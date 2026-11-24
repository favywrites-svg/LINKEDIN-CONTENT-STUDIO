import { NextResponse } from "next/server";
import { z } from "zod";
import { processUserIdeaInput } from "@/lib/workflows/strategist";

export const dynamic = "force-dynamic";

const FromInputSchema = z.object({
  rawInput: z.string().min(3).max(4000),
  mode: z.enum(["suggest_angle", "write_post"]),
  customAngle: z.string().max(1000).optional(),
  modelChoice: z.string().max(160).optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = FromInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please paste a quote, observation, question, or idea." },
        { status: 400 }
      );
    }

    const result = await processUserIdeaInput({
      rawInput: parsed.data.rawInput,
      mode: parsed.data.mode,
      customAngle: parsed.data.customAngle,
      modelChoice: parsed.data.modelChoice,
    });

    return NextResponse.json(result, {
      status: result.mode === "write_post" ? 201 : 200,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not process your input.",
      },
      { status: 500 }
    );
  }
}
