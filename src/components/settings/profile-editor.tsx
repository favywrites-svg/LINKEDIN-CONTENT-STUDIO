"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2, UserCheck } from "lucide-react";
import type { AuthorProfileRecord, ConfirmedProject } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ProfileEditor({
  initialProfile,
}: {
  initialProfile: AuthorProfileRecord;
}) {
  const router = useRouter();
  const [preferredName, setPreferredName] = React.useState(
    initialProfile.preferredName
  );
  const [positioning, setPositioning] = React.useState(
    initialProfile.positioning
  );
  const [voiceSummary, setVoiceSummary] = React.useState(
    initialProfile.voiceSummary
  );
  const [projects, setProjects] = React.useState<ConfirmedProject[]>(
    initialProfile.confirmedProjects
  );
  const [saving, setSaving] = React.useState(false);
  const [savedNote, setSavedNote] = React.useState<string | null>(null);

  const handleAddProject = () => {
    setProjects((prev) => [
      ...prev,
      {
        id: `proj-${Date.now()}`,
        name: "",
        status: "prototype",
        summary: "",
        confirmedLessons: "",
      },
    ]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNote(null);
    try {
      const cleanProjects = projects.filter(
        (p) => p.name.trim() && p.summary.trim()
      );
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredName,
          positioning,
          voiceSummary,
          confirmedProjects: cleanProjects,
        }),
      });
      if (res.ok) {
        setSavedNote("Author profile & confirmed projects saved.");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-accent" />
          <CardTitle>Author Profile & Confirmed Projects</CardTitle>
        </div>
        <CardDescription>
          Only confirmed projects and exact statuses (Concept, Prototype,
          Experiment, Production) listed here can be referenced as your own work.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Preferred Name
            </label>
            <input
              type="text"
              required
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Professional Positioning
            </label>
            <textarea
              rows={3}
              required
              value={positioning}
              onChange={(e) => setPositioning(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface p-2.5 text-xs text-foreground"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">
              Voice & Style Summary
            </label>
            <textarea
              rows={2}
              required
              value={voiceSummary}
              onChange={(e) => setVoiceSummary(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface p-2.5 text-xs text-foreground"
            />
          </div>

          <div className="space-y-2.5 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Confirmed Projects ({projects.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddProject}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Project</span>
              </Button>
            </div>

            {projects.map((proj, idx) => (
              <div
                key={proj.id}
                className="space-y-2 rounded-lg border border-border bg-surface-subtle/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={proj.name}
                    onChange={(e) =>
                      setProjects((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, name: e.target.value } : p
                        )
                      )
                    }
                    placeholder="Project name"
                    className="h-8 flex-1 rounded border border-border bg-surface px-2.5 text-xs text-foreground"
                  />
                  <select
                    value={proj.status}
                    onChange={(e) =>
                      setProjects((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? {
                                ...p,
                                status: e.target
                                  .value as ConfirmedProject["status"],
                              }
                            : p
                        )
                      )
                    }
                    className="h-8 rounded border border-border bg-surface px-2 text-xs text-foreground"
                  >
                    <option value="concept">Concept</option>
                    <option value="prototype">Prototype</option>
                    <option value="experiment">Experiment</option>
                    <option value="production">Production</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setProjects((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="h-8 w-8 text-muted hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <input
                  type="text"
                  value={proj.summary}
                  onChange={(e) =>
                    setProjects((prev) =>
                      prev.map((p, i) =>
                        i === idx ? { ...p, summary: e.target.value } : p
                      )
                    )
                  }
                  placeholder="Honest summary of what it does"
                  className="h-8 w-full rounded border border-border bg-surface px-2.5 text-xs text-foreground"
                />
                <input
                  type="text"
                  value={proj.confirmedLessons}
                  onChange={(e) =>
                    setProjects((prev) =>
                      prev.map((p, i) =>
                        i === idx
                          ? { ...p, confirmedLessons: e.target.value }
                          : p
                      )
                    )
                  }
                  placeholder="Confirmed engineering/workflow lessons"
                  className="h-8 w-full rounded border border-border bg-surface px-2.5 text-xs text-foreground"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>Save Profile</span>
            </Button>
            {savedNote && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                {savedNote}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
