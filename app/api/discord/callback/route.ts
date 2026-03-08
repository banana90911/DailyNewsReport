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
  error?: string;
  error_description?: string;
};

type DiscordUserResponse = {
  id: string;
};

type DiscordRateLimitMeta = {
  retryAfterSeconds?: number;
  scope?: string;
  global?: boolean;
  bucket?: string;
};

function toFiniteNumberOrNull(value: string | number | null | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRateLimitMeta(response: Response, payload: Record<string, unknown> | null): DiscordRateLimitMeta {
  const retryAfterHeader = toFiniteNumberOrNull(response.headers.get("retry-after"));
  const resetAfterHeader = toFiniteNumberOrNull(response.headers.get("x-ratelimit-reset-after"));
  const retryAfterBody = toFiniteNumberOrNull(payload?.retry_after as string | number | null | undefined);
  const scope = response.headers.get("x-ratelimit-scope") || undefined;
  const globalHeader = response.headers.get("x-ratelimit-global");
  const globalFromHeader = globalHeader ? globalHeader.toLowerCase() === "true" : null;
  const globalFromBody = typeof payload?.global === "boolean" ? (payload.global as boolean) : null;
  const bucket = response.headers.get("x-ratelimit-bucket") || undefined;

  return {
    retryAfterSeconds: retryAfterHeader ?? resetAfterHeader ?? retryAfterBody ?? undefined,
    scope,
    global: globalFromHeader ?? globalFromBody ?? undefined,
    bucket
  };
}

function redirectToHomeWithStatus(status: string, meta?: DiscordRateLimitMeta): NextResponse {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = new URL("/", baseUrl);

  url.searchParams.set("discord", status);

  if (meta?.retryAfterSeconds != null && Number.isFinite(meta.retryAfterSeconds)) {
    url.searchParams.set("discord_retry_after", String(Math.ceil(meta.retryAfterSeconds)));
  }

  if (meta?.scope) {
    url.searchParams.set("discord_scope", meta.scope);
  }

  if (typeof meta?.global === "boolean") {
    url.searchParams.set("discord_global", meta.global ? "1" : "0");
  }

  if (meta?.bucket) {
    url.searchParams.set("discord_bucket", meta.bucket.slice(0, 80));
  }

  return NextResponse.redirect(url);
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
    const tokenErrorBody = await tokenResponse.text();
    let tokenErrorPayload: Record<string, unknown> | null = null;

    try {
      tokenErrorPayload = JSON.parse(tokenErrorBody) as Record<string, unknown>;
    } catch {
      tokenErrorPayload = null;
    }

    const rateLimitMeta = extractRateLimitMeta(tokenResponse, tokenErrorPayload);

    console.error("Discord OAuth token exchange failed", {
      status: tokenResponse.status,
      body: tokenErrorBody,
      retryAfter: tokenResponse.headers.get("retry-after"),
      rateLimitResetAfter: tokenResponse.headers.get("x-ratelimit-reset-after"),
      rateLimitScope: tokenResponse.headers.get("x-ratelimit-scope"),
      rateLimitGlobal: tokenResponse.headers.get("x-ratelimit-global"),
      rateLimitBucket: tokenResponse.headers.get("x-ratelimit-bucket"),
      rateLimitMeta,
      callbackUrl
    });
    return redirectToHomeWithStatus(`token_error_${tokenResponse.status}`, rateLimitMeta);
  }

  const token = (await tokenResponse.json()) as DiscordTokenResponse;

  if (!token.access_token) {
    console.error("Discord OAuth token payload missing access_token", {
      callbackUrl,
      error: token.error,
      errorDescription: token.error_description
    });
    return redirectToHomeWithStatus("token_error_payload");
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
