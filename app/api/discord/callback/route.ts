import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDiscordCallbackUrl, verifyDiscordOAuthState } from "@/lib/discord-oauth";

const DISCORD_API = "https://discord.com/api/v10";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type DiscordUserResponse = {
  id: string;
};

function redirectToHomeWithStatus(status: string): NextResponse {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return NextResponse.redirect(new URL(`/?discord=${status}`, baseUrl));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectToHomeWithStatus("denied");
  }

  if (!code) {
    return redirectToHomeWithStatus("missing_code");
  }

  const verified = verifyDiscordOAuthState(state);
  if (!verified) {
    return redirectToHomeWithStatus("invalid_state");
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectToHomeWithStatus("oauth_config_missing");
  }

  const callbackUrl = getDiscordCallbackUrl();

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl
  });

  const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: tokenParams
  });

  if (!tokenResponse.ok) {
    return redirectToHomeWithStatus("token_error");
  }

  const token = (await tokenResponse.json()) as DiscordTokenResponse;

  if (!token.access_token) {
    return redirectToHomeWithStatus("token_error");
  }

  const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
    headers: {
      Authorization: `${token.token_type || "Bearer"} ${token.access_token}`
    }
  });

  if (!userResponse.ok) {
    return redirectToHomeWithStatus("profile_error");
  }

  const discordUser = (await userResponse.json()) as DiscordUserResponse;

  if (!discordUser.id) {
    return redirectToHomeWithStatus("profile_error");
  }

  const existingByDiscordId = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "discord",
        providerAccountId: discordUser.id
      }
    },
    select: {
      id: true,
      userId: true
    }
  });

  if (existingByDiscordId && existingByDiscordId.userId !== verified.userId) {
    return redirectToHomeWithStatus("already_linked");
  }

  const expiresAt = token.expires_in
    ? Math.floor(Date.now() / 1000) + Number(token.expires_in)
    : null;

  const existingByUser = await prisma.account.findFirst({
    where: {
      userId: verified.userId,
      provider: "discord"
    },
    select: {
      id: true,
      providerAccountId: true
    }
  });

  if (existingByUser) {
    await prisma.account.update({
      where: { id: existingByUser.id },
      data: {
        providerAccountId: discordUser.id,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        token_type: token.token_type ?? null,
        scope: token.scope ?? null,
        expires_at: expiresAt
      }
    });
  } else {
    await prisma.account.create({
      data: {
        userId: verified.userId,
        type: "oauth",
        provider: "discord",
        providerAccountId: discordUser.id,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        token_type: token.token_type ?? null,
        scope: token.scope ?? null,
        expires_at: expiresAt
      }
    });
  }

  return redirectToHomeWithStatus("connected");
}
