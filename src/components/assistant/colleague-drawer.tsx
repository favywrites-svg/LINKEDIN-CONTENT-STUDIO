"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { AUTHOR_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  navigateTo?: string;
}

const SUGGESTED_PROMPTS = [
  "Plan my week",
  "Which content pillar have we neglected recently?",
  "Why did you choose the latest topic?",
];

export function ColleagueDrawer() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [turns, setTurns] = React.useState<ChatTurn[]>([
    {
      role: "assistant",
      text: `Hi ${AUTHOR_NAME}! Ask me to generate this week's content, explain a topic choice, check neglected pillars, run research, or ban a phrase ("Never use X again").`,
    },
  ]);

  const sendMessage = async (textToSend?: string) => {
    const msg = (textToSend ?? input).trim();
    if (!msg || sending) return;

    const nextHistory: ChatTurn[] = [...turns, { role: "user", text: msg }];
    setTurns(nextHistory);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          currentPathname: pathname,
          history: turns.slice(-8).map((t) => ({ role: t.role, text: t.text })),
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        navigateTo?: string;
        error?: string;
      };
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            data.reply ||
            data.error ||
            "Something interrupted that request. Try again anytime.",
          navigateTo: data.navigateTo,
        },
      ]);
      router.refresh();
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Network error reaching the server. Your workspace data is safe.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1.5"
      >
        <MessageSquare className="h-3.5 w-3.5 text-accent" />
        <span className="hidden sm:inline">Ask Partner</span>
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Content Partner Assistant"
        >
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Content Partner
                  </p>
                  <p className="text-[11px] text-muted">
                    Context-aware colleague ({pathname})
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close assistant panel"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {turns.map((turn, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl p-3 text-xs leading-relaxed ${
                    turn.role === "user"
                      ? "ml-8 bg-accent text-accent-foreground"
                      : "mr-6 border border-border bg-surface-subtle/70 text-foreground"
                  }`}
                >
                  <p>{turn.text}</p>
                  {turn.navigateTo && turn.navigateTo !== pathname && (
                    <button
                      type="button"
                      onClick={() => {
                        router.push(turn.navigateTo!);
                        setOpen(false);
                      }}
                      className="mt-2 inline-block font-semibold text-accent hover:underline cursor-pointer"
                    >
                      Open {turn.navigateTo} →
                    </button>
                  )}
                </div>
              ))}

              <div className="space-y-1.5 pt-2">
                <p className="text-[11px] font-medium text-muted">
                  Try asking:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={sending}
                      onClick={() => sendMessage(p)}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground hover:border-accent hover:text-foreground cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
              className="flex items-center gap-2 border-t border-border p-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask or instruct your content partner..."
                className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:border-accent focus:outline-none"
              />
              <Button
                type="submit"
                size="icon"
                disabled={sending || !input.trim()}
                aria-label="Send instruction"
                className="h-9 w-9"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
