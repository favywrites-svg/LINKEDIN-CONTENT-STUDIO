import { describe, expect, it, vi } from "vitest";
import { StorageRepository } from "@/lib/db/repository";
import {
  detectProhibitedLanguage,
  normalizeEmDashes,
} from "@/lib/editorial/guardrails";
import {
  computeContentIntelligence,
  executeWeeklyGeneration,
} from "./weekly-generator";
import type { AIProvider } from "@/lib/ai/provider";

vi.mock("@/lib/research/live-research", () => ({
  runLiveWeeklyResearch: vi.fn(async () => ({
    sources: [
      {
        title: "Evaluating Human-in-the-Loop Enterprise Workflows",
        publisher: "arXiv (Original Research / Preprint)",
        url: "https://arxiv.org/abs/2501.00001",
        sourceType: "research" as const,
        publicationDate: "2026-10-12",
        accessedAt: "2026-11-24T09:00:00.000Z",
        summary:
          "Empirical analysis of exception handling and human review gates in automated operational pipelines.",
        keyFindings:
          "Automated steps fail most often at undocumented handoff boundaries rather than model accuracy.",
        limitations: "Preprint evaluation across three enterprise teams.",
        verificationStatus: "checked" as const,
      },
    ],
    warnings: [],
  })),
}));

describe("SQLite repository, prohibited language guardrails, and 7-stage weekly generator", () => {
  it("enforces human-only approval and detects prohibited language variations", () => {
    const repo = new StorageRepository(":memory:");
    repo.addMemoryItem({
      category: "prohibited_language",
      pattern: "let that sink in",
      ruleExplanation: "Banned LinkedIn cliché",
    });

    const memory = repo.listMemoryItems(true);
    const found = detectProhibitedLanguage(
      "This workflow is a real game changer — let that sink in.",
      memory
    );
    expect(found).toContain("—");
    expect(found).toContain("game-changer");
    expect(found).toContain("let that sink in");
    expect(normalizeEmDashes("Problem — not hype.")).toBe("Problem, not hype.");

    // System cannot create an approved draft directly
    expect(() =>
      repo.createContentDraft({
        weeklyPackageId: null,
        ideaId: null,
        slotIndex: 0,
        title: "Test",
        body: "Body",
        pillar: "practical_business_problems",
        intendedAudience: "Founders",
        hookStyle: "Observation",
        structureType: "Problem-analysis",
        selectionRationale: "Test",
        status: "approved",
        qualityReview: null,
        missingAuthorInput: null,
        visualRecommendation: null,
        targetPublishDate: null,
        sourceIds: [],
      })
    ).toThrow(/Explicit user approval is required/i);

    const draft = repo.createContentDraft({
      weeklyPackageId: null,
      ideaId: null,
      slotIndex: 0,
      title: "Workflow Bottlenecks",
      body: "Clean practical post.",
      pillar: "practical_business_problems",
      intendedAudience: "Operations leaders",
      hookStyle: "Observation",
      structureType: "Breakdown",
      selectionRationale: "Addresses core pillar",
      status: "ready_for_review",
      qualityReview: null,
      missingAuthorInput: null,
      visualRecommendation: null,
      targetPublishDate: null,
      sourceIds: [],
    });

    // Assistant actor cannot set status to approved
    expect(() =>
      repo.updateDraft(draft.id, { status: "approved", actor: "assistant" })
    ).toThrow(/Only an explicit user action/i);

    // User actor can explicitly approve
    const approved = repo.updateDraft(draft.id, {
      status: "approved",
      actor: "user",
    });
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeTruthy();
  });

  it("runs all 7 weekly generation stages, persists sources & drafts, and tracks stage logs", async () => {
    const repo = new StorageRepository(":memory:");

    let callIndex = 0;
    const fakeProvider: AIProvider = {
      providerName: "gemini",
      modelName: "gemini-2.5-flash",
      async generateStructured({ schema }) {
        callIndex += 1;
        if (callIndex === 1) {
          return schema.parse({
            assistantNote:
              "Prepared three distinct posts balancing operational bottlenecks, prototype lessons, and digital-health workflow design.",
            topics: [
              {
                title: "Why Handoffs Break Before Models Do",
                pillar: "practical_business_problems",
                intendedAudience: "Operations managers and founders",
                problemOrOpportunity: "Broken manual handoffs hidden under AI pilots",
                centralAngle: "Fix the handoff contract before automating the task",
                expertiseDemonstrated: "Process evaluation and AI implementation",
                whySelected: "Core business-problems pillar backed by fresh workflow research",
                hookStyle: "Sharp operational observation",
                structureType: "Problem -> mechanism -> takeaway",
                healthcareRelevant: false,
                sourceIndices: [0],
              },
              {
                title: "Separating Memory from Generation in AI Tools",
                pillar: "project_builds",
                intendedAudience: "Hiring managers and technical leaders",
                problemOrOpportunity: "Generic stateless AI outputs",
                centralAngle: "Persistent rules beat longer prompts",
                expertiseDemonstrated: "Practical system design on a real prototype",
                whySelected: "Demonstrates hands-on architecture thinking",
                hookStyle: "Architecture trade-off",
                structureType: "Build lesson",
                healthcareRelevant: false,
                sourceIndices: [],
              },
            ],
          });
        }

        return schema.parse({
          posts: [
            {
              topicIndex: 0,
              title: "Why Handoffs Break Before Models Do",
              body: "Most automation pilots do not stall because the language model is weak.\n\nThey stall at the handoff between two teams that never agreed on what a complete input looks like.",
              missingAuthorInput: {
                needed: false,
                question: "",
                whyItMatters: "",
              },
              visualRecommendation: {
                choice: "simple_diagram",
                rationale: "A 3-box handoff sketch makes the exception boundary immediately clear.",
              },
              qualitySelfCheck: {
                factualSupport: "strong",
                voiceAlignment: "strong",
                originality: "strong",
                practicalValue: "strong",
                overallNote: "Grounded and specific.",
                issues: [],
                strengths: ["Clear operational tension"],
              },
            },
            {
              topicIndex: 1,
              title: "Separating Memory from Generation in AI Tools",
              body: "While building a prototype editorial assistant, one design choice mattered more than prompt length: storing explicit language rules separately from generation.",
              missingAuthorInput: {
                needed: true,
                question: "Is there one specific rule you added early that immediately improved draft quality?",
                whyItMatters: "Adds a concrete, real observation from your build.",
              },
              visualRecommendation: {
                choice: "none",
                rationale: "Text argument is concise and clear without an image.",
              },
              qualitySelfCheck: {
                factualSupport: "strong",
                voiceAlignment: "strong",
                originality: "strong",
                practicalValue: "strong",
                overallNote: "Honest prototype framing.",
                issues: [],
                strengths: ["Distinguishes prototype honestly"],
              },
            },
          ],
        });
      },
    };

    const result = await executeWeeklyGeneration({
      postCount: 2,
      repo,
      aiProvider: fakeProvider,
    });

    expect(result.packageRecord.status).toBe("completed");
    expect(
      result.packageRecord.stageLogs.every((s) => s.status === "completed")
    ).toBe(true);
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0].sources).toHaveLength(1);
    expect(result.drafts[1].missingAuthorInput?.needed).toBe(true);

    const intelAfter = computeContentIntelligence(repo.listDrafts());
    expect(intelAfter.totalHistoricalPosts).toBe(2);
    expect(intelAfter.underrepresentedPillars).toContain("industry_commentary");
  });
});
