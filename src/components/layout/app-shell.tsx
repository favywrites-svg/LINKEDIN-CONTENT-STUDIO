"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  FilePenLine,
  LayoutDashboard,
  Lightbulb,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  PRIMARY_NAV_ITEMS,
  type NavItem,
  type SafeRuntimeStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { ColleagueDrawer } from "@/components/assistant/colleague-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  ideas: Lightbulb,
  research: BookOpen,
  drafts: FilePenLine,
  calendar: CalendarDays,
  approved: CheckCircle2,
  memory: Brain,
  archive: Archive,
  settings: Settings,
};

const GROUP_LABELS: Record<NavItem["group"], string> = {
  workspace: "Main",
  publishing: "Schedule & Approved",
  system: "Preferences",
};

interface AppShellProps {
  children: React.ReactNode;
  runtimeStatus: SafeRuntimeStatus;
}

export function AppShell({ children, runtimeStatus }: AppShellProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setPendingHref(null);
    setMobileMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const displayedPath = pendingHref ?? pathname;

  const currentNav =
    PRIMARY_NAV_ITEMS.find((item) =>
      item.href === "/"
        ? displayedPath === "/"
        : displayedPath.startsWith(item.href)
    ) ?? PRIMARY_NAV_ITEMS[0];

  const groupedNav = React.useMemo(() => {
    const groups: NavItem["group"][] = ["workspace", "publishing", "system"];
    return groups.map((group) => ({
      group,
      label: GROUP_LABELS[group],
      items: PRIMARY_NAV_ITEMS.filter((item) => item.group === group),
    }));
  }, []);

  const renderNavLinks = (collapsed: boolean) => (
    <nav
      aria-label="Primary navigation"
      className="flex-1 space-y-6 overflow-y-auto px-3.5 py-5"
    >
      {groupedNav.map(({ group, label, items }) => (
        <div key={group} className="space-y-1">
          {!collapsed && (
            <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              {label}
            </p>
          )}
          {items.map((item) => {
            const Icon = NAV_ICONS[item.id] ?? LayoutDashboard;
            const isActive =
              item.href === "/"
                ? displayedPath === "/"
                : displayedPath.startsWith(item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={true}
                onClick={() => setPendingHref(item.href)}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                  isActive
                    ? "bg-accent-soft text-accent-soft-foreground"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    isActive
                      ? "text-accent"
                      : "text-muted group-hover:text-foreground"
                  )}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar-bg transition-[width] duration-200 lg:flex lg:flex-col",
          sidebarCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-4",
            sidebarCollapsed ? "justify-center" : "justify-between"
          )}
        >
          <Link
            href="/"
            prefetch={true}
            onClick={() => setPendingHref("/")}
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-xs">
              <FilePenLine className="h-4 w-4" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-tight text-foreground">
                  Content Studio
                </p>
                <p className="truncate text-xs text-muted">
                  LinkedIn Assistant
                </p>
              </div>
            )}
          </Link>
          {!sidebarCollapsed && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="h-8 w-8 text-muted"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        {renderNavLinks(sidebarCollapsed)}

        <div className="border-t border-sidebar-border p-3.5">
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="h-8 w-8 text-muted"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface-subtle/70 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 text-accent" />
                <span>You Stay in Control</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Posts are never published without you copying them yourself.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar-bg shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <FilePenLine className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Content Studio
                  </p>
                  <p className="text-xs text-muted">LinkedIn Assistant</p>
                </div>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {renderNavLinks(false)}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="h-9 w-9 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <span className="truncate text-base font-semibold text-foreground">
              {currentNav.label}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <ColleagueDrawer />
            <Link
              href="/settings"
              prefetch={true}
              className="hidden sm:inline-flex"
            >
              {runtimeStatus.aiConfigured ? (
                <Badge variant="accent" className="cursor-pointer py-1 px-3">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Ready</span>
                </Badge>
              ) : (
                <Badge variant="warning" className="cursor-pointer py-1 px-3">
                  <span>Setup AI Key</span>
                </Badge>
              )}
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
