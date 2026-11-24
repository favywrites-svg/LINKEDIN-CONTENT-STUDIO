import { describe, expect, it } from "vitest";
import { StorageRepository } from "@/lib/db/repository";
import {
  generatePostFromTopic,
  planWeekTopics,
  processUserIdeaInput,
} from "./strategist";
import type { AIProvider } from "@/lib/ai/provider";

describe("Simplified Strategist & Writing Assistant workflow", () => {
  it("plans 4 weekly topics (2 authority, 1 educational, 1 reflection), drafts from a topic, and handles user quotes/ideas", async () => {
    const repo = new StorageRepository(":memory:");

    let step = 0;
    const mockAI: AIProvider = {
      providerName: "gemini",
      modelName: "gemini-3.5-flash-lite",
      async generateStructured({ schema }) {
        step += 1;
        if (step === 1) {
          return schema.parse({
            strategistNote: "Four varied topics for your week.",
            topics: [
              {
                topic: "Auditing Manual Handoffs Before Buying Automation",
                angle: "Map where inputs stall between teams before adding AI.",
                postType: "authority",
                pillar: "practical_business_problems",
                intendedAudience: "Operations leaders",
              },
              {
                topic: "Designing Human Exception Paths in Pharmacy Workflows",
                angle: "Show how unclear edge cases derail healthcare automation.",
                postType: "authority",
                pillar: "project_builds",
                intendedAudience: "Health-tech founders",
              },
              {
                topic: "Deterministic Rules vs LLM Judgment: A Simple Filter",
                angle: "Explain when a 10-line validation rule beats an AI prompt.",
                postType: "educational",
                pillar: "practical_business_problems",
                intendedAudience: "Business owners and builders",
              },
              {
                topic: "Why Calm Systems Beat Flashy Demos",
                angle: "Reflect on valuing dependability over novelty in daily work.",
                postType: "reflection",
                pillar: "human_reflections",
                intendedAudience: "Hiring managers and peers",
              },
            ],
          });
        }

        if (step === 2) {
          return schema.parse({
            title: "Auditing Manual Handoffs Before Buying Automation",
            body: "Before automating a workflow, watch where requests sit waiting for clarification.\n\nMost bottlenecks live in unclear handoffs rather than slow typing.",
            hookStyle: "Direct workflow observation",
            structureType: "Problem to practical takeaway",
          });
        }

        return schema.parse({
          title: "Automating a Broken Process Only Multiplies Errors",
          body: "A line worth keeping on every operations desk: automating a messy process just helps a team make mistakes faster.\n\nBefore connecting an AI model, define what a valid input looks like.",
          hookStyle: "Attributed observation",
          structureType: "Insight unpack",
        });
      },
    };

    const plan = await planWeekTopics({ repo, aiProvider: mockAI });
    expect(plan.topics).toHaveLength(4);
    expect(plan.topics.filter((t) => t.postType === "authority")).toHaveLength(2);
    expect(plan.topics.filter((t) => t.postType === "educational")).toHaveLength(1);
    expect(plan.topics.filter((t) => t.postType === "reflection")).toHaveLength(1);

    const fromTopicDraft = await generatePostFromTopic({
      ideaId: plan.topics[0].id,
      repo,
      aiProvider: mockAI,
    });
    expect(fromTopicDraft.ideaId).toBe(plan.topics[0].id);
    expect(fromTopicDraft.body).toContain("bottlenecks");

    const fromUserQuote = await processUserIdeaInput({
      rawInput:
        '"The first rule of any technology used in a business is that automation applied to an inefficient operation will magnify the inefficiency."',
      mode: "write_post",
      repo,
      aiProvider: mockAI,
    });
    expect(fromUserQuote.mode).toBe("write_post");
    if (fromUserQuote.mode === "write_post") {
      expect(fromUserQuote.draft.body.length).toBeGreaterThan(40);
    }
  });
});
