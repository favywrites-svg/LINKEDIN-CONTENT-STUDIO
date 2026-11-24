"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  Edit3,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  AuthorProfileRecord,
  EditorialMemoryItem,
  FeedbackEventRecord,
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

export function MemoryClient({
  initialItems,
  profile,
  feedback,
}: {
  initialItems: EditorialMemoryItem[];
  profile: AuthorProfileRecord;
  feedback: FeedbackEventRecord[];
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(initialItems);
  const [category, setCategory] =
    React.useState<EditorialMemoryItem["category"]>("prohibited_language");
  const [origin, setOrigin] =
    React.useState<EditorialMemoryItem["origin"]>("explicit");
  const [pattern, setPattern] = React.useState("");
  const [explanation, setExplanation] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editPattern, setEditPattern] = React.useState("");
  const [editExplanation, setEditExplanation] = React.useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          origin,
          pattern: pattern.trim(),
          ruleExplanation: explanation.trim(),
          confirmed: origin !== "inferred",
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { item: EditorialMemoryItem };
        setItems((prev) => [
          data.item,
          ...prev.filter((i) => i.id !== data.item.id),
        ]);
        setPattern("");
        setExplanation("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRule = async (id: string) => {
    const res = await fetch("/api/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, confirmed: true }),
    });
    if (res.ok) {
      const data = (await res.json()) as { item: EditorialMemoryItem };
      setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
      router.refresh();
    }
  };

  const handleSaveEdit = async (id: string) => {
    const res = await fetch("/api/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        pattern: editPattern,
        ruleExplanation: editExplanation,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { item: EditorialMemoryItem };
      setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
      setEditingId(null);
      router.refresh();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/memory?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      router.refresh();
    }
  };

  const awaitingConfirmation = items.filter((i) => !i.confirmed);
  const prohibited = items.filter(
    (i) => i.confirmed && i.category === "prohibited_language"
  );
  const preferences = items.filter(
    (i) => i.confirmed && i.category !== "prohibited_language"
  );

  return (
    <div className="space-y-6">
      {/* Inferred Preferences Awaiting Efe's Confirmation */}
      {awaitingConfirmation.length > 0 && (
        <Card className="border-indigo-300 dark:border-indigo-500/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Learned Preferences Awaiting Your Confirmation (
                {awaitingConfirmation.length})
              </CardTitle>
              <Badge variant="accent">Inferred from Feedback</Badge>
            </div>
            <CardDescription>
              Inferred rules never become permanent automatically. Confirm the
              ones you want applied to future posts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {awaitingConfirmation.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-surface-subtle/50 p-3 text-xs sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-semibold text-foreground">{item.pattern}</p>
                  <p className="text-muted-foreground">{item.ruleExplanation}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleConfirmRule(item.id)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Confirm Rule</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add Rule Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Writing Preference or Prohibited Phrase</CardTitle>
          <CardDescription>
            Distinguish explicit permanent instructions from temporary notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid gap-3 md:grid-cols-12">
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as EditorialMemoryItem["category"])
              }
              className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs text-foreground md:col-span-3"
            >
              <option value="prohibited_language">
                Never use again (Prohibited)
              </option>
              <option value="writing_preference">Writing preference</option>
              <option value="topic_preference">Topic preference</option>
              <option value="professional_fact">
                Verified professional fact
              </option>
            </select>
            <select
              value={origin}
              onChange={(e) =>
                setOrigin(e.target.value as EditorialMemoryItem["origin"])
              }
              className="h-9 rounded-lg border border-border bg-surface px-2.5 text-xs text-foreground md:col-span-2"
            >
              <option value="explicit">Explicit permanent</option>
              <option value="temporary">Temporary</option>
            </select>
            <input
              type="text"
              required
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={
                category === "prohibited_language"
                  ? 'Word or phrase to ban (e.g. "delve")'
                  : "Preference or fact..."
              }
              className="h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground md:col-span-3"
            />
            <input
              type="text"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Reason..."
              className="h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground md:col-span-2"
            />
            <Button
              type="submit"
              size="md"
              disabled={saving}
              className="md:col-span-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>Save</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Prohibited Language */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-600 dark:text-red-400" />
                <CardTitle>Prohibited Language</CardTitle>
              </div>
              <Badge variant="danger">{prohibited.length} active</Badge>
            </div>
            <CardDescription>
              Checked automatically across exact & close variations before drafts
              are presented.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {prohibited.map((item) => (
              <div
                key={item.id}
                className="space-y-2 rounded-lg border border-border p-3 text-xs"
              >
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editPattern}
                      onChange={(e) => setEditPattern(e.target.value)}
                      className="h-8 w-full rounded border border-border bg-surface px-2 text-xs"
                    />
                    <input
                      type="text"
                      value={editExplanation}
                      onChange={(e) => setEditExplanation(e.target.value)}
                      className="h-8 w-full rounded border border-border bg-surface px-2 text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSaveEdit(item.id)}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono font-semibold text-foreground">
                          {item.pattern}
                        </code>
                        <Badge variant="neutral">{item.origin}</Badge>
                      </div>
                      <p className="text-muted-foreground">
                        {item.ruleExplanation}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditPattern(item.pattern);
                          setEditExplanation(item.ruleExplanation);
                        }}
                        className="h-7 w-7 text-muted"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        className="h-7 w-7 text-muted hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Writing Preferences & Feedback Log */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <CardTitle>Saved Preferences & Verified Facts</CardTitle>
                </div>
                <Badge variant="accent">{preferences.length} active</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {preferences.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {item.pattern}
                      </span>
                      <Badge variant="neutral">
                        {item.category.replace("_", " ")}
                      </Badge>
                      <Badge variant="neutral">{item.origin}</Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {item.ruleExplanation}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item.id)}
                    className="h-7 w-7 shrink-0 text-muted hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feedback & Decision History</CardTitle>
              <CardDescription>
                Approvals, rejections, manual edits, and flagged expressions (
                {profile.preferredName}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {feedback.length === 0 ? (
                <p className="text-xs text-muted">No feedback logged yet.</p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
                  {feedback.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-start justify-between gap-2 border-b border-border pb-2 last:border-b-0"
                    >
                      <span className="text-muted-foreground">{ev.note}</span>
                      <Badge variant="neutral" className="shrink-0">
                        {ev.eventType.replace("_", " ")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
