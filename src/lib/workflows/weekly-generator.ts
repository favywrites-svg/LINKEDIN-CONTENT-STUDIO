import { z } from "zod";
import {
  CONTENT_PILLARS,
  DEFAULT_WEEKLY_POST_COUNT,
  type ContentPillarId,
} from "@/lib/constants";
import { getRepository, type StorageRepository } from "@/lib/db/repository";
import type {
  AuthorProfileRecord,
  ContentDraftRecord,
  ContentIntelligenceSummary,
  EditorialMemoryItem,
  ResearchSourceRecord,
  WeeklyPackageRecord,
} from "@/lib/db/types";
import { getActiveAIProvider, type AIProvider } from "@/lib/ai/provider";
import { runLiveWeeklyResearch } from "@/lib/research/live-research";
import {
  checkTopicSimilarity,
  detectProhibitedLanguage,
  normalizeEmDashes,
  runDeterministicQualityReview,
} from "@/lib/editorial/guardrails";

const PILLAR_IDS: [ContentPillarId, ...ContentPillarId[]] = [
  "practical_business_problems",
  "project_builds",
  "industry_commentary",
  "human_reflections",
];

const ContentSelectionSchema = z.object({
  assistantNote: z.string(),
  topics: z.array(
    z.object({
      title: z.string(),
      pillar: z.enum(PILLAR_IDS),
      intendedAudience: z.string(),
      problemOrOpportunity: z.string(),
      centralAngle: z.string(),
      expertiseDemonstrated: z.string(),
      whySelected: z.string(),
      hookStyle: z.string(),
      structureType: z.string(),
      healthcareRelevant: z.boolean(),
      sourceIndices: z.array(z.number().int().min(0)),
    })
  ),
});

const GeneratedPostsSchema = z.object({
  posts: z.array(
    z.object({
      topicIndex: z.number().int().min(0),
      title: z.string(),
      body: z.string(),
      missingAuthorInput: z.object({
        needed: z.boolean(),
        question: z.string(),
        whyItMatters: z.string(),
      }),
      visualRecommendation: z.object({
        choice: z.enum(["none", "sourced_image", "simple_diagram"]),
        rationale: z.string(),
      }),
      qualitySelfCheck: z.object({
        factualSupport: z.enum(["strong", "needs_review"]),
        voiceAlignment: z.enum(["strong", "needs_review"]),
        originality: z.enum(["strong", "needs_review"]),
        practicalValue: z.enum(["strong", "needs_review"]),
        overallNote: z.string(),
        issues: z.array(z.string()),
        strengths: z.array(z.string()),
      }),
    })
  ),
});

const SingleDraftRevisionSchema = z.object({
  title: z.string(),
  body: z.string(),
  hookStyle: z.string().default("Updated opening"),
  structureType: z.string().default("Refined post structure"),
  colleagueNote: z.string().default("Updated draft according to your instructions."),
  missingAuthorInput: z
    .object({
      needed: z.boolean().default(false),
      question: z.string().default(""),
      whyItMatters: z.string().default(""),
    })
    .default({ needed: false, question: "", whyItMatters: "" }),
  qualityCheck: z
    .object({
      factualSupport: z.enum(["strong", "needs_review"]).default("strong"),
      voiceAlignment: z.enum(["strong", "needs_review"]).default("strong"),
      originality: z.enum(["strong", "needs_review"]).default("strong"),
      practicalValue: z.enum(["strong", "needs_review"]).default("strong"),
      overallNote: z.string().default("Revised against Brand Voice rules."),
      issues: z.array(z.string()).default([]),
      strengths: z.array(z.string()).default(["Clear practical message"]),
    })
    .default({
      factualSupport: "strong",
      voiceAlignment: "strong",
      originality: "strong",
      practicalValue: "strong",
      overallNote: "Revised against Brand Voice rules.",
      issues: [],
      strengths: ["Clear practical message"],
    }),
});

export function buildWeekLabel(date = new Date()): string {
  const start = new Date(date);
  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(start);
  return `Week of ${formatted}`;
}

