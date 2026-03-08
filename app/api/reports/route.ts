import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiSession } from "@/lib/route-auth";

export async function GET() {
  const { session, errorResponse } = await requireApiSession();
  if (errorResponse || !session) {
    return errorResponse;
  }

  const reports = await prisma.report.findMany({
    where: {
      userId: session.user.id
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      errorMessage: true
    }
  });

  return NextResponse.json({
    reports: reports.map((report) => ({
      ...report,
      createdAt: report.createdAt.toISOString()
    }))
  });
}
