import { z } from "zod";
import type { ContentPillarId } from "@/lib/constants";
import {
  getReadyRepository,
  persistRepository,
  type StorageRepository,
} from "@/lib/db/repository";
import type {
  AuthorProfileRecord,
  ContentDraftRecord,
  ContentIdeaRecord,
  EditorialMemoryItem,
  SuggestedPostType,
  WeeklyPackageRecord,
} from "@/lib/db/types";
import { getActiveAIProvider, type AIProvider } from "@/lib/ai/provider";
import {
  normalizeEmDashes,
  runDeterministicQualityReview,
} from "@/lib/editorial/guardrails";
import { buildWeekLabel } from "./weekly-generator";

const PILLAR_IDS: [ContentPillarId, ...ContentPillarId[]] = [
  "practical_business_problems",
  "project_builds",
  "industry_commentary",
  "human_reflections",
];

const POST_TYPES: [SuggestedPostType, ...SuggestedPostType[]] = [
  "authority",
  "educational",
  "reflection",
];

export const POST_TYPE_LABELS: Record<SuggestedPostType, string> = {
  authority: "Authority",
  educational: "Educational",
  reflection: "Personal / Professional Reflection",
};

const WeeklyTopicsSchema = z.object({
  strategistNote: z
    .string()
    .default("Here are four simple, practical post ideas for your week."),
  topics: z
    .array(
      z.object({
        topic: z.string().min(3),
        angle: z.string().min(8),
        postType: z.enum(POST_TYPES),
        pillar: z.enum(PILLAR_IDS).default("practical_business_problems"),
        intendedAudience: z
          .string()
          .default("Business owners, managers, and hiring teams"),
      })
    )
    .min(4),
});

const DraftPostOutputSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(30),
  hookStyle: z.string().default("Simple observation"),
  structureType: z.string().default("Plain story & takeaway"),
});

const ReviseDraftOutputSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(20),
  colleagueNote: z
    .string()
    .default("Updated your draft using simpler, clearer wording."),
});

const AngleSuggestionSchema = z.object({
  topic: z.string().min(3),
  angle: z.string().min(8),
  postType: z.enum(POST_TYPES).default("authority"),
  pillar: z.enum(PILLAR_IDS).default("practical_business_problems"),
});

function buildStrategistSystemPrompt(
  profile: AuthorProfileRecord,
  memoryItems: EditorialMemoryItem[]
): string {
  const prohibitions = memoryItems
    .filter(
      (m) => m.active && m.confirmed && m.category === "prohibited_language"
    )
    .map((m) => `- "${m.pattern}"`)
    .join("\n");

  const preferences = memoryItems
    .filter(
      (m) => m.active && m.confirmed && m.category !== "prohibited_language"
    )
    .map((m) => `- ${m.pattern}`)
    .join("\n");

  const confirmedProjects = profile.confirmedProjects
    .map((p) => `- ${p.name} (${p.status}): ${p.summary}`)
    .join("\n");

  return `You are ${profile.preferredName}'s LinkedIn content strategist and writing assistant.

WHO ${profile.preferredName.toUpperCase()} IS:
${profile.positioning}
confirmed projects/facts (never invent fake stories, clients, or numbers):
${confirmedProjects || "- AI implementation & pharmacy background"}

MOST IMPORTANT WRITING RULE — WRITE SIMPLY:
- Use simple, everyday words that a normal person actually says in real conversation (Grade 6 to 8 reading level).
- NO big, stiff, corporate, or academic words. Avoid words like: "leverage", "utilize", "optimize", "streamline", "operationalize", "paradigm", "synergy", "ecosystem", "scalable", "measurable baselines", "cross-functional", "governance", "embed", "regulatory checkpoints", "delve", "underscore", "imperative", "multifaceted", "frictionless", or "proliferation".
- Say "use" instead of "utilize". Say "fix" or "improve" instead of "optimize". Say "how the work gets done" instead of "operational workflows".
- Write short, clear sentences (mostly 8 to 16 words).
- Sound warm, down-to-earth, smart, and human. You do not need big words to sound smart; explaining a real problem in plain English is what shows real understanding.
- Never use em dashes (—). Use commas or full stops instead.
- Never claim secret LinkedIn algorithm tricks or promise viral reach.
- Do not force "Thoughts?" or hashtags at the end.

PROHIBITED EXPRESSIONS (never use):
${prohibitions || "- — (em dash)"}

SAVED PREFERENCES:
${preferences || "- Keep language plain, friendly, and practical."}`;
}

