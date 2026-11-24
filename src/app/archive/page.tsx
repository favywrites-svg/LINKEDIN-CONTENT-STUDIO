import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getReadyRepository } from "@/lib/db/repository";
import { ArchiveClient } from "@/components/archive/archive-client";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const repo = await getReadyRepository();
  const archivedDrafts = repo.listDrafts({
    statuses: ["rejected", "archived"],
    includeArchived: true,
  });
  const archivedIdeas = repo
    .listContentIdeas(true)
    .filter((i) => i.status === "archived" || i.status === "rejected");
  const archivedSources = repo
    .listResearchSources(true)
    .filter((s) => Boolean(s.archivedAt));

  const total =
    archivedDrafts.length + archivedIdeas.length + archivedSources.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Archive"
        description="Restore or permanently delete archived drafts, ideas, and research sources."
        badge={<Badge variant="neutral">{total} items</Badge>}
      />
      <ArchiveClient
        archivedDrafts={archivedDrafts}
        archivedIdeas={archivedIdeas}
        archivedSources={archivedSources}
      />
    </div>
  );
}
