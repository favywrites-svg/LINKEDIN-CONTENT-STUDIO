import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getReadyRepository } from "@/lib/db/repository";
import { IdeasClient } from "@/components/ideas/ideas-client";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const repo = await getReadyRepository();
  const ideas = repo.listContentIdeas(false);
  const sources = repo.listResearchSources(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Ideas"
        description="Review proposed opportunities, add manual ideas, complete Author Input Checkpoints, and convert ideas into linked drafts."
        badge={<Badge variant="neutral">{ideas.length} ideas</Badge>}
      />
      <IdeasClient initialIdeas={ideas} sources={sources} />
    </div>
  );
}
