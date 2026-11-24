import { NextResponse } from "next/server";
import { z } from "zod";
import { getReadyRepository, persistRepository } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

const UpdateProfileSchema = z.object({
  preferredName: z.string().min(1).max(80).optional(),
  positioning: z.string().min(10).max(2000).optional(),
  voiceSummary: z.string().min(10).max(2000).optional(),
  audiences: z.array(z.string().min(1).max(300)).optional(),
  confirmedBackground: z.array(z.string().min(1).max(500)).optional(),
  avoidTopicsOrPatterns: z.array(z.string().min(1).max(500)).optional(),
  confirmedProjects: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(200),
        status: z.enum(["concept", "prototype", "experiment", "production"]),
        summary: z.string().min(1).max(1000),
        confirmedLessons: z.string().max(1000),
      })
    )
    .optional(),
});

export async function GET() {
  const repo = await getReadyRepository();
  return NextResponse.json({
    profile: repo.getAuthorProfile(),
    providerSettings: repo.getProviderSettings(),
  });
}

export async function PATCH(request: Request) {
  try {
    const raw = await request.json();
    const parsed = UpdateProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid profile payload." },
        { status: 400 }
      );
    }

    const repo = await getReadyRepository();
    const updated = repo.updateAuthorProfile(parsed.data);
    await persistRepository(repo);
    return NextResponse.json({ profile: updated });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update profile.",
      },
      { status: 500 }
    );
  }
}
