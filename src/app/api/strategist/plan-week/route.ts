import { NextResponse } from "next/server";
import { z } from "zod";
import { planWeekTopics } from "@/lib/workflows/strategist";

export const dynamic = "force-dynamic";

const PlanWeekRequestSchema = z.object({
  focusNote: z.string().max(600).optional(),
  modelChoice: z.string().max(160).optional(),
});

export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = PlanWeekRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { packageRecord, topics } = await planWeekTopics({
      focusNote: parsed.data.focusNote,
      modelChoice: parsed.data.modelChoice,
    });

    return NextResponse.json({
      package: packageRecord,
      topics,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not generate weekly topics.",
      },
      { status: 500 }
    );
  }
}
