import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getEffectiveRuntimeStatus,
  updateLocalServerEnv,
} from "@/lib/env-store";
import { testAIProviderConnection } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

const UpdateCredentialsSchema = z.object({
  action: z.enum(["save", "test"]),
  aiProvider: z.enum(["auto", "gemini", "openrouter"]).optional(),
  geminiApiKey: z.string().optional(),
  geminiModel: z.string().max(120).optional(),
  openRouterApiKey: z.string().optional(),
  openRouterModel: z.string().max(160).optional(),
  tavilyApiKey: z.string().optional(),
});

export async function GET() {
  return NextResponse.json({
    runtimeStatus: getEffectiveRuntimeStatus(),
  });
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = UpdateCredentialsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid configuration payload." },
        { status: 400 }
      );
    }

    if (parsed.data.action === "save") {
      const updates: Record<string, string | undefined> = {};
      if (parsed.data.aiProvider) {
        updates.AI_PROVIDER = parsed.data.aiProvider;
      }
      if (parsed.data.geminiApiKey?.trim()) {
        updates.GEMINI_API_KEY = parsed.data.geminiApiKey.trim();
      }
      if (parsed.data.geminiModel?.trim()) {
        updates.GEMINI_MODEL = parsed.data.geminiModel.trim();
      }
      if (parsed.data.openRouterApiKey?.trim()) {
        updates.OPENROUTER_API_KEY = parsed.data.openRouterApiKey.trim();
      }
      if (parsed.data.openRouterModel?.trim()) {
        updates.OPENROUTER_MODEL = parsed.data.openRouterModel.trim();
      }
      if (parsed.data.tavilyApiKey?.trim()) {
        updates.TAVILY_API_KEY = parsed.data.tavilyApiKey.trim();
        updates.RESEARCH_PROVIDER = "tavily";
      }

      updateLocalServerEnv(updates);
      return NextResponse.json({
        saved: true,
        runtimeStatus: getEffectiveRuntimeStatus(),
      });
    }

    const check = await testAIProviderConnection();
    return NextResponse.json({
      ...check,
      runtimeStatus: getEffectiveRuntimeStatus(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Provider check or save failed.",
      },
      { status: 500 }
    );
  }
}
