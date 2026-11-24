"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Eye,
  ExternalLink,
  FilePenLine,
  History,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  AUTHOR_NAME,
  WORKFLOW_STATUS_LABELS,
  getPillarById,
} from "@/lib/constants";
import type {
  ContentDraftRecord,
  DraftRevisionRecord,
  ResearchSourceRecord,
} from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface WritingStudioProps {
  initialDraft: ContentDraftRecord;
  initialRevisions: DraftRevisionRecord[];
  availableSources: ResearchSourceRecord[];
}

const QUICK_REVISION_CHIPS = [
  "Rewrite in simpler, everyday words (no big jargon)",
  "Make it shorter and easier to read",
  "Make it sound warmer and more conversational",
  "Give it a clearer, simpler first line",
  "Add a simple real-world work example",
];

const LINKEDIN_FOLD_CHAR_LIMIT = 210;

export function WritingStudio({
  initialDraft,
  initialRevisions,
  availableSources,
}: WritingStudioProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(initialDraft);
  const [revisions, setRevisions] = React.useState(initialRevisions);
  const [title, setTitle] = React.useState(initialDraft.title);
  const [body, setBody] = React.useState(initialDraft.body);
  const [targetDate, setTargetDate] = React.useState(
    initialDraft.targetPublishDate ?? ""
  );
  const [viewMode, setViewMode] = React.useState<"edit" | "linkedin_preview">(
    "edit"
  );
  const [previewExpanded, setPreviewExpanded] = React.useState(false);

  const [selectedPhrase, setSelectedPhrase] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<
    "revise" | "sources" | "qa" | "history"
  >("revise");

  const [revisionPrompt, setRevisionPrompt] = React.useState("");
  const [saveAsRule, setSaveAsRule] = React.useState(false);
  const [authorInputText, setAuthorInputText] = React.useState(
    initialDraft.missingAuthorInput?.suppliedAnswer ??
      initialDraft.authorInputUsed ??
      ""
  );

  // Non-destructive AI revision diff preview state
  const [proposedDiff, setProposedDiff] = React.useState<{
    title: string;
    body: string;
    note: string;
  } | null>(null);

  // Explicit Approval Confirmation modal state
  const [confirmApproveOpen, setConfirmApproveOpen] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [autoSaveLabel, setAutoSaveLabel] = React.useState<string | null>(null);
  const [regenerating, setRegenerating] = React.useState(false);
  const [runningQa, setRunningQa] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const wordCount = React.useMemo(
    () => body.trim().split(/\s+/).filter(Boolean).length,
    [body]
  );

  const hasUnsavedEdits =
    title !== draft.title ||
    body !== draft.body ||
    (targetDate || null) !== draft.targetPublishDate;

  // Debounced auto-save so user-entered edits are never lost
  React.useEffect(() => {
    if (!hasUnsavedEdits) return;
    setAutoSaveLabel("Unsaved edits...");
    const timer = setTimeout(async () => {
      try {
        setAutoSaveLabel("Auto-saving...");
        const res = await fetch(`/api/drafts/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            body,
            targetPublishDate: targetDate || null,
            revisionNote: "Auto-saved editor snapshot",
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            draft: ContentDraftRecord;
            revisions: DraftRevisionRecord[];
          };
          setDraft(data.draft);
          setRevisions(data.revisions);
          setAutoSaveLabel("Auto-saved");
        }
      } catch {
        setAutoSaveLabel("Offline — keep tab open");
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [title, body, targetDate, hasUnsavedEdits, draft.id]);

  const handleTextareaSelect = (
    e: React.SyntheticEvent<HTMLTextAreaElement>
  ) => {
    const el = e.currentTarget;
    const snippet = el.value
      .slice(el.selectionStart, el.selectionEnd)
      .trim();
    if (snippet.length >= 2 && snippet.length <= 160) {
      setSelectedPhrase(snippet);
    } else {
      setSelectedPhrase("");
    }
  };

  const handleNeverUseAgain = async () => {
    if (!selectedPhrase) return;
    setErrorMsg(null);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "prohibited_language",
          pattern: selectedPhrase,
          ruleExplanation: `Flagged directly in Studio from "${draft.title}" — never use again.`,
          sourceDraftId: draft.id,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setErrorMsg(d.error || "Could not save prohibited phrase.");
        return;
      }
      setStatusMsg(
        `Saved "${selectedPhrase}" to Editorial Memory (Prohibited Language).`
      );
      setSelectedPhrase("");
    } catch {
      setErrorMsg("Failed to save prohibited phrase.");
    }
  };

  const handleSaveManual = async (nextStatus?: ContentDraftRecord["status"]) => {
    setSaving(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          status: nextStatus,
          targetPublishDate: targetDate || null,
          runQualityCheck: true,
        }),
      });
      const data = (await res.json()) as {
        draft?: ContentDraftRecord;
        revisions?: DraftRevisionRecord[];
        error?: string;
      };
      if (!res.ok || !data.draft) {
        setErrorMsg(data.error || "Failed to save draft.");
        return;
      }
      setDraft(data.draft);
      setTitle(data.draft.title);
      setBody(data.draft.body);
      if (data.revisions) setRevisions(data.revisions);
      setConfirmApproveOpen(false);
      setAutoSaveLabel("Saved");
      setStatusMsg(
        nextStatus === "approved"
          ? "Post explicitly approved! Copy the final text and publish manually on LinkedIn."
          : nextStatus === "ready_for_review"
            ? "Moved to Ready for Review."
            : nextStatus === "published"
              ? "Marked as manually published."
              : "Changes saved."
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewAIRevise = async (
    customInstruction?: string,
    withInput?: string
  ) => {
    setRegenerating(true);
    setErrorMsg(null);
    setStatusMsg(
      "Revising your post in simple, everyday English..."
    );
    try {
      // Persist any manual edits before revising so nothing is lost
      if (hasUnsavedEdits) {
        await fetch(`/api/drafts/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body }),
        });
      }

      const res = await fetch(`/api/drafts/${draft.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: customInstruction ?? revisionPrompt,
          suppliedAuthorInput: withInput,
          saveFeedbackAsRule: saveAsRule,
          previewOnly: false,
        }),
      });
      const data = (await res.json()) as {
        draft?: ContentDraftRecord;
        colleagueNote?: string;
        error?: string;
      };
      if (!res.ok || !data.draft) {
        setStatusMsg(null);
        setErrorMsg(
          data.error ||
            "AI revision unavailable. Your current draft text was preserved untouched."
        );
        return;
      }
      setDraft(data.draft);
      setTitle(data.draft.title);
      setBody(data.draft.body);
      setRevisionPrompt("");
      setSaveAsRule(false);
      setStatusMsg(
        data.colleagueNote ||
          "Updated! Previous version is saved in the History tab if you ever want to undo."
      );

      const detailRes = await fetch(`/api/drafts/${draft.id}`);
      if (detailRes.ok) {
        const detail = (await detailRes.json()) as {
          revisions: DraftRevisionRecord[];
        };
        setRevisions(detail.revisions);
      }
      router.refresh();
    } finally {
      setRegenerating(false);
    }
  };

  const handleAcceptProposedDiff = async () => {
    if (!proposedDiff) return;
    setTitle(proposedDiff.title);
    setBody(proposedDiff.body);
    const note = proposedDiff.note;
    setProposedDiff(null);

    setSaving(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: proposedDiff.title,
          body: proposedDiff.body,
          revisionNote: `Accepted AI revision: ${note}`,
          runQualityCheck: true,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          draft: ContentDraftRecord;
          revisions: DraftRevisionRecord[];
        };
        setDraft(data.draft);
        setRevisions(data.revisions);
        setStatusMsg("Revision accepted and saved to history.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRunDeterministicQA = async () => {
    setRunningQa(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          runQualityCheck: true,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          draft: ContentDraftRecord;
          revisions: DraftRevisionRecord[];
        };
        setDraft(data.draft);
        setRevisions(data.revisions);
        setActiveTab("qa");
        setStatusMsg("Editorial, voice, and repetition checks updated.");
      }
    } finally {
      setRunningQa(false);
    }
  };

  const handleToggleSourceLink = async (sourceId: string) => {
    const currentIds = draft.sourceIds ?? [];
    const exists = currentIds.includes(sourceId);
    const nextIds = exists
      ? currentIds.filter((id) => id !== sourceId)
      : [...currentIds, sourceId];

    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceIds: nextIds, runQualityCheck: true }),
    });
    if (res.ok) {
      const data = (await res.json()) as { draft: ContentDraftRecord };
      setDraft(data.draft);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteStudioDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/drafts");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const pillar = getPillarById(draft.pillar);
  const aboveFold = body.slice(0, LINKEDIN_FOLD_CHAR_LIMIT);
  const hasMoreFold = body.length > LINKEDIN_FOLD_CHAR_LIMIT;

  return (
    <div className="space-y-5">
      {/* Top Studio Bar */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/drafts"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Drafts</span>
          </Link>
          <span className="text-border-strong">/</span>
          <Badge variant="accent">{pillar.shortName}</Badge>
          <Badge
            variant={
              draft.status === "approved" || draft.status === "published"
                ? "success"
                : "neutral"
            }
          >
            {WORKFLOW_STATUS_LABELS[draft.status]}
          </Badge>
          {autoSaveLabel && (
            <span className="text-[11px] text-muted">{autoSaveLabel}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={handleDeleteStudioDraft}
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/15"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setViewMode((m) => (m === "edit" ? "linkedin_preview" : "edit"))
            }
          >
            {viewMode === "edit" ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                <span>LinkedIn Fold Preview</span>
              </>
            ) : (
              <>
                <FilePenLine className="h-3.5 w-3.5" />
                <span>Back to Editor</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={() => handleSaveManual()}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Save Changes</span>
          </Button>

          {draft.status === "draft" && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => handleSaveManual("ready_for_review")}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Ready for Review</span>
            </Button>
          )}

          {draft.status !== "approved" && draft.status !== "published" && (
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => setConfirmApproveOpen(true)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Approve Post</span>
            </Button>
          )}

          {draft.status === "approved" && (
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => handleSaveManual("published")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Mark Manually Published</span>
            </Button>
          )}
        </div>
      </div>

      {/* Explicit Deliberate Approval Confirmation Modal */}
      {confirmApproveOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-confirm-title"
          className="rounded-xl border border-indigo-300 bg-indigo-50/90 p-4 dark:border-indigo-500/40 dark:bg-indigo-950/60"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <p
                id="approve-confirm-title"
                className="text-sm font-semibold text-foreground"
              >
                Confirm explicit human approval?
              </p>
              <p className="text-xs text-muted-foreground">
                Approving records your timestamp and moves this post to your
                Approved queue. LinkedIn publishing remains manual (copy &
                paste).
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmApproveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() => handleSaveManual("approved")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Yes, Approve Post</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Diff Preview before applying AI revision */}
      {proposedDiff && (
        <Card className="border-accent">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Proposed AI Revision Preview</CardTitle>
              <CardDescription>{proposedDiff.note}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProposedDiff(null)}
              >
                <X className="h-3.5 w-3.5" />
                <span>Discard</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAcceptProposedDiff}
              >
                <Check className="h-3.5 w-3.5" />
                <span>Accept Revision</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted">Current Draft</p>
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-subtle/50 p-3 text-xs leading-relaxed text-muted-foreground">
                {body}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-accent">
                Proposed Revision
              </p>
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-indigo-300/70 bg-indigo-50/40 p-3 text-xs leading-relaxed text-foreground dark:border-indigo-500/30 dark:bg-indigo-500/10">
                {proposedDiff.body}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {statusMsg && (
        <div className="rounded-lg border border-emerald-300/70 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-red-300/70 bg-red-50 px-4 py-2.5 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Main 2-Pane Studio */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Editor or LinkedIn Fold Preview Pane */}
        <div className="space-y-4 lg:col-span-7">
          {viewMode === "linkedin_preview" ? (
            <Card>
              <CardHeader className="border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground">
                    {AUTHOR_NAME[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {AUTHOR_NAME}
                    </p>
                    <p className="text-xs text-muted">
                      AI Implementation & Business Operations · Preview
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {previewExpanded || !hasMoreFold ? body : `${aboveFold}...`}
                </div>
                {hasMoreFold && (
                  <button
                    type="button"
                    onClick={() => setPreviewExpanded((v) => !v)}
                    className="text-xs font-semibold text-accent hover:underline cursor-pointer"
                  >
                    {previewExpanded ? "Show less" : "...see more (LinkedIn fold)"}
                  </button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="space-y-3 pb-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-label="Draft working title"
                  className="w-full border-b border-transparent bg-transparent text-lg font-semibold text-foreground focus:border-accent focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {wordCount} words · {body.length} chars · Hook:{" "}
                    <strong className="font-medium text-foreground">
                      {draft.hookStyle}
                    </strong>
                  </span>
                  <label className="flex items-center gap-1.5">
                    <span>Target date:</span>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-foreground"
                    />
                  </label>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {selectedPhrase && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs dark:border-amber-500/30 dark:bg-amber-500/15">
                    <span className="truncate text-foreground">
                      Selected: <strong>&ldquo;{selectedPhrase}&rdquo;</strong>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={handleNeverUseAgain}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Never use this again</span>
                    </Button>
                  </div>
                )}

                <textarea
                  rows={16}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onSelect={handleTextareaSelect}
                  aria-label="LinkedIn post editor"
                  className="w-full resize-y rounded-xl border border-border bg-surface-subtle/30 p-5 text-base leading-relaxed text-foreground focus:border-accent focus:bg-surface focus:outline-none"
                />

                <p className="text-[11px] text-muted">
                  Highlight any word or cliché above to trigger{" "}
                  <strong>Never use this again</strong>. Edits auto-save
                  non-destructively.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Context & Colleague Rail */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface p-1">
            {(
              [
                { id: "revise", label: "AI Revise" },
                {
                  id: "sources",
                  label: `Sources (${draft.sources?.length ?? 0})`,
                },
                { id: "qa", label: "Quality Review" },
                { id: "history", label: `History (${revisions.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "revise" && (
            <Card>
              <CardHeader>
                <CardTitle>AI-Assisted Revision (With Diff Preview)</CardTitle>
                <CardDescription>
                  Proposed changes open in a side-by-side diff first so your
                  writing is never overwritten automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(draft.missingAuthorInput?.needed ||
                  draft.authorInputUsed ||
                  draft.missingAuthorInput?.suppliedAnswer) && (
                  <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-xs dark:border-indigo-500/30 dark:bg-indigo-500/10">
                    <div className="flex items-start gap-2">
                      <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <div>
                        <p className="font-semibold text-foreground">
                          Author-Supplied Input (Kept Separate from AI Text)
                        </p>
                        {draft.missingAuthorInput?.question && (
                          <p className="mt-0.5 text-muted-foreground">
                            {draft.missingAuthorInput.question}
                          </p>
                        )}
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={authorInputText}
                      onChange={(e) => setAuthorInputText(e.target.value)}
                      placeholder="Your confirmed personal note, project status, or opinion..."
                      className="w-full rounded-md border border-border bg-surface p-2 text-xs text-foreground"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={regenerating || !authorInputText.trim()}
                      onClick={() =>
                        handlePreviewAIRevise(
                          "Integrate Efe's supplied personal perspective naturally without inventing extra claims.",
                          authorInputText
                        )
                      }
                    >
                      {regenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>Preview With My Perspective</span>
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    1-Click Revisions
                  </p>
                  {regenerating && (
                    <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/80 p-2.5 text-xs text-foreground dark:border-indigo-500/30 dark:bg-indigo-500/15">
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
                      <span>Rewriting in plain, everyday English...</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_REVISION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        disabled={regenerating}
                        onClick={() => handlePreviewAIRevise(chip)}
                        className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-border pt-3">
                  <textarea
                    rows={3}
                    value={revisionPrompt}
                    onChange={(e) => setRevisionPrompt(e.target.value)}
                    placeholder="Custom instruction (e.g. 'Shorter opening, add a pharmacy handoff analogy')"
                    className="w-full rounded-lg border border-border bg-surface p-2.5 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={saveAsRule}
                      onChange={(e) => setSaveAsRule(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>
                      Save as a permanent rule in Editorial Memory
                    </span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={regenerating || !revisionPrompt.trim()}
                      onClick={() => handlePreviewAIRevise()}
                    >
                      {regenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      <span>Revise Draft</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={regenerating}
                      onClick={() =>
                        handlePreviewAIRevise(
                          "Rewrite this post from scratch using simpler, everyday words and a fresh opening."
                        )
                      }
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Rewrite Simply</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "sources" && (
            <Card>
              <CardHeader>
                <CardTitle>Linked Sources & Rationale</CardTitle>
                <CardDescription>{draft.selectionRationale}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {draft.sources && draft.sources.length > 0 ? (
                  <div className="space-y-2.5">
                    {draft.sources.map((src) => (
                      <div
                        key={src.id}
                        className="space-y-1.5 rounded-lg border border-border p-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-accent hover:underline"
                          >
                            {src.title}{" "}
                            <ExternalLink className="inline h-3 w-3" />
                          </a>
                          <Badge variant="success">
                            {src.verificationStatus}
                          </Badge>
                        </div>
                        <p className="text-muted">
                          {src.publisher}
                          {src.publicationDate
                            ? ` · ${src.publicationDate}`
                            : ""}
                        </p>
                        <p className="leading-relaxed text-muted-foreground">
                          {src.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    No external sources attached to this draft yet.
                  </p>
                )}

                {availableSources.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-semibold text-foreground">
                      Attach / Detach Library Sources
                    </p>
                    <div className="max-h-44 space-y-1.5 overflow-y-auto">
                      {availableSources.slice(0, 12).map((src) => {
                        const attached = draft.sourceIds.includes(src.id);
                        return (
                          <label
                            key={src.id}
                            className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={attached}
                              onChange={() => handleToggleSourceLink(src.id)}
                            />
                            <span className="truncate">{src.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "qa" && (
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle>Editorial & Voice Quality Review</CardTitle>
                  <CardDescription className="mt-1">
                    {draft.qualityReview?.overallNote ||
                      "Run instant deterministic checks anytime (even without AI keys)."}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={runningQa}
                  onClick={handleRunDeterministicQA}
                >
                  {runningQa ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  )}
                  <span>Run Check</span>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {draft.qualityReview && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-border p-2.5">
                        <p className="text-muted">Factual Support</p>
                        <p className="mt-0.5 font-semibold capitalize text-foreground">
                          {draft.qualityReview.factualSupport.replace("_", " ")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-2.5">
                        <p className="text-muted">Voice & Style</p>
                        <p className="mt-0.5 font-semibold capitalize text-foreground">
                          {draft.qualityReview.voiceAlignment.replace("_", " ")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-2.5">
                        <p className="text-muted">Originality</p>
                        <p className="mt-0.5 font-semibold capitalize text-foreground">
                          {draft.qualityReview.originality.replace("_", " ")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border p-2.5">
                        <p className="text-muted">Practical Value</p>
                        <p className="mt-0.5 font-semibold capitalize text-foreground">
                          {draft.qualityReview.practicalValue.replace("_", " ")}
                        </p>
                      </div>
                    </div>

                    {draft.qualityReview.issues.length > 0 && (
                      <div className="space-y-1 rounded-lg border border-amber-300/70 bg-amber-50/70 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                        <p className="font-semibold text-foreground">
                          Flagged items ({draft.qualityReview.issues.length})
                        </p>
                        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                          {draft.qualityReview.issues.map((iss, i) => (
                            <li key={i}>{iss}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {draft.qualityReview.strengths.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">
                          Strengths
                        </p>
                        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                          {draft.qualityReview.strengths.map((st, i) => (
                            <li key={i}>{st}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {draft.visualRecommendation && (
                      <div className="rounded-lg border border-border bg-surface-subtle/50 p-2.5">
                        <p className="font-semibold text-foreground">
                          Visual recommendation:{" "}
                          {draft.visualRecommendation.choice.replace("_", " ")}
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          {draft.visualRecommendation.rationale}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "history" && (
            <Card>
              <CardHeader>
                <CardTitle>Revision History</CardTitle>
                <CardDescription>
                  Restore any prior version non-destructively.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {revisions.map((rev) => (
                  <div
                    key={rev.id}
                    className="space-y-1.5 rounded-lg border border-border p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="neutral">{rev.actor}</Badge>
                      <span className="text-[11px] text-muted">
                        {new Date(rev.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="font-medium text-foreground">
                      {rev.instruction}
                    </p>
                    <p className="line-clamp-3 text-muted-foreground">
                      {rev.body}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBody(rev.body);
                        setStatusMsg(
                          "Loaded snapshot into editor. Click Save to persist."
                        );
                      }}
                    >
                      <History className="h-3.5 w-3.5" />
                      <span>Load Into Editor</span>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
