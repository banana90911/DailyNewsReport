"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  buildCategoryHelpText,
  getSubCategoryOptions,
  MAIN_CATEGORIES,
  NO_SUB_TOPIC,
  toTopicLabel
} from "@/lib/categories";

type ScheduleSetItem = {
  id: string;
  mainCategory: string;
  subCategory: string;
  scheduleType: "DAILY" | "WEEKLY" | "WEEKDAY" | "WEEKEND" | "CUSTOM" | "AMPM" | "HOURLY";
  sendToDiscord: boolean;
  aiPerspective: boolean;
  summary: string;
  nextRunAt: string | null;
  createdAt: string;
};

type ReportItem = {
  id: string;
  title: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  createdAt: string;
  errorMessage: string | null;
};

type Props = {
  userName: string;
  userEmail: string;
  googleLinked: boolean;
  discordLinked: boolean;
  discordAccountId: string | null;
  discordStatus: string;
  discordRetryAfterSeconds: number | null;
  discordRateLimitScope: string | null;
  discordRateLimitGlobal: boolean | null;
  discordRateLimitBucket: string | null;
  discordCallbackUri: string;
  discordOAuthEnabled: boolean;
  discordInviteUrl: string;
  sets: ScheduleSetItem[];
  reports: ReportItem[];
};

type ScheduleType = "DAILY" | "WEEKLY" | "WEEKDAY" | "WEEKEND" | "CUSTOM";
type Meridiem = "AM" | "PM";

const WEEKDAY_OPTIONS = [
  { label: "일요일", value: 0 },
  { label: "월요일", value: 1 },
  { label: "화요일", value: 2 },
  { label: "수요일", value: 3 },
  { label: "목요일", value: 4 },
  { label: "금요일", value: 5 },
  { label: "토요일", value: 6 }
];

const DIRECT_DAY_OPTIONS = [
  { label: "월", value: 1 },
  { label: "화", value: 2 },
  { label: "수", value: 3 },
  { label: "목", value: 4 },
  { label: "금", value: 5 },
  { label: "토", value: 6 },
  { label: "일", value: 0 }
];

const SUB_TOPIC_PLACEHOLDER_MAP: Record<string, string> = {
  "경제": "기름값 인상",
  AI: "생성형 AI 기반 상담 지원",
  "정치": "총선 판세 변화",
  "사회": "전세사기 대응책",
  "IT/과학": "제로데이 보안 취약점"
};

