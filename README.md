# DailyNewsApp - 출근길 리포트 웹앱

Google 로그인 기반으로 사용자별 `출근길 예약`을 저장하고, 최신 뉴스를 분석해 한국어 리포트 + 한국어 TTS로 제공하는 Next.js 앱입니다.

## 핵심 기능

- Google OAuth 필수 로그인, Discord 선택 연동
- 주제/소주제/주기/AI 관점/디스코드 전송 설정
- 여러 개의 출근길 예약 저장 (수정 불가, 삭제 가능)
- `지금 실행`으로 즉시 리포트 생성
- Firecrawl 검색 + OpenAI 분석 파이프라인
- AI 관점 토글 시 AI 상상/사고실험 스타일 리포트/TTS 생성
- 리포트 리스트/상세 열람, TTS 재생(재생/정지/-5/+5)
- Discord 연동 시 리포트 링크 + TTS 링크 DM 전송
- 스케줄러 API 제공 (GitHub Actions 연동)

## 기술 스택

- Next.js (App Router) + TypeScript
- NextAuth + Prisma + PostgreSQL (Supabase)
- Supabase Storage (TTS mp3 저장)
- Firecrawl API
- OpenAI API (텍스트 생성 + TTS)

## 무료 운영 구성

- 앱 서버: Render Free
- 데이터베이스: Supabase Postgres
- TTS 파일 저장: Supabase Storage (bucket: `tts`)

## 로컬 실행

1. 의존성 설치

```bash
npm install
```

2. 환경 변수

```bash
cp .env.example .env.local
```

필수값
- `DATABASE_URL` (Supabase direct Postgres 연결 문자열, 예: `db.<project-ref>.supabase.co:5432`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TTS_BUCKET` (기본값 `tts`)

3. Supabase Storage 버킷 생성

- Supabase Dashboard -> Storage -> New bucket -> 이름 `tts`
- private/public 모두 가능 (현재 코드는 서버에서 서비스 롤로 직접 다운로드)

4. DB 반영

```bash
npx prisma db push
```

5. 개발 서버

```bash
npm run dev
```

## 배포 방식 (중요)

GitHub Actions는 **앱 서버를 호스팅하지 않습니다**.
- GitHub Actions: 배포 트리거/스케줄 호출 자동화
- 실제 앱 호스팅: Render

현재 저장소에는 Render Free 배포 설정이 포함되어 있습니다.
- Render 블루프린트: [render.yaml](/Users/siheonjung/Desktop/code/DailyNewsApp/render.yaml)
- 배포 트리거 워크플로우: [.github/workflows/deploy-render.yml](/Users/siheonjung/Desktop/code/DailyNewsApp/.github/workflows/deploy-render.yml)

### Render 배포 절차

1. Render에서 `Blueprint`로 저장소 연결
2. `render.yaml` 기반 서비스 생성
3. Render 환경변수 채우기
- OAuth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_*`, `DISCORD_*`
- AI/검색: `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`
- 스케줄 보호: `CRON_SECRET`
- DB/Storage: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_TTS_BUCKET`
4. GitHub Secrets 추가
- `RENDER_DEPLOY_HOOK_URL`: Render Deploy Hook URL
- `SCHEDULER_ENDPOINT`: `https://<your-domain>/api/scheduler/run`
- `CRON_SECRET`: 스케줄 보호 토큰

### OAuth Redirect URI

배포 도메인 기준으로 아래 URI를 각각 등록해야 합니다.

- Google: `https://<your-domain>/api/auth/callback/google`
- Discord: `https://<your-domain>/api/discord/callback`

## 스케줄 실행

- 엔드포인트: `POST /api/scheduler/run`
- 헤더: `x-cron-secret: <CRON_SECRET>` (설정한 경우)
- 워크플로우: [.github/workflows/scheduler.yml](/Users/siheonjung/Desktop/code/DailyNewsApp/.github/workflows/scheduler.yml)

## 프롬프트 수정 포인트

- 일반 쿼리 생성: `buildQueryPrompt`
- 일반 분석: `buildAnalysisPrompt`
- 일반 최종 편집: `buildReportComposerPrompt`
- 일반 TTS 대본: `buildTtsScriptPrompt`
- AI 관점 쿼리: `buildAiPerspectiveQueryPrompt`
- AI 관점 분석: `buildAiPerspectiveAnalysisPrompt`
- AI 관점 최종 편집: `buildAiPerspectiveReportComposerPrompt`
- AI 관점 TTS 대본: `buildAiPerspectiveTtsPrompt`

파일: [lib/prompts.ts](/Users/siheonjung/Desktop/code/DailyNewsApp/lib/prompts.ts)

## 참고

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`가 설정되면 TTS mp3는 Supabase Storage로 저장됩니다.
- 위 값이 없으면 로컬 파일(`TTS_STORAGE_DIR`, 기본 `storage/tts`)로 fallback 저장됩니다.
- Firecrawl CLI 확인: `firecrawl --help`
