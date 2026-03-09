import { NextResponse } from "next/server";
import { runDueSchedules } from "@/lib/report-pipeline";

export async function POST(request: Request) {
  const now = new Date();
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  console.info("[scheduler] trigger received", {
    nowUtc: now.toISOString(),
    hasCronSecret: Boolean(expected),
    hasProvidedSecret: Boolean(provided)
  });

  if (expected && provided !== expected) {
    console.warn("[scheduler] unauthorized trigger", {
      nowUtc: now.toISOString()
    });
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDueSchedules();
    console.info("[scheduler] trigger processed", {
      nowUtc: now.toISOString(),
      ...result
    });
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[scheduler] trigger failed", {
      nowUtc: now.toISOString(),
      error: errorMessage
    });
    return NextResponse.json({ message: "Scheduler run failed", error: errorMessage }, { status: 500 });
  }
}
