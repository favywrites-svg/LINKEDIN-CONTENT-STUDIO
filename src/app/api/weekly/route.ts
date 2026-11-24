import { NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_WEEKLY_POST_COUNT } from "@/lib/constants";
import {
  getReadyRepository,
  persistRepository,
} from "@/lib/db/repository";
import {
  buildWeekLabel,
  executeWeeklyGeneration,
} from "@/lib/workflows/weekly-generator";

export const dynamic = "force-dynamic";

const StartWeeklySchema = z.object({
  postCount: z.number().int().min(1).max(7).optional(),
  userInstruction: z.string().max(1000).optional(),
  retryPackageId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const repo = await getReadyRepository();
    const packages = repo.listWeeklyPackages(10);
    const latest = packages[0] ?? null;
    const latestDrafts = latest
      ? repo.listDrafts({ weeklyPackageId: latest.id })
      : [];

    return NextResponse.json({
      packages,
      latestPackage: latest,
      latestDrafts,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load weekly packages.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = StartWeeklySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters." },
        { status: 400 }
      );
    }

    const repo = await getReadyRepository();
    const postCount = parsed.data.postCount ?? DEFAULT_WEEKLY_POST_COUNT;
    const userInstruction =
      parsed.data.userInstruction?.trim() || "Give me content for the week.";

    // Prevent duplicate concurrent runs if one is already running
    const recent = repo.listWeeklyPackages(1)[0];
    if (recent && recent.status === "running" && !parsed.data.retryPackageId) {
      return NextResponse.json(
        {
          package: recent,
          alreadyRunning: true,
        },
        { status: 202 }
      );
    }

    const pkg = parsed.data.retryPackageId
      ? repo.getWeeklyPackageById(parsed.data.retryPackageId) ??
        repo.createWeeklyPackage({
          weekLabel: buildWeekLabel(),
          requestedPostCount: postCount,
          userInstruction,
        })
      : repo.createWeeklyPackage({
          weekLabel: buildWeekLabel(),
          requestedPostCount: postCount,
          userInstruction,
        });
    await persistRepository(repo);

    // Launch the 7-stage pipeline asynchronously on the server so client can poll real stage progress
    void executeWeeklyGeneration({
      postCount: pkg.requestedPostCount,
      userInstruction: pkg.userInstruction,
      existingPackageId: pkg.id,
      repo,
    })
      .then(() => persistRepository(repo))
      .catch(() => {
        // Stage failure is already persisted inside executeWeeklyGeneration
      });

    return NextResponse.json({ package: pkg }, { status: 202 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not start weekly content generation.",
      },
      { status: 500 }
    );
  }
}
