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
- NextAuth + Prisma + SQLite
- Firecrawl API
- OpenAI API (텍스트 생성 + TTS)


