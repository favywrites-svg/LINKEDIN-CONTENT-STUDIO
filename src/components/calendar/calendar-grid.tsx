"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CONTENT_PILLARS,
  MONTHLY_POST_TARGET,
  getPillarById,
} from "@/lib/constants";
import type { ContentDraftRecord } from "@/lib/db/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildMonthGrid(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells: Array<{ day: number | null; isoDate: string | null }> = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, isoDate: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(monthIndex + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    cells.push({ day, isoDate: `${year}-${mm}-${dd}` });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, isoDate: null });
  }
  return cells;
}

export function CalendarGrid({ drafts }: { drafts: ContentDraftRecord[] }) {
  const [cursor, setCursor] = React.useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(cursor.year, cursor.month, 1));

  const cells = React.useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Calendar"
        description="Suggested target dates from your weekly packages alongside manually published posts."
        badge={<Badge variant="accent">Target: {MONTHLY_POST_TARGET} / month</Badge>}
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setCursor({ year: now.getFullYear(), month: now.getMonth() });
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                setCursor((p) =>
                  p.month === 0
                    ? { year: p.year - 1, month: 11 }
                    : { year: p.year, month: p.month - 1 }
                )
              }
              aria-label="Previous month"
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium text-foreground">
              {monthLabel}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                setCursor((p) =>
                  p.month === 11
                    ? { year: p.year + 1, month: 0 }
                    : { year: p.year, month: p.month + 1 }
                )
              }
              aria-label="Next month"
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="overflow-hidden xl:col-span-9">
          <div className="grid grid-cols-7 border-b border-border bg-surface-subtle/60">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-border">
            {cells.map((cell, index) => {
              const dayDrafts = cell.isoDate
                ? drafts.filter(
                    (d) =>
                      (d.publishedAt?.slice(0, 10) ?? d.targetPublishDate) ===
                      cell.isoDate
                  )
                : [];
              const isToday = cell.isoDate === todayIso;

              return (
                <div
                  key={index}
                  className="min-h-24 space-y-1.5 bg-surface p-2 sm:min-h-28"
                >
                  {cell.day !== null && (
                    <span
                      className={
                        isToday
                          ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                          : "inline-flex h-6 w-6 items-center justify-center text-xs font-medium text-muted-foreground"
                      }
                    >
                      {cell.day}
                    </span>
                  )}
                  {dayDrafts.map((d) => (
                    <Link
                      key={d.id}
                      href={`/drafts/${d.id}`}
                      className="block truncate rounded bg-accent-soft px-1.5 py-1 text-[11px] font-medium text-accent-soft-foreground hover:opacity-90"
                      title={`${getPillarById(d.pillar).shortName}: ${d.title}`}
                    >
                      {d.title}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Pillar Balance</CardTitle>
              <CardDescription>Active & approved posts vs. target</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {CONTENT_PILLARS.map((pillar) => {
                const count = drafts.filter((d) => d.pillar === pillar.id).length;
                return (
                  <div
                    key={pillar.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-foreground">
                      {pillar.shortName}
                    </span>
                    <span className="shrink-0 font-mono text-muted">
                      {count} / {pillar.monthlyTarget}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-2.5 pt-5 text-xs leading-relaxed text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                Dates are planning targets only. Posts are never published
                automatically to LinkedIn.
              </span>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
