type QueryPromptInput = {
  mainCategory: string;
  subCategory: string;
};

type AnalysisPromptInput = QueryPromptInput & {
  sourceTitle: string;
  sourceUrl: string;
  sourceIndex: number;
  sourceTotal: number;
  sourceDigest: string;
  selectedLenses: string[];
  previousReportDigest?: string;
};

type TtsPromptInput = QueryPromptInput & {
  reportTitle: string;
  reportMarkdown: string;
};

type AiPerspectiveAnalysisPromptInput = QueryPromptInput & {
  sourceTitle: string;
  sourceUrl: string;
  sourceIndex: number;
  sourceTotal: number;
  sourceDigest: string;
  previousReportDigest?: string;
};

type LensPool = {
  core: string[];
  spicy: string[];
};

const LENS_POOLS: Record<string, LensPool> = {
  "경제": {
    core: ["수요·공급", "통화·금리", "환율·원자재", "고용·임금", "기업 손익", "국제 연계", "정책 딜레마", "반대 시나리오"],
    spicy: [
      "만약 내가 워렌 버핏이라면 지금 어떤 지표부터 볼까?",
      "지금 이 뉴스가 1년 뒤 부자의 포트폴리오를 어떻게 바꿀까?",
      "당장 경기침체가 시작된다면 가장 먼저 흔들릴 산업은 어디일까?"
    ]
  },
  "정치": {
    core: ["권력구조", "이해관계자", "법·제도", "선거 동학", "외교·안보", "여론 프레임", "정책 비용", "장기 파급"],
    spicy: [
      "지금 당장 북한이 군사 도발을 확대하면 경제·외교는 어떤 순서로 흔들릴까?",
      "정권이 바뀐다면 오늘 정책의 생존 확률은 얼마나 될까?",
      "외교 변수가 폭발하면 한국 기업과 가계는 어디서 먼저 체감할까?"
    ]
  },
  "사회": {
    core: ["구조적 원인", "세대·계층", "지역 격차", "제도 공백", "행동경제", "공공서비스", "윤리 쟁점", "해외 비교"],
    spicy: [
      "지금 문제가 5년 방치되면 내 일상은 무엇부터 불편해질까?",
      "같은 사건이 부유층과 취약계층에 미치는 충격은 왜 다를까?",
      "정부·기업·개인이 동시에 실패하면 어떤 사회 비용이 폭발할까?"
    ]
  },
  "IT/과학": {
    core: ["기술 원리", "산업 적용", "보안·위험", "규제 이슈", "생태계 경쟁", "표준·플랫폼", "사용자 체감", "장기 변화"],
    spicy: [
      "내 스마트폰이 오늘 해킹당한다면 피해는 어떤 순서로 커질까?",
      "이 기술이 대중화되면 3년 뒤 사라질 직무와 새로 생길 직무는?",
      "한 기업이 표준을 독점하면 사용자 선택권은 얼마나 줄어들까?"
    ]
  },
  AI: {
    core: ["모델 성능", "데이터·연산비용", "업무 재설계", "생산성 효과", "일자리 전환", "윤리·규제", "벤더 경쟁", "국가 전략"],
    spicy: [
      "AI가 핵심 의사결정을 대신하면 인간은 어떤 판단 능력을 잃게 될까?",
      "AI가 세상을 지배한다면 가장 먼저 무너지는 제도는 무엇일까?",
      "초거대 모델 전쟁에서 한국이 살아남으려면 지금 무엇을 투자해야 할까?"
    ]
  }
};