/**
 * Core Workflow 1: Suggest 4 post topics for the week in plain, everyday language:
 * - 2 authority posts
 * - 1 educational post
 * - 1 personal or professional reflection
 */
export async function planWeekTopics(options?: {
  focusNote?: string;
  modelChoice?: string;
  repo?: StorageRepository;
  aiProvider?: AIProvider;
}): Promise<{
  packageRecord: WeeklyPackageRecord;
  topics: ContentIdeaRecord[];
}> {
  const repo = options?.repo ?? (await getReadyRepository());
  const ai =
    options?.aiProvider ?? getActiveAIProvider(undefined, options?.modelChoice);
  const profile = repo.getAuthorProfile();
  const memory = repo.listMemoryItems(true);

  const recentIdeas = repo.listContentIdeas(false).slice(0, 12);
  const recentDrafts = repo.listDrafts({ includeArchived: false }).slice(0, 12);
  const avoidTitles = Array.from(
    new Set([
      ...recentIdeas.map((i) => i.title),
      ...recentDrafts.map((d) => d.title),
    ])
  ).slice(0, 14);

  const pkg = repo.createWeeklyPackage({
    weekLabel: buildWeekLabel(),
    requestedPostCount: 4,
    userInstruction: options?.focusNote?.trim() || "Plan my week",
  });

  try {
    const result = await ai.generateStructured({
      systemPrompt: buildStrategistSystemPrompt(profile, memory),
      userPrompt: `Suggest 4 LinkedIn post topics for ${profile.preferredName}'s week using plain, everyday English (no corporate buzzwords).
${options?.focusNote?.trim() ? `Note from ${profile.preferredName}: "${options.focusNote.trim()}"\n` : ""}
Use this exact 4-post mix:
1. Authority post #1: A real, everyday problem with AI automation, team tasks, or business processes. (postType: "authority")
2. Authority post #2: Another practical angle on fixing messy work, deciding where AI actually helps, or a simple healthcare/pharmacy work example where natural. (postType: "authority")
3. Educational post: Explain one useful AI or process idea in plain words, or show how to solve a common mistake. (postType: "educational")
4. Personal or professional reflection: An honest, relatable thought on work, staying practical with tech, or learning while building. (postType: "reflection")

Avoid repeating these recent topics:
${avoidTitles.length > 0 ? avoidTitles.map((t) => `- ${t}`).join("\n") : "- None yet"}

Keep every topic title and angle simple, conversational, and easy to understand at a glance.

Return ONLY valid JSON:
{
  "strategistNote": "1 short, friendly sentence introducing this week's 4 ideas",
  "topics": [
    {
      "topic": "Simple, clear topic in plain English",
      "angle": "The main point in 1-2 simple, everyday sentences",
      "postType": "authority" | "educational" | "reflection",
      "pillar": "practical_business_problems" | "project_builds" | "industry_commentary" | "human_reflections",
      "intendedAudience": "Business owners, managers, or hiring teams"
    }
  ]
}`,
      schema: WeeklyTopicsSchema,
      temperature: 0.75,
    });

    const four = result.topics.slice(0, 4);
    const savedIdeas = four.map((item) =>
      repo.createContentIdea({
        weeklyPackageId: pkg.id,
        title: normalizeEmDashes(item.topic.trim()),
        postType: item.postType,
        pillar:
          item.postType === "reflection" ? "human_reflections" : item.pillar,
        intendedAudience: item.intendedAudience,
        problemOrOpportunity: normalizeEmDashes(item.topic.trim()),
        centralAngle: normalizeEmDashes(item.angle.trim()),
        expertiseDemonstrated: POST_TYPE_LABELS[item.postType],
        whySelected: `${POST_TYPE_LABELS[item.postType]} slot in weekly 4-post plan`,
        status: "idea",
        actor: "system",
      })
    );

    const completedPkg = repo.updateWeeklyPackageStage(
      pkg.id,
      "presentation",
      "completed",
      "Prepared 4 weekly topic suggestions.",
      {
        packageStatus: "completed",
        assistantSummary: normalizeEmDashes(result.strategistNote),
        providerUsed: `${ai.providerName}:${ai.modelName}`,
        errorMessage: null,
      }
    );

    if (!options?.repo) {
      await persistRepository(repo);
    }

    return {
      packageRecord: completedPkg,
      topics: savedIdeas,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not generate weekly topics.";
    repo.updateWeeklyPackageStage(
      pkg.id,
      "content_selection",
      "failed",
      message,
      { packageStatus: "failed", errorMessage: message }
    );
    throw err;
  }
}

/**
 * Generates a full LinkedIn draft from one of the suggested weekly topics in simple, everyday English.
 */
export async function generatePostFromTopic(options: {
  ideaId: string;
  extraContext?: string;
  modelChoice?: string;
  repo?: StorageRepository;
  aiProvider?: AIProvider;
}): Promise<ContentDraftRecord> {
  const repo = options.repo ?? (await getReadyRepository());
  const idea = repo.getIdeaById(options.ideaId);
  if (!idea) {
    throw new Error("Topic not found.");
  }

  const ai =
    options.aiProvider ?? getActiveAIProvider(undefined, options.modelChoice);
  const profile = repo.getAuthorProfile();
  const memory = repo.listMemoryItems(true);
  const priorDrafts = repo.listDrafts({ includeArchived: false });

  const generated = await ai.generateStructured({
    systemPrompt: buildStrategistSystemPrompt(profile, memory),
    userPrompt: `Write a LinkedIn post in ${profile.preferredName}'s voice using simple, everyday words:

POST TYPE: ${POST_TYPE_LABELS[idea.postType]}
TOPIC: ${idea.title}
MAIN POINT: ${idea.centralAngle}
${options.extraContext?.trim() ? `NOTE FROM EFE: "${options.extraContext.trim()}"` : ""}

STYLE CHECKLIST:
- Write 100 to 180 words with short, easy-to-read paragraphs separated by blank lines (\\n\\n).
- Use plain words you would use talking to a smart friend. Zero big corporate or textbook jargon.
- Start with a clear, relatable first line.
- Stick to one clear lesson or takeaway.
- Never invent fake personal stories, clients, or numbers.
- Never use em dashes (—).

Return ONLY valid JSON:
{
  "title": "Simple working title",
  "body": "Complete LinkedIn post text",
  "hookStyle": "Simple opening",
  "structureType": "Short clear paragraphs"
}`,
    schema: DraftPostOutputSchema,
    temperature: 0.65,
  });

  const cleanTitle = normalizeEmDashes(generated.title.trim());
  const cleanBody = normalizeEmDashes(generated.body.trim());

  const qa = runDeterministicQualityReview({
    title: cleanTitle,
    body: cleanBody,
    sourceCount: idea.sourceIds.length,
    memoryItems: memory,
    priorDrafts,
  });

  const draft = repo.createContentDraft({
    weeklyPackageId: idea.weeklyPackageId,
    ideaId: idea.id,
    slotIndex: 0,
    title: cleanTitle,
    body: cleanBody,
    pillar: idea.pillar,
    intendedAudience: idea.intendedAudience,
    hookStyle: generated.hookStyle,
    structureType: generated.structureType,
    selectionRationale: `${POST_TYPE_LABELS[idea.postType]}: ${idea.centralAngle}`,
    authorInputUsed: options.extraContext?.trim() ?? "",
    status: qa.overallPassed ? "ready_for_review" : "draft",
    qualityReview: qa,
    missingAuthorInput: null,
    visualRecommendation: null,
    targetPublishDate: null,
    sourceIds: idea.sourceIds,
    actor: "system",
  });

  repo.updateContentIdea(idea.id, { status: "drafted", actor: "system" });
  if (!options.repo) {
    await persistRepository(repo);
  }
  return draft;
}

/**
 * Core Workflow 2: Turn a quote, observation, question, or rough idea into an angle or simple post.
 */
export async function processUserIdeaInput(options: {
  rawInput: string;
  mode: "suggest_angle" | "write_post";
  customAngle?: string;
  modelChoice?: string;
  repo?: StorageRepository;
  aiProvider?: AIProvider;
}): Promise<
  | {
      mode: "suggest_angle";
      suggestion: {
        topic: string;
        angle: string;
        postType: SuggestedPostType;
        postTypeLabel: string;
        pillar: ContentPillarId;
      };
    }
  | {
      mode: "write_post";
      draft: ContentDraftRecord;
    }
> {
  const repo = options.repo ?? (await getReadyRepository());
  const ai =
    options.aiProvider ?? getActiveAIProvider(undefined, options.modelChoice);
  const profile = repo.getAuthorProfile();
  const memory = repo.listMemoryItems(true);
  const systemPrompt = buildStrategistSystemPrompt(profile, memory);
  const rawMaterial = options.rawInput.trim();

  if (options.mode === "suggest_angle") {
    const res = await ai.generateStructured({
      systemPrompt,
      userPrompt: `${profile.preferredName} shared this quote, observation, question, or idea:
"""
${rawMaterial}
"""

Suggest a simple, relatable LinkedIn angle in plain English that keeps the original meaning while sharing a practical takeaway. Never claim someone else's words or experience as ${profile.preferredName}'s own.

Return ONLY valid JSON:
{
  "topic": "Simple topic title",
  "angle": "Main point in 1-2 plain, clear sentences",
  "postType": "authority" | "educational" | "reflection",
  "pillar": "practical_business_problems" | "project_builds" | "industry_commentary" | "human_reflections"
}`,
      schema: AngleSuggestionSchema,
      temperature: 0.65,
    });

    return {
      mode: "suggest_angle",
      suggestion: {
        topic: normalizeEmDashes(res.topic.trim()),
        angle: normalizeEmDashes(res.angle.trim()),
        postType: res.postType,
        postTypeLabel: POST_TYPE_LABELS[res.postType],
        pillar: res.pillar,
      },
    };
  }

  const generated = await ai.generateStructured({
    systemPrompt,
    userPrompt: `Write an original LinkedIn post in ${profile.preferredName}'s voice using simple, everyday words, based on this input:
"""
${rawMaterial}
"""
${options.customAngle?.trim() ? `Main angle to use: "${options.customAngle.trim()}"\n` : ""}
RULES:
1. Keep the meaning of the input, but write simply and naturally (100 to 180 words, short paragraphs, zero big corporate words).
2. NEVER pass off someone else's quote, words, or personal experience as ${profile.preferredName}'s own. Credit or frame an external quote/observation honestly (for example: "I came across a great line recently..." or "Someone pointed out something true...") and then explain what it means in plain words.
3. Never invent fake stories or metrics, and never use em dashes (—).

Return ONLY valid JSON:
{
  "title": "Simple working title",
  "body": "Complete LinkedIn post text",
  "hookStyle": "Plain opening",
  "structureType": "Short clear paragraphs"
}`,
    schema: DraftPostOutputSchema,
    temperature: 0.65,
  });

  const cleanTitle = normalizeEmDashes(generated.title.trim());
  const cleanBody = normalizeEmDashes(generated.body.trim());
  const priorDrafts = repo.listDrafts({ includeArchived: false });
  const qa = runDeterministicQualityReview({
    title: cleanTitle,
    body: cleanBody,
    sourceCount: 0,
    memoryItems: memory,
    priorDrafts,
  });

  const draft = repo.createContentDraft({
    weeklyPackageId: null,
    ideaId: null,
    slotIndex: 0,
    title: cleanTitle,
    body: cleanBody,
    pillar: "practical_business_problems",
    intendedAudience: "Business owners, managers, and hiring teams",
    hookStyle: generated.hookStyle,
    structureType: generated.structureType,
    selectionRationale: `Created from your input: "${rawMaterial.slice(0, 120)}${rawMaterial.length > 120 ? "..." : ""}"`,
    authorInputUsed: rawMaterial,
    status: qa.overallPassed ? "ready_for_review" : "draft",
    qualityReview: qa,
    missingAuthorInput: null,
    visualRecommendation: null,
    targetPublishDate: null,
    sourceIds: [],
    actor: "user",
  });

  if (!options.repo) {
    await persistRepository(repo);
  }

  return {
    mode: "write_post",
    draft,
  };
}

/**
 * Fast, reliable draft revision in simple everyday English.
 */
export async function reviseDraftSimply(options: {
  draftId: string;
  instruction?: string;
  suppliedAuthorInput?: string;
  saveFeedbackAsRule?: boolean;
  previewOnly?: boolean;
  modelChoice?: string;
  repo?: StorageRepository;
  aiProvider?: AIProvider;
}): Promise<{
  draft: ContentDraftRecord;
  proposedTitle: string;
  proposedBody: string;
  colleagueNote: string;
}> {
  const repo = options.repo ?? (await getReadyRepository());
  const draft = repo.getDraftById(options.draftId);
  if (!draft) {
    throw new Error("Draft not found.");
  }

  const ai =
    options.aiProvider ?? getActiveAIProvider(undefined, options.modelChoice);
  const profile = repo.getAuthorProfile();
  const memory = repo.listMemoryItems(true);
  const instructionText =
    options.instruction?.trim() ||
    "Rewrite this post in simpler, everyday English with shorter sentences and zero big corporate words.";

  if (options.saveFeedbackAsRule && options.instruction?.trim()) {
    repo.addMemoryItem({
      category: "writing_preference",
      origin: "explicit",
      pattern: options.instruction.trim(),
      ruleExplanation: "Saved by Efe during draft revision.",
      confirmed: true,
      sourceDraftId: draft.id,
    });
  }

  const result = await ai.generateStructured({
    systemPrompt: buildStrategistSystemPrompt(profile, memory),
    userPrompt: `Revise this LinkedIn draft for ${profile.preferredName}.

CURRENT TITLE: ${draft.title}
CURRENT DRAFT:
"""
${draft.body}
"""
${options.suppliedAuthorInput?.trim() ? `\nEFE'S PERSONAL NOTE TO INCLUDE ACCURATELY:\n"${options.suppliedAuthorInput.trim()}"\n` : ""}
INSTRUCTION FROM EFE:
"${instructionText}"

RULES:
- Keep the core point intact, use plain everyday English (zero big buzzwords), never invent personal stories or numbers, and never use em dashes (—).
- Return ONLY valid JSON:
{
  "title": "Updated simple title",
  "body": "Complete revised post text with \\n\\n paragraph breaks",
  "colleagueNote": "1 short sentence explaining what changed"
}`,
    schema: ReviseDraftOutputSchema,
    temperature: 0.6,
  });

  const cleanTitle = normalizeEmDashes(result.title.trim());
  const cleanBody = normalizeEmDashes(result.body.trim());

  if (options.previewOnly) {
    return {
      draft,
      proposedTitle: cleanTitle,
      proposedBody: cleanBody,
      colleagueNote: result.colleagueNote,
    };
  }

  const priorDrafts = repo.listDrafts({ includeArchived: false });
  const qa = runDeterministicQualityReview({
    title: cleanTitle,
    body: cleanBody,
    sourceCount: draft.sourceIds.length,
    memoryItems: memory,
    priorDrafts,
    currentDraftId: draft.id,
  });

  const updated = repo.updateDraft(draft.id, {
    title: cleanTitle,
    body: cleanBody,
    actor: "assistant",
    revisionNote: instructionText,
    qualityReview: qa,
    status: qa.overallPassed ? "ready_for_review" : "draft",
  });

  repo.recordFeedback({
    draftId: draft.id,
    eventType: "regenerated",
    note: instructionText,
    saveAsPermanentRule: Boolean(options.saveFeedbackAsRule),
  });

  if (!options.repo) {
    await persistRepository(repo);
  }

  return {
    draft: updated,
    proposedTitle: updated.title,
    proposedBody: updated.body,
    colleagueNote: result.colleagueNote,
  };
}
