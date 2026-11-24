import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getReadyRepository } from "@/lib/db/repository";
import { ResearchClient } from "@/components/research/research-client";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const repo = await getReadyRepository();
  const sources = repo.listResearchSources(false);
  const findings = repo.listResearchFindings(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Research"
        description="Capture primary sources (automatic URL check or manual entry), verify evidence, and synthesize findings."
        badge={
          <Badge variant="neutral">
            {sources.length} sources · {findings.length} findings
          </Badge>
        }
      />
      <ResearchClient initialSources={sources} initialFindings={findings} />
    </div>
  );
}
