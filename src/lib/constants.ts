export type ContentPillarId =
  | "practical_business_problems"
  | "project_builds"
  | "industry_commentary"
  | "human_reflections";

export interface ContentPillar {
  id: ContentPillarId;
  name: string;
  shortName: string;
  monthlyTarget: number;
  purpose: string;
}

export const AUTHOR_NAME = "Efe";

export const CONTENT_PILLARS: readonly ContentPillar[] = [
  {
    id: "practical_business_problems",
    name: "Practical business problems and AI implementation",
    shortName: "Business Problems & AI",
    monthlyTarget: 4,
    purpose:
      "Show understanding of real operational problems and how technology may help.",
  },
  {
    id: "project_builds",
    name: "Project builds and workflow demonstrations",
    shortName: "Project Builds",
    monthlyTarget: 3,
    purpose:
      "Demonstrate practical ability, decisions, trade-offs, and learning.",
  },
  {
    id: "industry_commentary",
    name: "AI industry commentary and business developments",
    shortName: "Industry Commentary",
    monthlyTarget: 3,
    purpose:
      "Interpret developments and explain business implications, not merely report news.",
  },
  {
    id: "human_reflections",
    name: "Human reflections and professional perspectives",
    shortName: "Human Reflections",
    monthlyTarget: 2,
    purpose: "Share considered views on work, productivity, and technology.",
  },
] as const;

export const MONTHLY_POST_TARGET = CONTENT_PILLARS.reduce(
  (sum, pillar) => sum + pillar.monthlyTarget,
  0
);

export const DEFAULT_WEEKLY_POST_COUNT = 4;

export interface DashboardModelOption {
  id: string;
  label: string;
  provider: "auto" | "gemini" | "openrouter";
}

export const DASHBOARD_MODEL_OPTIONS: readonly DashboardModelOption[] = [
  {
    id: "auto",
    label: "Auto (Best Available Free Model)",
    provider: "auto",
  },
  {
    id: "gemini:gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash Lite (Fast)",
    provider: "gemini",
  },
  {
    id: "gemini:gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    provider: "gemini",
  },
  {
    id: "openrouter:google/gemma-4-31b-it:free",
    label: "Gemma 4 · 31B (OpenRouter Free)",
    provider: "openrouter",
  },
  {
    id: "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Nemotron Ultra · 550B (OpenRouter Free)",
    provider: "openrouter",
  },
  {
    id: "openrouter:nvidia/nemotron-3.5-lightning:free",
    label: "Nemotron 3.5 Lightning (OpenRouter Free)",
    provider: "openrouter",
  },
] as const;

export function getPillarById(id: string): ContentPillar {
  return (
    CONTENT_PILLARS.find((pillar) => pillar.id === id) ?? CONTENT_PILLARS[0]
  );
}

export type WorkflowStatus =
  | "idea"
  | "in_progress"
  | "draft"
  | "ready_for_review"
  | "approved"
  | "published"
  | "rejected"
  | "archived";

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  idea: "Idea",
  in_progress: "In Progress",
  draft: "Draft",
  ready_for_review: "Ready for Review",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
};

export interface NavItem {
  id: string;
  label: string;
  href: string;
  description: string;
  group: "workspace" | "publishing" | "system";
}

export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    description:
      "Personalised command centre, weekly content generator, and active package",
    group: "workspace",
  },
  {
    id: "ideas",
    label: "Content Ideas",
    href: "/ideas",
    description: "Selected content opportunities, rationale, and pillar mix",
    group: "workspace",
  },
  {
    id: "research",
    label: "Research",
    href: "/research",
    description:
      "Verified primary sources, evidence notes, caveats, and publication dates",
    group: "workspace",
  },
  {
    id: "drafts",
    label: "Drafts",
    href: "/drafts",
    description:
      "Generated posts, Writing Studio, single-post regeneration, and QA reviews",
    group: "workspace",
  },
  {
    id: "calendar",
    label: "Content Calendar",
    href: "/calendar",
    description: "Plan target publishing dates against your ~3/week rhythm",
    group: "publishing",
  },
  {
    id: "approved",
    label: "Approved",
    href: "/approved",
    description: "Explicitly approved posts ready to copy and publish manually",
    group: "publishing",
  },
  {
    id: "memory",
    label: "Editorial Memory",
    href: "/memory",
    description:
      "Writing preferences, prohibited language, and verified professional knowledge",
    group: "system",
  },
  {
    id: "archive",
    label: "Archive",
    href: "/archive",
    description: "Archived ideas, research records, and retired drafts",
    group: "system",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    description:
      "AI provider configuration, author positioning, and workspace status",
    group: "system",
  },
] as const;

