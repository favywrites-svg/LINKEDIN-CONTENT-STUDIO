"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Copy, FilePenLine } from "lucide-react";
import type { ContentDraftRecord } from "@/lib/db/types";
import { WORKFLOW_STATUS_LABELS, getPillarById } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function ApprovedClient({
  initialDrafts,
}: {
  initialDrafts: ContentDraftRecord[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState(initialDrafts);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = async (draft: ContentDraftRecord) => {
    await navigator.clipboard.writeText(draft.body);
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMarkPublished = async (draftId: string) => {
    const res = await fetch(`/api/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    if (res.ok) {
      const data = (await res.json()) as { draft: ContentDraftRecord };
      setDrafts((prev) =>
        prev.map((d) => (d.id === draftId ? data.draft : d))
      );
      router.refresh();
    }
  };

  if (drafts.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="No approved posts yet"
        description="Approve posts from your weekly package or Writing Studio. They'll appear here ready for one-click copy and manual LinkedIn publishing."
        action={
          <Link
            href="/drafts"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            <FilePenLine className="h-4 w-4 text-muted" />
            <span>Review Drafts</span>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {drafts.map((draft) => {
        const pillar = getPillarById(draft.pillar);
        return (
          <Card key={draft.id} className="flex flex-col justify-between">
            <div>
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="accent">{pillar.shortName}</Badge>
                  <Badge variant="success">
                    {WORKFLOW_STATUS_LABELS[draft.status]}
                  </Badge>
                </div>
                <CardTitle className="text-base">{draft.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap rounded-lg border border-border bg-surface-subtle/50 p-3.5 text-sm leading-relaxed text-foreground">
                  {draft.body}
                </div>
              </CardContent>
            </div>
            <CardFooter className="flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(draft)}
              >
                {copiedId === draft.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copied for LinkedIn</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Post Text</span>
                  </>
                )}
              </Button>
              {draft.status === "approved" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleMarkPublished(draft.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Mark Manually Published</span>
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
