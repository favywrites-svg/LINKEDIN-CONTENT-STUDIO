"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  FilePenLine,
  Lightbulb,
  Loader2,
  Quote,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  AUTHOR_NAME,
  DASHBOARD_MODEL_OPTIONS,
  WORKFLOW_STATUS_LABELS,
  getGreetingForHour,
  getPillarById,
} from "@/lib/constants";
import type {
  ContentDraftRecord,
  ContentIdeaRecord,
  SuggestedPostType,
  WeeklyPackageRecord,
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

const POST_TYPE_UI: Record<
  SuggestedPostType,
  { label: string; badgeVariant: "accent" | "info" | "neutral" }
> = {
  authority: { label: "Authority", badgeVariant: "accent" },
  educational: { label: "Educational", badgeVariant: "info" },
  reflection: {
    label: "Personal / Professional Reflection",
    badgeVariant: "neutral",
  },
};

const SIMPLE_REVISION_CHIPS = [
  "Rewrite in simpler, everyday words (no big jargon)",
  "Make it shorter and easier to read",
  "Make it sound warmer and more conversational",
  "Give it a clearer, simpler first line",
];

interface WeeklyWorkspaceProps {
  aiConfigured: boolean;
  initialPackage: WeeklyPackageRecord | null;
  initialTopics: ContentIdeaRecord[];
  recentDrafts: ContentDraftRecord[];
}

export function WeeklyWorkspace({
  aiConfigured,
  initialPackage,
  initialTopics,
  recentDrafts,
}: WeeklyWorkspaceProps) {
  const router = useRouter();
  const [greeting, setGreeting] = React.useState(() =>
    getGreetingForHour(10, AUTHOR_NAME)
  );
  const [selectedModel, setSelectedModel] = React.useState<string>("auto");

  React.useEffect(() => {
    setGreeting(getGreetingForHour(new Date().getHours(), AUTHOR_NAME));
    try {
      const saved = window.localStorage.getItem("lca_model_choice");
      if (
        saved &&
        DASHBOARD_MODEL_OPTIONS.some((option) => option.id === saved)
      ) {
        setSelectedModel(saved);
      }
    } catch {
      // ignore storage access issues
    }
  }, []);

  const handleModelChange = (nextModel: string) => {
    setSelectedModel(nextModel);
    try {
      window.localStorage.setItem("lca_model_choice", nextModel);
    } catch {
      // ignore
    }
  };

  const [activePackage, setActivePackage] =
    React.useState<WeeklyPackageRecord | null>(initialPackage);
  const [topics, setTopics] =
    React.useState<ContentIdeaRecord[]>(initialTopics);
  const [drafts, setDrafts] =
    React.useState<ContentDraftRecord[]>(recentDrafts);

  const [planningWeek, setPlanningWeek] = React.useState(false);
  const [draftingIdeaId, setDraftingIdeaId] = React.useState<string | null>(
    null
  );
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  );
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // User-provided quote / observation / idea state
  const [userIdeaInput, setUserIdeaInput] = React.useState("");
  const [ideaBusyMode, setIdeaBusyMode] = React.useState<
    "suggest_angle" | "write_post" | null
  >(null);
  const [suggestedAngle, setSuggestedAngle] = React.useState<{
    topic: string;
    angle: string;
    postType: SuggestedPostType;
    postTypeLabel: string;
  } | null>(null);

  // Instant Inline "Edit & Revise" Modal state
  const [editingDraft, setEditingDraft] =
    React.useState<ContentDraftRecord | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editBody, setEditBody] = React.useState("");
  const [previousBody, setPreviousBody] = React.useState<string | null>(null);
  const [reviseInstruction, setReviseInstruction] = React.useState("");
  const [savingDraft, setSavingDraft] = React.useState(false);
  const [revisingDraft, setRevisingDraft] = React.useState(false);
  const [modalFeedback, setModalFeedback] = React.useState<string | null>(null);
  const [modalError, setModalError] = React.useState<string | null>(null);

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const openInlineEditor = (draft: ContentDraftRecord) => {
    setEditingDraft(draft);
    setEditTitle(draft.title);
    setEditBody(draft.body);
    setPreviousBody(null);
    setReviseInstruction("");
    setModalFeedback(null);
    setModalError(null);
  };

  const handleDeleteDraft = async (draftId: string) => {
    setDeletingId(draftId);
    try {
      const res = await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
      if (res.ok) {
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        if (editingDraft?.id === draftId) {
          setEditingDraft(null);
        }
        setConfirmDeleteId(null);
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handlePlanMyWeek = async () => {
    setPlanningWeek(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/strategist/plan-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelChoice: selectedModel }),
      });
      const data = (await res.json()) as {
        package?: WeeklyPackageRecord;
        topics?: ContentIdeaRecord[];
        error?: string;
      };
      if (!res.ok || !data.topics) {
        setErrorMsg(data.error || "Could not generate weekly topics.");
        return;
      }
      setActivePackage(data.package ?? null);
      setTopics(data.topics);
      router.refresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Network error planning week."
      );
    } finally {
      setPlanningWeek(false);
    }
  };

  const handleGenerateFromTopic = async (ideaId: string) => {
    setDraftingIdeaId(ideaId);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/strategist/from-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId, modelChoice: selectedModel }),
      });
      const data = (await res.json()) as {
        draft?: ContentDraftRecord;
        error?: string;
      };
      if (!res.ok || !data.draft) {
        setErrorMsg(data.error || "Could not generate post from topic.");
        return;
      }
      setDrafts((prev) => [
        data.draft!,
        ...prev.filter((d) => d.id !== data.draft!.id),
      ]);
      setTopics((prev) =>
        prev.map((t) => (t.id === ideaId ? { ...t, status: "drafted" } : t))
      );
      openInlineEditor(data.draft);
      router.refresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Network error generating draft."
      );
    } finally {
      setDraftingIdeaId(null);
    }
  };

  const handleUserIdeaAction = async (
    mode: "suggest_angle" | "write_post",
    customAngle?: string
  ) => {
    if (!userIdeaInput.trim()) return;
    setIdeaBusyMode(mode);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/strategist/from-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: userIdeaInput.trim(),
          mode,
          customAngle,
          modelChoice: selectedModel,
        }),
      });
      const data = (await res.json()) as {
        mode?: "suggest_angle" | "write_post";
        suggestion?: {
          topic: string;
          angle: string;
          postType: SuggestedPostType;
          postTypeLabel: string;
        };
        draft?: ContentDraftRecord;
        error?: string;
      };

      if (!res.ok) {
        setErrorMsg(data.error || "Could not process your input.");
        return;
      }

      if (mode === "suggest_angle" && data.suggestion) {
        setSuggestedAngle(data.suggestion);
        return;
      }

      if (mode === "write_post" && data.draft) {
        setDrafts((prev) => [data.draft!, ...prev]);
        setUserIdeaInput("");
        setSuggestedAngle(null);
        openInlineEditor(data.draft);
        router.refresh();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Network error processing input."
      );
    } finally {
      setIdeaBusyMode(null);
    }
  };

  const handleSaveInlineDraft = async (
    nextStatus?: ContentDraftRecord["status"]
  ) => {
    if (!editingDraft) return;
    setSavingDraft(true);
    setModalError(null);
    setModalFeedback(null);
    try {
      const res = await fetch(`/api/drafts/${editingDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          body: editBody,
          status: nextStatus,
        }),
      });
      const data = (await res.json()) as {
        draft?: ContentDraftRecord;
        error?: string;
      };
      if (!res.ok || !data.draft) {
        setModalError(data.error || "Failed to save draft.");
        return;
      }
      setEditingDraft(data.draft);
      setDrafts((prev) =>
        prev.map((d) => (d.id === data.draft!.id ? data.draft! : d))
      );
      setModalFeedback(
        nextStatus === "approved"
          ? "Post approved! Ready to copy and publish on LinkedIn."
          : "Saved your edits."
      );
      router.refresh();
    } catch {
      setModalError("Network error while saving.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleReviseInlineDraft = async (instructionOverride?: string) => {
    if (!editingDraft) return;
    const textInstruction = (instructionOverride ?? reviseInstruction).trim();
    if (!textInstruction) return;

    setRevisingDraft(true);
    setModalError(null);
    setModalFeedback(null);
    try {
      if (editBody !== editingDraft.body || editTitle !== editingDraft.title) {
        await fetch(`/api/drafts/${editingDraft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editTitle, body: editBody }),
        });
      }

      const prevSnapshot = editBody;
      const res = await fetch(`/api/drafts/${editingDraft.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: textInstruction,
          previewOnly: false,
          modelChoice: selectedModel,
        }),
      });
      const data = (await res.json()) as {
        draft?: ContentDraftRecord;
        colleagueNote?: string;
        error?: string;
      };
      if (!res.ok || !data.draft) {
        setModalError(data.error || "Could not revise draft.");
        return;
      }
      setPreviousBody(prevSnapshot);
      setEditingDraft(data.draft);
      setEditTitle(data.draft.title);
      setEditBody(data.draft.body);
      setDrafts((prev) =>
        prev.map((d) => (d.id === data.draft!.id ? data.draft! : d))
      );
      setReviseInstruction("");
      setModalFeedback(data.colleagueNote || "Draft revised!");
      router.refresh();
    } catch {
      setModalError("Network error during AI revision.");
    } finally {
      setRevisingDraft(false);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* 1. Friendly Greeting + Model Picker + "Plan my week" */}
      <Card className="border-indigo-200/70 bg-gradient-to-br from-surface via-surface to-accent-soft/40 dark:border-indigo-500/25">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {greeting.headline}
              </h1>
              <p className="text-base leading-relaxed text-muted-foreground">
                Pick a model below and click <strong>Plan my week</strong> for
                four fresh post ideas, or paste a quote or thought to turn it
                into a simple, clear LinkedIn post.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Model Switcher right on Dashboard */}
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 shadow-2xs">
                <Cpu className="h-4 w-4 shrink-0 text-accent" />
                <select
                  aria-label="Choose AI model"
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="bg-transparent py-1 text-sm font-medium text-foreground focus:outline-none cursor-pointer"
                >
                  {DASHBOARD_MODEL_OPTIONS.map((opt) => (
                    <option
                      key={opt.id}
                      value={opt.id}
                      className="bg-surface text-foreground"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                size="lg"
                disabled={planningWeek}
                onClick={handlePlanMyWeek}
                className="shadow-sm"
              >
                {planningWeek ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Planning Your Week...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Plan my week</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {!aiConfigured && (
            <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border border-amber-300/70 bg-amber-50/80 p-4 text-sm text-amber-950 sm:flex-row sm:items-center dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>AI model key required:</strong> Add your Gemini or
                  OpenRouter key in Settings to generate weekly topics and
                  drafts.
                </span>
              </div>
              <Link
                href="/settings"
                prefetch={true}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </div>
          )}

          {errorMsg && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-300/70 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Weekly 4-Topic Plan */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {activePackage
                ? `${activePackage.weekLabel} — 4 Post Ideas`
                : "This Week's 4 Post Ideas"}
            </h2>
            <p className="text-sm text-muted">
              {activePackage?.assistantSummary ||
                "2 authority ideas, 1 educational idea, and 1 personal/professional reflection."}
            </p>
          </div>
          {topics.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={planningWeek}
              onClick={handlePlanMyWeek}
            >
              {planningWeek ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-accent" />
              )}
              <span>Suggest 4 Fresh Ideas</span>
            </Button>
          )}
        </div>

        {topics.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Lightbulb className="h-7 w-7 text-muted" />
              <p className="mt-3 text-base font-semibold text-foreground">
                No weekly plan yet
              </p>
              <p className="mt-1 max-w-md text-sm text-muted">
                Click <strong>Plan my week</strong> above to get four simple,
                varied topic ideas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {topics.slice(0, 4).map((item) => {
              const typeUi =
                POST_TYPE_UI[item.postType] ?? POST_TYPE_UI.authority;
              const matchingDraft = drafts.find((d) => d.ideaId === item.id);
              const isWriting = draftingIdeaId === item.id;

              return (
                <Card key={item.id} className="flex flex-col justify-between">
                  <div>
                    <CardHeader className="space-y-2.5 pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant={typeUi.badgeVariant}>
                          {typeUi.label}
                        </Badge>
                        {matchingDraft && (
                          <Badge variant="success">Draft Ready</Badge>
                        )}
                      </div>
                      <CardTitle>{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        <strong className="font-medium text-foreground">
                          Angle:
                        </strong>{" "}
                        {item.centralAngle}
                      </p>
                    </CardContent>
                  </div>

                  <CardFooter className="justify-between gap-2">
                    <span className="text-xs text-muted">
                      {getPillarById(item.pillar).shortName}
                    </span>
                    <div className="flex items-center gap-2">
                      {matchingDraft && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openInlineEditor(matchingDraft)}
                        >
                          <FilePenLine className="h-4 w-4" />
                          <span>Edit &amp; Revise</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant={matchingDraft ? "ghost" : "default"}
                        disabled={isWriting}
                        onClick={() => handleGenerateFromTopic(item.id)}
                      >
                        {isWriting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Writing...</span>
                          </>
                        ) : (
                          <>
                            <FilePenLine className="h-4 w-4" />
                            <span>
                              {matchingDraft ? "Write Another" : "Write Post"}
                            </span>
                          </>
                        )}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Provide Your Own Quote, Observation, Question, or Idea */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Quote className="h-5 w-5 text-accent" />
            <CardTitle>Write From Your Own Idea or Quote</CardTitle>
          </div>
          <CardDescription>
            Paste a quote, observation, question, or thought you found. I&apos;ll
            turn it into a clear, original post in your voice without claiming
            someone else&apos;s words as yours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            rows={4}
            value={userIdeaInput}
            onChange={(e) => setUserIdeaInput(e.target.value)}
            placeholder='Paste a quote, observation, question, or rough idea here...'
            className="w-full rounded-xl border border-border bg-surface p-4 text-base leading-relaxed text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={ideaBusyMode !== null || !userIdeaInput.trim()}
              onClick={() => handleUserIdeaAction("suggest_angle")}
            >
              {ideaBusyMode === "suggest_angle" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Lightbulb className="h-4 w-4 text-accent" />
                  <span>Suggest Angle First</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              size="md"
              disabled={ideaBusyMode !== null || !userIdeaInput.trim()}
              onClick={() => handleUserIdeaAction("write_post")}
            >
              {ideaBusyMode === "write_post" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Writing Post...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate LinkedIn Post</span>
                </>
              )}
            </Button>
          </div>

          {suggestedAngle && (
            <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-semibold text-foreground">
                  {suggestedAngle.topic}
                </span>
                <Badge variant="accent">{suggestedAngle.postTypeLabel}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Recommended angle:</strong>{" "}
                {suggestedAngle.angle}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={ideaBusyMode !== null}
                onClick={() =>
                  handleUserIdeaAction("write_post", suggestedAngle.angle)
                }
              >
                {ideaBusyMode === "write_post" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FilePenLine className="h-4 w-4" />
                )}
                <span>Write Post With This Angle</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Recent Drafts Ready to Edit, Revise, Copy, or Delete */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Your Drafts ({drafts.length})
            </h2>
            <p className="text-sm text-muted">
              Edit, revise, copy, or delete any draft right from here.
            </p>
          </div>
          <Link
            href="/drafts"
            prefetch={true}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <span>View all drafts</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {drafts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong p-6 text-center text-sm text-muted">
            Posts you generate will show up here ready to edit or copy.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {drafts.slice(0, 6).map((draft) => (
              <Card key={draft.id} className="flex flex-col justify-between">
                <div>
                  <CardHeader className="space-y-2.5 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="neutral">
                        {getPillarById(draft.pillar).shortName}
                      </Badge>
                      <Badge
                        variant={
                          draft.status === "approved" ||
                          draft.status === "published"
                            ? "success"
                            : "neutral"
                        }
                      >
                        {WORKFLOW_STATUS_LABELS[draft.status]}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{draft.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {draft.body}
                    </p>
                  </CardContent>
                </div>

                <CardFooter className="justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(draft.id, draft.body)}
                    >
                      {copiedId === draft.id ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </Button>

                    {confirmDeleteId === draft.id ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === draft.id}
                        onClick={() => handleDeleteDraft(draft.id)}
                      >
                        {deletingId === draft.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <span>Delete?</span>
                        )}
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
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openInlineEditor(draft)}
                  >
                    <FilePenLine className="h-4 w-4" />
                    <span>Edit &amp; Revise</span>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Instant Inline Edit & Revise Modal */}
      {editingDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit and Revise Draft"
        >
          <div
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            onClick={() => setEditingDraft(null)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant="accent">
                  {getPillarById(editingDraft.pillar).shortName}
                </Badge>
                <Badge
                  variant={
                    editingDraft.status === "approved" ? "success" : "neutral"
                  }
                >
                  {WORKFLOW_STATUS_LABELS[editingDraft.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/drafts/${editingDraft.id}`}
                  prefetch={true}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <span>Open Full Studio</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingDraft(null)}
                  aria-label="Close editor"
                  className="h-9 w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="grid flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-7">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-base font-semibold text-foreground focus:border-accent focus:outline-none"
                />
                <textarea
                  rows={12}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-subtle/30 p-4 text-base leading-relaxed text-foreground focus:border-accent focus:bg-surface focus:outline-none"
                />
                {previousBody && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditBody(previousBody);
                      setPreviousBody(null);
                      setModalFeedback(
                        "Restored previous text. Click Save Changes to keep it."
                      );
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Undo Last AI Revision</span>
                  </Button>
                )}
              </div>

              <div className="space-y-4 lg:col-span-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    1-Click AI Revisions
                  </p>
                  <div className="flex flex-col gap-2">
                    {SIMPLE_REVISION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        disabled={revisingDraft}
                        onClick={() => handleReviseInlineDraft(chip)}
                        className="rounded-xl border border-border bg-surface-subtle px-3.5 py-2.5 text-left text-sm text-foreground transition-colors hover:border-accent hover:bg-surface-hover disabled:opacity-50 cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-border pt-3.5">
                  <p className="text-sm font-semibold text-foreground">
                    Custom instruction
                  </p>
                  <textarea
                    rows={3}
                    value={reviseInstruction}
                    onChange={(e) => setReviseInstruction(e.target.value)}
                    placeholder='e.g. "Make it 3 short paragraphs in plain words"'
                    className="w-full rounded-xl border border-border bg-surface p-3 text-sm text-foreground focus:border-accent focus:outline-none"
                  />
                  <Button
                    type="button"
                    size="md"
                    className="w-full"
                    disabled={revisingDraft || !reviseInstruction.trim()}
                    onClick={() => handleReviseInlineDraft()}
                  >
                    {revisingDraft ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Revising...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Revise Draft</span>
                      </>
                    )}
                  </Button>
                </div>

                {revisingDraft && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/80 p-3.5 text-sm text-foreground dark:border-indigo-500/30 dark:bg-indigo-500/15">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                    <span>Rewriting your post in simple, clear words...</span>
                  </div>
                )}

                {modalFeedback && (
                  <div className="rounded-xl border border-emerald-300/70 bg-emerald-50 p-3.5 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {modalFeedback}
                  </div>
                )}

                {modalError && (
                  <div className="rounded-xl border border-red-300/70 bg-red-50 p-3.5 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    {modalError}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-subtle/40 px-6 py-3.5">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(editingDraft.id, editBody)}
                >
                  {copiedId === editingDraft.id ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Text</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deletingId === editingDraft.id}
                  onClick={() => handleDeleteDraft(editingDraft.id)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/15"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Draft</span>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={savingDraft}
                  onClick={() => handleSaveInlineDraft()}
                >
                  {savingDraft ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>Save Changes</span>
                </Button>

                {editingDraft.status !== "approved" &&
                  editingDraft.status !== "published" && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={savingDraft}
                      onClick={() => handleSaveInlineDraft("approved")}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Approve Post</span>
                    </Button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
