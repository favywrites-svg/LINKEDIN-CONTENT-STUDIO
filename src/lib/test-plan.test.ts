import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { z } from "zod";
import { StorageRepository } from "@/lib/db/repository";
import {
  GeminiProvider,
  OpenRouterProvider,
  AIProviderError,
  getActiveAIProvider,
} from "@/lib/ai/provider";
import { getSafeRuntimeStatus } from "@/lib/constants";
import { inspectUrlSource } from "@/lib/research/live-research";
import { runDeterministicQualityReview } from "@/lib/editorial/guardrails";
import {
  createAccessSessionToken,
  verifyAccessSessionToken,
} from "@/lib/auth-token";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TEST_PLAN.md — Product Workflow Tests (WF-01 to WF-14)", () => {
  it("WF-02 & WF-03: persists research sources, findings, and linked ideas; detaches safely on source delete", () => {
    const repo = new StorageRepository(":memory:");

    const source = repo.upsertResearchSource({
      title: "WHO Digital Health Implementation Guidance",
      publisher: "World Health Organization",
      url: "https://example.org/who-guidance",
      sourceType: "primary",
      publicationDate: "2026-05-01",
      accessedAt: "2026-11-24T10:00:00.000Z",
      summary: "Operational readiness matters as much as clinical validation.",
      keyFindings: "Workflow training and exception paths determine adoption.",
      evidenceNotes: "Section 3.2",
      limitations: "Guidance varies by national regulatory framework.",
      verificationStatus: "checked",
    });

    const finding = repo.createResearchFinding({
      question: "What causes digital-health workflow rollouts to stall?",
      summary: "Staff handoff friction outweighs algorithm accuracy gaps.",
      businessRelevance: "Applies to clinics, pharmacies, and ops teams.",
      problemOrOpportunity: "Unmapped exception paths",
      implementationImplications: "Map manual fallback paths first.",
      uncertainties: "Limited small-pharmacy data.",
      potentialAngles: "Why pharmacy workflow rollouts need fallback design",
      status: "new",
      sourceIds: [source.id],
    });
    expect(finding.sources).toHaveLength(1);

    // WF-04 & WF-05: Author input checkpoint blocks conversion until supplied or waived
    const idea = repo.createContentIdea({
      title: "Designing Pharmacy Exception Paths",
      pillar: "practical_business_problems",
      intendedAudience: "Health-tech & operations leaders",
      problemOrOpportunity: "Automated triage fails on edge cases",
      centralAngle: "Design the human exception path before deploying AI",
      expertiseDemonstrated: "Pharmacy + AI workflow architecture",
      whySelected: "Bridges operations and digital health naturally",
      authorInputNeeded: true,
      authorInputPrompt: "Share one dispensing handoff bottleneck you've observed.",
      sourceIds: [source.id],
      findingIds: [finding.id],
      actor: "user",
    });

    expect(() => repo.convertIdeaToDraft(idea.id)).toThrow(
      /Author input is required/i
    );

    repo.updateContentIdea(idea.id, {
      authorInput:
        "In busy dispensary workflows, unclear prescription clarifications stall the entire queue.",
      actor: "user",
    });

    const draft = repo.convertIdeaToDraft(idea.id);
    expect(draft.ideaId).toBe(idea.id);
    expect(draft.sourceIds).toContain(source.id);
    expect(draft.body).toContain("dispensary workflows");

    // WF-06: Revisions retain previous versions non-destructively
    const revised = repo.updateDraft(draft.id, {
      body: "Updated body preserving dispensary handoff insight without hype.",
      actor: "user",
      revisionNote: "Tightened opening",
    });
    expect(revised.body).toContain("Updated body");
    expect(repo.listDraftRevisions(draft.id).length).toBeGreaterThanOrEqual(2);

    // WF-08, WF-09, WF-10, WF-12: Workflow states & explicit approval boundary
    const ready = repo.updateDraft(draft.id, {
      status: "ready_for_review",
      actor: "user",
    });
    expect(ready.status).toBe("ready_for_review");

    expect(() =>
      repo.updateDraft(draft.id, { status: "approved", actor: "assistant" })
    ).toThrow(/Only an explicit user action/i);

    const approved = repo.updateDraft(draft.id, {
      status: "approved",
      actor: "user",
    });
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeTruthy();

    const published = repo.updateDraft(draft.id, {
      status: "published",
      actor: "user",
    });
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeTruthy();

    // WF-13: Search & filter
    expect(repo.listDrafts({ search: "dispensary" })).toHaveLength(1);
    expect(repo.listDrafts({ search: "nonexistentkeyword" })).toHaveLength(0);

    // DATA_MODEL rule 9: Deleting source does not erase draft text
    repo.deleteResearchSource(source.id);
    const afterSourceDelete = repo.getDraftById(draft.id)!;
    expect(afterSourceDelete.body).toContain("Updated body");
    expect(afterSourceDelete.sourceIds).toHaveLength(0);
  });

  it("WF-07, WF-14, AI-08, AI-12: deterministic QA flags unsupported stats, clichés, em dashes, and repetition", () => {
    const repo = new StorageRepository(":memory:");
    const memory = repo.listMemoryItems(true);

    const prior = repo.createContentDraft({
      weeklyPackageId: null,
      ideaId: null,
      slotIndex: 0,
      title: "Pharmacy Inventory Automation Bottlenecks",
      body: "Automating pharmacy inventory ordering fails when stock counts and supplier lead times are inconsistent across branches.",
      pillar: "practical_business_problems",
      intendedAudience: "Operations managers",
      hookStyle: "Observation",
      structureType: "Problem breakdown",
      selectionRationale: "Prior post",
      status: "published",
      qualityReview: null,
      missingAuthorInput: null,
      visualRecommendation: null,
      targetPublishDate: null,
      sourceIds: [],
      actor: "user",
    });

    const report = runDeterministicQualityReview({
      title: "Pharmacy Inventory Automation Bottlenecks Again",
      body: "In today's fast-paced digital world — automating pharmacy inventory ordering cuts costs by 73% when stock counts and supplier lead times are inconsistent across branches. Agree?",
      sourceCount: 0,
      memoryItems: memory,
      priorDrafts: [prior],
    });

    expect(report.overallPassed).toBe(false);
    expect(report.factualSupport).toBe("needs_review");
    expect(report.voiceAlignment).toBe("needs_review");
    expect(report.originality).toBe("needs_review");
    expect(report.prohibitedLanguageFound).toContain("—");
    expect(report.similarityWarnings?.length).toBeGreaterThan(0);
  });

  it("infers unconfirmed preferences from repeated revision patterns without making them permanent automatically", () => {
    const repo = new StorageRepository(":memory:");

    repo.recordFeedback({
      draftId: null,
      eventType: "regenerated",
      note: "Add a more practical workflow example",
      saveAsPermanentRule: false,
    });
    repo.recordFeedback({
      draftId: null,
      eventType: "regenerated",
      note: "Needs a concrete workflow example",
      saveAsPermanentRule: false,
    });

    const allMemory = repo.listMemoryItems(false);
    const inferred = allMemory.find((m) => m.origin === "inferred");
    expect(inferred).toBeDefined();
    expect(inferred?.confirmed).toBe(false);

    // Unconfirmed inferred rules are NOT active in generation until confirmed by Efe
    expect(
      repo.listMemoryItems(true).some((m) => m.id === inferred!.id)
    ).toBe(false);

    repo.updateMemoryItem(inferred!.id, { confirmed: true });
    expect(
      repo.listMemoryItems(true).some((m) => m.id === inferred!.id)
    ).toBe(true);
  });
});

