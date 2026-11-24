import { NextResponse } from "next/server";
import { getReadyRepository } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const repo = await getReadyRepository();
    const pkg = repo.getWeeklyPackageById(id);
    if (!pkg) {
      return NextResponse.json(
        { error: "Weekly package not found." },
        { status: 404 }
      );
    }

    const drafts = repo.listDrafts({ weeklyPackageId: pkg.id });
    return NextResponse.json({ package: pkg, drafts });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to read weekly package.",
      },
      { status: 500 }
    );
  }
}
