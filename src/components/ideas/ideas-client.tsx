"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  Lightbulb,
  Loader2,
  MessageSquareQuote,
  Plus,
  Search,
  Sparkles,
  ThumbsDown,
} from "lucide-react";
import {
  CONTENT_PILLARS,
  getPillarById,
  type ContentPillarId,
} from "@/lib/constants";
import type { ContentIdeaRecord, ResearchSourceRecord } from "@/lib/db/types";
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

export function IdeasClient({
  initialIdeas,
  sources,
}: {
  initialIdeas: ContentIdeaRecord[];
  sources: ResearchSourceRecord[];
}) {
  const router = useRouter();
  const [ideas, setIdeas] = React.useState(initialIdeas);
  const [query, setQuery] = React.useState("");
  const [pillarFilter, setPillarFilter] = React.useState("all");
  const [showForm, setShowForm] = React.useState(false);

  // Manual idea fields
  const [title, setTitle] = React.useState("");
  const [pillar, setPillar] = React.useState<ContentPillarId>(
    "practical_business_problems"
  );
  const [audience, setAudience] = React.useState("");
  const [problem, setProblem] = React.useState("");
  const [angle, setAngle] = React.useState("");
  const [needsInput, setNeedsInput] = React.useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = React.useState<string[]>(
    []
  );

  // Author checkpoint inputs per idea
  const [checkpointInputs, setCheckpointInputs] = React.useState<
    Record<string, string>
  >({});

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    return ideas.filter((i) => {
      if (pillarFilter !== "all" && i.pillar !== pillarFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !i.title.toLowerCase().includes(q) &&
          !i.problemOrOpportunity.toLowerCase().includes(q) &&
          !i.centralAngle.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [ideas, pillarFilter, query]);

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          title,
          pillar,
          intendedAudience: audience,
          problemOrOpportunity: problem,
          centralAngle: angle,
          authorInputNeeded: needsInput,
          sourceIds: selectedSourceIds,
        }),
      });
      const data = (await res.json()) as {
        idea?: ContentIdeaRecord;
        error?: string;
      };
      if (!res.ok || !data.idea) {
        setError(data.error || "Could not create idea.");
        return;
      }
      setIdeas((prev) => [data.idea!, ...prev]);
      setTitle("");
      setAudience("");
      setProblem("");
      setAngle("");
      setNeedsInput(false);
      setSelectedSourceIds([]);
      setShowForm(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleAIGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ai_generate", count: 3 }),
      });
      const data = (await res.json()) as {
        ideas?: ContentIdeaRecord[];
        error?: string;
      };
      if (!res.ok || !data.ideas) {
        setError(data.error || "AI idea generation failed.");
        return;
      }
      setIdeas((prev) => [...data.ideas!, ...prev]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSupplyAuthorInput = async (
    ideaId: string,
    waive = false
  ) => {
    const supplied = checkpointInputs[ideaId]?.trim() ?? "";
    const res = await fetch("/api/ideas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: ideaId,
        authorInput: waive ? "" : supplied,
        authorInputStatus: waive ? "waived" : "supplied",
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { idea: ContentIdeaRecord };
      setIdeas((prev) => prev.map((i) => (i.id === ideaId ? data.idea : i)));
    }
  };

  const handleConvertToDraft = async (ideaId: string) => {
    setError(null);
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaId }),
    });
    const data = (await res.json()) as {
      draft?: { id: string };
      error?: string;
    };
    if (!res.ok || !data.draft) {
      setError(data.error || "Could not convert idea to draft.");
      return;
    }
    router.push(`/drafts/${data.draft.id}`);
  };

  const handleStatusChange = async (
    id: string,
    status: ContentIdeaRecord["status"]
  ) => {
    const res = await fetch("/api/ideas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      if (status === "archived") {
        setIdeas((prev) => prev.filter((i) => i.id !== id));
      } else {
        const data = (await res.json()) as { idea: ContentIdeaRecord };
        setIdeas((prev) => prev.map((i) => (i.id === id ? data.idea : i)));
      }
      router.refresh();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1 max-w-sm">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ideas..."
              className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs text-foreground"
            />
          </div>
          <select
            value={pillarFilter}
            onChange={(e) => setPillarFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs text-foreground"
          >
            <option value="all">All Pillars</option>
            {CONTENT_PILLARS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.shortName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={handleAIGenerate}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-accent" />
            )}
            <span>AI Propose Ideas</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-4 w-4" />
            <span>{showForm ? "Close" : "New Idea"}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300/70 bg-red-50 px-4 py-2.5 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add a Content Opportunity Manually</CardTitle>
            <CardDescription>
              Capture the problem, reader, central angle, linked research, and
              whether personal input is required before drafting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateManual} className="space-y-3">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Working title"
                  className="h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
                />
                <select
                  value={pillar}
                  onChange={(e) => setPillar(e.target.value as ContentPillarId)}
                  className="h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
                >
                  {CONTENT_PILLARS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.shortName}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Intended audience (e.g. Operations managers & founders)"
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
              />
              <textarea
                rows={2}
                required
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="Problem or opportunity addressed..."
                className="w-full rounded-lg border border-border bg-surface p-2.5 text-xs text-foreground"
              />
              <textarea
                rows={2}
                required
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                placeholder="Central angle / perspective..."
                className="w-full rounded-lg border border-border bg-surface p-2.5 text-xs text-foreground"
              />

              {sources.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Link Research Sources
                  </p>
                  <div className="max-h-28 space-y-1 overflow-y-auto rounded border border-border p-2">
                    {sources.slice(0, 8).map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSourceIds.includes(s.id)}
                          onChange={() =>
                            setSelectedSourceIds((prev) =>
                              prev.includes(s.id)
                                ? prev.filter((x) => x !== s.id)
                                : [...prev, s.id]
                            )
                          }
                        />
                        <span className="truncate">{s.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={needsInput}
                  onChange={(e) => setNeedsInput(e.target.checked)}
                />
                <span>
                  Require Author Input Checkpoint before converting to a draft
                </span>
              </label>

              <Button type="submit" size="sm" disabled={busy}>
                <Plus className="h-3.5 w-3.5" />
                <span>Save Idea</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="h-5 w-5" />}
          title="No matching content ideas"
          description="Generate a weekly package on your Dashboard, click AI Propose Ideas, or add a manual opportunity above."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((idea) => {
            const p = getPillarById(idea.pillar);
            const blockedByCheckpoint =
              idea.authorInputNeeded && idea.authorInputStatus === "requested";

            return (
              <Card key={idea.id} className="flex flex-col justify-between">
                <div>
                  <CardHeader className="space-y-2 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="accent">{p.shortName}</Badge>
                      <div className="flex items-center gap-1.5">
                        {idea.healthcareRelevant && (
                          <Badge variant="info">Health / Pharma</Badge>
                        )}
                        <Badge variant="neutral">{idea.status}</Badge>
                      </div>
                    </div>
                    <CardTitle className="text-base">{idea.title}</CardTitle>
                    <CardDescription>
                      <strong>Reader:</strong> {idea.intendedAudience}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
                    <p>
                      <strong className="text-foreground">Problem:</strong>{" "}
                      {idea.problemOrOpportunity}
                    </p>
                    <p>
                      <strong className="text-foreground">Angle:</strong>{" "}
                      {idea.centralAngle}
                    </p>
                    <p>
                      <strong className="text-foreground">
                        Linked sources:
                      </strong>{" "}
                      {idea.sourceIds.length}
                    </p>

                    {blockedByCheckpoint && (
                      <div className="space-y-2 rounded-lg border border-amber-300/80 bg-amber-50/80 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                        <div className="flex items-start gap-2">
                          <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                          <div>
                            <p className="font-semibold text-foreground">
                              Author Input Checkpoint Required
                            </p>
                            <p className="text-muted-foreground">
                              {idea.authorInputPrompt ||
                                "Share your personal experience or opinion before drafting."}
                            </p>
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          value={checkpointInputs[idea.id] ?? ""}
                          onChange={(e) =>
                            setCheckpointInputs((prev) => ({
                              ...prev,
                              [idea.id]: e.target.value,
                            }))
                          }
                          placeholder="Your confirmed input..."
                          className="w-full rounded border border-border bg-surface p-2 text-xs text-foreground"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!(checkpointInputs[idea.id]?.trim())}
                            onClick={() => handleSupplyAuthorInput(idea.id)}
                          >
                            Save Input
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleSupplyAuthorInput(idea.id, true)
                            }
                          >
                            Use Non-Personal Angle
                          </Button>
                        </div>
                      </div>
                    )}

                    {idea.authorInput && (
                      <p className="rounded bg-surface-subtle p-2 text-foreground">
                        <strong>Your supplied input:</strong> {idea.authorInput}
                      </p>
                    )}
                  </CardContent>
                </div>

                <CardFooter className="gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleStatusChange(idea.id, "rejected")}
                      title="Reject idea"
                      className="h-8 w-8 text-muted hover:text-red-600"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleStatusChange(idea.id, "archived")}
                      title="Archive idea"
                      className="h-8 w-8 text-muted"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {idea.status !== "drafted" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={blockedByCheckpoint}
                      onClick={() => handleConvertToDraft(idea.id)}
                    >
                      <span>Convert to Draft</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