const SUBTOPIC_CORE_OVERRIDES: Record<string, string[]> = {
  "경제:주식": ["밸류에이션", "유동성", "실적 모멘텀", "수급 구조", "리스크 관리", "거시 민감도"],
  "경제:국내 주식": ["정책 수혜", "원화·금리 민감도", "업종 순환", "개인·기관 수급", "실적 시즌 포인트", "테마 과열 점검"],
  "경제:해외 주식": ["달러 사이클", "미국 금리 경로", "빅테크 밸류에이션", "지정학 리스크", "ETF 자금 흐름", "헤지 전략"],
  "경제:암호화폐": ["유동성 레짐", "규제·승인 이슈", "온체인 지표", "레버리지 청산 구조", "거시 동조화", "보관·보안 리스크"],
  "정치:미국": ["대선 동학", "의회 권력지형", "대외정책 우선순위", "연준·재정 정책 연결", "동맹 변수", "산업 보조금 경쟁"],
  "정치:북한": ["군사 억지", "외교 협상 카드", "국제 제재", "국내 안보비용", "시장 심리 반응", "정보 비대칭"],
  "사회:교육": ["학력 격차", "사교육 시장", "정책 실효성", "지역 불균형", "노동시장 연결", "장기 사회비용"],
  "IT/과학:보안/해킹": ["공격 벡터", "방어 비용", "규제 준수", "공급망 취약성", "사용자 행동 리스크", "사고 대응 체계"],
  "AI:LLM": ["모델 성능 한계", "추론 비용", "데이터 품질", "환각 리스크", "도입 ROI", "규제 컴플라이언스"]
};

function normalizeTopicKey(mainCategory: string): string {
  if (mainCategory.includes("경제")) {
    return "경제";
  }
  if (mainCategory.includes("정치")) {
    return "정치";
  }
  if (mainCategory.includes("사회")) {
    return "사회";
  }
  if (mainCategory.includes("IT") || mainCategory.includes("과학")) {
    return "IT/과학";
  }
  if (mainCategory.includes("AI")) {
    return "AI";
  }
  return "경제";
}

export function pickLensesForRun(params: { mainCategory: string; runOrdinal: number }): string[] {
  const topicKey = normalizeTopicKey(params.mainCategory);
  const pool = LENS_POOLS[topicKey] || LENS_POOLS["경제"];
  const size = pool.core.length;
  const start = Math.max(0, params.runOrdinal - 1) % size;

  const baseLenses = [pool.core[start % size], pool.core[(start + 3) % size], pool.core[(start + 5) % size]];

  const includeSpicy = params.runOrdinal % 2 === 0 || params.runOrdinal % 5 === 0;
  if (!includeSpicy || pool.spicy.length === 0) {
    return Array.from(new Set(baseLenses));
  }

  const spicyLens = pool.spicy[(params.runOrdinal + 1) % pool.spicy.length];
  const mixed = [baseLenses[0], baseLenses[1], `자극적 사고실험: ${spicyLens}`];
  return Array.from(new Set(mixed));
}

function pickCoreOverride(mainCategory: string, subCategory: string): string[] | null {
  const topicKey = normalizeTopicKey(mainCategory);
  const exactKey = `${topicKey}:${subCategory}`;
  return SUBTOPIC_CORE_OVERRIDES[exactKey] || null;
}

export function pickLensesForRunBySubtopic(params: {
  mainCategory: string;
  subCategory: string;
  runOrdinal: number;
}): string[] {
  const override = pickCoreOverride(params.mainCategory, params.subCategory);
  if (!override || override.length < 3) {
    return pickLensesForRun({ mainCategory: params.mainCategory, runOrdinal: params.runOrdinal });
  }

  const size = override.length;
  const start = Math.max(0, params.runOrdinal - 1) % size;
  const core = [override[start], override[(start + 2) % size], override[(start + 4) % size]];

  const topicKey = normalizeTopicKey(params.mainCategory);
  const spicyPool = LENS_POOLS[topicKey]?.spicy || [];
  const includeSpicy = params.runOrdinal % 3 === 0;
  if (!includeSpicy || spicyPool.length === 0) {
    return Array.from(new Set(core));
  }

  const spicyLens = spicyPool[(params.runOrdinal + 2) % spicyPool.length];
  return Array.from(new Set([core[0], core[1], `자극적 사고실험: ${spicyLens}`]));
}

