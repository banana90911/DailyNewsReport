import { ScheduleType } from "@prisma/client";
import { DateTime } from "luxon";

export type ScheduleInput = {
  scheduleType: ScheduleType;
  timezone: string;
  dayOfWeek?: number | null;
  hour?: number | null;
  minute?: number | null;
  intervalHours?: number | null;
  morningHour?: number | null;
  eveningHour?: number | null;
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateTime(date: Date, timezone: string): DateTime {
  return DateTime.fromJSDate(date, { zone: timezone });
}

export function validateScheduleInput(input: ScheduleInput): void {
  if (!input.timezone) {
    throw new Error("timezone 값이 필요합니다.");
  }

  if (input.scheduleType === "DAILY") {
    if (input.hour == null || input.hour < 0 || input.hour > 23) {
      throw new Error("매일 주기는 0~23시를 지정해야 합니다.");
    }
  }

  if (input.scheduleType === "WEEKLY") {
    if (input.dayOfWeek == null || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      throw new Error("매주 주기는 요일(0~6)을 지정해야 합니다.");
    }
    if (input.hour == null || input.hour < 0 || input.hour > 23) {
      throw new Error("매주 주기는 0~23시를 지정해야 합니다.");
    }
  }

  if (input.scheduleType === "AMPM") {
    if (input.morningHour == null || input.morningHour < 0 || input.morningHour > 11) {
      throw new Error("오전 시간은 0~11시여야 합니다.");
    }
    if (input.eveningHour == null || input.eveningHour < 12 || input.eveningHour > 23) {
      throw new Error("오후 시간은 12~23시여야 합니다.");
    }
  }

  if (input.scheduleType === "HOURLY") {
    if (input.intervalHours == null || input.intervalHours < 1 || input.intervalHours > 24) {
      throw new Error("시간 주기 간격은 1~24시간이어야 합니다.");
    }
  }
}

export function buildScheduleText(input: ScheduleInput): string {
  const minute = input.minute ?? 0;

  if (input.scheduleType === "DAILY") {
    return `매일 ${formatHourMinute(input.hour ?? 8, minute)}`;
  }

  if (input.scheduleType === "WEEKLY") {
    const dayLabel = DAY_LABELS[input.dayOfWeek ?? 1] ?? "월";
    return `매주 ${dayLabel}요일 ${formatHourMinute(input.hour ?? 8, minute)}`;
  }

  if (input.scheduleType === "AMPM") {
    return `오전 ${formatHourMinute(input.morningHour ?? 8, minute)}, 오후 ${formatHourMinute(
      input.eveningHour ?? 20,
      minute
    )}`;
  }

  return `${input.intervalHours ?? 1}시간마다`;
}

export function computeNextRun(input: ScheduleInput, fromDate: Date = new Date()): Date {
  validateScheduleInput(input);

  const now = toDateTime(fromDate, input.timezone);
  const minute = input.minute ?? 0;

  if (input.scheduleType === "DAILY") {
    let candidate = now.set({ hour: input.hour ?? 8, minute, second: 0, millisecond: 0 });
    if (candidate <= now) {
      candidate = candidate.plus({ days: 1 });
    }
    return candidate.toJSDate();
  }

  if (input.scheduleType === "WEEKLY") {
    const targetWeekday = ((input.dayOfWeek ?? 1) + 6) % 7 + 1;
    let daysToAdd = targetWeekday - now.weekday;
    if (daysToAdd < 0) {
      daysToAdd += 7;
    }

    let candidate = now.plus({ days: daysToAdd }).set({
      hour: input.hour ?? 8,
      minute,
      second: 0,
      millisecond: 0
    });

    if (candidate <= now) {
      candidate = candidate.plus({ days: 7 });
    }

    return candidate.toJSDate();
  }

  if (input.scheduleType === "AMPM") {
    const candidates = [input.morningHour ?? 8, input.eveningHour ?? 20]
      .map((hour) => now.set({ hour, minute, second: 0, millisecond: 0 }))
      .filter((dt) => dt > now)
      .sort((a, b) => a.toMillis() - b.toMillis());

    if (candidates.length > 0) {
      return candidates[0].toJSDate();
    }

    const tomorrowMorning = now
      .plus({ days: 1 })
      .set({ hour: input.morningHour ?? 8, minute, second: 0, millisecond: 0 });

    return tomorrowMorning.toJSDate();
  }

  return now
    .plus({ hours: input.intervalHours ?? 1 })
    .startOf("minute")
    .set({ second: 0, millisecond: 0 })
    .toJSDate();
}

export function isScheduleDue(nextRunAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!nextRunAt) {
    return true;
  }
  return nextRunAt.getTime() <= now.getTime();
}

export function formatHourMinute(hour: number, minute: number): string {
  const normalizedHour = Math.max(0, Math.min(23, hour));
  const normalizedMinute = Math.max(0, Math.min(59, minute));

  const period = normalizedHour < 12 ? "오전" : "오후";
  const hour12 = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${period} ${hour12}시${normalizedMinute > 0 ? ` ${normalizedMinute}분` : ""}`;
}
