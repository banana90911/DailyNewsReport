import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSupabaseAdminClient, hasSupabaseStorageConfig } from "@/lib/supabase-admin";

type RouteParams = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, { params }: RouteParams) {
  const report = await prisma.report.findUnique({
    where: {
      id: params.id
    },
    select: {
      ttsPath: true,
      status: true
    }
  });

  if (!report || report.status !== "COMPLETED" || !report.ttsPath) {
    return NextResponse.json({ message: "TTS 파일이 없습니다." }, { status: 404 });
  }

  if (report.ttsPath.startsWith("supabase:")) {
    const parsed = parseSupabasePath(report.ttsPath);
    if (!parsed) {
      return NextResponse.json({ message: "TTS 경로 형식이 올바르지 않습니다." }, { status: 500 });
    }

    if (!hasSupabaseStorageConfig()) {
      return NextResponse.json({ message: "Supabase 저장소 설정이 누락되었습니다." }, { status: 500 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.objectPath);
    if (error || !data) {
      return NextResponse.json({ message: "TTS 파일을 읽을 수 없습니다." }, { status: 404 });
    }

    const bytes = await data.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400"
      }
    });
  }

  const absolutePath = path.isAbsolute(report.ttsPath)
    ? report.ttsPath
    : path.join(process.cwd(), report.ttsPath);

  try {
    const data = await fs.readFile(absolutePath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400"
      }
    });
  } catch {
    return NextResponse.json({ message: "TTS 파일을 읽을 수 없습니다." }, { status: 404 });
  }
}

function parseSupabasePath(ttsPath: string): { bucket: string; objectPath: string } | null {
  const parts = ttsPath.split(":");
  if (parts.length < 3 || parts[0] !== "supabase") {
    return null;
  }

  const bucket = parts[1];
  const objectPath = parts.slice(2).join(":");

  if (!bucket || !objectPath) {
    return null;
  }

  return { bucket, objectPath };
}
