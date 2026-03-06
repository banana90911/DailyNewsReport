import { CategoryScheduleSet, ReportStatus, ScheduleType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendDiscordReportDm } from "@/lib/discord";
import { searchLatestNews } from "@/lib/firecrawl";
import {
  buildAiPerspectiveAnalysisPrompt,
  buildAiPerspectiveQueryPrompt,
  buildAiPerspectiveReportComposerPrompt,
  buildAiPerspectiveTtsPrompt,
  buildAnalysisPrompt,
  buildQueryPrompt,
  buildReportComposerPrompt,
  buildTtsScriptPrompt,
  pickLensesForRunBySubtopic
} from "@/lib/prompts";
import { computeNextRun } from "@/lib/schedule";
import { generateKoreanTtsMp3 } from "@/lib/tts";
import { generateText } from "@/lib/openai";

const MAX_SOURCES = 18;
const MAX_QUERIES = 6;
const MAX_ANALYSIS_ITEMS = 6;

function stripCodeFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function extractQueries(rawText: string): string[] {
  const result: string[] = [];
  const text = stripCodeFence(rawText);

  try {
    const parsed = JSON.parse(text) as {
      queries?: Array<string | { query?: string }>;
    };

    if (Array.isArray(parsed.queries)) {
      for (const item of parsed.queries) {
        if (typeof item === "string") {
          result.push(item);
          continue;
        }

        if (item?.query && typeof item.query === "string") {
          result.push(item.query);
        }
      }
    }
  } catch {
    // JSON 파싱 실패 시 줄 단위 fallback을 사용한다.
  }

  if (result.length === 0) {
    result.push(
      ...text
        .split(/\n+/)
        .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
        .filter(Boolean)
    );
  }

  return Array.from(new Set(result.map((item) => item.trim()).filter(Boolean))).slice(0, MAX_QUERIES);
}

function summarizeSourceForPrompt(item: {
  title: string;
  url: string;
  markdown: string;
  snippet?: string;
  publishedDate?: string;
}): string {
  const body = (item.markdown || item.snippet || "").replace(/\s+/g, " ").slice(0, 1600);
  return [
    `제목: ${item.title}`,
    `링크: ${item.url}`,
    item.publishedDate ? `발행시각(원문 기준): ${item.publishedDate}` : "발행시각: 정보 없음",
    `본문요약: ${body}`
  ].join("\n");
}

function asScheduleInput(set: CategoryScheduleSet): {
  scheduleType: ScheduleType;
  timezone: string;
  dayOfWeek: number | null;
  hour: number | null;
  minute: number | null;
  intervalHours: number | null;
  morningHour: number | null;
  eveningHour: number | null;
} {
  return {
    scheduleType: set.scheduleType,
    timezone: set.timezone,
    dayOfWeek: set.dayOfWeek,
    hour: set.hour,
    minute: set.minute,
    intervalHours: set.intervalHours,
    morningHour: set.morningHour,
    eveningHour: set.eveningHour
  };
}