function suggestTargetDates(count: number, baseDate = new Date()): string[] {
  const dates: string[] = [];
  const cursor = new Date(baseDate);
  const spacingDays = count <= 3 ? 2 : 1;

  for (let i = 0; i < count; i++) {
    cursor.setDate(cursor.getDate() + (i === 0 ? 1 : spacingDays));
    if (cursor.getDay() === 0) {
      cursor.setDate(cursor.getDate() + 1);
    }
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

export function computeContentIntelligence(
  pastDrafts: ContentDraftRecord[]
): ContentIntelligenceSummary {
  const activeHistory = pastDrafts.filter(
    (d) => d.status !== "rejected" && d.status !== "archived"
  );

  const pillarCounts: Record<ContentPillarId, number> = {
    practical_business_problems: 0,
    project_builds: 0,
    industry_commentary: 0,
    human_reflections: 0,
  };

  for (const draft of activeHistory.slice(0, 24)) {
    if (pillarCounts[draft.pillar] !== undefined) {
      pillarCounts[draft.pillar] += 1;
    }
  }

  const totalRecent = Object.values(pillarCounts).reduce((a, b) => a + b, 0);

  // Rank pillars by deficit relative to monthly target ratio (4/12, 3/12, 3/12, 2/12)
  const scored = CONTENT_PILLARS.map((pillar) => {
    const targetShare = pillar.monthlyTarget / 12;
    const actualShare =
      totalRecent === 0 ? 0 : pillarCounts[pillar.id] / totalRecent;
    return {
      id: pillar.id,
      deficit: targetShare - actualShare,
    };
  }).sort((a, b) => b.deficit - a.deficit);

  const underrepresentedPillars = scored.slice(0, 3).map((s) => s.id);
  const recentTopicsAvoided = activeHistory
    .slice(0, 10)
    .map((d) => d.title);
  const recentHooksAvoided = Array.from(
    new Set(
      activeHistory
        .slice(0, 6)
        .map((d) => d.hookStyle)
        .filter(Boolean)
    )
  );

  // Include digital health / pharma lens naturally if <= 35% of recent posts touched it
  const recentHealthMentions = activeHistory
    .slice(0, 9)
    .filter((d) =>
      /health|pharma|clinic|patient|hospital|medica/i.test(
        `${d.title} ${d.body}`
      )
    ).length;
  const includeHealthcareLens =
    activeHistory.length === 0 ||
    recentHealthMentions / Math.min(activeHistory.length, 9) <= 0.35;

  const rationale =
    totalRecent === 0
      ? "First weekly package: balancing Practical Business Problems, Project/Workflow thinking, and Industry Analysis while weaving in your digital-health/pharmacy lens naturally on at most one post."
      : `Reviewed ${activeHistory.length} previous post(s). Prioritising underrepresented pillars (${underrepresentedPillars
          .map(
            (id) =>
              CONTENT_PILLARS.find((p) => p.id === id)?.shortName ?? id
          )
          .join(", ")}) while avoiding ${recentTopicsAvoided.length} recent topic angle(s).`;

  return {
    totalHistoricalPosts: activeHistory.length,
    pillarCounts,
    underrepresentedPillars,
    recentTopicsAvoided,
    recentHooksAvoided,
    includeHealthcareLens,
    rationale,
  };
}

function buildEditorialSystemPrompt(
  profile: AuthorProfileRecord,
  memoryItems: EditorialMemoryItem[]
): string {
  const prohibitions = memoryItems
    .filter((m) => m.active && m.confirmed && m.category === "prohibited_language")
    .map((m) => `- "${m.pattern}" (${m.ruleExplanation})`)
    .join("\n");

  const preferences = memoryItems
    .filter((m) => m.active && m.confirmed && m.category !== "prohibited_language")
    .map((m) => `- [${m.category}] ${m.pattern}: ${m.ruleExplanation}`)
    .join("\n");

  const projects = profile.confirmedProjects
    .map(
      (p) =>
        `- ${p.name} [Status: ${p.status.toUpperCase()}]: ${p.summary} | Confirmed lessons: ${p.confirmedLessons}`
    )
    .join("\n");

  return `You are Efe's friendly, sharp, self-directed LinkedIn Content Partner.
Author preferred name: ${profile.preferredName}
Positioning: ${profile.positioning}
Target audiences: ${profile.audiences.join("; ")}
Voice & style: ${profile.voiceSummary}

CONFIRMED BACKGROUND & PROJECTS (NEVER invent unverified projects, clients, metrics, credentials, or personal stories):
${profile.confirmedBackground.map((b) => `- ${b}`).join("\n")}
${projects || "- None confirmed beyond positioning."}

STRICT PROHIBITED LANGUAGE (NEVER USE THESE OR CLOSE VARIATIONS):
${prohibitions || "- Never use em dashes (—)."}

SAVED EDITORIAL PREFERENCES:
${preferences || "- Lead with the real problem before the tool."}

NON-NEGOTIABLE EDITORIAL RULES:
1. Every post must demonstrate real business/operational problem understanding, practical AI implementation judgment, or critical thinking. Never write shallow news summaries.
2. Never use em dashes (—). Use commas, full stops, colons, or parentheses instead.
3. Sound like a thoughtful, warm, articulate human professional (with subtle, natural Nigerian conversational clarity where fitting, never forced slang).
4. Never fabricate personal anecdotes, client engagements, revenue/time-saved percentages, or production deployments. Distinguish Concept, Prototype, Experiment, and Production honestly.
5. Do not force a question or hashtags at the end of every post.`;
}

export async function executeWeeklyGeneration(options?: {
  postCount?: number;
  userInstruction?: string;
  repo?: StorageRepository;
  aiProvider?: AIProvider;
  existingPackageId?: string;
}): Promise<{
  packageRecord: WeeklyPackageRecord;
  drafts: ContentDraftRecord[];
}> {
  const repo = options?.repo ?? getRepository();
  const postCount = Math.min(
    Math.max(options?.postCount ?? DEFAULT_WEEKLY_POST_COUNT, 1),
    7
  );
  const userInstruction =
    options?.userInstruction?.trim() || "Give me content for the week.";

  const pkg = options?.existingPackageId
    ? repo.getWeeklyPackageById(options.existingPackageId)!
    : repo.createWeeklyPackage({
        weekLabel: buildWeekLabel(),
        requestedPostCount: postCount,
        userInstruction,
      });

  try {
    // Stage 1: Context Review
    repo.updateWeeklyPackageStage(
      pkg.id,
      "context_review",
      "running",
      "Loading your positioning, editorial memory, prohibited expressions, and past content...",
      { packageStatus: "running", errorMessage: null }
    );

    const ai = options?.aiProvider ?? getActiveAIProvider();
    const profile = repo.getAuthorProfile();
    const memoryItems = repo.listMemoryItems(true);
    const pastDrafts = repo.listDrafts({ includeArchived: true });
    const existingSources = repo.listResearchSources(false);

    repo.updateWeeklyPackageStage(
      pkg.id,
      "context_review",
      "completed",
      `Loaded profile for ${profile.preferredName}, ${memoryItems.length} active editorial memory rules, and ${pastDrafts.length} historical post(s).`,
      { providerUsed: `${ai.providerName}:${ai.modelName}` }
    );

    // Stage 2: Content Intelligence
    repo.updateWeeklyPackageStage(
      pkg.id,
      "content_intelligence",
      "running",
      "Analysing pillar distribution, topic history, and hook variety..."
    );

    const intelligence = computeContentIntelligence(pastDrafts);

    repo.updateWeeklyPackageStage(
      pkg.id,
      "content_intelligence",
      "completed",
      intelligence.rationale,
      { intelligenceSummary: intelligence }
    );

    // Stage 3: Live Research
    repo.updateWeeklyPackageStage(
      pkg.id,
      "research",
      "running",
      "Researching primary literature (arXiv, PubMed) and credible web sources..."
    );

    const existingUrlSet = new Set(existingSources.map((s) => s.url));
    const liveResearch = await runLiveWeeklyResearch({
      includeHealthcare: intelligence.includeHealthcareLens,
      focusInstruction:
        userInstruction.toLowerCase() === "give me content for the week."
          ? ""
          : userInstruction,
      existingUrls: existingUrlSet,
    });

    const savedSources: ResearchSourceRecord[] = [];
    for (const candidate of liveResearch.sources) {
      savedSources.push(repo.upsertResearchSource(candidate));
    }

    // Include up to 4 recent verified sources from library if live fetch was partial
    const workingSources =
      savedSources.length >= 3
        ? savedSources
        : [
            ...savedSources,
            ...existingSources
              .filter(
                (s) =>
                  s.verificationStatus === "checked" &&
                  !savedSources.some((n) => n.id === s.id)
              )
              .slice(0, 5),
          ];

    const researchDetail =
      savedSources.length > 0
        ? `Verified and saved ${savedSources.length} live research source(s) (${workingSources.length} total sources available for grounding).`
        : workingSources.length > 0
          ? `Live source feeds were unreachable (${liveResearch.warnings.join("; ") || "network unavailable"}); grounding in ${workingSources.length} previously verified library source(s).`
          : `No external research feeds could be reached right now; topics will rely strictly on operational reasoning and confirmed background without citing external studies.`;

    repo.updateWeeklyPackageStage(
      pkg.id,
      "research",
      "completed",
      researchDetail
    );

    // Stage 4: Content Selection
    repo.updateWeeklyPackageStage(
      pkg.id,
      "content_selection",
      "running",
      `Selecting ${postCount} distinct, non-repetitive topics across your pillars...`
    );

    const systemPrompt = buildEditorialSystemPrompt(profile, memoryItems);
    const numberedSources = workingSources
      .map(
        (s, idx) =>
          `[${idx}] "${s.title}" (${s.publisher}, ${s.publicationDate ?? "recent"}) — URL: ${s.url}\nSummary: ${s.summary}\nLimitations: ${s.limitations}`
      )
      .join("\n\n");

    const selectionResult = await ai.generateStructured({
      systemPrompt,
      userPrompt: `Plan ${postCount} distinct LinkedIn posts for ${pkg.weekLabel}.
User request: "${userInstruction}"

CONTENT INTELLIGENCE:
- Underrepresented pillars to prioritise: ${intelligence.underrepresentedPillars.join(", ")}
- Include at most 1 natural digital-health / pharmacy-operations angle this week: ${intelligence.includeHealthcareLens ? "Yes (1 post)" : "Optional, do not over-index on healthcare"}
- Recent post titles to AVOID repeating: ${intelligence.recentTopicsAvoided.join(" | ") || "None yet"}
- Recent hook styles to vary away from: ${intelligence.recentHooksAvoided.join(", ") || "None yet"}

VERIFIED RESEARCH SOURCES AVAILABLE (only reference indices that genuinely fit; never invent other sources):
${numberedSources || "No external sources fetched; focus on practical business workflow analysis, AI implementation decisions, and confirmed prototype lessons."}

Select exactly ${postCount} balanced topics using different pillars, different hook styles (e.g., sharp operational observation, contrarian implementation reality, concrete workflow breakdown, calm reflection), and different post structures.

Return JSON matching:
{
  "assistantNote": "Warm, brief 2-sentence colleague explanation to Efe explaining why you chose this week's mix",
  "topics": [
    {
      "title": "Working title",
      "pillar": "practical_business_problems" | "project_builds" | "industry_commentary" | "human_reflections",
      "intendedAudience": "Specific target reader",
      "problemOrOpportunity": "The concrete operational or human problem",
      "centralAngle": "The distinct argument or perspective",
      "expertiseDemonstrated": "What capability this shows recruiters/founders/ops leaders",
      "whySelected": "Why this topic was chosen now based on pillar balance & research",
      "hookStyle": "Short label for the opening approach",
      "structureType": "Short label for the post structure",
      "healthcareRelevant": boolean,
      "sourceIndices": [0]
    }
  ]
}`,
      schema: ContentSelectionSchema,
      temperature: 0.7,
    });

    const chosenTopics = selectionResult.topics.slice(0, postCount);
    if (chosenTopics.length === 0) {
      throw new Error("Content selection returned zero topics.");
    }

    const createdIdeas = chosenTopics.map((topic) => {
      const validSourceIds = topic.sourceIndices
        .map((idx) => workingSources[idx]?.id)
        .filter((id): id is string => Boolean(id));

      return repo.createContentIdea({
        weeklyPackageId: pkg.id,
        title: topic.title,
        pillar: topic.pillar,
        intendedAudience: topic.intendedAudience,
        problemOrOpportunity: topic.problemOrOpportunity,
        centralAngle: topic.centralAngle,
        expertiseDemonstrated: topic.expertiseDemonstrated,
        whySelected: topic.whySelected,
        healthcareRelevant: topic.healthcareRelevant,
        status: "drafted",
        sourceIds: validSourceIds,
      });
    });

    repo.updateWeeklyPackageStage(
      pkg.id,
      "content_selection",
      "completed",
      `Selected ${chosenTopics.length} complementary topics across ${new Set(chosenTopics.map((t) => t.pillar)).size} pillar(s).`
    );

    // Stage 5: Content Generation
    repo.updateWeeklyPackageStage(
      pkg.id,
      "content_generation",
      "running",
      `Writing ${chosenTopics.length} complete LinkedIn posts in Efe's voice...`
    );

    const generationResult = await ai.generateStructured({
      systemPrompt,
      userPrompt: `Write complete, publication-grade LinkedIn posts for each selected topic below.

SELECTED TOPICS:
${chosenTopics
  .map(
    (t, idx) =>
      `Topic ${idx}: "${t.title}"
- Pillar: ${t.pillar}
- Audience: ${t.intendedAudience}
- Problem: ${t.problemOrOpportunity}
- Central Angle: ${t.centralAngle}
- Hook Style: ${t.hookStyle}
- Structure: ${t.structureType}
- Linked Source Indices: ${JSON.stringify(t.sourceIndices)}`
  )
  .join("\n\n")}

VERIFIED RESEARCH SOURCES:
${numberedSources || "None (rely on clear operational reasoning without inventing external stats)."}

WRITING & INTEGRITY INSTRUCTIONS:
- Generate the complete LinkedIn post body (typically 130 to 240 words, separated by clean blank lines for readability).
- Make each post sound distinct in opening, rhythm, and ending.
- NEVER use em dashes (—) or any prohibited expression.
- NEVER invent personal stories, client engagements, metrics, or project outcomes Efe hasn't confirmed. If a post discusses Efe's confirmed prototype, explicitly treat it as a prototype, not a customer-deployed system.
- If a post would become stronger with a personal observation, opinion, or real workflow story from Efe, still write a strong, honest initial draft now AND set missingAuthorInput.needed = true with one specific, friendly question for Efe. Otherwise set missingAuthorInput.needed = false.
- Recommend a visual ONLY if a sourced figure or simple workflow diagram genuinely improves comprehension; otherwise choose "none".

Return JSON matching:
{
  "posts": [
    {
      "topicIndex": 0,
      "title": "Post working title",
      "body": "Full LinkedIn post text with \\n\\n paragraph breaks",
      "missingAuthorInput": {
        "needed": boolean,
        "question": "Specific question for Efe if needed, else empty string",
        "whyItMatters": "Why Efe's input helps here, else empty string"
      },
      "visualRecommendation": {
        "choice": "none" | "sourced_image" | "simple_diagram",
        "rationale": "Clear 1-sentence reason"
      },
      "qualitySelfCheck": {
        "factualSupport": "strong" | "needs_review",
        "voiceAlignment": "strong" | "needs_review",
        "originality": "strong" | "needs_review",
        "practicalValue": "strong" | "needs_review",
        "overallNote": "Honest assessment of the draft",
        "issues": [],
        "strengths": ["Specific strength"]
      }
    }
  ]
}`,
      schema: GeneratedPostsSchema,
      temperature: 0.65,
      timeoutMs: 90000,
    });

    repo.updateWeeklyPackageStage(
      pkg.id,
      "content_generation",
      "completed",
      `Generated ${generationResult.posts.length} full LinkedIn draft(s).`
    );

    // Stage 6: Quality Assurance & Prohibited Language Enforcement
    repo.updateWeeklyPackageStage(
      pkg.id,
      "quality_assurance",
      "running",
      "Running prohibited-language checks, em-dash scrub, and editorial QA..."
    );

    const targetDates = suggestTargetDates(chosenTopics.length);
    const savedDrafts: ContentDraftRecord[] = [];
    let qaFlagCount = 0;

    for (let i = 0; i < chosenTopics.length; i++) {
      const topic = chosenTopics[i];
      const idea = createdIdeas[i];
      const generated =
        generationResult.posts.find((p) => p.topicIndex === i) ??
        generationResult.posts[i];

      if (!generated) continue;

      // Normalize accidental em dashes first, then check remaining prohibited language
      const cleanedBody = normalizeEmDashes(generated.body.trim());
      const cleanedTitle = normalizeEmDashes(generated.title.trim());
      const violations = detectProhibitedLanguage(
        `${cleanedTitle}\n${cleanedBody}`,
        memoryItems
      );

      const overlaps = checkTopicSimilarity(
        `${cleanedTitle}\n${cleanedBody}`,
        pastDrafts
      );
      const similarityWarnings = overlaps.map(
        (o) =>
          `Overlap (${Math.round(o.score * 100)}%) with prior post "${o.title}"`
      );

      const issues = [
        ...generated.qualitySelfCheck.issues,
        ...similarityWarnings,
      ];
      if (violations.length > 0) {
        qaFlagCount += 1;
        issues.push(
          `Contains prohibited expression(s) from Editorial Memory: ${violations.join(", ")}`
        );
      }

      const overallPassed =
        violations.length === 0 &&
        overlaps.length === 0 &&
        generated.qualitySelfCheck.factualSupport === "strong" &&
        generated.qualitySelfCheck.voiceAlignment === "strong";

      if (!overallPassed) qaFlagCount += 1;

      const draft = repo.createContentDraft({
        weeklyPackageId: pkg.id,
        ideaId: idea.id,
        slotIndex: i,
        title: cleanedTitle,
        body: cleanedBody,
        pillar: topic.pillar,
        intendedAudience: topic.intendedAudience,
        hookStyle: topic.hookStyle,
        structureType: topic.structureType,
        selectionRationale: topic.whySelected,
        status: overallPassed ? "ready_for_review" : "draft",
        qualityReview: {
          overallPassed,
          overallNote: generated.qualitySelfCheck.overallNote,
          factualSupport: generated.qualitySelfCheck.factualSupport,
          voiceAlignment:
            violations.length > 0
              ? "needs_review"
              : generated.qualitySelfCheck.voiceAlignment,
          originality:
            overlaps.length > 0
              ? "needs_review"
              : generated.qualitySelfCheck.originality,
          practicalValue: generated.qualitySelfCheck.practicalValue,
          prohibitedLanguageFound: violations,
          similarityWarnings,
          issues,
          strengths: generated.qualitySelfCheck.strengths,
        },
        missingAuthorInput: generated.missingAuthorInput.needed
          ? {
              needed: true,
              question: generated.missingAuthorInput.question,
              whyItMatters: generated.missingAuthorInput.whyItMatters,
            }
          : { needed: false, question: "", whyItMatters: "" },
        visualRecommendation: generated.visualRecommendation,
        targetPublishDate: targetDates[i] ?? null,
        sourceIds: idea.sourceIds,
      });

      savedDrafts.push(draft);
    }

    repo.updateWeeklyPackageStage(
      pkg.id,
      "quality_assurance",
      "completed",
      qaFlagCount === 0
        ? `All ${savedDrafts.length} posts passed prohibited-language and voice QA checks.`
        : `Completed QA across ${savedDrafts.length} posts (${qaFlagCount} item(s) flagged for closer review).`
    );

    // Stage 7: Presentation
    const finalPkg = repo.updateWeeklyPackageStage(
      pkg.id,
      "presentation",
      "completed",
      `Saved ${savedDrafts.length} drafts to your weekly package for review.`,
      {
        packageStatus: "completed",
        assistantSummary: selectionResult.assistantNote,
        errorMessage: null,
      }
    );

    return {
      packageRecord: finalPkg,
      drafts: savedDrafts,
    };
  } catch (err) {
    const currentPkg = repo.getWeeklyPackageById(pkg.id)!;
    const message =
      err instanceof Error
        ? err.message
        : "Weekly content generation failed unexpectedly.";

    const failedPkg = repo.updateWeeklyPackageStage(
      pkg.id,
      currentPkg.currentStage,
      "failed",
      message,
      {
        packageStatus: "failed",
        errorMessage: message,
      }
    );

    throw Object.assign(new Error(message), { packageRecord: failedPkg });
  }
}

/**
 * Regenerates or revises a single post without touching the rest of the weekly package.
 */
export async function regenerateSingleDraft(options: {
  draftId: string;
  instruction?: string;
  suppliedAuthorInput?: string;
  saveFeedbackAsRule?: boolean;
  previewOnly?: boolean;
  repo?: StorageRepository;
  aiProvider?: AIProvider;
}): Promise<{
  draft: ContentDraftRecord;
  proposedTitle: string;
  proposedBody: string;
  colleagueNote: string;
}> {
  const repo = options.repo ?? getRepository();
  const draft = repo.getDraftById(options.draftId);
  if (!draft) {
    throw new Error("Draft not found.");
  }

  const ai = options.aiProvider ?? getActiveAIProvider();
  const profile = repo.getAuthorProfile();
  const memoryItems = repo.listMemoryItems(true);
  const systemPrompt = buildEditorialSystemPrompt(profile, memoryItems);

  const instructionText =
    options.instruction?.trim() ||
    (options.suppliedAuthorInput
      ? "Incorporate Efe's supplied personal perspective naturally while preserving factual accuracy."
      : "Regenerate this post with a sharper, fresher angle and stronger opening.");

  if (options.saveFeedbackAsRule && options.instruction?.trim()) {
    repo.addMemoryItem({
      category: "writing_preference",
      origin: "explicit",
      pattern: options.instruction.trim(),
      ruleExplanation:
        "Explicitly saved by Efe during draft revision for all future posts.",
      confirmed: true,
      sourceDraftId: draft.id,
    });
  }

  const sourcesContext =
    (draft.sources ?? [])
      .map(
        (s) =>
          `- "${s.title}" (${s.publisher}, ${s.publicationDate ?? "recent"}): ${s.summary}`
      )
      .join("\n") || "No external sources attached; rely on verified operational reasoning.";

  const result = await ai.generateStructured({
    systemPrompt,
    userPrompt: `Revise or regenerate this individual LinkedIn draft for Efe.

CURRENT DRAFT TITLE: ${draft.title}
PILLAR: ${draft.pillar}
INTENDED AUDIENCE: ${draft.intendedAudience}
TOPIC RATIONALE: ${draft.selectionRationale}

CURRENT BODY:
${draft.body}

VERIFIED SOURCES LINKED TO THIS DRAFT:
${sourcesContext}

${
  options.suppliedAuthorInput?.trim()
    ? `EFE'S SUPPLIED PERSONAL EXPERIENCE / PERSPECTIVE (use accurately, do not embellish beyond what Efe stated):\n"${options.suppliedAuthorInput.trim()}"`
    : ""
}

REVISION / REGENERATION INSTRUCTION FROM EFE:
"${instructionText}"

Requirements:
- Preserve factual accuracy and all prohibited-language rules (including zero em dashes).
- Never invent personal details or project results beyond what Efe supplied.
- Return JSON matching:
{
  "title": "Updated working title",
  "body": "Complete revised LinkedIn post body",
  "hookStyle": "Opening hook style used",
  "structureType": "Post structure used",
  "colleagueNote": "Friendly 1-2 sentence explanation to Efe of what you changed",
  "missingAuthorInput": {
    "needed": boolean,
    "question": "",
    "whyItMatters": ""
  },
  "qualityCheck": {
    "factualSupport": "strong" | "needs_review",
    "voiceAlignment": "strong" | "needs_review",
    "originality": "strong" | "needs_review",
    "practicalValue": "strong" | "needs_review",
    "overallNote": "Brief QA summary",
    "issues": [],
    "strengths": ["Key strength"]
  }
}`,
    schema: SingleDraftRevisionSchema,
    temperature: 0.65,
  });

  const cleanedBody = normalizeEmDashes(result.body.trim());
  const cleanedTitle = normalizeEmDashes(result.title.trim());
  const refreshedMemory = repo.listMemoryItems(true);
  const violations = detectProhibitedLanguage(
    `${cleanedTitle}\n${cleanedBody}`,
    refreshedMemory
  );

  const issues = [...result.qualityCheck.issues];
  if (violations.length > 0) {
    issues.push(`Prohibited language detected: ${violations.join(", ")}`);
  }

  const overallPassed =
    violations.length === 0 &&
    result.qualityCheck.factualSupport === "strong" &&
    result.qualityCheck.voiceAlignment === "strong";

  if (options.previewOnly) {
    return {
      draft,
      proposedTitle: cleanedTitle,
      proposedBody: cleanedBody,
      colleagueNote: result.colleagueNote,
    };
  }

  const updated = repo.updateDraft(draft.id, {
    title: cleanedTitle,
    body: cleanedBody,
    hookStyle: result.hookStyle,
    structureType: result.structureType,
    status: overallPassed ? "ready_for_review" : "draft",
    actor: "assistant",
    revisionNote: instructionText,
    missingAuthorInput: options.suppliedAuthorInput?.trim()
      ? {
          needed: false,
          question: draft.missingAuthorInput?.question ?? "",
          whyItMatters: draft.missingAuthorInput?.whyItMatters ?? "",
          suppliedAnswer: options.suppliedAuthorInput.trim(),
        }
      : result.missingAuthorInput,
    qualityReview: {
      overallPassed,
      overallNote: result.qualityCheck.overallNote,
      factualSupport: result.qualityCheck.factualSupport,
      voiceAlignment:
        violations.length > 0 ? "needs_review" : result.qualityCheck.voiceAlignment,
      originality: result.qualityCheck.originality,
      practicalValue: result.qualityCheck.practicalValue,
      prohibitedLanguageFound: violations,
      issues,
      strengths: result.qualityCheck.strengths,
    },
  });

  repo.recordFeedback({
    draftId: draft.id,
    eventType: options.suppliedAuthorInput?.trim()
      ? "input_supplied"
      : "regenerated",
    note: instructionText,
    saveAsPermanentRule: Boolean(options.saveFeedbackAsRule),
  });

  return {
    draft: updated,
    proposedTitle: updated.title,
    proposedBody: updated.body,
    colleagueNote: result.colleagueNote,
  };
}

/**
 * AI-assisted research synthesis from selected verified sources (Phase 4).
 */
export async function synthesizeResearchFinding(options: {
  question: string;
  sourceIds: string[];
  repo?: StorageRepository;
  aiProvider?: AIProvider;
}) {
  const repo = options.repo ?? getRepository();
  const ai = options.aiProvider ?? getActiveAIProvider();
  const profile = repo.getAuthorProfile();
  const memory = repo.listMemoryItems(true);

  const sources = options.sourceIds
    .map((id) => repo.getResearchSourceById(id))
    .filter((s): s is ResearchSourceRecord => s !== null);

  if (sources.length === 0) {
    throw new Error("Select at least one verified research source to synthesize.");
  }

  const SynthesisSchema = z.object({
    summary: z.string(),
    businessRelevance: z.string(),
    problemOrOpportunity: z.string(),
    implementationImplications: z.string(),
    uncertainties: z.string(),
    potentialAngles: z.string(),
  });

  const synthesized = await ai.generateStructured({
    systemPrompt: buildEditorialSystemPrompt(profile, memory),
    userPrompt: `Synthesize the following verified source(s) around the question: "${options.question}"

SOURCES:
${sources
  .map(
    (s, i) =>
      `[${i + 1}] ${s.title} (${s.publisher}, ${s.publicationDate ?? "recent"})\nSummary: ${s.summary}\nFindings: ${s.keyFindings}\nLimitations: ${s.limitations}`
  )
  .join("\n\n")}

Return JSON with keys: summary, businessRelevance, problemOrOpportunity, implementationImplications, uncertainties, potentialAngles. Never invent facts beyond the supplied sources.`,
    schema: SynthesisSchema,
  });

  return repo.createResearchFinding({
    question: options.question,
    ...synthesized,
    status: "new",
    sourceIds: sources.map((s) => s.id),
  });
}

/**
 * Generates structured Content Ideas from selected Research Sources/Findings (Phase 4).
 */
export async function generateIdeasFromResearch(options?: {
  sourceIds?: string[];
  count?: number;
  repo?: StorageRepository;
  aiProvider?: AIProvider;
}) {
  const repo = options?.repo ?? getRepository();
  const ai = options?.aiProvider ?? getActiveAIProvider();
  const profile = repo.getAuthorProfile();
  const memory = repo.listMemoryItems(true);
  const pastDrafts = repo.listDrafts({ includeArchived: true });
  const intel = computeContentIntelligence(pastDrafts);

  const allSources = repo.listResearchSources(false);
  const selectedSources =
    options?.sourceIds && options.sourceIds.length > 0
      ? allSources.filter((s) => options.sourceIds!.includes(s.id))
      : allSources.slice(0, 5);

  const count = Math.min(Math.max(options?.count ?? 3, 1), 5);

  const IdeasSchema = z.object({
    ideas: z.array(
      z.object({
        title: z.string(),
        pillar: z.enum(PILLAR_IDS),
        intendedAudience: z.string(),
        problemOrOpportunity: z.string(),
        centralAngle: z.string(),
        expertiseDemonstrated: z.string(),
        whySelected: z.string(),
        authorInputNeeded: z.boolean(),
        authorInputPrompt: z.string(),
        healthcareRelevant: z.boolean(),
      })
    ),
  });

  const generated = await ai.generateStructured({
    systemPrompt: buildEditorialSystemPrompt(profile, memory),
    userPrompt: `Propose ${count} distinct LinkedIn content ideas for Efe.
Underrepresented pillars: ${intel.underrepresentedPillars.join(", ")}.
Prior titles to avoid repeating: ${intel.recentTopicsAvoided.join(" | ") || "None"}.

SOURCES:
${
  selectedSources
    .map((s) => `- ${s.title} (${s.publisher}): ${s.summary}`)
    .join("\n") || "Use operational problem reasoning."
}

Return JSON: { "ideas": [{ title, pillar, intendedAudience, problemOrOpportunity, centralAngle, expertiseDemonstrated, whySelected, authorInputNeeded, authorInputPrompt, healthcareRelevant }] }`,
    schema: IdeasSchema,
  });

  return generated.ideas.slice(0, count).map((idea) =>
    repo.createContentIdea({
      title: idea.title,
      pillar: idea.pillar,
      intendedAudience: idea.intendedAudience,
      problemOrOpportunity: idea.problemOrOpportunity,
      centralAngle: idea.centralAngle,
      expertiseDemonstrated: idea.expertiseDemonstrated,
      whySelected: idea.whySelected,
      authorInputNeeded: idea.authorInputNeeded,
      authorInputPrompt: idea.authorInputPrompt,
      healthcareRelevant: idea.healthcareRelevant,
      sourceIds: selectedSources.map((s) => s.id),
      actor: "system",
    })
  );
}

export { runDeterministicQualityReview };

