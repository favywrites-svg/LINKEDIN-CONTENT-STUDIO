import { getReadyRepository } from "@/lib/db/repository";
import { CalendarGrid } from "@/components/calendar/calendar-grid";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const repo = await getReadyRepository();
  const drafts = repo.listDrafts({
    statuses: ["draft", "ready_for_review", "approved", "published"],
  });

  return <CalendarGrid drafts={drafts} />;
}
