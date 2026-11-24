import { getReadyRepository } from "@/lib/db/repository";
import { getEffectiveRuntimeStatus } from "@/lib/env-store";
import { WeeklyWorkspace } from "@/components/dashboard/weekly-workspace";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const repo = await getReadyRepository();
  const runtime = getEffectiveRuntimeStatus();

  const packages = repo.listWeeklyPackages(5);
  const latestPackage = packages[0] ?? null;

  const allIdeas = repo.listContentIdeas(false);
  const latestTopics = latestPackage
    ? allIdeas.filter((i) => i.weeklyPackageId === latestPackage.id)
    : allIdeas.slice(0, 4);

  const recentDrafts = repo.listDrafts({ includeArchived: false });

  return (
    <WeeklyWorkspace
      aiConfigured={runtime.aiConfigured}
      initialPackage={latestPackage}
      initialTopics={latestTopics}
      recentDrafts={recentDrafts}
    />
  );
}
