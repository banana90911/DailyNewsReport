import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
