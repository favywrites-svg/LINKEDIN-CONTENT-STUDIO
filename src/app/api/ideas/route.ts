import { NextResponse } from "next/server";
import { z } from "zod";
import { getReadyRepository, persistRepository } from "@/lib/db/repository";
import { generateIdeasFromResearch } from "@/lib/workflows/weekly-generator";

export const dynamic = "force-dynamic";

const CreateIdeaSchema = z.object({
  mode: z.enum(["manual", "ai_generate"]).default("manual"),
  title: z.string().max(300).optional(),
  pillar: z
    .enum([
      "practical_business_problems",
      "project_builds",
      "industry_commentary",
      "human_reflections",
    ])
    .optional(),
  intendedAudience: z.string().max(300).optional(),
  problemOrOpportunity: z.string().max(1000).optional(),
  centralAngle: z.string().max(1000).optional(),
  expertiseDemonstrated: z.string().max(500).optional(),
  whySelected: z.string().max(500).optional(),
  authorInputNeeded: z.boolean().optional(),
  authorInputPrompt: z.string().max(500).optional(),
  authorInput: z.string().max(2000).optional(),
  healthcareRelevant: z.boolean().optional(),
  sourceIds: z.array(z.string()).optional(),
  count: z.number().int().min(1).max(5).optional(),
});

const PatchIdeaSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(300).optional(),
  pillar: z
    .enum([
      "practical_business_problems",
      "project_builds",
      "industry_commentary",
      "human_reflections",
    ])
    .optional(),
  problemOrOpportunity: z.string().max(1000).optional(),
  centralAngle: z.string().max(1000).optional(),
  authorInput: z.string().max(2000).optional(),
  authorInputStatus: z
    .enum(["not_needed", "requested", "supplied", "waived"])
    .optional(),
  status: z
    .enum(["idea", "in_progress", "drafted", "rejected", "archived"])
    .optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "true";
    const repo = await getReadyRepository();
    return NextResponse.json({ ideas: repo.listContentIdeas(includeArchived) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load ideas." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = CreateIdeaSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid idea payload." },
        { status: 400 }
      );
    }

    if (parsed.data.mode === "ai_generate") {
      const ideas = await generateIdeasFromResearch({
        sourceIds: parsed.data.sourceIds,
        count: parsed.data.count ?? 3,
      });
      return NextResponse.json({ ideas }, { status: 201 });
    }

    if (
      !parsed.data.title?.trim() ||
      !parsed.data.problemOrOpportunity?.trim() ||
      !parsed.data.centralAngle?.trim()
    ) {
      return NextResponse.json(
        { error: "Title, problem/opportunity, and central angle are required." },
        { status: 400 }
      );
    }

    const repo = await getReadyRepository();
    const idea = repo.createContentIdea({
      title: parsed.data.title.trim(),
      pillar: parsed.data.pillar ?? "practical_business_problems",
      intendedAudience:
        parsed.data.intendedAudience?.trim() ||
        "Operations managers, founders, and hiring managers",
      problemOrOpportunity: parsed.data.problemOrOpportunity.trim(),
      centralAngle: parsed.data.centralAngle.trim(),
      expertiseDemonstrated:
        parsed.data.expertiseDemonstrated?.trim() ||
        "Practical AI implementation and process evaluation",
      whySelected:
        parsed.data.whySelected?.trim() || "Manually added content opportunity",
      authorInputNeeded: Boolean(parsed.data.authorInputNeeded),
      authorInputPrompt:
        parsed.data.authorInputPrompt?.trim() ||
        (parsed.data.authorInputNeeded
          ? "Share your personal observation, project context, or opinion before drafting."
          : ""),
      authorInput: parsed.data.authorInput?.trim() || "",
      healthcareRelevant: Boolean(parsed.data.healthcareRelevant),
      sourceIds: parsed.data.sourceIds ?? [],
      actor: "user",
    });

    await persistRepository(repo);
    return NextResponse.json({ idea }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create idea." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const raw = await request.json();
    const parsed = PatchIdeaSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid idea update payload." },
        { status: 400 }
      );
    }

    const repo = await getReadyRepository();
    const { id, ...patch } = parsed.data;
    const updated = repo.updateContentIdea(id, { ...patch, actor: "user" });
    if (!updated) {
      return NextResponse.json({ error: "Idea not found." }, { status: 404 });
    }
    await persistRepository(repo);
    return NextResponse.json({ idea: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update idea." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing idea id." }, { status: 400 });
    }
    const repo = await getReadyRepository();
    repo.deleteContentIdea(id);
    await persistRepository(repo);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete idea." },
      { status: 500 }
    );
  }
}
