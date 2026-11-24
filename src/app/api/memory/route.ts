import { NextResponse } from "next/server";
import { z } from "zod";
import { getReadyRepository, persistRepository } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

const CreateMemorySchema = z.object({
  category: z.enum([
    "prohibited_language",
    "writing_preference",
    "topic_preference",
    "professional_fact",
  ]),
  origin: z.enum(["explicit", "inferred", "temporary"]).optional(),
  pattern: z.string().min(1).max(300),
  ruleExplanation: z.string().max(500).optional(),
  confirmed: z.boolean().optional(),
  sourceDraftId: z.string().nullable().optional(),
});

const PatchMemorySchema = z.object({
  id: z.string().min(1),
  pattern: z.string().min(1).max(300).optional(),
  ruleExplanation: z.string().max(500).optional(),
  confirmed: z.boolean().optional(),
  active: z.boolean().optional(),
  origin: z.enum(["explicit", "inferred", "temporary"]).optional(),
});

export async function GET() {
  try {
    const repo = await getReadyRepository();
    const items = repo.listMemoryItems(false);
    const feedback = repo.listFeedbackEvents(25);
    const profile = repo.getAuthorProfile();
    return NextResponse.json({ items, feedback, profile });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load editorial memory.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = CreateMemorySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid phrase or preference." },
        { status: 400 }
      );
    }

    const repo = await getReadyRepository();
    const origin = parsed.data.origin ?? "explicit";
    const item = repo.addMemoryItem({
      category: parsed.data.category,
      origin,
      pattern: parsed.data.pattern,
      ruleExplanation:
        parsed.data.ruleExplanation?.trim() ||
        (parsed.data.category === "prohibited_language"
          ? "Flagged by Efe: never use this expression again."
          : "Explicit preference saved by Efe."),
      confirmed: parsed.data.confirmed ?? origin === "explicit",
      sourceDraftId: parsed.data.sourceDraftId ?? null,
    });

    await persistRepository(repo);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not save memory rule.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const raw = await request.json();
    const parsed = PatchMemorySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update payload." },
        { status: 400 }
      );
    }

    const repo = await getReadyRepository();
    const { id, ...patch } = parsed.data;
    const updated = repo.updateMemoryItem(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Rule not found." }, { status: 404 });
    }
    await persistRepository(repo);
    return NextResponse.json({ item: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update rule." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing rule id." }, { status: 400 });
    }
    const repo = await getReadyRepository();
    repo.deleteMemoryItem(id);
    await persistRepository(repo);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete rule." },
      { status: 500 }
    );
  }
}
