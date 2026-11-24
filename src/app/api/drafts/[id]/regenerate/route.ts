import { NextResponse } from "next/server";
import { z } from "zod";
import { reviseDraftSimply } from "@/lib/workflows/strategist";

export const dynamic = "force-dynamic";

const RegenerateSchema = z.object({
  instruction: z.string().max(1000).optional(),
  suppliedAuthorInput: z.string().max(2000).optional(),
  saveFeedbackAsRule: z.boolean().optional(),
  previewOnly: z.boolean().optional(),
  modelChoice: z.string().max(160).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = RegenerateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid revision payload." },
        { status: 400 }
      );
    }

    const result = await reviseDraftSimply({
      draftId: id,
      instruction: parsed.data.instruction,
      suppliedAuthorInput: parsed.data.suppliedAuthorInput,
      saveFeedbackAsRule: parsed.data.saveFeedbackAsRule,
      previewOnly: parsed.data.previewOnly,
      modelChoice: parsed.data.modelChoice,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not revise draft.",
      },
      { status: 500 }
    );
  }
}
