import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getReadyRepository } from "@/lib/db/repository";
import { MemoryClient } from "@/components/memory/memory-client";

export const dynamic = "force-dynamic";

export default async function EditorialMemoryPage() {
  const repo = await getReadyRepository();
  const items = repo.listMemoryItems(false);
  const profile = repo.getAuthorProfile();
  const feedback = repo.listFeedbackEvents(20);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Writing Preferences & Editorial Memory"
        description="Transparent, editable memory of your writing preferences, prohibited words/expressions, and verified professional facts."
        badge={<Badge variant="accent">{items.length} active rules</Badge>}
      />
      <MemoryClient
        initialItems={items}
        profile={profile}
        feedback={feedback}
      />
    </div>
  );
}
