import { NextResponse } from "next/server";
import { z } from "zod";
import { getReadyRepository, persistRepository } from "@/lib/db/repository";
import { runDeterministicQualityReview } from "@/lib/editorial/guardrails";

export const dynamic = "force-dynamic";

const PatchDraftSchema = z.object({
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
  status: z
    .enum([
      "draft",
      "ready_for_review",
      "approved",
      "published",
      "rejected",
      "archived",
    ])
    .optional(),
  revisionNote: z.string().max(500).optional(),
  targetPublishDate: z.string().nullable().optional(),
  sourceIds: z.array(z.string()).optional(),
  runQualityCheck: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const repo = await getReadyRepository();
    const draft = repo.getDraftById(id);
    if (!draft) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }
    const revisions = repo.listDraftRevisions(id);
    return NextResponse.json({ draft, revisions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load draft." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const raw = await request.json();
    const parsed = PatchDraftSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid draft update payload." },
        { status: 400 }
      );
    }

    const repo = await getReadyRepository();
    const existing = repo.getDraftById(id);
    if (!existing) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    const effectiveTitle = parsed.data.title ?? existing.title;
    const effectiveBody = parsed.data.body ?? existing.body;
    const effectiveSources = parsed.data.sourceIds ?? existing.sourceIds;

    let nextQuality = existing.qualityReview;
    if (parsed.data.body !== undefined || parsed.data.runQualityCheck) {
      const memory = repo.listMemoryItems(true);
      const allDrafts = repo.listDrafts({ includeArchived: false });
      nextQuality = runDeterministicQualityReview({
        title: effectiveTitle,
        body: effectiveBody,
        sourceCount: effectiveSources.length,
        memoryItems: memory,
        priorDrafts: allDrafts,
        currentDraftId: id,
      });
    }

    const updated = repo.updateDraft(id, {
      title: parsed.data.title,
      body: parsed.data.body,
      pillar: parsed.data.pillar,
      status: parsed.data.status,
      revisionNote: parsed.data.revisionNote,
      targetPublishDate: parsed.data.targetPublishDate,
      sourceIds: parsed.data.sourceIds,
      qualityReview: nextQuality,
      actor: "user",
    });
    const revisions = repo.listDraftRevisions(id);
    await persistRepository(repo);

    return NextResponse.json({ draft: updated, revisions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update draft." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const repo = await getReadyRepository();
    repo.deleteDraft(id);
    await persistRepository(repo);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete draft." },
      { status: 500 }
    );
  }
}
