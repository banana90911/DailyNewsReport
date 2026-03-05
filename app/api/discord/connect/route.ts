import { NextResponse } from "next/server";
import { createDiscordOAuthState, getDiscordCallbackUrl } from "@/lib/discord-oauth";
import { getSessionOrNull } from "@/lib/session";

export async function GET() {
  const session = await getSessionOrNull();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
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

  return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
}
