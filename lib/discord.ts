import { prisma } from "@/lib/db";

const DISCORD_API = "https://discord.com/api/v10";

async function discordRequest(path: string, options: RequestInit): Promise<Response> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    throw new Error("DISCORD_BOT_TOKEN 환경 변수가 설정되지 않았습니다.");
  }

  return fetch(`${DISCORD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
}

export async function getLinkedDiscordUserId(appUserId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: {
      userId: appUserId,
      provider: "discord"
    },
    select: {
      providerAccountId: true
    }
  });

  return account?.providerAccountId ?? null;
}

export async function sendDiscordReportDm(params: {
  appUserId: string;
  reportTitle: string;
  reportUrl: string;
  ttsUrl: string;
}): Promise<{ discordUserId: string; channelId: string }> {
  const discordUserId = await getLinkedDiscordUserId(params.appUserId);

  if (!discordUserId) {
    throw new Error("Discord 계정이 연결되지 않았습니다.");
  }

  const channelResponse = await discordRequest("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId })
  });

  if (!channelResponse.ok) {
    const text = await channelResponse.text();
    throw new Error(`Discord DM 채널 생성 실패: ${channelResponse.status} ${text}`);
  }

  const channel = (await channelResponse.json()) as { id: string };

  const message = [
    `**${params.reportTitle}**`,
    `리포트: ${params.reportUrl}`,
    `TTS 듣기: ${params.ttsUrl}`
  ].join("\n");

  const messageResponse = await discordRequest(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: message })
  });

  if (!messageResponse.ok) {
    const text = await messageResponse.text();
    throw new Error(`Discord 메시지 전송 실패: ${messageResponse.status} ${text}`);
  }

  return {
    discordUserId,
    channelId: channel.id
  };
}
