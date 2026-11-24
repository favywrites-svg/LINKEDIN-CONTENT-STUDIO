"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  FilePenLine,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  CONTENT_PILLARS,
  WORKFLOW_STATUS_LABELS,
  getPillarById,
  type ContentPillarId,
} from "@/lib/constants";
import type { ContentDraftRecord } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function DraftsClient({
  initialDrafts,
}: {
  initialDrafts: ContentDraftRecord[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState(initialDrafts);
  const [query, setQuery] = React.useState("");
  const [pillarFilter, setPillarFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const [showNewForm, setShowNewForm] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newPillar, setNewPillar] = React.useState<ContentPillarId>(
    "practical_business_problems"
  );
  const [newBody, setNewBody] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  );

  const filtered = React.useMemo(() => {
    return drafts.filter((d) => {
      if (pillarFilter !== "all" && d.pillar !== pillarFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !d.title.toLowerCase().includes(q) &&
          !d.body.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [drafts, pillarFilter, statusFilter, query]);

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          pillar: newPillar,
          body: newBody.trim(),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { draft: ContentDraftRecord };
        router.push(`/drafts/${data.draft.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (id: string) => {
    const res = await fetch(`/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    if (res.ok) {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      router.refresh();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/drafts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setConfirmDeleteId(null);
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-60 flex-1 max-w-sm">
            <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drafts..."
              className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-3.5 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>

          <select
            value={pillarFilter}
            onChange={(e) => setPillarFilter(e.target.value)}
            aria-label="Filter by content pillar"
            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
          >
            <option value="all">All Pillars</option>
            {CONTENT_PILLARS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.shortName}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by workflow status"
            className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="ready_for_review">Ready for Review</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        <Button
          type="button"
          variant={showNewForm ? "secondary" : "default"}
          size="md"
          onClick={() => setShowNewForm((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          <span>{showNewForm ? "Close" : "New Draft"}</span>
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardHeader>
            <CardTitle>Write a Draft From Scratch</CardTitle>
            <CardDescription>
              Start a post in your own words and open it in the editor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateManual} className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title..."
                  className="h-10 rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground"
                />
                <select
                  value={newPillar}
                  onChange={(e) =>
                    setNewPillar(e.target.value as ContentPillarId)
                  }
                  className="h-10 rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground"
                >
                  {CONTENT_PILLARS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.shortName}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                rows={5}
                required
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Write your post..."
                className="w-full rounded-xl border border-border bg-surface p-4 text-base text-foreground"
              />
              <Button type="submit" size="md" disabled={creating}>
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FilePenLine className="h-4 w-4" />
                )}
                <span>Create &amp; Open</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FilePenLine className="h-5 w-5" />}
          title="No matching drafts"
          description="Generate posts from your Dashboard or click New Draft above."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((draft) => {
            const pillar = getPillarById(draft.pillar);
            const words = draft.body.trim().split(/\s+/).filter(Boolean).length;
            return (
              <Card key={draft.id} className="flex flex-col justify-between">
                <div>
                  <CardHeader className="space-y-2.5 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="accent">{pillar.shortName}</Badge>
                      <Badge
                        variant={
                          draft.status === "approved" ? "success" : "neutral"
                        }
                      >
                        {WORKFLOW_STATUS_LABELS[draft.status]}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{draft.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {draft.body}
                    </p>
                  </CardContent>
                </div>
                <CardFooter className="gap-2">
                  <span className="text-xs text-muted">{words} words</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleArchive(draft.id)}
                      title="Archive draft"
                      aria-label="Archive draft"
                      className="h-9 w-9 text-muted"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>

                    {confirmDeleteId === draft.id ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(draft.id)}
                      >
                        Delete?
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDeleteId(draft.id)}
                        title="Delete draft"
                        aria-label="Delete draft"
                        className="h-9 w-9 text-muted hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}

                    <Link
                      href={`/drafts/${draft.id}`}
                      prefetch={true}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover"
                    >
                      <FilePenLine className="h-4 w-4" />
                      <span>Open</span>
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
