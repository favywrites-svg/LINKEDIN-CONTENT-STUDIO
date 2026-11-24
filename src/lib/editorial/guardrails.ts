import type {
  ContentDraftRecord,
  EditorialMemoryItem,
  QualityReviewReport,
} from "@/lib/db/types";

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks text against all active, confirmed prohibited_language items in Editorial Memory,
 * including close hyphen/whitespace variations ("game-changer" vs "game changer")
 * and Unicode em dashes ("—").
 */
export function detectProhibitedLanguage(
  text: string,
  memoryItems: EditorialMemoryItem[]
): string[] {
  const violations: string[] = [];
  const activeProhibitions = memoryItems.filter(
    (item) =>
      item.active && item.confirmed && item.category === "prohibited_language"
  );

  for (const rule of activeProhibitions) {
    const pattern = rule.pattern.trim();
    if (!pattern) continue;

    if (/^[^\w]+$/.test(pattern)) {
      if (text.includes(pattern)) {
        violations.push(pattern);
      }
      continue;
    }

    const tokens = pattern.split(/[\s\-]+/).filter(Boolean);
    if (tokens.length === 0) continue;

    const joined = tokens.map(escapeRegExp).join("[\\s\\-]+");
    const regex = new RegExp(`\\b${joined}\\b`, "i");
    if (regex.test(text)) {
      violations.push(pattern);
    }
  }

  return Array.from(new Set(violations));
}

/**
 * Replaces accidental em dashes with clean punctuation so voice rules are respected.
 */
export function normalizeEmDashes(text: string): string {
  return text
    .replace(/\s*—\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\.\s*,/g, ".");
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "this",
  "from",
  "your",
  "have",
  "more",
  "when",
  "what",
  "into",
  "about",
  "they",
  "their",
  "most",
  "only",
  "just",
  "than",
  "some",
  "every",
  "where",
  "which",
  "while",
  "because",
]);

function significantTokens(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Computes Jaccard similarity against historical posts to detect repeated topics, hooks, or arguments.
 */
export function checkTopicSimilarity(
  candidateTitleAndBody: string,
  priorDrafts: ContentDraftRecord[],
  excludeDraftId?: string
): Array<{ draftId: string; title: string; score: number }> {
  const candidateSet = significantTokens(candidateTitleAndBody);
  if (candidateSet.size < 4) return [];

  const matches: Array<{ draftId: string; title: string; score: number }> = [];

  for (const prior of priorDrafts) {
    if (prior.id === excludeDraftId) continue;
    if (prior.status === "archived" || prior.status === "rejected") continue;

    const priorSet = significantTokens(`${prior.title} ${prior.body}`);
    if (priorSet.size === 0) continue;

    let intersection = 0;
    for (const tok of candidateSet) {
      if (priorSet.has(tok)) intersection += 1;
    }
    const union = candidateSet.size + priorSet.size - intersection;
    const score = union === 0 ? 0 : intersection / union;

    if (score >= 0.28) {
      matches.push({
        draftId: prior.id,
        title: prior.title,
        score: Number(score.toFixed(2)),
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 3);
}

const GENERIC_FILLER_PATTERNS = [
  /in today'?s fast[\s\-]paced/i,
  /ai is changing everything/i,
  /revolutioniz(?:e|ing)/i,
  /unlock the power of/i,
  /delve into/i,
  /let that sink in/i,
  /thoughts\?\s*$/i,
  /agree\?\s*$/i,
];

/**
 * Deterministic editorial & voice review that works offline without an AI key,
 * catching prohibited language, em dashes, unsupported statistics, generic hooks,
 * forced endings, and similarity with prior posts.
 */
export function runDeterministicQualityReview(params: {
  title: string;
  body: string;
  sourceCount: number;
  memoryItems: EditorialMemoryItem[];
  priorDrafts: ContentDraftRecord[];
  currentDraftId?: string;
}): QualityReviewReport {
  const combined = `${params.title}\n${params.body}`;
  const prohibitedFound = detectProhibitedLanguage(combined, params.memoryItems);
  const issues: string[] = [];
  const strengths: string[] = [];

  if (prohibitedFound.length > 0) {
    issues.push(
      `Contains prohibited language from Editorial Memory: ${prohibitedFound.join(", ")}`
    );
  } else {
    strengths.push("Zero prohibited words or em dashes detected.");
  }

  for (const rx of GENERIC_FILLER_PATTERNS) {
    const match = combined.match(rx);
    if (match) {
      issues.push(`Generic AI filler or predictable ending detected: "${match[0]}"`);
    }
  }

  // Flag unattributed percentages / statistics when 0 verified sources are linked
  const statMatches = params.body.match(/\b\d{1,3}(?:\.\d+)?%|\b\d+x\b/gi);
  const factualSupport: "strong" | "needs_review" =
    statMatches && statMatches.length > 0 && params.sourceCount === 0
      ? "needs_review"
      : "strong";

  if (factualSupport === "needs_review") {
    issues.push(
      `Found numeric claim(s) (${statMatches!.join(", ")}) with no verified source linked. Attach a checked source or soften the claim.`
    );
  } else if (params.sourceCount > 0) {
    strengths.push(`Backed by ${params.sourceCount} linked research source(s).`);
  }

  // Flag shallow news summary if very short or lacks problem framing
  const wordCount = params.body.trim().split(/\s+/).filter(Boolean).length;
  const practicalValue: "strong" | "needs_review" =
    wordCount < 45 ? "needs_review" : "strong";
  if (wordCount < 45) {
    issues.push(
      "Draft is very brief; expand the operational problem, trade-offs, or practical takeaway."
    );
  } else {
    strengths.push("Substantive length with clear paragraph pacing.");
  }

  const hashtags = params.body.match(/#[a-z0-9_]+/gi) ?? [];
  if (hashtags.length > 4) {
    issues.push(
      `Contains ${hashtags.length} hashtags; keep hashtags minimal or omit them per Brand Voice.`
    );
  }

  const overlaps = checkTopicSimilarity(
    combined,
    params.priorDrafts,
    params.currentDraftId
  );
  const similarityWarnings = overlaps.map(
    (o) => `High overlap (${Math.round(o.score * 100)}%) with prior post "${o.title}"`
  );
  if (similarityWarnings.length > 0) {
    issues.push(...similarityWarnings);
  } else {
    strengths.push("Distinct from your previous posts.");
  }

  const voiceAlignment: "strong" | "needs_review" =
    prohibitedFound.length === 0 &&
    !GENERIC_FILLER_PATTERNS.some((rx) => rx.test(combined))
      ? "strong"
      : "needs_review";

  const originality: "strong" | "needs_review" =
    overlaps.length === 0 ? "strong" : "needs_review";

  const overallPassed =
    factualSupport === "strong" &&
    voiceAlignment === "strong" &&
    originality === "strong" &&
    practicalValue === "strong";

  return {
    overallPassed,
    overallNote: overallPassed
      ? "Passes editorial voice, sourcing, and originality checks. Ready for your review and approval."
      : `Review ${issues.length} flagged item(s) before approving.`,
    factualSupport,
    voiceAlignment,
    originality,
    practicalValue,
    prohibitedLanguageFound: prohibitedFound,
    similarityWarnings,
    issues,
    strengths,
  };
}
