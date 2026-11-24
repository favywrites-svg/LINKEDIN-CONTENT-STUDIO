import type { ResearchSourceRecord } from "@/lib/db/types";
import { getEffectiveEnv } from "@/lib/env-store";

export type CandidateSource = {
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
};

function stripTagsAndCollapse(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = 12000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent":
          "LinkedInContentAssistant/1.0 (Private Research Workspace)",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches real, recent peer-reviewed / preprint research from arXiv's public Atom API.
 */
async function fetchArxivSources(
  query: string,
  maxResults = 3
): Promise<CandidateSource[]> {
  const encoded = encodeURIComponent(query);
  const apiUrl = `https://export.arxiv.org/api/query?search_query=all:${encoded}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`;

  const res = await fetchWithTimeout(apiUrl);
  if (!res.ok) return [];

  const xml = await res.text();
  const entries = xml.split("<entry>").slice(1);
  const accessedAt = new Date().toISOString();
  const results: CandidateSource[] = [];

  for (const entry of entries) {
    const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
    const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);

    if (!idMatch || !titleMatch || !summaryMatch) continue;

    const url = stripTagsAndCollapse(idMatch[1]).replace(/^http:/, "https:");
    const title = stripTagsAndCollapse(titleMatch[1]);
    const abstractText = stripTagsAndCollapse(summaryMatch[1]);
    const pubDate = publishedMatch
      ? stripTagsAndCollapse(publishedMatch[1]).slice(0, 10)
      : null;

    results.push({
      title,
      publisher: "arXiv (Original Research / Preprint)",
      url,
      sourceType: "research",
      publicationDate: pubDate,
      accessedAt,
      summary: abstractText.slice(0, 650),
      keyFindings: abstractText.slice(0, 900),
      limitations:
        "Preprint / academic study; findings reflect research conditions and require practical workflow validation before operational claims.",
      verificationStatus: "checked",
    });
  }

  return results;
}

/**
 * Fetches real biomedical, digital health, and pharmaceutical technology research from PubMed E-utilities.
 */
