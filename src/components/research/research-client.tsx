"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  BookOpen,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import type {
  ResearchFindingRecord,
  ResearchSourceRecord,
} from "@/lib/db/types";
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

export function ResearchClient({
  initialSources,
  initialFindings,
}: {
  initialSources: ResearchSourceRecord[];
  initialFindings: ResearchFindingRecord[];
}) {
  const router = useRouter();
  const [sources, setSources] = React.useState(initialSources);
  const [findings, setFindings] = React.useState(initialFindings);
  const [tab, setTab] = React.useState<"sources" | "findings">("sources");
  const [query, setQuery] = React.useState("");
  const [entryMode, setEntryMode] = React.useState<"url" | "manual">("url");

  // URL fetch state
  const [url, setUrl] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Offline manual source entry state
  const [manualTitle, setManualTitle] = React.useState("");
  const [manualPublisher, setManualPublisher] = React.useState("");
  const [manualUrl, setManualUrl] = React.useState("");
  const [manualType, setManualType] =
    React.useState<ResearchSourceRecord["sourceType"]>("primary");
  const [manualSummary, setManualSummary] = React.useState("");
  const [manualLimitations, setManualLimitations] = React.useState("");

  // AI / Manual synthesis state
  const [selectedSourceIds, setSelectedSourceIds] = React.useState<string[]>(
    []
  );
  const [synthesisQuestion, setSynthesisQuestion] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filteredSources = React.useMemo(() => {
    if (!query.trim()) return sources;
    const q = query.toLowerCase();
    return sources.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.publisher.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q)
    );
  }, [sources, query]);

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url", url: url.trim(), notes }),
      });
      const data = (await res.json()) as {
        source?: ResearchSourceRecord;
        error?: string;
      };
      if (!res.ok || !data.source) {
        setError(data.error || "Could not verify URL.");
        return;
      }
      setSources((prev) => [
        data.source!,
        ...prev.filter((s) => s.id !== data.source!.id),
      ]);
      setUrl("");
      setNotes("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleAddManualSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          title: manualTitle,
          publisher: manualPublisher,
          url: manualUrl,
          sourceType: manualType,
          summary: manualSummary,
          limitations: manualLimitations,
          verificationStatus: "checked",
        }),
      });
      const data = (await res.json()) as {
        source?: ResearchSourceRecord;
        error?: string;
      };
      if (!res.ok || !data.source) {
        setError(data.error || "Could not save manual source.");
        return;
      }
      setSources((prev) => [
        data.source!,
        ...prev.filter((s) => s.id !== data.source!.id),
      ]);
      setManualTitle("");
      setManualPublisher("");
      setManualUrl("");
      setManualSummary("");
      setManualLimitations("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!synthesisQuestion.trim() || selectedSourceIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "synthesize",
          question: synthesisQuestion.trim(),
          sourceIds: selectedSourceIds,
        }),
      });
      const data = (await res.json()) as {
        finding?: ResearchFindingRecord;
        error?: string;
      };
      if (!res.ok || !data.finding) {
        setError(data.error || "Synthesis failed.");
        return;
      }
      setFindings((prev) => [data.finding!, ...prev]);
      setSynthesisQuestion("");
      setSelectedSourceIds([]);
      setTab("findings");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleArchiveSource = async (id: string) => {
    const res = await fetch("/api/research", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "source", id, archive: true }),
    });
    if (res.ok) {
      setSources((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={tab === "sources" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("sources")}
          >
            Sources ({sources.length})
          </Button>
          <Button
            type="button"
            variant={tab === "findings" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("findings")}
          >
            Synthesized Findings ({findings.length})
          </Button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sources..."
            className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-xs text-foreground"
          />
        </div>
      </div>

      {/* Source Capture Card */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle>Capture Research Source</CardTitle>
            <CardDescription>
              Fetch & verify a live URL automatically, or enter a full manual
              record when offline or behind a login.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={entryMode === "url" ? "secondary" : "ghost"}
              onClick={() => setEntryMode("url")}
            >
              URL Fetch
            </Button>
            <Button
              type="button"
              size="sm"
              variant={entryMode === "manual" ? "secondary" : "ghost"}
              onClick={() => setEntryMode("manual")}
            >
              Manual Record
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entryMode === "url" ? (
            <form onSubmit={handleAddUrl} className="space-y-3">
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                />
                <Button type="submit" size="md" disabled={busy}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>Fetch & Verify</span>
                </Button>
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional evidence note..."
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
              />
            </form>
          ) : (
            <form onSubmit={handleAddManualSource} className="space-y-3">
              <div className="grid gap-2.5 sm:grid-cols-3">
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Source title"
                  className="h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
                />
                <input
                  type="text"
                  required
                  value={manualPublisher}
                  onChange={(e) => setManualPublisher(e.target.value)}
                  placeholder="Publisher / journal"
                  className="h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
                />
                <select
                  value={manualType}
                  onChange={(e) =>
                    setManualType(
                      e.target.value as ResearchSourceRecord["sourceType"]
                    )
                  }
                  className="h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
                >
                  <option value="primary">Primary documentation / guidance</option>
                  <option value="research">Original research / paper</option>
                  <option value="reporting">Credible reporting</option>
                  <option value="commentary">Practitioner commentary</option>
                </select>
              </div>
              <input
                type="url"
                required
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="Exact source URL (https://...)"
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
              />
              <textarea
                rows={3}
                required
                value={manualSummary}
                onChange={(e) => setManualSummary(e.target.value)}
                placeholder="Summary & exact evidence..."
                className="w-full rounded-lg border border-border bg-surface p-2.5 text-xs text-foreground"
              />
              <input
                type="text"
                value={manualLimitations}
                onChange={(e) => setManualLimitations(e.target.value)}
                placeholder="Limitations or caveats..."
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
              />
              <Button type="submit" size="sm" disabled={busy}>
                <Plus className="h-3.5 w-3.5" />
                <span>Save Manual Source</span>
              </Button>
            </form>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* AI Research Synthesis Bar when sources are checked */}
      {selectedSourceIds.length > 0 && (
        <Card className="border-accent">
          <CardContent className="pt-4">
            <form
              onSubmit={handleSynthesize}
              className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
            >
              <span className="shrink-0 text-xs font-medium text-foreground">
                {selectedSourceIds.length} source(s) selected:
              </span>
              <input
                type="text"
                required
                value={synthesisQuestion}
                onChange={(e) => setSynthesisQuestion(e.target.value)}
                placeholder="Question to synthesize (e.g. What workflow handoffs fail most in clinical AI?)"
                className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
              />
              <Button type="submit" size="sm" disabled={busy}>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Synthesize Finding</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === "sources" ? (
        filteredSources.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No matching research sources"
            description="Add a source above or run Generate This Week's Content on the Dashboard to populate primary literature automatically."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredSources.map((src) => {
              const selected = selectedSourceIds.includes(src.id);
              return (
                <Card key={src.id} className="flex flex-col justify-between">
                  <div>
                    <CardHeader className="space-y-2 pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              setSelectedSourceIds((prev) =>
                                prev.includes(src.id)
                                  ? prev.filter((x) => x !== src.id)
                                  : [...prev, src.id]
                              )
                            }
                          />
                          <Badge variant="neutral">{src.sourceType}</Badge>
                        </label>
                        <Badge
                          variant={
                            src.verificationStatus === "checked"
                              ? "success"
                              : "warning"
                          }
                        >
                          {src.verificationStatus}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm leading-snug">
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-accent hover:underline"
                        >
                          {src.title}{" "}
                          <ExternalLink className="inline h-3.5 w-3.5" />
                        </a>
                      </CardTitle>
                      <CardDescription>
                        {src.publisher}
                        {src.publicationDate
                          ? ` · Published ${src.publicationDate}`
                          : ""}{" "}
                        · Accessed {src.accessedAt.slice(0, 10)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                      <p>{src.summary}</p>
                      {src.evidenceNotes && (
                        <p className="text-foreground">
                          <strong>Notes:</strong> {src.evidenceNotes}
                        </p>
                      )}
                      {src.limitations && (
                        <p className="text-[11px] text-muted">
                          <strong>Limitations:</strong> {src.limitations}
                        </p>
                      )}
                    </CardContent>
                  </div>
                  <CardFooter className="justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchiveSource(src.id)}
                    >
                      <Archive className="h-3.5 w-3.5" />
                      <span>Archive</span>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )
      ) : findings.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="No synthesized findings yet"
          description="Select one or more verified sources in the Sources tab above to synthesize business implications, limitations, and LinkedIn angles."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {findings.map((f) => (
            <Card key={f.id}>
              <CardHeader>
                <CardTitle className="text-sm">{f.question}</CardTitle>
                <CardDescription>
                  Linked to {f.sourceIds.length} verified source(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <p>{f.summary}</p>
                <p>
                  <strong className="text-foreground">Business relevance:</strong>{" "}
                  {f.businessRelevance}
                </p>
                {f.implementationImplications && (
                  <p>
                    <strong className="text-foreground">Implementation:</strong>{" "}
                    {f.implementationImplications}
                  </p>
                )}
                {f.uncertainties && (
                  <p className="text-[11px] text-muted">
                    <strong>Uncertainties:</strong> {f.uncertainties}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
