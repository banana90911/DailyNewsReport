import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/scheduler/run", "/api/discord/callback", "/favicon.ico"];

function isPublicPath(pathname: string): boolean {
  if (/^\/api\/reports\/[^/]+\/tts$/.test(pathname)) {
    return true;
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/public")) {
    return true;
  }

  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token?.userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!token.googleLinked) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "google_required");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"]
};
