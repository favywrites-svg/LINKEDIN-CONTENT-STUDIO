import { NextResponse } from "next/server";
import { getReadyRepository } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") === "markdown" ? "markdown" : "json";
    const repo = await getReadyRepository();
    const snapshot = repo.exportWorkspaceSnapshot();

    if (format === "markdown") {
      const lines: string[] = [
        `# LinkedIn Content Assistant Backup (${snapshot.authorProfile.preferredName})`,
        `Exported at: ${snapshot.exportedAt}`,
        "",
        `## Positioning`,
        snapshot.authorProfile.positioning,
        "",
        `## Editorial Memory (${snapshot.editorialMemory.length} rules)`,
        ...snapshot.editorialMemory.map(
          (m) =>
            `- **[${m.category} | ${m.origin}${m.confirmed ? "" : " - unconfirmed"}]** \`${m.pattern}\`: ${m.ruleExplanation}`
        ),
        "",
        `## Content Drafts (${snapshot.contentDrafts.length})`,
        ...snapshot.contentDrafts.flatMap((d) => [
          `### ${d.title} (${d.status} · ${d.pillar})`,
          "",
          d.body,
          "",
        ]),
        `## Research Sources (${snapshot.researchSources.length})`,
        ...snapshot.researchSources.map(
          (s) => `- [${s.title}](${s.url}) (${s.publisher}, ${s.verificationStatus})`
        ),
      ];

      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="linkedin-assistant-backup-${snapshot.exportedAt.slice(0, 10)}.md"`,
        },
      });
    }

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="linkedin-assistant-backup-${snapshot.exportedAt.slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed." },
      { status: 500 }
    );
  }
}