function toHumanDate(value: string | null): string {
  if (!value) {
    return "미정";
  }

  const dt = new Date(value);
  return dt.toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function normalizeSetSummaryDisplay(summary: string): string {
  return summary.replace(/\s*직접 선택\s*\(/, " (");
}

function to24Hour(hour12: number, meridiem: Meridiem): number {
  const normalized = Math.min(12, Math.max(1, hour12));
  if (meridiem === "AM") {
    return normalized === 12 ? 0 : normalized;
  }
  return normalized === 12 ? 12 : normalized + 12;
}

function toDiscordStatusMessage(params: {
  status: string;
  retryAfterSeconds: number | null;
  rateLimitScope: string | null;
  rateLimitGlobal: boolean | null;
}): string {
  const map: Record<string, string> = {
    connected: "Discord 계정 연결이 완료되었습니다.",
    denied: "Discord 권한 승인이 취소되었습니다.",
    connect_cooldown: "Discord 재시도 대기 시간입니다. 잠시 후 다시 시도해 주세요.",
    invalid_state: "Discord 연결 검증에 실패했습니다. 다시 시도해 주세요.",
    token_error: "Discord 토큰 발급에 실패했습니다.",
    token_error_400: "Discord 토큰 발급에 실패했습니다. Redirect URI 또는 Client ID/Secret을 확인해 주세요. (400)",
    token_error_401: "Discord 토큰 발급에 실패했습니다. Client Secret이 올바른지 확인해 주세요. (401)",
    token_error_403: "Discord 토큰 발급이 거부되었습니다. Discord 앱 권한 설정을 확인해 주세요. (403)",
    token_error_429: "Discord 요청이 너무 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요. (429)",
    token_error_payload: "Discord 토큰 응답 형식이 올바르지 않습니다. 앱 설정을 다시 확인해 주세요.",
    profile_error: "Discord 프로필 조회에 실패했습니다.",
    already_linked: "이 Discord 계정은 다른 사용자에 이미 연결되어 있습니다.",
    oauth_config_missing: "Discord OAuth 설정이 누락되어 연결할 수 없습니다.",
    missing_code: "Discord 인증 코드가 전달되지 않았습니다."
  };

  const base = map[params.status] || "";

  if ((params.status !== "token_error_429" && params.status !== "connect_cooldown") || !base) {
    return base;
  }

  const details: string[] = [];

  if (params.retryAfterSeconds != null && Number.isFinite(params.retryAfterSeconds)) {
    details.push(`약 ${Math.ceil(params.retryAfterSeconds)}초 후 재시도`);
  }

  if (params.rateLimitScope) {
    details.push(`scope=${params.rateLimitScope}`);
  }

  if (typeof params.rateLimitGlobal === "boolean") {
    details.push(`global=${params.rateLimitGlobal ? "true" : "false"}`);
  }

  if (details.length === 0) {
    return base;
  }

  return `${base} (${details.join(", ")})`;
}

function toDiscordRateLimitDebugText(params: {
  status: string;
  retryAfterSeconds: number | null;
  rateLimitScope: string | null;
  rateLimitGlobal: boolean | null;
  rateLimitBucket: string | null;
}): string {
  if (params.status !== "token_error_429" && params.status !== "connect_cooldown") {
    return "";
  }

  const parts: string[] = [];

  if (params.retryAfterSeconds != null && Number.isFinite(params.retryAfterSeconds)) {
    parts.push(`Retry-After=${Math.ceil(params.retryAfterSeconds)}s`);
  }

  if (params.rateLimitScope) {
    parts.push(`X-RateLimit-Scope=${params.rateLimitScope}`);
  }

  if (typeof params.rateLimitGlobal === "boolean") {
    parts.push(`X-RateLimit-Global=${params.rateLimitGlobal ? "true" : "false"}`);
  }

  if (params.rateLimitBucket) {
    parts.push(`X-RateLimit-Bucket=${params.rateLimitBucket}`);
  }

  return parts.length > 0 ? `Discord 제한 진단: ${parts.join(" | ")}` : "";
}

function sortDirectDays(days: number[]): number[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return Array.from(new Set(days)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function getSubTopicPlaceholder(mainCategory: string): string {
  return `예: ${SUB_TOPIC_PLACEHOLDER_MAP[mainCategory] || "핵심 이슈 분석"}`;
}

export function DashboardClient(props: Props) {
  const [sets, setSets] = useState(props.sets);
  const [reports, setReports] = useState(props.reports);
  const [saving, setSaving] = useState(false);
  const [runningSetId, setRunningSetId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("");

  const [mainCategory, setMainCategory] = useState<(typeof MAIN_CATEGORIES)[number]>("경제");
  const [mainCustom, setMainCustom] = useState("");
  const [subCategory, setSubCategory] = useState("Hot");
  const [subCustom, setSubCustom] = useState("");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("DAILY");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [directDays, setDirectDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [meridiem, setMeridiem] = useState<Meridiem>("AM");
  const [hour12, setHour12] = useState(8);
  const [sendToDiscord, setSendToDiscord] = useState(false);
  const [aiPerspective, setAiPerspective] = useState(false);
  const hasReachedSetLimit = sets.length >= 3;

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul", []);

  const isSubTopicDisabled = mainCategory === "전체" || mainCategory === "직접 입력";
  const subOptions = isSubTopicDisabled ? [] : getSubCategoryOptions(mainCategory);
  const effectiveMain = mainCategory === "직접 입력" ? mainCustom || "직접 입력" : mainCategory;
  const effectiveSub = isSubTopicDisabled
    ? NO_SUB_TOPIC
    : subCategory === "직접 입력"
      ? subCustom || "직접 입력"
      : subCategory;
  const helpText = buildCategoryHelpText(effectiveMain, effectiveSub);
  const discordStatusMessage = toDiscordStatusMessage({
    status: props.discordStatus,
    retryAfterSeconds: props.discordRetryAfterSeconds,
    rateLimitScope: props.discordRateLimitScope,
    rateLimitGlobal: props.discordRateLimitGlobal
  });
  const discordRateLimitDebugText = toDiscordRateLimitDebugText({
    status: props.discordStatus,
    retryAfterSeconds: props.discordRetryAfterSeconds,
    rateLimitScope: props.discordRateLimitScope,
    rateLimitGlobal: props.discordRateLimitGlobal,
    rateLimitBucket: props.discordRateLimitBucket
  });
  const discordConnectBlocked =
    props.discordStatus === "token_error_429" || props.discordStatus === "connect_cooldown";
  const subTopicPlaceholder = getSubTopicPlaceholder(mainCategory);

  const refreshReports = useCallback(async () => {
    const response = await fetch("/api/reports", {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { reports?: ReportItem[] };
    if (!Array.isArray(payload.reports)) {
      return;
    }

    setReports(payload.reports);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshReports();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshReports]);

  async function handleCreateSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");

    if (hasReachedSetLimit) {
      setErrorText("출근길 일정은 최대 3개까지 생성할 수 있습니다.");
      return;
    }

    if (scheduleType === "CUSTOM" && directDays.length === 0) {
      setErrorText("직접 선택에서는 최소 1개 이상의 요일을 선택해 주세요.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        mainCategory,
        mainCustom,
        subCategory: isSubTopicDisabled ? NO_SUB_TOPIC : subCategory,
        subCustom: isSubTopicDisabled ? "" : subCustom,
        scheduleType,
        timezone,
        dayOfWeek: scheduleType === "WEEKLY" ? dayOfWeek : null,
        customDays: scheduleType === "CUSTOM" ? sortDirectDays(directDays) : [],
        hour: to24Hour(hour12, meridiem),
        minute: 0,
        sendToDiscord: props.discordLinked ? sendToDiscord : false,
        aiPerspective
      };

      const response = await fetch("/api/sets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "출근길 예약 저장에 실패했습니다.");
      }

      const created = data.set as ScheduleSetItem;
      setSets((prev) => [
        {
          ...created,
          nextRunAt: created.nextRunAt,
          createdAt: created.createdAt
        },
        ...prev
      ]);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "출근길 예약 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSet(setId: string) {
    if (!window.confirm("이 출근길 예약을 제거할까요? 수정은 불가하며 다시 생성해야 합니다.")) {
      return;
    }

    const response = await fetch(`/api/sets/${setId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = await response.json();
      setErrorText(payload.message || "출근길 예약 제거에 실패했습니다.");
      return;
    }

    setSets((prev) => prev.filter((item) => item.id !== setId));
  }

  async function handleRunNow(setId: string) {
    setErrorText("");
    setRunningSetId(setId);

    try {
      const response = await fetch(`/api/sets/${setId}/run`, {
        method: "POST"
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "지금 생성에 실패했습니다.");
      }
      setTimeout(() => {
        void refreshReports();
      }, 800);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "실행 실패");
    } finally {
      setRunningSetId(null);
    }
  }

  async function handleDeleteReport(reportId: string) {
    if (!window.confirm("이 리포트를 제거할까요?")) {
      return;
    }

    const response = await fetch(`/api/reports/${reportId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = await response.json();
      setErrorText(payload.message || "리포트 제거에 실패했습니다.");
      return;
    }

    setReports((prev) => prev.filter((item) => item.id !== reportId));
  }

  function handleToggleDirectDay(day: number) {
    setDirectDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((item) => item !== day);
      }
      return sortDirectDays([...prev, day]);
    });
  }

  return (
    <main className="main-shell">
      <section className="hero">
        <h1>출근길</h1>
        <p>
          {props.userName || "사용자"} 님의 출근길은 무엇으로 채우고 싶으신가요? 주제와 일정을 선택해주세요.
          <br />
          간단한 리포트를 생성하여 읽거나 라디오처럼 들을수도 있어요.
          <br />※ 듣기 전용의 별도의 스크립트가 생성됩니다.
        </p>
        <p className="item-meta">{props.userEmail}</p>
        <div className={`status-badge ${props.discordLinked ? "on" : "off"}`}>
          {props.discordLinked ? "Discord 연결됨 ✅" : "Discord 미연결"}
        </div>
        {props.discordLinked && props.discordAccountId ? (
          <p className="item-meta">Discord ID: {props.discordAccountId}</p>
        ) : null}
        {discordStatusMessage ? <p className="notice">{discordStatusMessage}</p> : null}
        {discordRateLimitDebugText ? <p className="item-meta">{discordRateLimitDebugText}</p> : null}
        <div className="actions">
          <button className="btn secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
            로그아웃
          </button>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>새 출근길 예약</h2>
          <form className="form-grid" onSubmit={handleCreateSet}>
            <div className="form-row">
              <label>주제</label>
              <select
                value={mainCategory}
                onChange={(event) => {
                  const nextMain = event.target.value as (typeof MAIN_CATEGORIES)[number];
                  setMainCategory(nextMain);

                  if (nextMain === "전체" || nextMain === "직접 입력") {
                    setSubCategory(NO_SUB_TOPIC);
                    setSubCustom("");
                    return;
                  }

                  const defaults = getSubCategoryOptions(nextMain);
                  setSubCategory(defaults[0] || "전체");
                }}
              >
                {MAIN_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {toTopicLabel(category)}
                  </option>
                ))}
              </select>
            </div>

            {mainCategory === "직접 입력" ? (
              <div className="form-row">
                <label>주제 직접 입력</label>
                <input
                  value={mainCustom}
                  onChange={(event) => setMainCustom(event.target.value)}
                  placeholder="예: 비트코인 떡락 이유"
                />
              </div>
            ) : null}

            {!isSubTopicDisabled ? (
              <div className="form-row">
                <label>소주제</label>
                <select value={subCategory} onChange={(event) => setSubCategory(event.target.value)}>
                  {subOptions.map((item) => (
                    <option key={item} value={item}>
                      {toTopicLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {!isSubTopicDisabled && subCategory === "직접 입력" ? (
              <div className="form-row">
                <label>소주제 직접 입력</label>
                <input value={subCustom} onChange={(event) => setSubCustom(event.target.value)} placeholder={subTopicPlaceholder} />
              </div>
            ) : null}

            <div className="form-row full">
              <p className="help-text">{helpText}</p>
            </div>

            <div className="form-row full">
              <label>AI 관점</label>
              <label className="toggle-wrap">
                <input
                  type="checkbox"
                  checked={aiPerspective}
                  onChange={(event) => setAiPerspective(event.target.checked)}
                />
                <span>{aiPerspective ? "ON" : "OFF"}</span>
              </label>
              {aiPerspective ? (
                <>
                  <p className="item-meta">선택한 주제를 AI의 상상/사고실험 관점으로 해석한 리포트를 생성합니다.</p>
                  <p className="item-meta">AI는 이 주제를 어떻게 바라볼까요?</p>
                </>
              ) : null}
            </div>

            <div className="form-row full">
              <label>일정</label>
              <div className="segmented" role="group" aria-label="일정 선택">
                <button
                  className={`seg-btn ${scheduleType === "DAILY" ? "active" : ""}`}
                  onClick={() => setScheduleType("DAILY")}
                  type="button"
                >
                  매일
                </button>
                <button
                  className={`seg-btn ${scheduleType === "WEEKLY" ? "active" : ""}`}
                  onClick={() => setScheduleType("WEEKLY")}
                  type="button"
                >
                  매주
                </button>
                <button
                  className={`seg-btn ${scheduleType === "WEEKDAY" ? "active" : ""}`}
                  onClick={() => setScheduleType("WEEKDAY")}
                  type="button"
                >
                  주중
                </button>
                <button
                  className={`seg-btn ${scheduleType === "WEEKEND" ? "active" : ""}`}
                  onClick={() => setScheduleType("WEEKEND")}
                  type="button"
                >
                  주말
                </button>
                <button
                  className={`seg-btn ${scheduleType === "CUSTOM" ? "active" : ""}`}
                  onClick={() => setScheduleType("CUSTOM")}
                  type="button"
                >
                  직접 선택
                </button>
              </div>
            </div>

            {scheduleType === "WEEKLY" ? (
              <div className="form-row full">
                <label>요일</label>
                <select value={dayOfWeek} onChange={(event) => setDayOfWeek(Number(event.target.value))}>
                  {WEEKDAY_OPTIONS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {scheduleType === "CUSTOM" ? (
              <div className="form-row full">
                <label>직접 선택</label>
                <div className="weekday-segment" role="group" aria-label="직접 선택 요일">
                  {DIRECT_DAY_OPTIONS.map((day) => (
                    <button
                      key={day.value}
                      className={`weekday-btn ${directDays.includes(day.value) ? "active" : ""}`}
                      onClick={() => handleToggleDirectDay(day.value)}
                      type="button"
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="form-row">
              <label>오전/오후</label>
              <div className="segmented" role="group" aria-label="오전오후 선택">
                <button
                  className={`seg-btn ${meridiem === "AM" ? "active" : ""}`}
                  onClick={() => setMeridiem("AM")}
                  type="button"
                >
                  오전
                </button>
                <button
                  className={`seg-btn ${meridiem === "PM" ? "active" : ""}`}
                  onClick={() => setMeridiem("PM")}
                  type="button"
                >
                  오후
                </button>
              </div>
            </div>

            <div className="form-row">
              <label>시간 (1~12)</label>
              <input
                type="number"
                min={1}
                max={12}
                value={hour12}
                onChange={(event) => setHour12(Number(event.target.value))}
              />
            </div>

            <div className="form-row full">
              <label>디스코드 연동</label>
              {props.discordLinked ? (
                <>
                  <p className="help-text">
                    Discord 계정 연결됨 ✅
                    {props.discordAccountId ? ` (ID: ${props.discordAccountId})` : ""}
                  </p>
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={sendToDiscord}
                      onChange={(event) => setSendToDiscord(event.target.checked)}
                    />
                    리포트/TTS 링크를 디스코드로 받기
                  </label>
                </>
              ) : (
                <>
                  <p className="notice">디스코드를 연결하면 리포트와 TTS 링크를 봇 DM으로 받을 수 있습니다.</p>
                  <p className="item-meta">Discord Redirect URI 등록값: {props.discordCallbackUri}</p>
                  <div className="actions">
                    {props.discordOAuthEnabled ? (
                      discordConnectBlocked ? (
                        <button className="btn secondary" type="button" disabled>
                          Discord 계정 연결
                        </button>
                      ) : (
                        <a className="btn secondary" href="/api/discord/connect">
                          Discord 계정 연결
                        </a>
                      )
                    ) : (
                      <a className="btn secondary" href={props.discordInviteUrl} target="_blank" rel="noreferrer">
                        Discord 봇 초대 링크 열기
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="form-row full item-meta">현재 타임존: {timezone}</div>

            {errorText ? (
              <div className="form-row full">
                <p className="notice">{errorText}</p>
              </div>
            ) : null}

            {!errorText && hasReachedSetLimit ? (
              <div className="form-row full">
                <p className="notice">출근길 일정은 최대 3개까지 저장할 수 있습니다. 기존 일정을 제거한 뒤 추가해 주세요.</p>
              </div>
            ) : null}

            <div className="form-row full actions">
              <button className="btn primary" disabled={saving || hasReachedSetLimit} type="submit">
                {saving ? "저장 중..." : hasReachedSetLimit ? "최대 3개 도달" : "출근길 예약"}
              </button>
            </div>
          </form>
        </article>

        <div style={{ display: "grid", gap: 16 }}>
          <article className="card">
            <div className="section-head">
              <h2 className="section-title">
                <span>출근길 일정</span>
                <span className="section-count">({sets.length})</span>
              </h2>
            </div>
            <div className={`set-list ${sets.length > 3 ? "scroll-list" : ""}`}>
              {sets.length === 0 ? <p className="item-meta">아직 저장된 예약이 없습니다.</p> : null}
              {sets.map((set) => (
                <div className="set-item" key={set.id}>
                  <strong>{normalizeSetSummaryDisplay(set.summary)}</strong>
                  <p className="item-meta">다음 실행: {toHumanDate(set.nextRunAt)}</p>
                  <p className="item-meta">생성: {toHumanDate(set.createdAt)}</p>
                  <div className="item-actions">
                    <button
                      className="btn primary"
                      disabled={runningSetId === set.id}
                      onClick={() => handleRunNow(set.id)}
                      type="button"
                    >
                      {runningSetId === set.id ? "생성 중..." : "지금 생성"}
                    </button>
                    <button className="btn secondary" onClick={() => handleDeleteSet(set.id)} type="button">
                      제거
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="section-head">
              <h2 className="section-title">
                <span>최근 리포트</span>
                <span className="section-count">({reports.length})</span>
              </h2>
              <p className="section-note">※ 생성 10일 후 자동으로 만료됩니다.</p>
            </div>
            <div className={`report-list ${reports.length > 3 ? "scroll-list" : ""}`}>
              {reports.length === 0 ? <p className="item-meta">아직 생성된 리포트가 없습니다.</p> : null}
              {reports.map((report) => (
                <div className="report-item" key={report.id}>
                  <strong>{report.title}</strong>
                  <p className="item-meta">
                    상태:{" "}
                    <span className={report.status === "PENDING" ? "status-text pending" : "status-text"}>{report.status}</span> | 생성:{" "}
                    {toHumanDate(report.createdAt)}
                  </p>
                  {report.errorMessage?.includes("Discord 전송 실패") ? (
                    <p className="notice">{report.errorMessage}</p>
                  ) : null}
                  <div className="item-actions">
                    {report.status === "PENDING" ? (
                      <button className="btn primary" type="button" disabled>
                        열람
                      </button>
                    ) : (
                      <Link className="btn primary" href={`/reports/${report.id}`}>
                        열람
                      </Link>
                    )}
                    <button className="btn secondary" onClick={() => handleDeleteReport(report.id)} type="button">
                      제거
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