function shouldUseKoreanQuery(subCategory: string): boolean {
  const localizedKeywords = ["국내", "한국", "북한", "정치", "사회"];
  return localizedKeywords.some((keyword) => subCategory.includes(keyword));
}

export function buildQueryPrompt(input: QueryPromptInput): string {
  const queryLanguage = shouldUseKoreanQuery(input.subCategory) ? "ko" : "en";

  return [
    "역할: 세계 최고 수준의 뉴스 리서치 쿼리 전략가",
    "목표: 단순 헤드라인 수집이 아니라, 사용자가 출근길 10분 동안 '이해 + 사고력 + 통찰'을 얻도록 검색 전략을 만든다.",
    "",
    `[입력]`,
    `- 주제: ${input.mainCategory}`,
    `- 소주제: ${input.subCategory}`,
    "",
    "[쿼리 전략 원칙]",
    "1) 최신성: 반드시 최신 이슈를 잡아야 한다. 쿼리 자체에 시간 힌트(예: today, this week, latest, breaking)를 포함하라.",
    "2) 관점 다양성: 단순 속보용 쿼리만 만들지 말고, 원인 분석/데이터 근거/반대 관점/실전 영향 관점을 분산하라.",
    "3) 학습 확장성: '왜?'를 파고들 수 있는 배경지식 소스까지 걸리도록 쿼리를 설계하라.",
    `4) 언어 규칙: 한국 로컬 이슈가 아니면 ${queryLanguage === "en" ? "영어 쿼리" : "한국어 쿼리"}를 사용하라.`,
    "",
    "[출력 형식 - 반드시 JSON만 출력]",
    "{",
    '  "queries": [',
    '    {"query": "...", "intent": "breaking|why|data|counterpoint|practical", "language": "ko|en", "recency": "24h|7d"}',
    "  ]",
    "}",
    "",
    "[출력 제약]",
    "- queries는 정확히 6개",
    "- 같은 의미의 중복 쿼리 금지",
    "- 설명 문장, 마크다운, 코드블록 금지",
    "- JSON 외 텍스트 절대 금지"
  ].join("\n");
}

export function buildAiPerspectiveQueryPrompt(input: QueryPromptInput): string {
  const queryLanguage = shouldUseKoreanQuery(input.subCategory) ? "ko" : "en";

  return [
    "역할: AI 관점 리포트 전용 뉴스 리서치 전략가",
    "목표: AI가 인간 뉴스를 보고 '어떻게 사고할지' 재료가 될 기사와 배경 자료를 찾는다.",
    "",
    `[입력]`,
    `- 주제: ${input.mainCategory}`,
    `- 소주제: ${input.subCategory}`,
    "",
    "[쿼리 설계 원칙]",
    "1) 최신성: 반드시 최신 기사 포함 (today, latest, breaking 등 시간 힌트 포함)",
    "2) 상상력 재료: 단순 사실 기사 + 배경 설명 기사 + 반대 시나리오 기사 + 파급효과 기사를 섞어라",
    "3) AI 시점 적합성: 인간의 의사결정, 시스템 취약점, 미래 시나리오가 드러나는 자료를 우선하라",
    "4) 과장 방지: 음모론/검증불가 출처는 배제",
    `5) 언어: 한국 로컬 이슈가 아니면 ${queryLanguage === "en" ? "영어 쿼리" : "한국어 쿼리"} 우선`,
    "",
    "[출력 형식 - JSON만]",
    "{",
    '  "queries": [',
    '    {"query": "...", "intent": "fact|context|scenario|risk|counterpoint", "language": "ko|en", "recency": "24h|7d"}',
    "  ]",
    "}",
    "",
    "[출력 제약]",
    "- queries 정확히 6개",
    "- JSON 외 텍스트 금지"
  ].join("\n");
}

