import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/session";

export async function requireApiSession() {
  const session = await getSessionOrNull();
  if (!session?.user?.id) {
    return {
      session: null,
      errorResponse: NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 })
    };
  }

  return {
    session,
    errorResponse: null
  };
}
