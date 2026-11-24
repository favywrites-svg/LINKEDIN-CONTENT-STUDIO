import { NextResponse } from "next/server";
import { z } from "zod";
import { getReadyRepository, persistRepository } from "@/lib/db/repository";
import type { ContentPillarId, WorkflowStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

const CreateDraftSchema = z.object({
  ideaId: z.string().optional(),
  bypassCheckpoint: z.boolean().optional(),
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).max(10000).optional(),
  pillar: z
    .enum([
      "practical_business_problems",
      "project_builds",
      "industry_commentary",
      "human_reflections",
    ])
    .optional(),
  intendedAudience: z.string().max(300).optional(),
  targetPublishDate: z.string().nullable().optional(),
  sourceIds: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const pillarParam = searchParams.get("pillar") as ContentPillarId | null;
    const search = searchParams.get("q") ?? undefined;
    const includeArchived = searchParams.get("includeArchived") === "true";

    const statuses = statusParam
      ? (statusParam.split(",") as WorkflowStatus[])
      : undefined;

    const repo = await getReadyRepository();
    const drafts = repo.listDrafts({
      statuses,
      pillar: pillarParam || undefined,
      search,
      includeArchived,
    });
    return NextResponse.json({ drafts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load drafts." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = CreateDraftSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid draft payload." },
        { status: 400 }
      );
    }

    const repo = await getReadyRepository();

    if (parsed.data.ideaId) {
      const converted = repo.convertIdeaToDraft(parsed.data.ideaId, {
        initialBody: parsed.data.body,
        bypassCheckpoint: parsed.data.bypassCheckpoint,
      });
      await persistRepository(repo);
      return NextResponse.json({ draft: converted }, { status: 201 });
    }

    if (!parsed.data.title || !parsed.data.body) {
      return NextResponse.json(
        { error: "Title and body are required when creating a manual draft." },
        { status: 400 }
      );
    }

    const created = repo.createContentDraft({
      weeklyPackageId: null,
      ideaId: null,
      slotIndex: 0,
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
      pillar: parsed.data.pillar ?? "practical_business_problems",
      intendedAudience:
        parsed.data.intendedAudience?.trim() ||
        "Operations leaders, founders, and hiring managers",
      hookStyle: "Manual opening",
      structureType: "Author structured",
      selectionRationale: "Created manually by Efe",
      status: "draft",
      qualityReview: null,
      missingAuthorInput: null,
      visualRecommendation: null,
      targetPublishDate: parsed.data.targetPublishDate ?? null,
      sourceIds: parsed.data.sourceIds ?? [],
      actor: "user",
    });

    await persistRepository(repo);
    return NextResponse.json({ draft: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create draft." },
      { status: 400 }
    );
  }
}
