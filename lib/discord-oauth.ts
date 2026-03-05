import crypto from "node:crypto";
import { getRequiredEnv } from "@/lib/env";

const STATE_TTL_SECONDS = 60 * 10;

function getStateSecret(): string {
  return process.env.NEXTAUTH_SECRET || getRequiredEnv("DISCORD_CLIENT_SECRET");
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  const secret = getStateSecret();
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createDiscordOAuthState(userId: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const payload = `${userId}:${nowSeconds}`;
  const encodedPayload = toBase64Url(payload);
  const signature = signPayload(payload);
  return `${encodedPayload}.${signature}`;
}

export function verifyDiscordOAuthState(state: string | null): { userId: string } | null {
  if (!state) {
    return null;
  }

  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const payload = fromBase64Url(encodedPayload);
  const expected = signPayload(payload);

  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return null;
  }

  const [userId, issuedAtRaw] = payload.split(":");
  const issuedAt = Number(issuedAtRaw);

  if (!userId || !Number.isFinite(issuedAt)) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - issuedAt > STATE_TTL_SECONDS) {
    return null;
  }

  return { userId };
}

export function getDiscordCallbackUrl(): string {
  const base = getRequiredEnv("NEXTAUTH_URL").replace(/\/$/, "");
  return `${base}/api/discord/callback`;
}
