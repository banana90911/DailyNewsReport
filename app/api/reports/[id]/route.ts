import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";
import { getSupabaseAdminClient, hasSupabaseStorageConfig } from "@/lib/supabase-admin";

type RouteParams = {
  params: {
    id: string;
  };
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { session, errorResponse } = await requireApiSession();
  if (errorResponse || !session) {
    return errorResponse;
  }

  const report = await prisma.report.findFirst({
    where: {
      id: params.id,
      userId: session.user.id
    },
    select: {
      id: true,
      ttsPath: true
    }
  });

  if (!report) {
    return NextResponse.json({ message: "리포트를 찾을 수 없습니다." }, { status: 404 });
  }

  if (report.ttsPath) {
    await cleanupTtsAsset(report.ttsPath);
  }

  await prisma.report.delete({
    where: {
      id: report.id
    }
  });

  return NextResponse.json({ success: true });
}

async function cleanupTtsAsset(ttsPath: string): Promise<void> {
  if (ttsPath.startsWith("supabase:")) {
    const parsed = parseSupabasePath(ttsPath);
    if (parsed && hasSupabaseStorageConfig()) {
      const supabase = getSupabaseAdminClient();
      await supabase.storage.from(parsed.bucket).remove([parsed.objectPath]);
    }
    return;
  }

  const absolutePath = path.isAbsolute(ttsPath) ? ttsPath : path.join(process.cwd(), ttsPath);
  try {
    await fs.unlink(absolutePath);
  } catch {
    // 파일이 이미 제거된 경우를 포함해 정리 실패는 삭제 흐름을 막지 않는다.
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
