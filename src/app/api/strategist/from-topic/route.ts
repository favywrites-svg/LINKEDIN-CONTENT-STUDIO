import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePostFromTopic } from "@/lib/workflows/strategist";

export const dynamic = "force-dynamic";

const FromTopicSchema = z.object({
  ideaId: z.string().min(1),
  extraContext: z.string().max(1500).optional(),
  modelChoice: z.string().max(160).optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = FromTopicSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing topic ID." },
        { status: 400 }
      );
    }

    const draft = await generatePostFromTopic({
      ideaId: parsed.data.ideaId,
      extraContext: parsed.data.extraContext,
      modelChoice: parsed.data.modelChoice,
    });

    return NextResponse.json({ draft }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not generate post from topic.",
      },
      { status: 500 }
    );
  }
}
