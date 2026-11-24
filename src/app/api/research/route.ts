import { NextResponse } from "next/server";
import { z } from "zod";
import { getReadyRepository, persistRepository } from "@/lib/db/repository";
import { inspectUrlSource } from "@/lib/research/live-research";
import { synthesizeResearchFinding } from "@/lib/workflows/weekly-generator";

export const dynamic = "force-dynamic";

const PostResearchSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("url"),
    url: z.string().url(),
    notes: z.string().max(1500).optional(),
  }),
  z.object({
    mode: z.literal("manual"),
    title: z.string().min(1).max(300),
    publisher: z.string().min(1).max(200),
    url: z.string().url(),
    sourceType: z.enum([
      "primary",
      "research",
      "reporting",
      "commentary",
      "other",
    ]),
    publicationDate: z.string().nullable().optional(),
    summary: z.string().min(1).max(2000),
    keyFindings: z.string().max(2000).optional(),
    evidenceNotes: z.string().max(2000).optional(),
    limitations: z.string().max(1500).optional(),
    potentialAngles: z.string().max(1500).optional(),
    verificationStatus: z
      .enum(["unreviewed", "checked", "disputed", "outdated", "inaccessible"])
      .default("unreviewed"),
  }),
  z.object({
    mode: z.literal("manual_finding"),
    question: z.string().min(1).max(400),
    summary: z.string().min(1).max(2000),
    businessRelevance: z.string().min(1).max(1500),
    problemOrOpportunity: z.string().max(1500).optional(),
    implementationImplications: z.string().max(1500).optional(),
    uncertainties: z.string().max(1500).optional(),
    potentialAngles: z.string().max(1500).optional(),
    sourceIds: z.array(z.string()).default([]),
  }),
  z.object({
    mode: z.literal("synthesize"),
    question: z.string().min(3).max(400),
    sourceIds: z.array(z.string()).min(1),
  }),
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "true";
    const repo = await getReadyRepository();
    return NextResponse.json({
      sources: repo.listResearchSources(includeArchived),
      findings: repo.listResearchFindings(includeArchived),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load research library.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    // Backwards-compatible default mode = "url"
    const normalized = raw && !raw.mode && raw.url ? { ...raw, mode: "url" } : raw;
    const parsed = PostResearchSchema.safeParse(normalized);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid research payload." },
        { status: 400 }
      );
    }

    const repo = await getReadyRepository();

    if (parsed.data.mode === "url") {
      const inspected = await inspectUrlSource(parsed.data.url);
      if (parsed.data.notes?.trim()) {
        inspected.evidenceNotes = parsed.data.notes.trim();
      }
      const saved = repo.upsertResearchSource(inspected);
      await persistRepository(repo);
      return NextResponse.json({ source: saved }, { status: 201 });
    }

    if (parsed.data.mode === "manual") {
      const saved = repo.upsertResearchSource({
        title: parsed.data.title.trim(),
        publisher: parsed.data.publisher.trim(),
        url: parsed.data.url.trim(),
        sourceType: parsed.data.sourceType,
        publicationDate: parsed.data.publicationDate || null,
        accessedAt: new Date().toISOString(),
        summary: parsed.data.summary.trim(),
        keyFindings:
          parsed.data.keyFindings?.trim() || parsed.data.summary.trim(),
        evidenceNotes: parsed.data.evidenceNotes?.trim() || "",
        limitations:
          parsed.data.limitations?.trim() ||
          "Manual entry; verify primary scope before quoting statistics.",
        potentialAngles: parsed.data.potentialAngles?.trim() || "",
        verificationStatus: parsed.data.verificationStatus,
      });
      await persistRepository(repo);
      return NextResponse.json({ source: saved }, { status: 201 });
    }

    if (parsed.data.mode === "manual_finding") {
      const finding = repo.createResearchFinding({
        question: parsed.data.question.trim(),
        summary: parsed.data.summary.trim(),
        businessRelevance: parsed.data.businessRelevance.trim(),
        problemOrOpportunity: parsed.data.problemOrOpportunity?.trim() || "",
        implementationImplications:
          parsed.data.implementationImplications?.trim() || "",
        uncertainties: parsed.data.uncertainties?.trim() || "",
        potentialAngles: parsed.data.potentialAngles?.trim() || "",
        status: "new",
        sourceIds: parsed.data.sourceIds,
      });
      await persistRepository(repo);
      return NextResponse.json({ finding }, { status: 201 });
    }

    const finding = await synthesizeResearchFinding({
      question: parsed.data.question.trim(),
      sourceIds: parsed.data.sourceIds,
      repo,
    });
    await persistRepository(repo);
    return NextResponse.json({ finding }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not save research record.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const raw = (await request.json()) as {
      entity?: "source" | "finding";
      id?: string;
      archive?: boolean;
      restore?: boolean;
      verificationStatus?:
        | "unreviewed"
        | "checked"
        | "disputed"
        | "outdated"
        | "inaccessible";
      evidenceNotes?: string;
      limitations?: string;
    };

    if (!raw.id) {
      return NextResponse.json({ error: "Missing record id." }, { status: 400 });
    }

    const repo = await getReadyRepository();
    if (raw.entity === "finding") {
      const updated = repo.updateResearchFinding(raw.id, {
        status: raw.archive ? "archived" : raw.restore ? "reviewed" : undefined,
      });
      await persistRepository(repo);
      return NextResponse.json({ finding: updated });
    }

    const updated = repo.updateResearchSource(raw.id, {
      archivedAt: raw.archive
        ? new Date().toISOString()
        : raw.restore
          ? null
          : undefined,
      verificationStatus: raw.verificationStatus,
      evidenceNotes: raw.evidenceNotes,
      limitations: raw.limitations,
    });
    await persistRepository(repo);
    return NextResponse.json({ source: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing source id." }, { status: 400 });
    }
    const repo = await getReadyRepository();
    repo.deleteResearchSource(id);
    await persistRepository(repo);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed." },
      { status: 500 }
    );
  }
}
