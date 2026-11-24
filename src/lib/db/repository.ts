import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  AUTHOR_NAME,
  WEEKLY_GENERATION_STAGES,
  type ContentPillarId,
  type WeeklyStageKey,
  type WorkflowStatus,
} from "@/lib/constants";
import type {
  AuthorInputStatus,
  AuthorProfileRecord,
  ContentDraftRecord,
  ContentIdeaRecord,
  ContentIntelligenceSummary,
  DraftRevisionRecord,
  EditorialMemoryItem,
  FeedbackEventRecord,
  MissingAuthorInputPrompt,
  ProviderSettingsRecord,
  QualityReviewReport,
  ResearchFindingRecord,
  ResearchSourceRecord,
  StageProgressEntry,
  VisualRecommendation,
  WeeklyPackageRecord,
  WorkflowEventRecord,
} from "./types";
import {
  getConfiguredPostgresUrl,
  loadTablesFromPostgres,
  saveTablesToPostgres,
} from "./cloud-sync";

const PERSISTED_TABLES = [
  "author_profile",
  "provider_settings",
  "workflow_events",
  "editorial_memory_items",
  "research_sources",
  "research_findings",
  "weekly_packages",
  "content_ideas",
  "content_drafts",
  "draft_sources",
  "draft_revisions",
  "feedback_events",
] as const;

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class StorageRepository {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const pgUrl = getConfiguredPostgresUrl(process.env);
    if (!dbPath && process.env.VERCEL && !pgUrl) {
      throw new Error(
        "Vercel production requires DATABASE_URL (PostgreSQL). Local filesystem SQLite cannot be used for durable storage on serverless."
      );
    }

    const resolvedPath =
      dbPath ??
      (pgUrl ? ":memory:" : path.join(process.cwd(), "data", "assistant.sqlite"));

    if (resolvedPath !== ":memory:") {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    }

    this.db = new DatabaseSync(resolvedPath);
    if (resolvedPath !== ":memory:") {
      this.db.exec("PRAGMA journal_mode = WAL;");
    }
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.initializeSchema();
    this.migrateColumnsSafely();
    this.seedDefaultsIfEmpty();
  }

  private ensureColumn(table: string, column: string, definition: string) {
    const cols = this.db
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS author_profile (
        id TEXT PRIMARY KEY,
        preferred_name TEXT NOT NULL,
        positioning TEXT NOT NULL,
        audiences_json TEXT NOT NULL,
        voice_summary TEXT NOT NULL,
        confirmed_background_json TEXT NOT NULL,
        confirmed_projects_json TEXT NOT NULL,
        avoid_patterns_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS provider_settings (
        id TEXT PRIMARY KEY,
        provider_name TEXT NOT NULL,
        model_name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        non_secret_config_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_events (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS editorial_memory_items (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        origin TEXT NOT NULL,
        pattern TEXT NOT NULL,
        rule_explanation TEXT NOT NULL,
        confirmed INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL DEFAULT 1,
        source_draft_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_sources (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        publisher TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL,
        publication_date TEXT,
        accessed_at TEXT NOT NULL,
        summary TEXT NOT NULL,
        key_findings TEXT NOT NULL,
        evidence_notes TEXT NOT NULL DEFAULT '',
        limitations TEXT NOT NULL,
        potential_angles TEXT NOT NULL DEFAULT '',
        verification_status TEXT NOT NULL,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_findings (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        summary TEXT NOT NULL,
        business_relevance TEXT NOT NULL,
        problem_or_opportunity TEXT NOT NULL,
        implementation_implications TEXT NOT NULL,
        uncertainties TEXT NOT NULL,
        potential_angles TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        source_ids_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS weekly_packages (
        id TEXT PRIMARY KEY,
        week_label TEXT NOT NULL,
        requested_post_count INTEGER NOT NULL,
        user_instruction TEXT NOT NULL,
        status TEXT NOT NULL,
        current_stage TEXT NOT NULL,
        stage_logs_json TEXT NOT NULL,
        intelligence_summary_json TEXT,
        assistant_summary TEXT NOT NULL,
        error_message TEXT,
        provider_used TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content_ideas (
        id TEXT PRIMARY KEY,
        weekly_package_id TEXT,
        title TEXT NOT NULL,
        pillar TEXT NOT NULL,
        intended_audience TEXT NOT NULL,
        problem_or_opportunity TEXT NOT NULL,
        central_angle TEXT NOT NULL,
        expertise_demonstrated TEXT NOT NULL,
        why_selected TEXT NOT NULL,
        author_input_needed INTEGER NOT NULL DEFAULT 0,
        author_input_status TEXT NOT NULL DEFAULT 'not_needed',
        author_input_prompt TEXT NOT NULL DEFAULT '',
        author_input TEXT NOT NULL DEFAULT '',
        evidence_notes TEXT NOT NULL DEFAULT '',
        healthcare_relevant INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        source_ids_json TEXT NOT NULL,
        finding_ids_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content_drafts (
        id TEXT PRIMARY KEY,
        weekly_package_id TEXT,
        idea_id TEXT,
        slot_index INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        pillar TEXT NOT NULL,
        intended_audience TEXT NOT NULL,
        hook_style TEXT NOT NULL,
        structure_type TEXT NOT NULL,
        selection_rationale TEXT NOT NULL,
        author_input_used TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        quality_review_json TEXT,
        missing_author_input_json TEXT,
        visual_recommendation_json TEXT,
        target_publish_date TEXT,
        approved_at TEXT,
        published_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS draft_sources (
        draft_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        PRIMARY KEY (draft_id, source_id)
      );

      CREATE TABLE IF NOT EXISTS draft_revisions (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL,
        body TEXT NOT NULL,
        instruction TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feedback_events (
        id TEXT PRIMARY KEY,
        draft_id TEXT,
        event_type TEXT NOT NULL,
        note TEXT NOT NULL,
        save_as_permanent_rule INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
  }

  private migrateColumnsSafely() {
    this.ensureColumn(
      "author_profile",
      "avoid_patterns_json",
      "TEXT NOT NULL DEFAULT '[]'"
    );
    this.ensureColumn(
      "research_sources",
      "evidence_notes",
      "TEXT NOT NULL DEFAULT ''"
    );
    this.ensureColumn(
      "research_sources",
      "potential_angles",
      "TEXT NOT NULL DEFAULT ''"
    );
    this.ensureColumn(
      "content_ideas",
      "author_input_needed",
      "INTEGER NOT NULL DEFAULT 0"
    );
    this.ensureColumn(
      "content_ideas",
      "author_input_status",
      "TEXT NOT NULL DEFAULT 'not_needed'"
    );
    this.ensureColumn(
      "content_ideas",
      "author_input_prompt",
      "TEXT NOT NULL DEFAULT ''"
    );
    this.ensureColumn(
      "content_ideas",
      "author_input",
      "TEXT NOT NULL DEFAULT ''"
    );
    this.ensureColumn(
      "content_ideas",
      "evidence_notes",
      "TEXT NOT NULL DEFAULT ''"
    );
    this.ensureColumn(
      "content_ideas",
      "finding_ids_json",
      "TEXT NOT NULL DEFAULT '[]'"
    );
    this.ensureColumn(
      "content_ideas",
      "post_type",
      "TEXT NOT NULL DEFAULT 'authority'"
    );
    this.ensureColumn(
      "content_drafts",
      "author_input_used",
      "TEXT NOT NULL DEFAULT ''"
    );
  }

  private seedDefaultsIfEmpty() {
    const now = new Date().toISOString();
    const existingProfile = this.db
      .prepare("SELECT id FROM author_profile WHERE id = 'default'")
      .get();

    if (!existingProfile) {
      this.db
        .prepare(
          `INSERT INTO author_profile (
            id, preferred_name, positioning, audiences_json, voice_summary,
            confirmed_background_json, confirmed_projects_json, avoid_patterns_json, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          "default",
          AUTHOR_NAME,
          "AI implementation professional with a pharmacy background and a practical understanding of business operations, focused on identifying real workflow problems, evaluating where AI genuinely helps, and translating technical ideas into dependable solutions.",
          JSON.stringify([
            "Recruiters and hiring managers for AI implementation & automation roles",
            "Business owners and founders",
            "Operations managers and process leaders",
            "Health-tech, digital-health, and pharmaceutical technology organisations",
          ]),
          "Simple, everyday English with short, clear sentences. Warm, down-to-earth, and human. Explain ideas in plain words a smart friend would use, with zero stiff corporate or academic buzzwords.",
          JSON.stringify([
            "AI implementation and business process automation specialist",
            "Pharmacy background providing practical domain credibility in healthcare, digital health, and pharmaceutical operations",
            "Guiding philosophy: Think critically. Build practically. Communicate clearly.",
          ]),
          JSON.stringify([
            {
              id: "proj-linkedin-assistant",
              name: "Intelligent LinkedIn Content Partner",
              status: "prototype",
              summary:
                "A private, human-in-the-loop AI content partner combining live source verification, pillar intelligence, editorial memory, and strict human approval.",
              confirmedLessons:
                "Separating live research verification and persistent editorial memory from raw text generation prevents generic, repetitive AI output.",
            },
          ]),
          JSON.stringify([
            "Shallow headline summaries without operational analysis",
            "Unverified productivity or revenue claims",
            "Making every single post about healthcare",
          ]),
          now
        );
    }

    const existingProvider = this.db
      .prepare("SELECT id FROM provider_settings WHERE id = 'default'")
      .get();

    if (!existingProvider) {
      this.db
        .prepare(
          `INSERT INTO provider_settings (id, provider_name, model_name, enabled, non_secret_config_json, updated_at)
           VALUES ('default', 'gemini', 'gemini-2.5-flash', 1, ?, ?)`
        )
        .run(JSON.stringify({ temperature: 0.65, maxWeeklyPosts: 5 }), now);
    }

    const memoryCountRow = this.db
      .prepare("SELECT COUNT(*) as cnt FROM editorial_memory_items")
      .get() as { cnt: number };

    if (memoryCountRow.cnt === 0) {
      const defaults: Array<
        Omit<EditorialMemoryItem, "id" | "createdAt" | "updatedAt">
      > = [
        {
          category: "prohibited_language",
          origin: "explicit",
          pattern: "—",
          ruleExplanation:
            "Never use em dashes. Use commas, full stops, colons, or parentheses instead.",
          confirmed: true,
          active: true,
          sourceDraftId: null,
        },
        {
          category: "prohibited_language",
          origin: "explicit",
          pattern: "In today's fast-paced digital world",
          ruleExplanation:
            "Generic AI cliché opening prohibited by Brand Voice.",
          confirmed: true,
          active: true,
          sourceDraftId: null,
        },
        {
          category: "prohibited_language",
          origin: "explicit",
          pattern: "AI is changing everything",
          ruleExplanation:
            "Empty hype phrase; always name the specific workflow or business problem instead.",
          confirmed: true,
          active: true,
          sourceDraftId: null,
        },
        {
          category: "prohibited_language",
          origin: "explicit",
          pattern: "game-changer",
          ruleExplanation:
            "Overused hype vocabulary that weakens technical credibility.",
          confirmed: true,
          active: true,
          sourceDraftId: null,
        },
        {
          category: "writing_preference",
          origin: "explicit",
          pattern:
            "Lead with the operational or human problem before naming any AI tool",
          ruleExplanation:
            "Every post should clarify the real friction or decision tension before proposing automation.",
          confirmed: true,
          active: true,
          sourceDraftId: null,
        },
        {
          category: "writing_preference",
          origin: "explicit",
          pattern:
            "Do not force a question or 'Thoughts?' / 'Agree?' at the end of every post",
          ruleExplanation:
            "End with a clear takeaway, practical implication, or honest observation.",
          confirmed: true,
          active: true,
          sourceDraftId: null,
        },
      ];

      const stmt = this.db.prepare(`
        INSERT INTO editorial_memory_items (
          id, category, origin, pattern, rule_explanation, confirmed, active, source_draft_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of defaults) {
        stmt.run(
          crypto.randomUUID(),
          item.category,
          item.origin,
          item.pattern,
          item.ruleExplanation,
          item.confirmed ? 1 : 0,
          item.active ? 1 : 0,
          item.sourceDraftId,
          now,
          now
        );
      }
    }
  }

  // ---- Workflow Events (Audit Log) ----
  logWorkflowEvent(input: {
    entityType: WorkflowEventRecord["entityType"];
    entityId: string;
    fromStatus: string | null;
    toStatus: string;
    actor: "user" | "system";
  }): WorkflowEventRecord {
    if (input.toStatus === "approved" && input.actor !== "user") {
      throw new Error(
        "A system actor must never set a record to Approved. Explicit user approval is required."
      );
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO workflow_events (id, entity_type, entity_id, from_status, to_status, actor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.entityType,
        input.entityId,
        input.fromStatus,
        input.toStatus,
        input.actor,
        createdAt
      );

    return { id, ...input, createdAt };
  }

  listWorkflowEvents(limit = 40): WorkflowEventRecord[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM workflow_events ORDER BY created_at DESC LIMIT ?"
      )
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      entityType: r.entity_type as WorkflowEventRecord["entityType"],
      entityId: String(r.entity_id),
      fromStatus: r.from_status ? String(r.from_status) : null,
      toStatus: String(r.to_status),
      actor: r.actor as "user" | "system",
      createdAt: String(r.created_at),
    }));
  }

  // ---- Author Profile & Provider Settings ----
  getAuthorProfile(): AuthorProfileRecord {
    const row = this.db
      .prepare("SELECT * FROM author_profile WHERE id = 'default'")
      .get() as Record<string, unknown>;

    return {
      id: String(row.id),
      preferredName: String(row.preferred_name),
      positioning: String(row.positioning),
      audiences: parseJson(row.audiences_json, []),
      voiceSummary: String(row.voice_summary),
      confirmedBackground: parseJson(row.confirmed_background_json, []),
      confirmedProjects: parseJson(row.confirmed_projects_json, []),
      avoidTopicsOrPatterns: parseJson(row.avoid_patterns_json, []),
      updatedAt: String(row.updated_at),
    };
  }

  updateAuthorProfile(
    patch: Partial<Omit<AuthorProfileRecord, "id" | "updatedAt">>
  ): AuthorProfileRecord {
    const current = this.getAuthorProfile();
    const now = new Date().toISOString();
    const updated: AuthorProfileRecord = {
      ...current,
      ...patch,
      updatedAt: now,
    };
    this.db
      .prepare(
        `UPDATE author_profile SET
          preferred_name = ?,
          positioning = ?,
          audiences_json = ?,
          voice_summary = ?,
          confirmed_background_json = ?,
          confirmed_projects_json = ?,
          avoid_patterns_json = ?,
          updated_at = ?
        WHERE id = 'default'`
      )
      .run(
        updated.preferredName,
        updated.positioning,
        JSON.stringify(updated.audiences),
        updated.voiceSummary,
        JSON.stringify(updated.confirmedBackground),
        JSON.stringify(updated.confirmedProjects),
        JSON.stringify(updated.avoidTopicsOrPatterns),
        now
      );
    return updated;
  }

  getProviderSettings(): ProviderSettingsRecord {
    const row = this.db
      .prepare("SELECT * FROM provider_settings WHERE id = 'default'")
      .get() as Record<string, unknown>;
    return {
      id: String(row.id),
      providerName: String(row.provider_name),
      modelName: String(row.model_name),
      enabled: Boolean(row.enabled),
      nonSecretConfiguration: parseJson(row.non_secret_config_json, {}),
      updatedAt: String(row.updated_at),
    };
  }

  updateProviderSettings(
    patch: Partial<Omit<ProviderSettingsRecord, "id" | "updatedAt">>
  ): ProviderSettingsRecord {
    const current = this.getProviderSettings();
    const now = new Date().toISOString();
    const next: ProviderSettingsRecord = {
      ...current,
      ...patch,
      updatedAt: now,
    };
    this.db
      .prepare(
        `UPDATE provider_settings SET
          provider_name = ?, model_name = ?, enabled = ?, non_secret_config_json = ?, updated_at = ?
         WHERE id = 'default'`
      )
      .run(
        next.providerName,
        next.modelName,
        next.enabled ? 1 : 0,
        JSON.stringify(next.nonSecretConfiguration),
        now
      );
    return next;
  }

  // ---- Editorial Memory & Learning ----
  listMemoryItems(onlyActiveConfirmed = false): EditorialMemoryItem[] {
    const sql = onlyActiveConfirmed
      ? "SELECT * FROM editorial_memory_items WHERE active = 1 AND confirmed = 1 ORDER BY created_at DESC"
      : "SELECT * FROM editorial_memory_items ORDER BY confirmed ASC, created_at DESC";
    const rows = this.db.prepare(sql).all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      category: r.category as EditorialMemoryItem["category"],
      origin: r.origin as EditorialMemoryItem["origin"],
      pattern: String(r.pattern),
      ruleExplanation: String(r.rule_explanation),
      confirmed: Boolean(r.confirmed),
      active: Boolean(r.active),
      sourceDraftId: r.source_draft_id ? String(r.source_draft_id) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
  }

  addMemoryItem(input: {
    category: EditorialMemoryItem["category"];
    origin?: EditorialMemoryItem["origin"];
    pattern: string;
    ruleExplanation: string;
    confirmed?: boolean;
    sourceDraftId?: string | null;
  }): EditorialMemoryItem {
    const pattern = input.pattern.trim();
    const existing = this.db
      .prepare(
        "SELECT id FROM editorial_memory_items WHERE LOWER(pattern) = LOWER(?) AND category = ?"
      )
      .get(pattern, input.category) as { id: string } | undefined;

    const now = new Date().toISOString();
    const origin = input.origin ?? "explicit";
    const confirmed = input.confirmed ?? origin === "explicit";

    if (existing) {
      this.db
        .prepare(
          "UPDATE editorial_memory_items SET rule_explanation = ?, origin = ?, active = 1, confirmed = ?, updated_at = ? WHERE id = ?"
        )
        .run(
          input.ruleExplanation.trim(),
          origin,
          confirmed ? 1 : 0,
          now,
          existing.id
        );
      return this.listMemoryItems(false).find((m) => m.id === existing.id)!;
    }

    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO editorial_memory_items (
          id, category, origin, pattern, rule_explanation, confirmed, active, source_draft_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      )
      .run(
        id,
        input.category,
        origin,
        pattern,
        input.ruleExplanation.trim(),
        confirmed ? 1 : 0,
        input.sourceDraftId ?? null,
        now,
        now
      );

    if (input.category === "prohibited_language" && origin === "explicit") {
      this.recordFeedback({
        draftId: input.sourceDraftId ?? null,
        eventType: "prohibited_flagged",
        note: `Never use again: "${pattern}"`,
        saveAsPermanentRule: true,
      });
    }

    return this.listMemoryItems(false).find((m) => m.id === id)!;
  }

  updateMemoryItem(
    id: string,
    patch: {
      pattern?: string;
      ruleExplanation?: string;
      confirmed?: boolean;
      active?: boolean;
      origin?: EditorialMemoryItem["origin"];
    }
  ): EditorialMemoryItem | null {
    const current = this.listMemoryItems(false).find((m) => m.id === id);
    if (!current) return null;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE editorial_memory_items SET
          pattern = ?, rule_explanation = ?, confirmed = ?, active = ?, origin = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        (patch.pattern ?? current.pattern).trim(),
        (patch.ruleExplanation ?? current.ruleExplanation).trim(),
        (patch.confirmed ?? current.confirmed) ? 1 : 0,
        (patch.active ?? current.active) ? 1 : 0,
        patch.origin ?? current.origin,
        now,
        id
      );
    return this.listMemoryItems(false).find((m) => m.id === id) ?? null;
  }

  deleteMemoryItem(id: string): void {
    this.db.prepare("DELETE FROM editorial_memory_items WHERE id = ?").run(id);
  }

  // ---- Research Sources & Synthesized Findings ----
  upsertResearchSource(input: {
    title: string;
    publisher: string;
    url: string;
    sourceType: ResearchSourceRecord["sourceType"];
    publicationDate: string | null;
    accessedAt: string;
    summary: string;
    keyFindings: string;
    evidenceNotes?: string;
    limitations: string;
    potentialAngles?: string;
    verificationStatus: ResearchSourceRecord["verificationStatus"];
  }): ResearchSourceRecord {
    const existing = this.db
      .prepare("SELECT * FROM research_sources WHERE url = ?")
      .get(input.url) as Record<string, unknown> | undefined;

    const now = new Date().toISOString();
    if (existing) {
      this.db
        .prepare(
          `UPDATE research_sources SET
            title = ?, publisher = ?, source_type = ?, publication_date = ?,
            accessed_at = ?, summary = ?, key_findings = ?, evidence_notes = ?,
            limitations = ?, potential_angles = ?, verification_status = ?,
            archived_at = NULL, updated_at = ?
          WHERE id = ?`
        )
        .run(
          input.title,
          input.publisher,
          input.sourceType,
          input.publicationDate,
          input.accessedAt,
          input.summary,
          input.keyFindings,
          input.evidenceNotes ?? String(existing.evidence_notes ?? ""),
          input.limitations,
          input.potentialAngles ?? String(existing.potential_angles ?? ""),
          input.verificationStatus,
          now,
          String(existing.id)
        );
      return this.getResearchSourceById(String(existing.id))!;
    }

    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO research_sources (
          id, title, publisher, url, source_type, publication_date, accessed_at,
          summary, key_findings, evidence_notes, limitations, potential_angles,
          verification_status, archived_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
      )
      .run(
        id,
        input.title,
        input.publisher,
        input.url,
        input.sourceType,
        input.publicationDate,
        input.accessedAt,
        input.summary,
        input.keyFindings,
        input.evidenceNotes ?? "",
        input.limitations,
        input.potentialAngles ?? "",
        input.verificationStatus,
        now,
        now
      );
    return this.getResearchSourceById(id)!;
  }

  updateResearchSource(
    id: string,
    patch: Partial<
      Omit<ResearchSourceRecord, "id" | "createdAt" | "updatedAt">
    >
  ): ResearchSourceRecord | null {
    const current = this.getResearchSourceById(id);
    if (!current) return null;
    const now = new Date().toISOString();
    const next = { ...current, ...patch };
    this.db
      .prepare(
        `UPDATE research_sources SET
          title = ?, publisher = ?, url = ?, source_type = ?, publication_date = ?,
          summary = ?, key_findings = ?, evidence_notes = ?, limitations = ?,
          potential_angles = ?, verification_status = ?, archived_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        next.title,
        next.publisher,
        next.url,
        next.sourceType,
        next.publicationDate,
        next.summary,
        next.keyFindings,
        next.evidenceNotes,
        next.limitations,
        next.potentialAngles,
        next.verificationStatus,
        next.archivedAt,
        now,
        id
      );
    return this.getResearchSourceById(id);
  }

  deleteResearchSource(id: string): void {
    // Detach safely from draft_sources without erasing draft body (DATA_MODEL.md rule)
    this.db
      .prepare("DELETE FROM draft_sources WHERE source_id = ?")
      .run(id);
    this.db.prepare("DELETE FROM research_sources WHERE id = ?").run(id);
  }

  getResearchSourceById(id: string): ResearchSourceRecord | null {
    const row = this.db
      .prepare("SELECT * FROM research_sources WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapResearchSource(row) : null;
  }

  listResearchSources(includeArchived = false): ResearchSourceRecord[] {
    const sql = includeArchived
      ? "SELECT * FROM research_sources ORDER BY created_at DESC"
      : "SELECT * FROM research_sources WHERE archived_at IS NULL ORDER BY created_at DESC";
    const rows = this.db.prepare(sql).all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapResearchSource(r));
  }

  private mapResearchSource(r: Record<string, unknown>): ResearchSourceRecord {
    return {
      id: String(r.id),
      title: String(r.title),
      publisher: String(r.publisher),
      url: String(r.url),
      sourceType: r.source_type as ResearchSourceRecord["sourceType"],
      publicationDate: r.publication_date ? String(r.publication_date) : null,
      accessedAt: String(r.accessed_at),
      summary: String(r.summary),
      keyFindings: String(r.key_findings),
      evidenceNotes: String(r.evidence_notes ?? ""),
      limitations: String(r.limitations),
      potentialAngles: String(r.potential_angles ?? ""),
      verificationStatus:
        r.verification_status as ResearchSourceRecord["verificationStatus"],
      archivedAt: r.archived_at ? String(r.archived_at) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  createResearchFinding(
    input: Omit<ResearchFindingRecord, "id" | "sources" | "createdAt" | "updatedAt">
  ): ResearchFindingRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO research_findings (
          id, question, summary, business_relevance, problem_or_opportunity,
          implementation_implications, uncertainties, potential_angles, status, source_ids_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.question,
        input.summary,
        input.businessRelevance,
        input.problemOrOpportunity,
        input.implementationImplications,
        input.uncertainties,
        input.potentialAngles,
        input.status,
        JSON.stringify(input.sourceIds),
        now,
        now
      );
    return this.listResearchFindings(true).find((f) => f.id === id)!;
  }

  updateResearchFinding(
    id: string,
    patch: Partial<
      Omit<ResearchFindingRecord, "id" | "sources" | "createdAt" | "updatedAt">
    >
  ): ResearchFindingRecord | null {
    const existing = this.listResearchFindings(true).find((f) => f.id === id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const next = { ...existing, ...patch };
    this.db
      .prepare(
        `UPDATE research_findings SET
          question = ?, summary = ?, business_relevance = ?, problem_or_opportunity = ?,
          implementation_implications = ?, uncertainties = ?, potential_angles = ?,
          status = ?, source_ids_json = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        next.question,
        next.summary,
        next.businessRelevance,
        next.problemOrOpportunity,
        next.implementationImplications,
        next.uncertainties,
        next.potentialAngles,
        next.status,
        JSON.stringify(next.sourceIds),
        now,
        id
      );
    return this.listResearchFindings(true).find((f) => f.id === id) ?? null;
  }

  listResearchFindings(includeArchived = false): ResearchFindingRecord[] {
    const sql = includeArchived
      ? "SELECT * FROM research_findings ORDER BY created_at DESC"
      : "SELECT * FROM research_findings WHERE status != 'archived' ORDER BY created_at DESC";
    const rows = this.db.prepare(sql).all() as Array<Record<string, unknown>>;
    return rows.map((r) => {
      const sourceIds = parseJson<string[]>(r.source_ids_json, []);
      const sources = sourceIds
        .map((sid) => this.getResearchSourceById(sid))
        .filter((s): s is ResearchSourceRecord => s !== null);
      return {
        id: String(r.id),
        question: String(r.question),
        summary: String(r.summary),
        businessRelevance: String(r.business_relevance),
        problemOrOpportunity: String(r.problem_or_opportunity),
        implementationImplications: String(r.implementation_implications),
        uncertainties: String(r.uncertainties),
        potentialAngles: String(r.potential_angles),
        status: r.status as ResearchFindingRecord["status"],
        sourceIds,
        sources,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      };
    });
  }

  // ---- Weekly Packages ----
  createWeeklyPackage(input: {
    weekLabel: string;
    requestedPostCount: number;
    userInstruction: string;
  }): WeeklyPackageRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const initialStages: StageProgressEntry[] = WEEKLY_GENERATION_STAGES.map(
      (s, idx) => ({
        key: s.key,
        step: s.step,
        label: s.label,
        status: idx === 0 ? "running" : "pending",
        detail: s.description,
        startedAt: idx === 0 ? now : null,
        completedAt: null,
      })
    );

    this.db
      .prepare(
        `INSERT INTO weekly_packages (
          id, week_label, requested_post_count, user_instruction, status, current_stage,
          stage_logs_json, intelligence_summary_json, assistant_summary, error_message, provider_used,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'running', 'context_review', ?, NULL, '', NULL, NULL, ?, ?)`
      )
      .run(
        id,
        input.weekLabel,
        input.requestedPostCount,
        input.userInstruction,
        JSON.stringify(initialStages),
        now,
        now
      );

    return this.getWeeklyPackageById(id)!;
  }

  updateWeeklyPackageStage(
    id: string,
    stageKey: WeeklyStageKey,
    stageStatus: "running" | "completed" | "failed",
    detail: string,
    extra?: {
      intelligenceSummary?: ContentIntelligenceSummary;
      assistantSummary?: string;
      packageStatus?: WeeklyPackageRecord["status"];
      errorMessage?: string | null;
      providerUsed?: string;
    }
  ): WeeklyPackageRecord {
    const pkg = this.getWeeklyPackageById(id);
    if (!pkg) throw new Error(`Weekly package ${id} not found`);

    const now = new Date().toISOString();
    const stageLogs = pkg.stageLogs.map((entry) => {
      if (entry.key !== stageKey) return entry;
      return {
        ...entry,
        status: stageStatus,
        detail,
        startedAt: entry.startedAt ?? now,
        completedAt:
          stageStatus === "completed" || stageStatus === "failed"
            ? now
            : entry.completedAt,
      };
    });

    const nextPkgStatus = extra?.packageStatus ?? pkg.status;
    const nextIntel = extra?.intelligenceSummary ?? pkg.intelligenceSummary;
    const nextSummary = extra?.assistantSummary ?? pkg.assistantSummary;
    const nextError =
      extra?.errorMessage !== undefined ? extra.errorMessage : pkg.errorMessage;
    const nextProvider = extra?.providerUsed ?? pkg.providerUsed;

    this.db
      .prepare(
        `UPDATE weekly_packages SET
          status = ?, current_stage = ?, stage_logs_json = ?,
          intelligence_summary_json = ?, assistant_summary = ?,
          error_message = ?, provider_used = ?, updated_at = ?
        WHERE id = ?`
      )
      .run(
        nextPkgStatus,
        stageKey,
        JSON.stringify(stageLogs),
        nextIntel ? JSON.stringify(nextIntel) : null,
        nextSummary,
        nextError,
        nextProvider,
        now,
        id
      );

    return this.getWeeklyPackageById(id)!;
  }

  getWeeklyPackageById(id: string): WeeklyPackageRecord | null {
    const row = this.db
      .prepare("SELECT * FROM weekly_packages WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapWeeklyPackage(row) : null;
  }

  listWeeklyPackages(limit = 10): WeeklyPackageRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM weekly_packages ORDER BY created_at DESC LIMIT ?")
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapWeeklyPackage(r));
  }

  private mapWeeklyPackage(r: Record<string, unknown>): WeeklyPackageRecord {
    return {
      id: String(r.id),
      weekLabel: String(r.week_label),
      requestedPostCount: Number(r.requested_post_count),
      userInstruction: String(r.user_instruction),
      status: r.status as WeeklyPackageRecord["status"],
      currentStage: r.current_stage as WeeklyStageKey,
      stageLogs: parseJson(r.stage_logs_json, []),
      intelligenceSummary: parseJson(r.intelligence_summary_json, null),
      assistantSummary: String(r.assistant_summary),
      errorMessage: r.error_message ? String(r.error_message) : null,
      providerUsed: r.provider_used ? String(r.provider_used) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  // ---- Content Ideas ----
  createContentIdea(input: {
    weeklyPackageId?: string | null;
    title: string;
    postType?: ContentIdeaRecord["postType"];
    pillar: ContentPillarId;
    intendedAudience: string;
    problemOrOpportunity: string;
    centralAngle: string;
    expertiseDemonstrated: string;
    whySelected: string;
    authorInputNeeded?: boolean;
    authorInputStatus?: AuthorInputStatus;
    authorInputPrompt?: string;
    authorInput?: string;
    evidenceNotes?: string;
    healthcareRelevant?: boolean;
    status?: ContentIdeaRecord["status"];
    sourceIds?: string[];
    findingIds?: string[];
    actor?: "user" | "system";
  }): ContentIdeaRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const needed = Boolean(input.authorInputNeeded);
    const inputStatus: AuthorInputStatus =
      input.authorInputStatus ??
      (input.authorInput?.trim()
        ? "supplied"
        : needed
          ? "requested"
          : "not_needed");
    const status = input.status ?? "idea";

    const postType: ContentIdeaRecord["postType"] =
      input.postType ??
      (input.pillar === "human_reflections" ? "reflection" : "authority");

    this.db
      .prepare(
        `INSERT INTO content_ideas (
          id, weekly_package_id, title, post_type, pillar, intended_audience,
          problem_or_opportunity, central_angle, expertise_demonstrated,
          why_selected, author_input_needed, author_input_status, author_input_prompt,
          author_input, evidence_notes, healthcare_relevant, status,
          source_ids_json, finding_ids_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.weeklyPackageId ?? null,
        input.title,
        postType,
        input.pillar,
        input.intendedAudience,
        input.problemOrOpportunity,
        input.centralAngle,
        input.expertiseDemonstrated,
        input.whySelected,
        needed ? 1 : 0,
        inputStatus,
        input.authorInputPrompt ?? "",
        input.authorInput ?? "",
        input.evidenceNotes ?? "",
        input.healthcareRelevant ? 1 : 0,
        status,
        JSON.stringify(input.sourceIds ?? []),
        JSON.stringify(input.findingIds ?? []),
        now,
        now
      );

    this.logWorkflowEvent({
      entityType: "idea",
      entityId: id,
      fromStatus: null,
      toStatus: status,
      actor: input.actor ?? "system",
    });

    return this.getIdeaById(id)!;
  }

  getIdeaById(id: string): ContentIdeaRecord | null {
    const row = this.db
      .prepare("SELECT * FROM content_ideas WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapIdeaRow(row) : null;
  }

  updateContentIdea(
    id: string,
    patch: Partial<Omit<ContentIdeaRecord, "id" | "createdAt" | "updatedAt">> & {
      actor?: "user" | "system";
    }
  ): ContentIdeaRecord | null {
    const current = this.getIdeaById(id);
    if (!current) return null;
    const now = new Date().toISOString();

    const nextAuthorInput = patch.authorInput ?? current.authorInput;
    const nextNeeded = patch.authorInputNeeded ?? current.authorInputNeeded;
    const nextInputStatus: AuthorInputStatus =
      patch.authorInputStatus ??
      (nextAuthorInput.trim()
        ? "supplied"
        : nextNeeded
          ? "requested"
          : "not_needed");
    const nextStatus = patch.status ?? current.status;

    this.db
      .prepare(
        `UPDATE content_ideas SET
          title = ?, pillar = ?, intended_audience = ?, problem_or_opportunity = ?,
          central_angle = ?, expertise_demonstrated = ?, why_selected = ?,
          author_input_needed = ?, author_input_status = ?, author_input_prompt = ?,
          author_input = ?, evidence_notes = ?, healthcare_relevant = ?,
          status = ?, source_ids_json = ?, finding_ids_json = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        patch.title ?? current.title,
        patch.pillar ?? current.pillar,
        patch.intendedAudience ?? current.intendedAudience,
        patch.problemOrOpportunity ?? current.problemOrOpportunity,
        patch.centralAngle ?? current.centralAngle,
        patch.expertiseDemonstrated ?? current.expertiseDemonstrated,
        patch.whySelected ?? current.whySelected,
        nextNeeded ? 1 : 0,
        nextInputStatus,
        patch.authorInputPrompt ?? current.authorInputPrompt,
        nextAuthorInput,
        patch.evidenceNotes ?? current.evidenceNotes,
        (patch.healthcareRelevant ?? current.healthcareRelevant) ? 1 : 0,
        nextStatus,
        JSON.stringify(patch.sourceIds ?? current.sourceIds),
        JSON.stringify(patch.findingIds ?? current.findingIds),
        now,
        id
      );

    if (nextStatus !== current.status) {
      this.logWorkflowEvent({
        entityType: "idea",
        entityId: id,
        fromStatus: current.status,
        toStatus: nextStatus,
        actor: patch.actor ?? "user",
      });
    }

    return this.getIdeaById(id);
  }

  deleteContentIdea(id: string): void {
    this.db.prepare("DELETE FROM content_ideas WHERE id = ?").run(id);
  }

  listContentIdeas(includeArchived = false): ContentIdeaRecord[] {
    const sql = includeArchived
      ? "SELECT * FROM content_ideas ORDER BY created_at DESC"
      : "SELECT * FROM content_ideas WHERE status != 'archived' ORDER BY created_at DESC";
    const rows = this.db.prepare(sql).all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapIdeaRow(r));
  }

  private mapIdeaRow(r: Record<string, unknown>): ContentIdeaRecord {
    return {
      id: String(r.id),
      weeklyPackageId: r.weekly_package_id ? String(r.weekly_package_id) : null,
      title: String(r.title),
      postType: (r.post_type || "authority") as ContentIdeaRecord["postType"],
      pillar: r.pillar as ContentPillarId,
      intendedAudience: String(r.intended_audience),
      problemOrOpportunity: String(r.problem_or_opportunity),
      centralAngle: String(r.central_angle),
      expertiseDemonstrated: String(r.expertise_demonstrated),
      whySelected: String(r.why_selected),
      authorInputNeeded: Boolean(r.author_input_needed),
      authorInputStatus: (r.author_input_status ||
        "not_needed") as AuthorInputStatus,
      authorInputPrompt: String(r.author_input_prompt ?? ""),
      authorInput: String(r.author_input ?? ""),
      evidenceNotes: String(r.evidence_notes ?? ""),
      healthcareRelevant: Boolean(r.healthcare_relevant),
      status: r.status as ContentIdeaRecord["status"],
      sourceIds: parseJson(r.source_ids_json, []),
      findingIds: parseJson(r.finding_ids_json, []),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  /**
   * Converts an Idea into a ContentDraft while preserving its idea_id, author input, and source links.
   * Respects the Author Input Checkpoint if personal input is required and neither supplied nor waived.
   */
  convertIdeaToDraft(
    ideaId: string,
    options?: { initialBody?: string; bypassCheckpoint?: boolean }
  ): ContentDraftRecord {
    const idea = this.getIdeaById(ideaId);
    if (!idea) throw new Error("Idea not found.");

    if (
      idea.authorInputNeeded &&
      idea.authorInputStatus === "requested" &&
      !idea.authorInput.trim() &&
      !options?.bypassCheckpoint
    ) {
      throw new Error(
        `Author input is required before drafting "${idea.title}". Supply your perspective or waive personal input first.`
      );
    }

    const body =
      options?.initialBody?.trim() ||
      [
        idea.problemOrOpportunity,
        "",
        idea.centralAngle,
        ...(idea.authorInput.trim()
          ? ["", `[Author perspective: ${idea.authorInput.trim()}]`]
          : []),
      ].join("\n");

    const draft = this.createContentDraft({
      weeklyPackageId: idea.weeklyPackageId,
      ideaId: idea.id,
      slotIndex: 0,
      title: idea.title,
      body,
      pillar: idea.pillar,
      intendedAudience: idea.intendedAudience,
      hookStyle: "Problem-first opening",
      structureType: "Operational breakdown",
      selectionRationale: idea.whySelected,
      authorInputUsed: idea.authorInput,
      status: "draft",
      qualityReview: null,
      missingAuthorInput: null,
      visualRecommendation: null,
      targetPublishDate: null,
      sourceIds: idea.sourceIds,
      actor: "user",
    });

    this.updateContentIdea(idea.id, { status: "drafted", actor: "user" });
    return draft;
  }

  // ---- Content Drafts ----
  createContentDraft(input: {
    weeklyPackageId: string | null;
    ideaId: string | null;
    slotIndex: number;
    title: string;
    body: string;
    pillar: ContentPillarId;
    intendedAudience: string;
    hookStyle: string;
    structureType: string;
    selectionRationale: string;
    authorInputUsed?: string;
    status: WorkflowStatus;
    qualityReview: QualityReviewReport | null;
    missingAuthorInput: MissingAuthorInputPrompt | null;
    visualRecommendation: VisualRecommendation | null;
    targetPublishDate: string | null;
    sourceIds: string[];
    actor?: "user" | "system";
  }): ContentDraftRecord {
    const actor = input.actor ?? "system";
    if (input.status === "approved" && actor !== "user") {
      throw new Error(
        "System generation cannot create a draft directly in Approved status. Explicit user approval is required."
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO content_drafts (
          id, weekly_package_id, idea_id, slot_index, title, body, pillar,
          intended_audience, hook_style, structure_type, selection_rationale,
          author_input_used, status, quality_review_json, missing_author_input_json,
          visual_recommendation_json, target_publish_date, approved_at, published_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
      )
      .run(
        id,
        input.weeklyPackageId,
        input.ideaId,
        input.slotIndex,
        input.title,
        input.body,
        input.pillar,
        input.intendedAudience,
        input.hookStyle,
        input.structureType,
        input.selectionRationale,
        input.authorInputUsed ?? "",
        input.status,
        input.qualityReview ? JSON.stringify(input.qualityReview) : null,
        input.missingAuthorInput
          ? JSON.stringify(input.missingAuthorInput)
          : null,
        input.visualRecommendation
          ? JSON.stringify(input.visualRecommendation)
          : null,
        input.targetPublishDate,
        input.status === "approved" ? now : null,
        now,
        now
      );

    const linkStmt = this.db.prepare(
      "INSERT OR IGNORE INTO draft_sources (draft_id, source_id) VALUES (?, ?)"
    );
    for (const sid of input.sourceIds) {
      linkStmt.run(id, sid);
    }

    this.addDraftRevision({
      draftId: id,
      body: input.body,
      instruction:
        actor === "user" ? "Initial manual draft" : "Initial autonomous draft",
      actor: actor === "user" ? "user" : "assistant",
    });

    this.logWorkflowEvent({
      entityType: "draft",
      entityId: id,
      fromStatus: null,
      toStatus: input.status,
      actor,
    });

    return this.getDraftById(id)!;
  }

  getDraftById(id: string): ContentDraftRecord | null {
    const row = this.db
      .prepare("SELECT * FROM content_drafts WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapDraftRow(row, true);
  }

  listDrafts(options?: {
    weeklyPackageId?: string;
    statuses?: WorkflowStatus[];
    pillar?: ContentPillarId;
    search?: string;
    includeArchived?: boolean;
  }): ContentDraftRecord[] {
    let sql = "SELECT * FROM content_drafts WHERE 1=1";
    const params: Array<string | number> = [];

    if (options?.weeklyPackageId) {
      sql += " AND weekly_package_id = ?";
      params.push(options.weeklyPackageId);
    }
    if (options?.pillar) {
      sql += " AND pillar = ?";
      params.push(options.pillar);
    }
    if (options?.statuses && options.statuses.length > 0) {
      const placeholders = options.statuses.map(() => "?").join(", ");
      sql += ` AND status IN (${placeholders})`;
      params.push(...options.statuses);
    } else if (!options?.includeArchived) {
      sql += " AND status != 'archived'";
    }
    if (options?.search?.trim()) {
      const q = `%${options.search.trim().toLowerCase()}%`;
      sql += " AND (LOWER(title) LIKE ? OR LOWER(body) LIKE ?)";
      params.push(q, q);
    }

    sql += " ORDER BY created_at DESC, slot_index ASC";
    const rows = this.db.prepare(sql).all(...params) as Array<
      Record<string, unknown>
    >;
    return rows.map((r) => this.mapDraftRow(r, true));
  }

  updateDraft(
    id: string,
    patch: {
      title?: string;
      body?: string;
      pillar?: ContentPillarId;
      status?: WorkflowStatus;
      actor: "user" | "assistant";
      revisionNote?: string;
      authorInputUsed?: string;
      qualityReview?: QualityReviewReport | null;
      missingAuthorInput?: MissingAuthorInputPrompt | null;
      visualRecommendation?: VisualRecommendation | null;
      targetPublishDate?: string | null;
      hookStyle?: string;
      structureType?: string;
      selectionRationale?: string;
      sourceIds?: string[];
    }
  ): ContentDraftRecord {
    const current = this.getDraftById(id);
    if (!current) throw new Error(`Draft ${id} not found`);

    if (patch.status === "approved" && patch.actor !== "user") {
      throw new Error(
        "Only an explicit user action can move a post to Approved."
      );
    }

    const now = new Date().toISOString();
    const nextTitle = patch.title ?? current.title;
    const nextBody = patch.body ?? current.body;
    const nextPillar = patch.pillar ?? current.pillar;
    const nextStatus = patch.status ?? current.status;
    const nextApprovedAt =
      nextStatus === "approved"
        ? current.approvedAt ?? now
        : nextStatus === "draft" || nextStatus === "ready_for_review"
          ? null
          : current.approvedAt;
    const nextPublishedAt =
      nextStatus === "published"
        ? current.publishedAt ?? now
        : current.publishedAt;

    const nextQuality =
      patch.qualityReview !== undefined
        ? patch.qualityReview
        : current.qualityReview;
    const nextMissing =
      patch.missingAuthorInput !== undefined
        ? patch.missingAuthorInput
        : current.missingAuthorInput;
    const nextVisual =
      patch.visualRecommendation !== undefined
        ? patch.visualRecommendation
        : current.visualRecommendation;
    const nextTargetDate =
      patch.targetPublishDate !== undefined
        ? patch.targetPublishDate
        : current.targetPublishDate;

    this.db
      .prepare(
        `UPDATE content_drafts SET
          title = ?, body = ?, pillar = ?, status = ?, hook_style = ?, structure_type = ?,
          selection_rationale = ?, author_input_used = ?, quality_review_json = ?,
          missing_author_input_json = ?, visual_recommendation_json = ?,
          target_publish_date = ?, approved_at = ?, published_at = ?, updated_at = ?
        WHERE id = ?`
      )
      .run(
        nextTitle,
        nextBody,
        nextPillar,
        nextStatus,
        patch.hookStyle ?? current.hookStyle,
        patch.structureType ?? current.structureType,
        patch.selectionRationale ?? current.selectionRationale,
        patch.authorInputUsed ?? current.authorInputUsed,
        nextQuality ? JSON.stringify(nextQuality) : null,
        nextMissing ? JSON.stringify(nextMissing) : null,
        nextVisual ? JSON.stringify(nextVisual) : null,
        nextTargetDate,
        nextApprovedAt,
        nextPublishedAt,
        now,
        id
      );

    if (patch.sourceIds) {
      this.db
        .prepare("DELETE FROM draft_sources WHERE draft_id = ?")
        .run(id);
      const linkStmt = this.db.prepare(
        "INSERT OR IGNORE INTO draft_sources (draft_id, source_id) VALUES (?, ?)"
      );
      for (const sid of patch.sourceIds) {
        linkStmt.run(id, sid);
      }
    }

    if (patch.body !== undefined && patch.body !== current.body) {
      this.addDraftRevision({
        draftId: id,
        body: patch.body,
        instruction:
          patch.revisionNote ??
          (patch.actor === "user" ? "Manual edit by Efe" : "Assistant revision"),
        actor: patch.actor,
      });

      if (patch.actor === "user") {
        this.recordFeedback({
          draftId: id,
          eventType: "edited",
          note: patch.revisionNote ?? "Direct edit in studio",
          saveAsPermanentRule: false,
        });
      }
    }

    if (patch.status && patch.status !== current.status) {
      this.logWorkflowEvent({
        entityType: "draft",
        entityId: id,
        fromStatus: current.status,
        toStatus: patch.status,
        actor: patch.actor === "user" ? "user" : "system",
      });

      if (patch.actor === "user") {
        if (patch.status === "approved") {
          this.recordFeedback({
            draftId: id,
            eventType: "approved",
            note: `Approved post: ${nextTitle}`,
            saveAsPermanentRule: false,
          });
        } else if (patch.status === "rejected") {
          this.recordFeedback({
            draftId: id,
            eventType: "rejected",
            note: patch.revisionNote ?? `Rejected post: ${nextTitle}`,
            saveAsPermanentRule: false,
          });
        }
      }
    }

    return this.getDraftById(id)!;
  }

  deleteDraft(id: string): void {
    this.db.prepare("DELETE FROM draft_sources WHERE draft_id = ?").run(id);
    this.db.prepare("DELETE FROM draft_revisions WHERE draft_id = ?").run(id);
    this.db.prepare("DELETE FROM content_drafts WHERE id = ?").run(id);
  }

  private mapDraftRow(
    r: Record<string, unknown>,
    hydrateSources: boolean
  ): ContentDraftRecord {
    const id = String(r.id);
    const sourceIdRows = this.db
      .prepare("SELECT source_id FROM draft_sources WHERE draft_id = ?")
      .all(id) as Array<{ source_id: string }>;
    const sourceIds = sourceIdRows.map((s) => s.source_id);

    let sources: ResearchSourceRecord[] | undefined;
    if (hydrateSources) {
      sources = sourceIds
        .map((sid) => this.getResearchSourceById(sid))
        .filter((s): s is ResearchSourceRecord => s !== null);
    }

    return {
      id,
      weeklyPackageId: r.weekly_package_id ? String(r.weekly_package_id) : null,
      ideaId: r.idea_id ? String(r.idea_id) : null,
      slotIndex: Number(r.slot_index),
      title: String(r.title),
      body: String(r.body),
      pillar: r.pillar as ContentPillarId,
      intendedAudience: String(r.intended_audience),
      hookStyle: String(r.hook_style),
      structureType: String(r.structure_type),
      selectionRationale: String(r.selection_rationale),
      authorInputUsed: String(r.author_input_used ?? ""),
      status: r.status as WorkflowStatus,
      qualityReview: parseJson(r.quality_review_json, null),
      missingAuthorInput: parseJson(r.missing_author_input_json, null),
      visualRecommendation: parseJson(r.visual_recommendation_json, null),
      targetPublishDate: r.target_publish_date
        ? String(r.target_publish_date)
        : null,
      approvedAt: r.approved_at ? String(r.approved_at) : null,
      publishedAt: r.published_at ? String(r.published_at) : null,
      sourceIds,
      sources,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  // ---- Revisions & Feedback Learning ----
  addDraftRevision(input: {
    draftId: string;
    body: string;
    instruction: string;
    actor: "assistant" | "user";
  }): DraftRevisionRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO draft_revisions (id, draft_id, body, instruction, actor, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.draftId, input.body, input.instruction, input.actor, now);
    return { id, ...input, createdAt: now };
  }

  listDraftRevisions(draftId: string): DraftRevisionRecord[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM draft_revisions WHERE draft_id = ? ORDER BY created_at DESC"
      )
      .all(draftId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      draftId: String(r.draft_id),
      body: String(r.body),
      instruction: String(r.instruction),
      actor: r.actor as "assistant" | "user",
      createdAt: String(r.created_at),
    }));
  }

  recordFeedback(input: {
    draftId: string | null;
    eventType: FeedbackEventRecord["eventType"];
    note: string;
    saveAsPermanentRule: boolean;
  }): FeedbackEventRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO feedback_events (id, draft_id, event_type, note, save_as_permanent_rule, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.draftId,
        input.eventType,
        input.note,
        input.saveAsPermanentRule ? 1 : 0,
        now
      );

    // Pattern-learning: if Efe repeats a similar instruction >= 2 times without explicitly saving it yet,
    // surface an unconfirmed inferred preference for Efe's explicit approval in Editorial Memory.
    if (!input.saveAsPermanentRule && input.eventType === "regenerated") {
      this.detectRepeatedFeedbackThemes(input.note, input.draftId);
    }

    return { id, ...input, createdAt: now };
  }

  private detectRepeatedFeedbackThemes(
    latestNote: string,
    draftId: string | null
  ) {
    const recent = this.listFeedbackEvents(20).filter(
      (f) => f.eventType === "regenerated"
    );

    const themes: Array<{
      regex: RegExp;
      pattern: string;
      explanation: string;
    }> = [
      {
        regex: /practical|concrete|workflow|example/i,
        pattern: "Include a concrete workflow example rather than abstract explanation",
        explanation:
          "Inferred from repeated revision requests asking for practical examples. Confirm to make permanent.",
      },
      {
        regex: /shorter|concise|tighter|brief/i,
        pattern: "Keep paragraphs tighter and default to concise-to-medium length",
        explanation:
          "Inferred from repeated requests for shorter, tighter drafts. Confirm to make permanent.",
      },
      {
        regex: /hook|opening|first line/i,
        pattern: "Open with a sharper, specific operational tension in the first line",
        explanation:
          "Inferred from repeated opening-hook adjustments. Confirm to make permanent.",
      },
      {
        regex: /conversational|human|less formal|natural/i,
        pattern: "Use a warmer, less formal conversational register",
        explanation:
          "Inferred from repeated tone adjustments toward conversational warmth. Confirm to make permanent.",
      },
    ];

    for (const theme of themes) {
      if (!theme.regex.test(latestNote)) continue;
      const occurrences = recent.filter((ev) => theme.regex.test(ev.note)).length;
      if (occurrences >= 2) {
        const alreadyExists = this.listMemoryItems(false).some(
          (m) => m.pattern.toLowerCase() === theme.pattern.toLowerCase()
        );
        if (!alreadyExists) {
          this.addMemoryItem({
            category: "writing_preference",
            origin: "inferred",
            pattern: theme.pattern,
            ruleExplanation: theme.explanation,
            confirmed: false,
            sourceDraftId: draftId,
          });
        }
      }
    }
  }

  listFeedbackEvents(limit = 30): FeedbackEventRecord[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM feedback_events ORDER BY created_at DESC LIMIT ?"
      )
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      draftId: r.draft_id ? String(r.draft_id) : null,
      eventType: r.event_type as FeedbackEventRecord["eventType"],
      note: String(r.note),
      saveAsPermanentRule: Boolean(r.save_as_permanent_rule),
      createdAt: String(r.created_at),
    }));
  }

  // ---- Workspace Backup Export ----
  exportWorkspaceSnapshot() {
    return {
      exportedAt: new Date().toISOString(),
      authorProfile: this.getAuthorProfile(),
      providerSettings: this.getProviderSettings(),
      editorialMemory: this.listMemoryItems(false),
      researchSources: this.listResearchSources(true),
      researchFindings: this.listResearchFindings(true),
      contentIdeas: this.listContentIdeas(true),
      weeklyPackages: this.listWeeklyPackages(50),
      contentDrafts: this.listDrafts({ includeArchived: true }),
      feedbackHistory: this.listFeedbackEvents(100),
      workflowEvents: this.listWorkflowEvents(100),
    };
  }

  exportRawTables(): Record<string, Array<Record<string, unknown>>> {
    const dump: Record<string, Array<Record<string, unknown>>> = {};
    for (const table of PERSISTED_TABLES) {
      dump[table] = this.db
        .prepare(`SELECT * FROM ${table}`)
        .all() as Array<Record<string, unknown>>;
    }
    return dump;
  }

  importRawTables(
    dump: Record<string, Array<Record<string, unknown>>>
  ): void {
    this.db.exec("PRAGMA foreign_keys = OFF;");
    try {
      for (const table of PERSISTED_TABLES) {
        const rows = dump[table];
        if (!rows) continue;
        this.db.exec(`DELETE FROM ${table};`);
        if (rows.length === 0) continue;

        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => "?").join(", ");
        const stmt = this.db.prepare(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`
        );
        for (const row of rows) {
          const vals = columns.map((col) => {
            const v = row[col];
            return v === undefined ? null : (v as string | number | null);
          });
          stmt.run(...vals);
        }
      }
    } finally {
      this.db.exec("PRAGMA foreign_keys = ON;");
    }
  }
}

declare global {
  var __linkedinAssistantRepo: StorageRepository | undefined;
}

export function getRepository(): StorageRepository {
  if (!globalThis.__linkedinAssistantRepo) {
    globalThis.__linkedinAssistantRepo = new StorageRepository();
  }
  return globalThis.__linkedinAssistantRepo;
}

/**
 * Hydrates the repository from PostgreSQL when DATABASE_URL / POSTGRES_URL is set,
 * or returns the fast local SQLite repository in 0ms during local use.
 */
export async function getReadyRepository(): Promise<StorageRepository> {
  const repo = getRepository();
  const pgUrl = getConfiguredPostgresUrl();
  if (!pgUrl) return repo;

  const remoteTables = await loadTablesFromPostgres(pgUrl);
  if (remoteTables) {
    repo.importRawTables(remoteTables);
  } else {
    await saveTablesToPostgres(pgUrl, repo.exportRawTables());
  }
  return repo;
}

/**
 * Flushes repository state to PostgreSQL when DATABASE_URL / POSTGRES_URL is set.
 * No-op locally where SQLite writes directly to data/assistant.sqlite.
 */
export async function persistRepository(
  repo: StorageRepository
): Promise<void> {
  const pgUrl = getConfiguredPostgresUrl();
  if (!pgUrl) return;
  await saveTablesToPostgres(pgUrl, repo.exportRawTables());
}
