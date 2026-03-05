import { NextResponse } from "next/server";
import { runDueSchedules } from "@/lib/report-pipeline";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (expected && provided !== expected) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const result = await runDueSchedules();
  return NextResponse.json(result);
}
