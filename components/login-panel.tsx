"use client";

import { signIn } from "next-auth/react";

function getErrorMessage(error?: string): string {
  if (!error) {
    return "";
  }

  const map: Record<string, string> = {
    google_required: "앱 사용을 위해 Google 로그인이 먼저 필요합니다.",
    Configuration: "Google OAuth 설정값이 누락되었거나 잘못되었습니다.",
    OAuthSignin: "Google 로그인 시작 단계에서 오류가 발생했습니다.",
    OAuthCallback: "Google 로그인 콜백 처리 중 오류가 발생했습니다.",
    AccessDenied: "Google 로그인 권한이 거부되었습니다.",
    Callback: "로그인 콜백 처리 중 오류가 발생했습니다.",
    OAuthAccountNotLinked: "이미 다른 방식으로 가입된 이메일입니다. 동일 계정으로 다시 시도해 주세요.",
    Default: "로그인 중 알 수 없는 오류가 발생했습니다."
  };

  return map[error] || `로그인 오류 코드: ${error}`;
}

export function LoginPanel({
  error,
  callbackUrl,
  googleConfigured
}: {
  error?: string;
  callbackUrl: string;
  googleConfigured: boolean;
}) {
  const message = getErrorMessage(error);

  return (
    <div className="main-shell" style={{ maxWidth: 520 }}>
      <section className="hero">
        <h1>출근길 리포트</h1>
        <p>Google 로그인 후, 원하는 출근길 예약을 저장하면 자동으로 리포트를 받아볼 수 있습니다.</p>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>로그인</h2>
        {!googleConfigured ? (
          <p className="notice">Google OAuth 설정이 비어 있습니다. `.env.local`에 Google Client ID/Secret을 입력해 주세요.</p>
        ) : null}
        {message ? <p className="notice">{message}</p> : null}
        <div className="actions">
          <button
            className="btn primary"
            disabled={!googleConfigured}
            onClick={() => signIn("google", { callbackUrl })}
          >
            Google로 시작하기
          </button>
        </div>
      </section>
    </div>
  );
}