export const WEEKLY_GENERATION_STAGES = [
  {
    key: "context_review",
    step: 1,
    label: "Context review",
    description:
      "Loading your positioning, editorial memory, prohibited language, and past posts.",
  },
  {
    key: "content_intelligence",
    step: 2,
    label: "Content intelligence",
    description:
      "Evaluating pillar balance, recent angles, and underrepresented areas.",
  },
  {
    key: "research",
    step: 3,
    label: "Research",
    description:
      "Gathering and checking primary research, clinical/tech papers, and credible publications.",
  },
  {
    key: "content_selection",
    step: 4,
    label: "Content selection",
    description:
      "Selecting a balanced set of distinct angles that demonstrate real expertise.",
  },
  {
    key: "content_generation",
    step: 5,
    label: "Content generation",
    description:
      "Writing complete LinkedIn posts in your voice with varied hooks and structures.",
  },
  {
    key: "quality_assurance",
    step: 6,
    label: "Quality assurance",
    description:
      "Checking factual support, prohibited expressions, originality, and missing personal context.",
  },
  {
    key: "presentation",
    step: 7,
    label: "Presentation",
    description:
      "Saving your weekly content package and source trail for review.",
  },
] as const;

export type WeeklyStageKey = (typeof WEEKLY_GENERATION_STAGES)[number]["key"];

export interface SafeRuntimeStatus {
  aiProvider: string;
  aiConfigured: boolean;
  aiModel: string | null;
  researchProvider: string;
  researchConfigured: boolean;
  databaseMode: "postgres" | "sqlite_local";
  databaseConfigured: boolean;
  accessProtectionEnabled: boolean;
  isVercel: boolean;
}

/**
 * Reads only non-secret configuration flags on the server.
 * Never returns API keys, passwords, or connection strings.
 */
export function getSafeRuntimeStatus(
  env: Record<string, string | undefined> = process.env
): SafeRuntimeStatus {
  const hasGeminiKey = Boolean(
    env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0
  );
  const hasOpenRouterKey = Boolean(
    env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim().length > 0
  );

  const requestedProvider = (env.AI_PROVIDER || "auto").toLowerCase();
  let resolvedProvider: "gemini" | "openrouter" | "unconfigured" =
    "unconfigured";

  if (requestedProvider === "gemini" && hasGeminiKey) {
    resolvedProvider = "gemini";
  } else if (requestedProvider === "openrouter" && hasOpenRouterKey) {
    resolvedProvider = "openrouter";
  } else if (requestedProvider === "auto") {
    if (hasGeminiKey) resolvedProvider = "gemini";
    else if (hasOpenRouterKey) resolvedProvider = "openrouter";
  }

  const aiConfigured = resolvedProvider !== "unconfigured";
  const aiModel =
    resolvedProvider === "gemini"
      ? env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite"
      : resolvedProvider === "openrouter"
        ? env.OPENROUTER_MODEL?.trim() ||
          "nvidia/nemotron-3-ultra-550b-a55b:free"
        : null;

  const hasTavilyKey = Boolean(
    env.TAVILY_API_KEY && env.TAVILY_API_KEY.trim().length > 0
  );
  const requestedResearch = (
    env.RESEARCH_PROVIDER || (hasTavilyKey ? "tavily" : "public_sources")
  ).toLowerCase();
  const researchConfigured = requestedResearch === "tavily" && hasTavilyKey;

  const rawDbUrl = env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim() || "";
  const hasPostgresUrl = Boolean(
    rawDbUrl.length > 0 && !rawDbUrl.includes("USER:PASSWORD@HOST")
  );
  const isVercel = Boolean(env.VERCEL);

  return {
    aiProvider: resolvedProvider,
    aiConfigured,
    aiModel,
    researchProvider: researchConfigured
      ? "tavily + primary feeds"
      : "primary feeds (arXiv, PubMed, web)",
    researchConfigured: true,
    databaseMode: hasPostgresUrl ? "postgres" : "sqlite_local",
    databaseConfigured: hasPostgresUrl || !isVercel,
    accessProtectionEnabled: Boolean(
      env.APP_ACCESS_PASSWORD && env.APP_ACCESS_PASSWORD.trim().length > 0
    ),
    isVercel,
  };
}

export function getGreetingForHour(hour: number, name = AUTHOR_NAME): {
  headline: string;
  subline: string;
} {
  const timeOfDay =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const headline = `Good ${timeOfDay}, ${name}!`;

  const sublines = [
    `Ready to put some sharp, practical thinking out this week? Tell me when to start and I'll handle the research and first drafts.`,
    `Whenever you're ready, click Generate This Week's Content and I'll pull fresh evidence, balance your pillars, and draft the week's posts.`,
    `Good to see you, ${name}. Let's turn real operational problems and fresh research into thoughtful posts without the manual busywork.`,
    `Your editorial workspace is ready. Ask for this week's content anytime, or jump straight into an active draft.`,
  ];
  const index = hour % sublines.length;
  return { headline, subline: sublines[index] };
}
