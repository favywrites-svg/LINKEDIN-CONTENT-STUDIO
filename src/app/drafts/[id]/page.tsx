import { notFound } from "next/navigation";
import { getReadyRepository } from "@/lib/db/repository";
import { WritingStudio } from "@/components/drafts/writing-studio";

export const dynamic = "force-dynamic";

export default async function DraftStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getReadyRepository();
  const draft = repo.getDraftById(id);
  if (!draft) {
    notFound();
  }
  const revisions = repo.listDraftRevisions(id);
  const availableSources = repo.listResearchSources(false);

  return (
    <WritingStudio
      initialDraft={draft}
      initialRevisions={revisions}
      availableSources={availableSources}
    />
  );
}
