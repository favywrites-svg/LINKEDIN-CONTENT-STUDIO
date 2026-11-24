"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import type {
  ContentDraftRecord,
  ContentIdeaRecord,
  ResearchSourceRecord,
} from "@/lib/db/types";
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

export function ArchiveClient({
  archivedDrafts,
  archivedIdeas,
  archivedSources,
}: {
  archivedDrafts: ContentDraftRecord[];
  archivedIdeas: ContentIdeaRecord[];
  archivedSources: ResearchSourceRecord[];
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<
    "all" | "drafts" | "ideas" | "research"
  >("all");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  );

  const handleRestoreDraft = async (id: string) => {
    await fetch(`/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    router.refresh();
  };

  const handleDeleteDraft = async (id: string) => {
    await fetch(`/api/drafts/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    router.refresh();
  };

  const handleRestoreIdea = async (id: string) => {
    await fetch("/api/ideas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "idea" }),
    });
    router.refresh();
  };

  const handleDeleteIdea = async (id: string) => {
    await fetch(`/api/ideas?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setConfirmDeleteId(null);
    router.refresh();
  };

  const handleRestoreSource = async (id: string) => {
    await fetch("/api/research", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "source", id, restore: true }),
    });
    router.refresh();
  };

  const handleDeleteSource = async (id: string) => {
    await fetch(`/api/research?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setConfirmDeleteId(null);
    router.refresh();
  };

  const totalCount =
    archivedDrafts.length + archivedIdeas.length + archivedSources.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: "all", label: `All (${totalCount})` },
            { id: "drafts", label: `Drafts (${archivedDrafts.length})` },
            { id: "ideas", label: `Ideas (${archivedIdeas.length})` },
            { id: "research", label: `Research (${archivedSources.length})` },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.id}
            type="button"
            size="sm"
            variant={filter === tab.id ? "default" : "outline"}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {totalCount === 0 ? (
        <EmptyState
          icon={<Archive className="h-5 w-5" />}
          title="Archive is empty"
          description="Archived or rejected drafts, ideas, and research sources appear here so you can restore or permanently delete them."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(filter === "all" || filter === "drafts") &&
            archivedDrafts.map((d) => (
              <Card key={d.id} className="flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="neutral">Draft · {d.status}</Badge>
                  </div>
                  <CardTitle className="text-sm">{d.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {d.body}
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRestoreDraft(d.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore</span>
                  </Button>
                  {confirmDeleteId === d.id ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteDraft(d.id)}
                    >
                      Confirm Delete
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDeleteId(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}

          {(filter === "all" || filter === "ideas") &&
            archivedIdeas.map((i) => (
              <Card key={i.id} className="flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <Badge variant="neutral">Idea · {i.status}</Badge>
                  <CardTitle className="text-sm">{i.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {i.centralAngle}
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRestoreIdea(i.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore</span>
                  </Button>
                  {confirmDeleteId === i.id ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteIdea(i.id)}
                    >
                      Confirm Delete
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDeleteId(i.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}

          {(filter === "all" || filter === "research") &&
            archivedSources.map((s) => (
              <Card key={s.id} className="flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <Badge variant="neutral">Research Source</Badge>
                  <CardTitle className="text-sm">{s.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {s.summary}
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRestoreSource(s.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore</span>
                  </Button>
                  {confirmDeleteId === s.id ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteSource(s.id)}
                    >
                      Confirm Delete
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDeleteId(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
