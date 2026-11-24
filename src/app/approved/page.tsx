import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getReadyRepository } from "@/lib/db/repository";
import { ApprovedClient } from "@/components/approved/approved-client";

export const dynamic = "force-dynamic";

export default async function ApprovedPage() {
  const repo = await getReadyRepository();
  const drafts = repo.listDrafts({ statuses: ["approved", "published"] });
  const approvedCount = drafts.filter((d) => d.status === "approved").length;
  const publishedCount = drafts.filter((d) => d.status === "published").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approved"
        description="Explicitly approved posts ready to copy and publish manually on LinkedIn, alongside your published history."
        badge={
          <Badge variant="success">
            {approvedCount} approved · {publishedCount} published
          </Badge>
        }
      />

      <Card>
        <CardContent className="flex items-start gap-3 py-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">
              Manual publishing only:
            </strong>{" "}
            Copy the approved post text below, paste and publish on LinkedIn
            yourself, then mark it Published so future weekly runs avoid
            repeating the topic.
          </p>
        </CardContent>
      </Card>

      <ApprovedClient initialDrafts={drafts} />
    </div>
  );
}
