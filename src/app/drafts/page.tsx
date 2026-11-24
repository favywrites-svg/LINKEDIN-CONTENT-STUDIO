import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getReadyRepository } from "@/lib/db/repository";
import { DraftsClient } from "@/components/drafts/drafts-client";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const repo = await getReadyRepository();
  const drafts = repo.listDrafts({
    statuses: ["draft", "ready_for_review", "approved"],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drafts"
        description="Search, filter, create manual drafts, or open generated weekly posts in the Writing Studio."
        badge={<Badge variant="neutral">{drafts.length} active</Badge>}
      />
      <DraftsClient initialDrafts={drafts} />
    </div>
  );
}