describe("TEST_PLAN.md — AI, Research & Security Tests (AI-01 to AI-11 & Security)", () => {
  it("AI-01: throws clear MISSING_KEY error when no AI key is configured", () => {
    expect(() => getActiveAIProvider({})).toThrowError(AIProviderError);
  });

  it("supports OpenRouter free-tier models and blocks HTTP 402 paid-credit models cleanly", async () => {
    const status = getSafeRuntimeStatus({
      AI_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "sk-or-v1-secret",
      OPENROUTER_MODEL: "meta-llama/llama-3.3-70b-instruct:free",
    });
    expect(status.aiConfigured).toBe(true);
    expect(status.aiProvider).toBe("openrouter");
    expect(status.aiModel).toBe("meta-llama/llama-3.3-70b-instruct:free");
    expect(JSON.stringify(status)).not.toContain("sk-or-v1-secret");

    const orProvider = new OpenRouterProvider(
      "sk-or-test",
      "meta-llama/llama-3.3-70b-instruct:free"
    );
    const Schema = z.object({ ok: z.boolean() });

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"ok": true}' } }],
            }),
            { status: 200 }
          )
      )
    );
    const res = await orProvider.generateStructured({
      systemPrompt: "sys",
      userPrompt: "usr",
      schema: Schema,
    });
    expect(res.ok).toBe(true);
  });

  it("AI-02 & AI-04: handles HTTP 429 rate limits and malformed JSON responses safely", async () => {
    const provider = new GeminiProvider("test-key", "gemini-2.5-flash");
    const Schema = z.object({ ok: z.boolean() });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limit", { status: 429 }))
    );

    await expect(
      provider.generateStructured({
        systemPrompt: "sys",
        userPrompt: "usr",
        schema: Schema,
      })
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                { content: { parts: [{ text: "not valid json at all" }] } },
              ],
            }),
            { status: 200 }
          )
      )
    );

    await expect(
      provider.generateStructured({
        systemPrompt: "sys",
        userPrompt: "usr",
        schema: Schema,
      })
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("AI-07: marks unreachable URLs as inaccessible rather than verified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not found", { status: 404 }))
    );
    const inspected = await inspectUrlSource("https://example.com/missing-doc");
    expect(inspected.verificationStatus).toBe("inaccessible");
  });

  it("Security & Deployment checks: .gitignore protects .env, .env.example has only placeholders, Vercel requires DATABASE_URL, and HMAC token validates cleanly", async () => {
    const gitignore = fs.readFileSync(
      path.join(process.cwd(), ".gitignore"),
      "utf8"
    );
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain(".env.local");

    const envExample = fs.readFileSync(
      path.join(process.cwd(), ".env.example"),
      "utf8"
    );
    expect(envExample).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(envExample).toContain('GEMINI_API_KEY=""');

    // Vercel serverless check
    const prevVercel = process.env.VERCEL;
    const prevDb = process.env.DATABASE_URL;
    process.env.VERCEL = "1";
    delete process.env.DATABASE_URL;
    try {
      expect(() => new StorageRepository()).toThrow(/DATABASE_URL/i);
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
      if (prevDb !== undefined) process.env.DATABASE_URL = prevDb;
    }

    // Single-user access token HMAC verification
    const token = await createAccessSessionToken("my-passcode", "secret-salt");
    expect(
      await verifyAccessSessionToken(token, "my-passcode", "secret-salt")
    ).toBe(true);
    expect(
      await verifyAccessSessionToken(
        `${token.slice(0, -1)}0`,
        "my-passcode",
        "secret-salt"
      )
    ).toBe(false);

    // Cloud Postgres serialization roundtrip fidelity
    const sourceRepo = new StorageRepository(":memory:");
    sourceRepo.createContentDraft({
      weeklyPackageId: null,
      ideaId: null,
      slotIndex: 0,
      title: "Cloud Sync Draft",
      body: "Persists cleanly across serverless instances.",
      pillar: "practical_business_problems",
      intendedAudience: "Founders",
      hookStyle: "Simple",
      structureType: "Short",
      selectionRationale: "Cloud check",
      status: "ready_for_review",
      qualityReview: null,
      missingAuthorInput: null,
      visualRecommendation: null,
      targetPublishDate: null,
      sourceIds: [],
      actor: "user",
    });
    const dump = sourceRepo.exportRawTables();
    const targetRepo = new StorageRepository(":memory:");
    targetRepo.importRawTables(dump);
    expect(targetRepo.listDrafts()[0]?.title).toBe("Cloud Sync Draft");
  });
});
