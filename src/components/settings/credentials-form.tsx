"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, PlugZap } from "lucide-react";
import type { SafeRuntimeStatus } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CredentialsForm({
  initialStatus,
}: {
  initialStatus: SafeRuntimeStatus;
}) {
  const router = useRouter();
  const [aiProvider, setAiProvider] = React.useState<
    "auto" | "gemini" | "openrouter"
  >(
    initialStatus.aiProvider === "openrouter"
      ? "openrouter"
      : initialStatus.aiProvider === "gemini"
        ? "gemini"
        : "auto"
  );
  const [geminiKey, setGeminiKey] = React.useState("");
  const [geminiModel, setGeminiModel] = React.useState(
    initialStatus.aiProvider === "gemini" && initialStatus.aiModel
      ? initialStatus.aiModel
      : "gemini-3.5-flash-lite"
  );
  const [openRouterKey, setOpenRouterKey] = React.useState("");
  const [openRouterModel, setOpenRouterModel] = React.useState(
    initialStatus.aiProvider === "openrouter" && initialStatus.aiModel
      ? initialStatus.aiModel
      : "nvidia/nemotron-3-ultra-550b-a55b:free"
  );
  const [tavilyKey, setTavilyKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/settings/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          aiProvider,
          geminiApiKey: geminiKey,
          geminiModel,
          openRouterApiKey: openRouterKey,
          openRouterModel,
          tavilyApiKey: tavilyKey,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFeedback({
          kind: "err",
          text: data.error || "Could not save server configuration.",
        });
        return;
      }
      setGeminiKey("");
      setOpenRouterKey("");
      setTavilyKey("");
      setFeedback({
        kind: "ok",
        text: "Saved securely to your server .env file. Click Test Active Connection to verify.",
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/settings/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setFeedback({
          kind: "err",
          text: data.error || "Connection test failed.",
        });
        return;
      }
      setFeedback({
        kind: "ok",
        text: data.message || "Connected cleanly!",
      });
      router.refresh();
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-accent" />
          <CardTitle>Gemini & OpenRouter Configuration</CardTitle>
        </div>
        <CardDescription>
          Edit <code className="font-mono">.env</code> directly in your project
          root or paste keys below. Keys stay strictly on your server and are
          never exposed to browser code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Active AI Provider
            </label>
            <select
              value={aiProvider}
              onChange={(e) =>
                setAiProvider(
                  e.target.value as "auto" | "gemini" | "openrouter"
                )
              }
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
            >
              <option value="auto">
                Auto (Uses Gemini if set, otherwise OpenRouter)
              </option>
              <option value="gemini">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Gemini API Key
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Paste AIza... (or leave blank to keep .env)"
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Gemini Model
              </label>
              <input
                type="text"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-mono text-xs text-foreground"
              />
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                OpenRouter API Key
              </label>
              <input
                type="password"
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                placeholder="Paste sk-or-v1-... (or leave blank to keep .env)"
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                OpenRouter Free Model ID
              </label>
              <input
                type="text"
                value={openRouterModel}
                onChange={(e) => setOpenRouterModel(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-mono text-xs text-foreground"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Optional: Tavily Search Key
            </label>
            <input
              type="password"
              value={tavilyKey}
              onChange={(e) => setTavilyKey(e.target.value)}
              placeholder="Optional tvly-... key"
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>Save to .env</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testing}
              onClick={handleTest}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlugZap className="h-3.5 w-3.5" />
              )}
              <span>Test Active Connection</span>
            </Button>
          </div>
        </form>

        {feedback && (
          <div
            className={`rounded-lg border p-3 text-xs ${
              feedback.kind === "ok"
                ? "border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-red-300/70 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
