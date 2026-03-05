import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateReportForSet } from "@/lib/report-pipeline";
import { requireApiSession } from "@/lib/route-auth";

type RouteParams = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, { params }: RouteParams) {
  const { session, errorResponse } = await requireApiSession();
  if (errorResponse || !session) {
    return errorResponse;
  }

  const set = await prisma.categoryScheduleSet.findFirst({
    where: {
      id: params.id,
      userId: session.user.id
    },
    select: { id: true }
  });

  if (!set) {
    return NextResponse.json({ message: "출근길 예약을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const result = await generateReportForSet(set.id);
    return NextResponse.json({ reportId: result.reportId });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "리포트 실행 실패" },
      { status: 500 }
    );
  }
}
