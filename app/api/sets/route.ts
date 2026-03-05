import { ScheduleType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSetSummary, NO_SUB_TOPIC, normalizeCategoryValue } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";
import { buildScheduleText, computeNextRun, validateScheduleInput } from "@/lib/schedule";

const createSetSchema = z.object({
  mainCategory: z.string().min(1),
  mainCustom: z.string().optional(),
  subCategory: z.string().optional(),
  subCustom: z.string().optional(),
  scheduleType: z.enum(["DAILY", "WEEKLY"]),
  timezone: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  hour: z.number().int().min(0).max(23).nullable().optional(),
  minute: z.number().int().min(0).max(59).nullable().optional(),
  sendToDiscord: z.boolean().default(false),
  aiPerspective: z.boolean().default(false)
});

export async function GET() {
  const { session, errorResponse } = await requireApiSession();
  if (errorResponse || !session) {
    return errorResponse;
  }

  const sets = await prisma.categoryScheduleSet.findMany({
    where: {
      userId: session.user.id
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return NextResponse.json({ sets });
}

export async function POST(request: Request) {
  const { session, errorResponse } = await requireApiSession();
  if (errorResponse || !session) {
    return errorResponse;
  }

  const body = await request.json();
  const parsed = createSetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "입력값이 올바르지 않습니다.",
        issues: parsed.error.issues
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const mainCategory = normalizeCategoryValue(input.mainCategory, input.mainCustom);
  const subCategoryDisabled = input.mainCategory === "전체" || input.mainCategory === "직접 입력";
  const subCategory = subCategoryDisabled
    ? NO_SUB_TOPIC
    : normalizeCategoryValue(input.subCategory || "전체", input.subCustom);

  const scheduleInput = {
    scheduleType: input.scheduleType as ScheduleType,
    timezone: input.timezone,
    dayOfWeek: input.dayOfWeek ?? null,
    hour: input.hour ?? null,
    minute: input.minute ?? 0,
    intervalHours: null,
    morningHour: null,
    eveningHour: null
  };

  try {
    validateScheduleInput(scheduleInput);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "주기 입력값 오류"
      },
      { status: 400 }
    );
  }

  const scheduleText = buildScheduleText(scheduleInput);
  const summary = buildSetSummary({
    mainCategory,
    subCategory,
    scheduleText,
    discordEnabled: input.sendToDiscord,
    aiPerspective: input.aiPerspective
  });

  const created = await prisma.categoryScheduleSet.create({
    data: {
      userId: session.user.id,
      mainCategory,
      mainCustom: input.mainCategory === "직접 입력" ? input.mainCustom?.trim() || null : null,
      subCategory,
      subCustom: !subCategoryDisabled && input.subCategory === "직접 입력" ? input.subCustom?.trim() || null : null,
      scheduleType: scheduleInput.scheduleType,
      timezone: scheduleInput.timezone,
      dayOfWeek: scheduleInput.dayOfWeek,
      hour: scheduleInput.hour,
      minute: scheduleInput.minute ?? 0,
      intervalHours: null,
      morningHour: null,
      eveningHour: null,
      sendToDiscord: input.sendToDiscord,
      aiPerspective: input.aiPerspective,
      summary,
      nextRunAt: computeNextRun(scheduleInput)
    }
  });

  return NextResponse.json({ set: created }, { status: 201 });
}
