import type {
  ContentPillarId,
  WeeklyStageKey,
  WorkflowStatus,
} from "@/lib/constants";

export type SourceType =
  | "primary"
  | "research"
  | "reporting"
  | "commentary"
  | "other";

export type VerificationStatus =
  | "unreviewed"
  | "checked"
  | "disputed"
  | "outdated"
  | "inaccessible";

export interface ResearchSourceRecord {
  id: string;
  title: string;
  publisher: string;
  url: string;
  sourceType: SourceType;
  publicationDate: string | null;
  accessedAt: string;
  summary: string;
  keyFindings: string;
  evidenceNotes: string;
  limitations: string;
  potentialAngles: string;
  verificationStatus: VerificationStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchFindingRecord {
  id: string;
  question: string;
  summary: string;
  businessRelevance: string;
  problemOrOpportunity: string;
  implementationImplications: string;
  uncertainties: string;
  potentialAngles: string;
  status: "new" | "reviewed" | "archived";
  sourceIds: string[];
  sources?: ResearchSourceRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmedProject {
  id: string;
  name: string;
  status: "concept" | "prototype" | "experiment" | "production";
  summary: string;
  confirmedLessons: string;
}

export interface AuthorProfileRecord {
  id: string;
  preferredName: string;
  positioning: string;
  audiences: string[];
  voiceSummary: string;
  confirmedBackground: string[];
  confirmedProjects: ConfirmedProject[];
  avoidTopicsOrPatterns: string[];
  updatedAt: string;
}

export interface ProviderSettingsRecord {
  id: string;
  providerName: string;
  modelName: string;
  enabled: boolean;
  nonSecretConfiguration: Record<string, string | number | boolean>;
  updatedAt: string;
}

export interface WorkflowEventRecord {
  id: string;
  entityType: "idea" | "draft" | "research_source" | "research_finding";
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  actor: "user" | "system";
  createdAt: string;
}

export type MemoryCategory =
  | "prohibited_language"
  | "writing_preference"
  | "topic_preference"
  | "professional_fact";

export type MemoryOrigin = "explicit" | "inferred" | "temporary";

export interface EditorialMemoryItem {
  id: string;
  category: MemoryCategory;
  origin: MemoryOrigin;
  pattern: string;
  ruleExplanation: string;
  confirmed: boolean;
  active: boolean;
  sourceDraftId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StageProgressEntry {
  key: WeeklyStageKey;
  step: number;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  detail: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ContentIntelligenceSummary {
  totalHistoricalPosts: number;
  pillarCounts: Record<ContentPillarId, number>;
  underrepresentedPillars: ContentPillarId[];
  recentTopicsAvoided: string[];
  recentHooksAvoided: string[];
  includeHealthcareLens: boolean;
  rationale: string;
}

export interface WeeklyPackageRecord {
  id: string;
  weekLabel: string;
  requestedPostCount: number;
  userInstruction: string;
  status: "running" | "completed" | "failed";
  currentStage: WeeklyStageKey;
  stageLogs: StageProgressEntry[];
  intelligenceSummary: ContentIntelligenceSummary | null;
  assistantSummary: string;
  errorMessage: string | null;
  providerUsed: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AuthorInputStatus =
  | "not_needed"
  | "requested"
  | "supplied"
  | "waived";

export type SuggestedPostType = "authority" | "educational" | "reflection";

export interface ContentIdeaRecord {
  id: string;
  weeklyPackageId: string | null;
  title: string;
  postType: SuggestedPostType;
  pillar: ContentPillarId;
  intendedAudience: string;
  problemOrOpportunity: string;
  centralAngle: string;
  expertiseDemonstrated: string;
  whySelected: string;
  authorInputNeeded: boolean;
  authorInputStatus: AuthorInputStatus;
  authorInputPrompt: string;
  authorInput: string;
  evidenceNotes: string;
  healthcareRelevant: boolean;
  status: "idea" | "in_progress" | "drafted" | "rejected" | "archived";
  sourceIds: string[];
  findingIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MissingAuthorInputPrompt {
  needed: boolean;
  question: string;
  whyItMatters: string;
  suppliedAnswer?: string;
}

export interface QualityReviewReport {
  overallPassed: boolean;
  overallNote: string;
  factualSupport: "strong" | "needs_review";
  voiceAlignment: "strong" | "needs_review";
  originality: "strong" | "needs_review";
  practicalValue: "strong" | "needs_review";
  prohibitedLanguageFound: string[];
  similarityWarnings?: string[];
  issues: string[];
  strengths: string[];
}

export interface VisualRecommendation {
  choice: "none" | "sourced_image" | "simple_diagram";
  rationale: string;
}

export interface ContentDraftRecord {
  id: string;
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
  authorInputUsed: string;
  status: WorkflowStatus;
  qualityReview: QualityReviewReport | null;
  missingAuthorInput: MissingAuthorInputPrompt | null;
  visualRecommendation: VisualRecommendation | null;
  targetPublishDate: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  sourceIds: string[];
  sources?: ResearchSourceRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DraftRevisionRecord {
  id: string;
  draftId: string;
  body: string;
  instruction: string;
  actor: "assistant" | "user";
  createdAt: string;
}

export interface FeedbackEventRecord {
  id: string;
  draftId: string | null;
  eventType:
    | "approved"
    | "rejected"
    | "edited"
    | "regenerated"
    | "prohibited_flagged"
    | "input_supplied";
  note: string;
  saveAsPermanentRule: boolean;
  createdAt: string;
}
