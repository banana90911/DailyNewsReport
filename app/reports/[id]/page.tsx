import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { AudioPlayer } from "@/components/audio-player";
import { prisma } from "@/lib/db";
import { getSessionOrNull } from "@/lib/session";

type SourceItem = {
  title?: string;
  url?: string;
};

function toKoreanDate(iso: Date): string {
  return iso.toLocaleString("ko-KR", {
    dateStyle: "full",
    timeStyle: "short"
  });
}

export default async function ReportPage({ params }: { params: { id: string } }) {
  const session = await getSessionOrNull();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const report = await prisma.report.findFirst({
    where: {
      id: params.id,
      userId: session.user.id
    },
    select: {
      id: true,
      title: true,
      markdown: true,
      status: true,
      errorMessage: true,
      sourceItems: true,
      createdAt: true,
      ttsPath: true
    }
  });

  if (!report) {
    notFound();
  }

  let sources: SourceItem[] = [];
  try {
    const parsed = JSON.parse(report.sourceItems || "[]");
    sources = Array.isArray(parsed) ? (parsed as SourceItem[]) : [];
  } catch {
    sources = [];
  }

  return (
    <main className="main-shell" style={{ maxWidth: 900 }}>
      <section className="hero">
        <h1>{report.title}</h1>
        <p>생성 시각: {toKoreanDate(report.createdAt)}</p>
        <p className="item-meta">상태: {report.status}</p>
        <div className="actions">
          <Link className="btn secondary" href="/">
            목록으로
          </Link>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        {report.errorMessage ? <p className="notice">{report.errorMessage}</p> : null}
        <article className="markdown">
          <ReactMarkdown>{report.markdown}</ReactMarkdown>
        </article>

        {report.status === "COMPLETED" && report.ttsPath ? (
          <AudioPlayer title={report.title} audioUrl={`/api/reports/${report.id}/tts`} />
        ) : null}
      </section>

      {sources.length > 0 ? (
        <section className="card" style={{ marginTop: 14 }}>
          <h2>참고 뉴스 링크</h2>
          <ul>
            {sources.map((item, index) => (
              <li key={`${item.url || "source"}-${index}`}>
                <a href={item.url || "#"} target="_blank" rel="noreferrer">
                  {item.title || item.url || `출처 ${index + 1}`}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