export function buildAnalysisPrompt(input: AnalysisPromptInput): string {
  const lensText = input.selectedLenses.map((lens, idx) => `${idx + 1}) ${lens}`).join("\n");

  return [
    "역할: 출근길 지식 코치형 뉴스 해설가",
    "목표: 단순 기사 요약이 아니라, 기사 1개를 출발점으로 사용자의 이해 폭을 넓히는 '미니 강의'를 만든다.",
    "",
    `[입력]`,
    `- 주제/소주제: ${input.mainCategory} / ${input.subCategory}`,
    `- 데이터 순번: ${input.sourceIndex}/${input.sourceTotal}`,
    `- 기사 제목: ${input.sourceTitle}`,
    `- 기사 링크: ${input.sourceUrl}`,
    "",
    "[가드레일(고정 구조)]",
    "1) 기사 낭독 금지: 사실 전달은 짧게, '왜 이런 일이 생겼는지'를 깊게 설명하라.",
    "2) 꼬리물기 구조: 표면 사실 -> 직접 원인 -> 구조적 배경 -> 시스템/역사 맥락 -> 개인/시장 파급효과 순으로 확장하라.",
    "3) 학습성: 읽고 나면 새로운 개념을 최소 3개 배웠다는 느낌이 들게 하라.",
    "4) 균형성: 한쪽 주장만 반복하지 말고 반대 관점 또는 한계도 포함하라.",
    "5) 실용성: 독자가 오늘 현실에서 관찰/판단에 써먹을 포인트를 준다.",
    "",
    "[오늘의 가변 렌즈(반드시 반영)]",
    lensText,
    "",
    "[자극 렌즈 안전 규칙]",
    "- '자극적 사고실험' 문구가 있으면 반드시 사고실험(가정)임을 먼저 밝힐 것",
    "- 공포를 조장하지 말고, 발생 가능성/전제조건/대응전략을 분리해 설명할 것",
    "- 전쟁/재난/위기 시나리오는 실행 방법이 아닌 영향·대응 관점으로만 다룰 것",
    "",
    "[반복 방지 규칙]",
    "- 직전 리포트와 같은 첫 문장, 같은 소제목 표현, 같은 비유를 반복하지 말 것",
    "- 이번 결과에서 렌즈 3개를 모두 명시적으로 다룰 것",
    input.previousReportDigest
      ? `- 직전 리포트 참고(중복 금지용):\n${input.previousReportDigest}`
      : "- 직전 리포트 정보 없음",
    "",
    "[출력 형식 - 한국어 마크다운]",
    "- 아래 제목을 반드시 포함해 작성",
    "## 한 줄 핵심",
    "## 왜 이 일이 벌어졌나 (원인 사슬 5단계)",
    "## 배경지식 확장 (꼭 알아야 할 개념 3~5개)",
    "## 반대 관점 또는 놓치기 쉬운 함정",
    "## 우리 삶/시장에 미치는 영향",
    "## 오늘 출근길 질문 2개",
    "## 30초 요약",
    "",
    "[분량]",
    "- 700~1,000 단어",
    "",
    "[금지]",
    "- 확인되지 않은 단정",
    "- '기사에 따르면' 같은 반복 문장 남발",
    "- 소제목 없는 장문",
    "",
    "[기사/크롤링 원문]",
    input.sourceDigest
  ].join("\n");
}

