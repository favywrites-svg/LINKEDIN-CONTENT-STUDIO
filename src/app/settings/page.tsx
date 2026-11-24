import { Database, Download, Lock, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getReadyRepository } from "@/lib/db/repository";
import { getEffectiveRuntimeStatus } from "@/lib/env-store";
import { CredentialsForm } from "@/components/settings/credentials-form";
import { ProfileEditor } from "@/components/settings/profile-editor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const status = getEffectiveRuntimeStatus();
  const repo = await getReadyRepository();
  const profile = repo.getAuthorProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure server-side AI credentials, manage your confirmed professional profile & projects, and export workspace backups."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <CredentialsForm initialStatus={status} />

          <Card>
            <CardHeader>
              <CardTitle>Data Backup & Export</CardTitle>
              <CardDescription>
                Download a complete snapshot of your drafts, research sources,
                editorial memory, and feedback history anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2.5">
              <a
                href="/api/export?format=json"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-xs font-medium text-foreground hover:bg-surface-hover"
              >
                <Download className="h-3.5 w-3.5 text-accent" />
                <span>Export JSON Backup</span>
              </a>
              <a
                href="/api/export?format=markdown"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-xs font-medium text-foreground hover:bg-surface-hover"
              >
                <Download className="h-3.5 w-3.5 text-accent" />
                <span>Export Markdown Summary</span>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Runtime & Security Status</CardTitle>
              <CardDescription>
                Read-only server environment summary (secrets never leave the
                server).
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-muted" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      AI Provider
                    </p>
                    <p className="text-xs text-muted">
                      {status.aiConfigured
                        ? `${status.aiProvider.toUpperCase()} (${status.aiModel})`
                        : "Manual Mode — add Gemini or OpenRouter key in .env"}
                    </p>
                  </div>
                </div>
                <Badge variant={status.aiConfigured ? "success" : "warning"}>
                  {status.aiConfigured ? "Ready" : "Manual"}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Search className="h-4 w-4 text-muted" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Research Engine
                    </p>
                    <p className="text-xs text-muted">
                      {status.researchProvider}
                    </p>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>

              <div className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Database className="h-4 w-4 text-muted" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Persistent Storage
                    </p>
                    <p className="text-xs text-muted">
                      {status.databaseMode === "postgres"
                        ? "PostgreSQL (DATABASE_URL)"
                        : "Local SQLite (data/assistant.sqlite)"}
                    </p>
                  </div>
                </div>
                <Badge variant="success">Persistent</Badge>
              </div>

              <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <Lock className="h-4 w-4 text-muted" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Private Access Gate
                    </p>
                    <p className="text-xs text-muted">
                      {status.accessProtectionEnabled
                        ? "Passcode gate active"
                        : "Bypassed locally (set APP_ACCESS_PASSWORD on Vercel)"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={status.accessProtectionEnabled ? "success" : "neutral"}
                >
                  {status.accessProtectionEnabled ? "Protected" : "Local"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <ProfileEditor initialProfile={profile} />
      </div>
    </div>
  );
}
