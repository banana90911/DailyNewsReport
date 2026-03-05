import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";
import { prisma } from "@/lib/db";
import { getSessionOrNull } from "@/lib/session";

export default async function HomePage({
  searchParams
}: {
  searchParams?: { discord?: string };
}) {
  const session = await getSessionOrNull();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [sets, reports, discordAccount] = await Promise.all([
    prisma.categoryScheduleSet.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.report.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true
      }
    }),
    prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "discord"
      },
      select: {
        providerAccountId: true
      }
    })
  ]);

  return (
    <DashboardClient
      userName={session.user.name || ""}
      userEmail={session.user.email || ""}
      googleLinked={Boolean(session.user.googleLinked)}
      discordLinked={Boolean(discordAccount)}
      discordAccountId={discordAccount?.providerAccountId || null}
      discordStatus={searchParams?.discord || ""}
      discordCallbackUri={`${(process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")}/api/discord/callback`}
      discordOAuthEnabled={Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET)}
      discordInviteUrl={process.env.DISCORD_BOT_INVITE_URL || "https://discord.com"}
      sets={sets.map((set) => ({
        ...set,
        nextRunAt: set.nextRunAt?.toISOString() ?? null,
        createdAt: set.createdAt.toISOString()
      }))}
      reports={reports.map((report) => ({
        ...report,
        createdAt: report.createdAt.toISOString()
      }))}
    />
  );
}
