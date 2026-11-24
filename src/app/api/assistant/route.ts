import { NextResponse } from "next/server";
import { z } from "zod";
import { CONTENT_PILLARS, getPillarById } from "@/lib/constants";
import { getReadyRepository, persistRepository } from "@/lib/db/repository";
import { getActiveAIProvider } from "@/lib/ai/provider";
import { runLiveWeeklyResearch } from "@/lib/research/live-research";
import {
  computeContentIntelligence,
} from "@/lib/workflows/weekly-generator";
import { planWeekTopics } from "@/lib/workflows/strategist";
import { getEffectiveRuntimeStatus } from "@/lib/env-store";

export const dynamic = "force-dynamic";

const AssistantRequestSchema = z.object({
  message: z.string().min(1).max(1500),
  currentPathname: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string(),
      })
    )
    .max(12)
    .optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = AssistantRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter a message." },
        { status: 400 }
      );
    }

    const repo = await getReadyRepository();
    const text = parsed.data.message.trim();
    const lower = text.toLowerCase();

    // 1. Direct action: "Never use ... again"
    const banMatch =
      text.match(/never use ["“']?([^"”'\n.!?]+)["”']? again/i) ||
      text.match(/ban (?:the )?(?:word|phrase|expression) ["“']?([^"”'\n.!?]+)["”']?/i);
    if (banMatch?.[1]) {
      const phrase = banMatch[1].trim();
      repo.addMemoryItem({
        category: "prohibited_language",
        origin: "explicit",
        pattern: phrase,
        ruleExplanation: "Added via Colleague Assistant instruction.",
        confirmed: true,
      });
      await persistRepository(repo);
      return NextResponse.json({
        reply: `Done, Efe. I saved "${phrase}" to your Prohibited Language list in Editorial Memory. I will check against it automatically before presenting any future drafts.`,
        actionTriggered: "memory_saved",
        navigateTo: "/memory",
      });
    }

    // 2. Direct action: "Plan my week" / "Give me content for the week"
    if (
      /plan my week|give me content for the week|generate (?:this )?week'?s content|suggest .*topics/i.test(
        lower
      )
    ) {
      const runtime = getEffectiveRuntimeStatus();
      if (!runtime.aiConfigured) {
        return NextResponse.json({
          reply:
            "Add your AI model key in Settings (or .env) first, Efe, and I'll suggest 4 balanced topics for your week.",
          actionTriggered: "needs_key",
          navigateTo: "/settings",
        });
      }

      const { packageRecord, topics } = await planWeekTopics({
        focusNote: text,
        repo,
      });
      await persistRepository(repo);

      return NextResponse.json({
        reply: `Prepared 4 topic suggestions for ${packageRecord.weekLabel} (2 authority, 1 educational, and 1 reflection): ${topics.map((t) => `"${t.title}"`).join(", ")}. Open your Dashboard to generate a post from any of them!`,
        actionTriggered: "weekly_started",
        packageId: packageRecord.id,
        navigateTo: "/",
      });
    }

    // 3. Direct action: "Research ..."
    if (/^research\b|find research on|recent developments in/i.test(lower)) {
      const existingUrls = new Set(
        repo.listResearchSources(false).map((s) => s.url)
      );
      const { sources } = await runLiveWeeklyResearch({
        includeHealthcare: /health|pharma|clinic|medical|patient/i.test(lower),
        focusInstruction: text.replace(/^research\s+/i, ""),
        existingUrls,
      });
      for (const s of sources) {
        repo.upsertResearchSource(s);
      }
      await persistRepository(repo);
      return NextResponse.json({
        reply:
          sources.length > 0
            ? `I ran a live research pass and verified ${sources.length} primary source(s), including "${sources[0].title}". They're saved in your Research library ready for synthesis or drafting.`
            : "I queried the live primary research feeds, though no new matching records came back right now. You can also paste any specific URL in Research to verify it directly.",
        actionTriggered: "research_completed",
        navigateTo: "/research",
      });
    }

    // 4. Diagnostic questions: neglected pillars / why topic chosen / preferences
    const drafts = repo.listDrafts({ includeArchived: false });
    const intel = computeContentIntelligence(drafts);
    const memory = repo.listMemoryItems(true);

    if (/neglect|underrepresented|pillar|distribution|balance/i.test(lower)) {
      const breakdown = CONTENT_PILLARS.map(
        (p) =>
          `${p.shortName}: ${intel.pillarCounts[p.id]} / ${p.monthlyTarget} target`
      ).join("; ");
      const topGap = getPillarById(intel.underrepresentedPillars[0]).name;
      return NextResponse.json({
        reply: `Looking at your actual content history (${intel.totalHistoricalPosts} active/published post(s)): ${breakdown}. Right now, "${topGap}" has the biggest gap relative to your monthly target, so I'll prioritise it in your next weekly package.`,
        actionTriggered: "diagnostic",
      });
    }

    if (/why did you (?:choose|select|pick)|why are we publishing/i.test(lower)) {
      const latest = drafts[0];
      if (!latest) {
        return NextResponse.json({
          reply:
            "We haven't generated a draft yet! Once I generate your weekly package, I store the exact pillar and source rationale on every post so I can explain any choice.",
        });
      }
      return NextResponse.json({
        reply: `For "${latest.title}" (${getPillarById(latest.pillar).shortName}), I selected it because: ${latest.selectionRationale} It draws on ${latest.sources?.length ?? 0} verified source(s) and avoids your recent hook styles.`,
        actionTriggered: "rationale_explained",
      });
    }

    // 5. Contextual colleague conversation via Gemini if configured, else honest workspace summary
    const runtime = getEffectiveRuntimeStatus();
    if (!runtime.aiConfigured) {
      return NextResponse.json({
        reply: `Right now you have ${drafts.length} active draft(s), ${repo.listResearchSources(false).length} verified research source(s), and ${memory.length} active Editorial Memory rules. You can ask me about pillar balance, ban phrases ("Never use X again"), ask me to "Research [topic]", or add your free Gemini key in Settings for open-ended strategy & drafting!`,
      });
    }

    const ai = getActiveAIProvider();
    const ReplySchema = z.object({
      reply: z.string(),
    });

    const historyText = (parsed.data.history ?? [])
      .map((h) => `${h.role === "user" ? "Efe" : "Partner"}: ${h.text}`)
      .join("\n");

    const response = await ai.generateStructured({
      systemPrompt: `You are Efe's friendly, articulate, honest LinkedIn Content Partner colleague.
Current page: ${parsed.data.currentPathname || "/"}
Workspace facts (NEVER invent facts outside this):
- Active/published drafts: ${drafts.length}
- Recent draft titles & rationales: ${drafts.slice(0, 5).map((d) => `"${d.title}" [${d.pillar}]: ${d.selectionRationale}`).join(" | ") || "None yet"}
- Pillar counts: ${JSON.stringify(intel.pillarCounts)}
- Underrepresented pillars: ${intel.underrepresentedPillars.join(", ")}
- Active Editorial Memory rules: ${memory.length}
Keep your answer warm, clear, concise (2-5 sentences), and never use em dashes (—).`,
      userPrompt: `${historyText ? `Recent conversation:\n${historyText}\n\n` : ""}Efe says: "${text}"\nReturn JSON: { "reply": "..." }`,
      schema: ReplySchema,
      temperature: 0.5,
    });

    return NextResponse.json({
      reply: response.reply.replace(/\s*—\s*/g, ", "),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Assistant could not process that request.",
      },
      { status: 500 }
    );
  }
}