async function fetchPubMedSources(
  query: string,
  maxResults = 2
): Promise<CandidateSource[]> {
  const encoded = encodeURIComponent(query);
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=pub+date&retmax=${maxResults}&term=${encoded}`;

  const searchRes = await fetchWithTimeout(searchUrl);
  if (!searchRes.ok) return [];
  const searchJson = (await searchRes.json()) as {
    esearchresult?: { idlist?: string[] };
  };
  const ids = searchJson.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  const idParam = ids.join(",");
  const [summaryRes, abstractRes] = await Promise.all([
    fetchWithTimeout(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${idParam}`
    ),
    fetchWithTimeout(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${idParam}`
    ),
  ]);

  if (!summaryRes.ok) return [];
  const summaryJson = (await summaryRes.json()) as {
    result?: Record<
      string,
      { title?: string; fulljournalname?: string; source?: string; pubdate?: string }
    >;
  };
  const xmlText = abstractRes.ok ? await abstractRes.text() : "";
  const accessedAt = new Date().toISOString();
  const results: CandidateSource[] = [];

  for (const pmid of ids) {
    const meta = summaryJson.result?.[pmid];
    if (!meta?.title) continue;

    // Extract matching PubmedArticle abstract if available
    let abstractExcerpt = "";
    const articleRegex = new RegExp(
      `<PMID[^>]*>${pmid}</PMID>[\\s\\S]*?<Abstract>([\\s\\S]*?)</Abstract>`,
      "i"
    );
    const match = xmlText.match(articleRegex);
    if (match?.[1]) {
      abstractExcerpt = stripTagsAndCollapse(match[1]);
    }

    const journal = meta.fulljournalname || meta.source || "PubMed Indexed Journal";
    results.push({
      title: stripTagsAndCollapse(meta.title),
      publisher: `${journal} (via PubMed)`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      sourceType: "research",
      publicationDate: meta.pubdate ?? null,
      accessedAt,
      summary:
        abstractExcerpt.slice(0, 650) ||
        `Indexed biomedical / digital health research article published in ${journal}.`,
      keyFindings:
        abstractExcerpt.slice(0, 900) ||
        `Primary journal record (${journal}, ${meta.pubdate ?? "recent"}).`,
      limitations:
        abstractExcerpt.length > 0
          ? "Clinical and health-tech findings depend on setting, regulatory context, and workflow integration."
          : "Abstract text was limited in feed metadata; restrict claims to verified scope.",
      verificationStatus: "checked",
    });
  }

  return results;
}

/**
 * Optional Tavily web research adapter when TAVILY_API_KEY is configured.
 */
async function fetchTavilySources(
  query: string,
  apiKey: string,
  maxResults = 3
): Promise<CandidateSource[]> {
  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: maxResults,
      include_answer: false,
    }),
  });

  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
    }>;
  };

  const accessedAt = new Date().toISOString();
  const sources: CandidateSource[] = [];

  for (const item of data.results ?? []) {
    if (!item.url || !item.title || !item.content) continue;
    let hostname = "Web Publication";
    try {
      hostname = new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      // keep fallback
    }
    sources.push({
      title: item.title.trim(),
      publisher: hostname,
      url: item.url,
      sourceType: "reporting",
      publicationDate: item.published_date ?? null,
      accessedAt,
      summary: stripTagsAndCollapse(item.content).slice(0, 600),
      keyFindings: stripTagsAndCollapse(item.content).slice(0, 900),
      limitations:
        "Retrieved via web search extract; distinguish reported claims from primary benchmarks.",
      verificationStatus: "checked",
    });
  }

  return sources;
}

/**
 * Inspects a manual URL directly over HTTP so manual research capture is genuinely verified.
 */
export async function inspectUrlSource(url: string): Promise<CandidateSource> {
  const accessedAt = new Date().toISOString();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Please enter a valid http:// or https:// URL.");
  }

  const hostname = parsedUrl.hostname.replace(/^www\./, "");

  try {
    const res = await fetchWithTimeout(parsedUrl.toString(), undefined, 10000);
    if (!res.ok) {
      return {
        title: parsedUrl.toString(),
        publisher: hostname,
        url: parsedUrl.toString(),
        sourceType: "other",
        publicationDate: null,
        accessedAt,
        summary: `Source returned HTTP ${res.status} when accessed.`,
        keyFindings: "",
        limitations: `Page could not be verified automatically (HTTP ${res.status}).`,
        verificationStatus: "inaccessible",
      };
    }

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch =
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
      );
    const dateMatch = html.match(
      /<meta[^>]+(?:property|name)=["'](?:article:published_time|pubdate|date)["'][^>]+content=["']([^"']+)["']/i
    );

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyExcerpt = stripTagsAndCollapse(bodyMatch?.[1] ?? html).slice(
      0,
      900
    );

    const title = titleMatch
      ? stripTagsAndCollapse(titleMatch[1])
      : parsedUrl.toString();
    const summary = descMatch
      ? stripTagsAndCollapse(descMatch[1])
      : bodyExcerpt.slice(0, 450);

    return {
      title: title || parsedUrl.toString(),
      publisher: hostname,
      url: parsedUrl.toString(),
      sourceType: "primary",
      publicationDate: dateMatch?.[1] ? dateMatch[1].slice(0, 10) : null,
      accessedAt,
      summary: summary || "Source fetched directly.",
      keyFindings: bodyExcerpt || summary,
      limitations:
        "Review extracted webpage context carefully to preserve original scope and caveats.",
      verificationStatus: "checked",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return {
      title: parsedUrl.toString(),
      publisher: hostname,
      url: parsedUrl.toString(),
      sourceType: "other",
      publicationDate: null,
      accessedAt,
      summary: `Could not reach URL automatically (${message}).`,
      keyFindings: "",
      limitations: "Source could not be accessed automatically; verify manually.",
      verificationStatus: "inaccessible",
    };
  }
}

/**
 * Conducts live multi-source research tailored to the week's topics and healthcare balance.
 * Never fabricates sources.
 */
export async function runLiveWeeklyResearch(options: {
  includeHealthcare: boolean;
  focusInstruction?: string;
  existingUrls: Set<string>;
}): Promise<{
  sources: CandidateSource[];
  warnings: string[];
}> {
  const env = getEffectiveEnv();
  const tavilyKey = env.TAVILY_API_KEY?.trim();
  const warnings: string[] = [];

  const customHint = options.focusInstruction?.trim()
    ? ` ${options.focusInstruction.trim().slice(0, 80)}`
    : "";

  const tasks: Array<Promise<CandidateSource[]>> = [
    fetchArxivSources(
      `enterprise AI workflow automation implementation business process${customHint}`,
      3
    ).catch((e) => {
      warnings.push(
        `arXiv business/AI query failed: ${e instanceof Error ? e.message : "network error"}`
      );
      return [];
    }),
    fetchArxivSources(
      `large language model evaluation reliability human in the loop`,
      2
    ).catch(() => []),
  ];

  if (options.includeHealthcare) {
    tasks.push(
      fetchPubMedSources(
        `("artificial intelligence"[Title/Abstract] AND ("clinical workflow"[Title/Abstract] OR "pharmacy"[Title/Abstract] OR "digital health"[Title/Abstract]))`,
        3
      ).catch((e) => {
        warnings.push(
          `PubMed digital health query failed: ${e instanceof Error ? e.message : "network error"}`
        );
        return [];
      })
    );
  }

  if (tavilyKey) {
    tasks.push(
      fetchTavilySources(
        `practical enterprise AI implementation lessons business operations${customHint}`,
        tavilyKey,
        3
      ).catch((e) => {
        warnings.push(
          `Tavily search failed: ${e instanceof Error ? e.message : "network error"}`
        );
        return [];
      })
    );
  }

  const batches = await Promise.all(tasks);
  const flat = batches.flat();

  // Deduplicate by URL, preferring fresh unseen URLs first
  const seen = new Set<string>();
  const fresh: CandidateSource[] = [];
  const previouslySeen: CandidateSource[] = [];

  for (const item of flat) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    if (options.existingUrls.has(item.url)) {
      previouslySeen.push(item);
    } else {
      fresh.push(item);
    }
  }

  const combined = [...fresh, ...previouslySeen].slice(0, 8);
  return { sources: combined, warnings };
}