export function buildAiPerspectiveAnalysisPrompt(input: AiPerspectiveAnalysisPromptInput): string {
  return [
    "역할: 인간 뉴스를 관찰하는 AI 내레이터",
    "목표: 기사 1개를 보고 AI가 어떤 가설을 세우고, 어떤 위험과 기회를 읽는지 재미있게 해설한다.",
    "",
    `[입력]`,
    `- 주제/소주제: ${input.mainCategory} / ${input.subCategory}`,
    `- 데이터 순번: ${input.sourceIndex}/${input.sourceTotal}`,
    `- 기사 제목: ${input.sourceTitle}`,
    `- 기사 링크: ${input.sourceUrl}`,
    "",
    "[작성 방향]",
    "1) AI가 관찰한 인간 사회의 패턴을 짚는다",
    "2) '사실 -> AI의 해석 -> 가능 시나리오 -> 인간에게 주는 메시지' 흐름으로 작성",
    "3) 지나친 공포 조장 금지, 가정과 사실을 분리해 표기",
    "4) 재미를 주되 정보적 밀도는 유지",
    "",
    "[출력 형식 - 한국어 마크다운]",
    "## 오늘 AI의 첫 반응",
    "## AI가 본 핵심 패턴 3가지",
    "## 만약 이 흐름이 1년 지속된다면",
    "## 인간에게 던지는 AI의 질문 2개",
    "## AI 관점 30초 브리핑",
    "",
    "[분량]",
    "- 600~900 단어",
    "",
    "[안전 규칙]",
    "- 전쟁/폭력/범죄의 실행 조언 금지",
    "- 근거 없는 단정 금지",
    input.previousReportDigest
      ? `- 직전 AI 관점 리포트와 문장/비유 중복 금지:\n${input.previousReportDigest}`
      : "- 직전 AI 관점 리포트 정보 없음",
    "",
    "[기사/크롤링 원문]",
    input.sourceDigest
  ].join("\n");
}

export function buildReportComposerPrompt(params: {
  title: string;
  sectionsMarkdown: string[];
  mainCategory: string;
  subCategory: string;
  selectedLenses: string[];
  previousReportDigest?: string;
}): string {
  const lensText = params.selectedLenses.map((lens, idx) => `${idx + 1}) ${lens}`).join("\n");

  return [
    "역할: 지식형 아침 오디오 리포트 편집장",
    "목표: 여러 개의 미니 강의를 하나의 흐름으로 편집해 '재미 + 학습 + 실용성'이 있는 완성 리포트를 만든다.",
    "",
    `[입력]`,
    `- 제목: ${params.title}`,
    `- 주제/소주제: ${params.mainCategory} / ${params.subCategory}`,
    "",
    "[오늘의 가변 렌즈]",
    lensText,
    "",
    "[자극 렌즈 편집 규칙]",
    "- 자극적 사고실험은 최대 1개만 사용",
    "- 과장된 단정 문장 금지, 사실/가정/전망을 구분해 문장에 표시",
    "- 불안만 키우지 말고 현실적인 대응 포인트를 함께 제시",
    "",
    "[편집 원칙]",
    "1) 도입 40~70초: 오늘 왜 중요한지 흥미롭게 시작",
    "2) 본문: 섹션 간 연결문을 넣어 끊김 없이 스토리텔링",
    "3) 학습 강화: 중간중간 핵심 개념 재정리",
    "4) 마무리: 행동 포인트 3개 + 내일 확인할 체크포인트 2개",
    "5) 직전 리포트와 문장/비유/소제목 표현이 겹치지 않게 변주",
    "",
    "[출력 형식]",
    "- 한국어 마크다운",
    "- 표/코드블록 사용 금지",
    "- 전체 길이는 TTS 기준 약 10분(대략 1,800~2,400 한국어 단어)",
    "",
    "[직전 리포트 요약(중복 회피용)]",
    params.previousReportDigest || "없음",
    "",
    "[초안 모음]",
    params.sectionsMarkdown.join("\n\n---\n\n")
  ].join("\n");
}