export async function generateReportForSet(setId: string): Promise<{ reportId: string }> {
  const set = await prisma.categoryScheduleSet.findUnique({
    where: { id: setId }
  });

  if (!set) {
    throw new Error("출근길 예약을 찾을 수 없습니다.");
  }

  const [completedCount, previousCompletedReport] = await Promise.all([
    prisma.report.count({
      where: {
        setId: set.id,
        status: ReportStatus.COMPLETED
      }
    }),
    prisma.report.findFirst({
      where: {
        setId: set.id,
        status: ReportStatus.COMPLETED
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        title: true,
        markdown: true
      }
    })
  ]);

  const runOrdinal = completedCount + 1;
  const selectedLenses = pickLensesForRunBySubtopic({
    mainCategory: set.mainCategory,
    subCategory: set.subCategory,
    runOrdinal
  });

  const previousReportDigest = previousCompletedReport
    ? `제목: ${previousCompletedReport.title}\n요약: ${previousCompletedReport.markdown.replace(/\s+/g, " ").slice(0, 900)}`
    : "";

  const report = await prisma.report.create({
    data: {
      userId: set.userId,
      setId: set.id,
      title: `${set.mainCategory}/${set.subCategory} 리포트`,
      markdown: "생성 중...",
      ttsText: "",
      sourceItems: "[]",
      status: ReportStatus.PENDING,
      startedAt: new Date()
    },
    select: { id: true }
  });

  try {
    const queryPrompt = set.aiPerspective
      ? buildAiPerspectiveQueryPrompt({
        mainCategory: set.mainCategory,
        subCategory: set.subCategory
      })
      : buildQueryPrompt({
        mainCategory: set.mainCategory,
        subCategory: set.subCategory
      });

    const rawQueries = await generateText({
      system: set.aiPerspective
        ? "You are an elite AI-perspective news strategist. Return valid JSON only."
        : "You are an elite news-research strategist. Return valid JSON only.",
      user: queryPrompt,
      temperature: 0.35
    });

    const queries = extractQueries(rawQueries);

    if (queries.length === 0) {
      throw new Error("검색 쿼리를 생성하지 못했습니다.");
    }

    const sourceMap = new Map<string, { title: string; url: string; markdown: string; snippet?: string; publishedDate?: string }>();

    for (const query of queries) {
      const results = await searchLatestNews(query, 8);
      for (const item of results) {
        if (!sourceMap.has(item.url)) {
          sourceMap.set(item.url, item);
        }
      }
    }

    const sources = Array.from(sourceMap.values()).slice(0, MAX_SOURCES);

    if (sources.length === 0) {
      throw new Error("최신 뉴스를 찾지 못했습니다.");
    }

    const analysisTargets = sources.slice(0, Math.min(MAX_ANALYSIS_ITEMS, sources.length));

    const sectionContents: string[] = [];

    for (let i = 0; i < analysisTargets.length; i += 1) {
      const source = analysisTargets[i];
      const sourceDigest = summarizeSourceForPrompt(source);

      const sectionMarkdown = await generateText({
        system: set.aiPerspective
          ? "You write imaginative but grounded Korean AI-perspective commentary."
          : "You write insightful Korean learning-style analysis content for commute listeners.",
        user: set.aiPerspective
          ? buildAiPerspectiveAnalysisPrompt({
              mainCategory: set.mainCategory,
              subCategory: set.subCategory,
              sourceTitle: source.title,
              sourceUrl: source.url,
              sourceIndex: i + 1,
              sourceTotal: analysisTargets.length,
              sourceDigest,
              previousReportDigest
            })
          : buildAnalysisPrompt({
              mainCategory: set.mainCategory,
              subCategory: set.subCategory,
              sourceTitle: source.title,
              sourceUrl: source.url,
              sourceIndex: i + 1,
              sourceTotal: analysisTargets.length,
              sourceDigest,
              selectedLenses,
              previousReportDigest
            }),
        temperature: 0.55
      });

      sectionContents.push(sectionMarkdown);
    }

    const title = set.aiPerspective
      ? `[AI 관점] ${set.mainCategory} / ${set.subCategory} 출근길 리포트`
      : `${set.mainCategory} / ${set.subCategory} 출근길 리포트`;

    const finalMarkdown = await generateText({
      system: set.aiPerspective
        ? "You are a top-tier Korean speculative-but-grounded audio report editor."
        : "You are a top-tier Korean report editor and narrative designer.",
      user: set.aiPerspective
        ? buildAiPerspectiveReportComposerPrompt({
            title,
            sectionsMarkdown: sectionContents,
            mainCategory: set.mainCategory,
            subCategory: set.subCategory,
            previousReportDigest
          })
        : buildReportComposerPrompt({
            title,
            sectionsMarkdown: sectionContents,
            mainCategory: set.mainCategory,
            subCategory: set.subCategory,
            selectedLenses,
            previousReportDigest
          }),
      temperature: 0.5
    });

    const ttsScript = await generateText({
      system: set.aiPerspective
        ? "You transform Korean AI-perspective markdown into engaging spoken script for TTS."
        : "You transform report markdown into engaging Korean spoken script for TTS.",
      user: set.aiPerspective
        ? buildAiPerspectiveTtsPrompt({
            mainCategory: set.mainCategory,
            subCategory: set.subCategory,
            reportTitle: title,
            reportMarkdown: finalMarkdown
          })
        : buildTtsScriptPrompt({
            mainCategory: set.mainCategory,
            subCategory: set.subCategory,
            reportTitle: title,
            reportMarkdown: finalMarkdown
          }),
      temperature: 0.6
    });

    const tts = await generateKoreanTtsMp3({
      reportId: report.id,
      title,
      markdown: ttsScript
    });

    await prisma.report.update({
      where: { id: report.id },
      data: {
        title,
        markdown: finalMarkdown,
        ttsText: tts.ttsText,
        ttsPath: tts.ttsPath,
        sourceItems: JSON.stringify(sources),
        status: ReportStatus.COMPLETED,
        completedAt: new Date()
      }
    });

    await prisma.categoryScheduleSet.update({
      where: { id: set.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: computeNextRun(asScheduleInput(set), new Date())
      }
    });

    if (set.sendToDiscord) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
        await sendDiscordReportDm({
          appUserId: set.userId,
          reportTitle: title,
          reportUrl: `${baseUrl}/reports/${report.id}`,
          ttsUrl: `${baseUrl}/api/reports/${report.id}/tts`
        });
      } catch (discordError) {
        await prisma.report.update({
          where: { id: report.id },
          data: {
            errorMessage: `Discord 전송 실패: ${discordError instanceof Error ? discordError.message : String(discordError)}`
          }
        });
      }
    }

    return { reportId: report.id };
  } catch (error) {
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.FAILED,
        markdown: "리포트 생성에 실패했습니다.",
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date()
      }
    });
    throw error;
  }
}

export async function runDueSchedules(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = new Date();

  const dueSets = await prisma.categoryScheduleSet.findMany({
    where: {
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }]
    },
    select: { id: true }
  });

  let succeeded = 0;
  let failed = 0;

  for (const set of dueSets) {
    try {
      await generateReportForSet(set.id);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    processed: dueSets.length,
    succeeded,
    failed
  };
}
