import { NextRequest, NextResponse } from "next/server";
import { createDiscordOAuthState, getDiscordCallbackUrl } from "@/lib/discord-oauth";
import { getSessionOrNull } from "@/lib/session";

const DISCORD_OAUTH_STATE_COOKIE = "discord_oauth_state";
const DISCORD_OAUTH_COOLDOWN_COOKIE = "discord_oauth_cooldown_until";

function toFiniteNumberOrNull(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function redirectToHomeWithStatus(status: string, retryAfterSeconds?: number): NextResponse {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = new URL("/", baseUrl);
  url.searchParams.set("discord", status);

  if (retryAfterSeconds && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    url.searchParams.set("discord_retry_after", String(Math.ceil(retryAfterSeconds)));
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const session = await getSessionOrNull();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const cooldownUntil = toFiniteNumberOrNull(request.cookies.get(DISCORD_OAUTH_COOLDOWN_COOKIE)?.value);

  if (cooldownUntil && cooldownUntil > nowSeconds) {
    return redirectToHomeWithStatus("connect_cooldown", cooldownUntil - nowSeconds);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const callbackUrl = getDiscordCallbackUrl();

  if (!clientId || !process.env.DISCORD_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/?discord=oauth_config_missing", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }

  const state = createDiscordOAuthState(session.user.id);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "identify email",
    redirect_uri: callbackUrl,
    prompt: "consent",
    state
  });

  const response = NextResponse.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);

  response.cookies.set(DISCORD_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/"
  });

  return response;
}