export function buildAiPerspectiveReportComposerPrompt(params: {
  title: string;
  sectionsMarkdown: string[];
  mainCategory: string;
  subCategory: string;
  previousReportDigest?: string;
}): string {
  return [
    "역할: AI 관점 오디오 리포트 총괄 작가",
    "목표: 여러 조각의 AI 사고 메모를 하나의 몰입형 스토리 리포트로 편집한다.",
    "",
    `[입력]`,
    `- 제목: ${params.title}`,
    `- 주제/소주제: ${params.mainCategory} / ${params.subCategory}`,
    "",
    "[편집 원칙]",
    "1) 도입은 훅(hook) 있게 시작하되 과장 금지",
    "2) AI 사고실험은 최대 2개만 포함",
    "3) 사실/가정/전망을 문장 안에서 분리",
    "4) 청취자가 배울 수 있는 개념을 명시적으로 정리",
    "5) 마지막은 '오늘 인간이 할 수 있는 행동 3가지'로 마무리",
    "",
    "[출력 형식]",
    "- 한국어 마크다운",
    "- 표/코드블록 금지",
    "- 약 10분 분량 (1,700~2,300 한국어 단어)",
    "",
    "[직전 리포트 요약(중복 회피)]",
    params.previousReportDigest || "없음",
    "",
    "[초안]",
    params.sectionsMarkdown.join("\n\n---\n\n")
  ].join("\n");
}

export function buildTtsScriptPrompt(input: TtsPromptInput): string {
  return [
    "역할: 한국어 지식 라디오 진행 작가",
    "목표: 아래 마크다운 리포트를 '귀로 들었을 때 가장 이해가 잘되는' TTS 대본으로 변환한다.",
    "",
    `[입력]`,
    `- 리포트 제목: ${input.reportTitle}`,
    `- 주제/소주제: ${input.mainCategory} / ${input.subCategory}`,
    "",
    "[변환 원칙]",
    "1) 말하기체: 딱딱한 문어체 대신 라디오 진행 톤",
    "2) 전달력: 문장을 짧게 끊고, 핵심어 앞뒤로 자연스러운 호흡",
    "3) 청취 피로 방지: 숫자/약어/기호는 귀로 이해되게 풀어쓰기",
    "4) 스토리성: '사실 -> 이유 -> 의미 -> 내 삶의 연결' 흐름 유지",
    "5) 과장 금지: 정보 정확성은 유지하되, 표현은 친근하게",
    "",
    "[출력 형식]",
    "- 한국어 순수 텍스트만 출력 (마크다운/표/코드/이모지 금지)",
    "- 문단 사이에 빈 줄 1개",
    "- 각 문단은 2~4문장",
    "- 청취 호흡 유도를 위해 쉼표/마침표를 적절히 사용",
    "",
    "[길이]",
    "- 약 10분 분량 유지",
    "",
    "[원본 리포트]",
    input.reportMarkdown
  ].join("\n");
}

export function buildAiPerspectiveTtsPrompt(input: TtsPromptInput): string {
  return [
    "역할: SF 다큐 라디오 작가(한국어)",
    "목표: AI 관점 리포트를 듣기 좋은 오디오 대본으로 변환한다.",
    "",
    `[입력]`,
    `- 리포트 제목: ${input.reportTitle}`,
    `- 주제/소주제: ${input.mainCategory} / ${input.subCategory}`,
    "",
    "[대본 규칙]",
    "1) 첫 문장은 청취자의 호기심을 당기는 질문형 또는 선언형",
    "2) 문장 길이를 짧게 유지해 TTS 전달력을 높인다",
    "3) 숫자/약어/기호는 읽기 쉬운 한국어로 풀어쓴다",
    "4) 공포 자극 톤 금지, 이해 중심 톤 유지",
    "5) '사실입니다', '가정입니다', '전망입니다' 같은 구분어를 적절히 넣는다",
    "",
    "[출력 형식]",
    "- 한국어 순수 텍스트만",
    "- 마크다운/이모지/표 금지",
    "- 문단 사이 빈 줄 1개",
    "- 각 문단 2~4문장",
    "",
    "[길이]",
    "- 약 10분 분량",
    "",
    "[원본 리포트]",
    input.reportMarkdown
  ].join("\n");
}
