export const MAIN_CATEGORIES = ["전체", "경제", "AI", "정치", "사회", "IT/과학", "직접 입력"] as const;

export type MainCategory = (typeof MAIN_CATEGORIES)[number];
export const NO_SUB_TOPIC = "없음";

const SUB_CATEGORY_MAP: Record<MainCategory, string[]> = {
  "전체": [],
  "경제": ["Hot", "전체", "주식", "국내 주식", "해외 주식", "암호화폐", "부동산", "직접 입력"],
  AI: ["Hot", "전체", "생성형 AI", "LLM", "로보틱스", "AI 정책", "AI 스타트업", "직접 입력"],
  "정치": ["Hot", "국내", "미국", "세계", "북한", "직접 입력"],
  "사회": ["Hot", "사건사고", "교육", "노동", "식품", "직접 입력"],
  "IT/과학": ["Hot", "모바일", "보안/해킹", "컴퓨터", "게임", "직접 입력"],
  "직접 입력": []
};

export function getSubCategoryOptions(mainCategory: MainCategory): string[] {
  return SUB_CATEGORY_MAP[mainCategory] ?? [];
}

export function normalizeCategoryValue(selected: string, customInput?: string): string {
  if (selected === "직접 입력") {
    return customInput?.trim() || "직접 입력";
  }
  return selected;
}

export function buildCategoryHelpText(mainCategory: string, subCategory: string): string {
  const normalizedSub = subCategory === NO_SUB_TOPIC ? "" : subCategory;
  const key = normalizedSub ? `${mainCategory}-${normalizedSub}` : mainCategory;

  const map: Record<string, string> = {
    "경제-Hot": "최신 핫한 경제 뉴스 리포트 생성",
    "경제-New": "방금 올라온 경제 뉴스를 빠르게 요약 분석",
    "경제-국내 주식": "국내 주식 시장 흐름과 핵심 종목 이슈 분석",
    "경제-해외 주식": "해외 주식 시장 변동성과 매크로 이슈 해설",
    "경제-암호화폐": "암호화폐 시장 급등락 원인과 리스크 포인트 정리",
    "AI-Hot": "가장 주목받는 AI 뉴스와 산업 파급력 분석",
    "AI-LLM": "LLM 중심 기술 업데이트와 활용 관점 해설",
    "정치-국내": "국내 정치 흐름과 쟁점을 맥락 중심으로 정리",
    "사회-사건사고": "주요 사건사고 이슈와 구조적 배경을 해설",
    "IT/과학-보안/해킹": "보안 위협과 기술 이슈를 핵심만 요약 분석",
    "Hot-Hot": "가장 뜨거운 최신 이슈를 맥락 중심으로 정리",
    "전체": "전 분야 핵심 뉴스를 균형 있게 요약",
    "직접 입력": "직접 입력한 주제를 중심으로 최신 뉴스를 정리"
  };

  if (map[key]) {
    return map[key];
  }

  if (!normalizedSub) {
    return `${mainCategory} 관련 최신 뉴스 리포트를 생성`;
  }

  return `${mainCategory}-${normalizedSub} 관련 최신 뉴스 리포트를 생성`;
}

export function toTopicLabel(value: string): string {
  if (value === "Hot") {
    return "🔥 Hot";
  }
  if (value === "New") {
    return "💡 New";
  }
  return value;
}

export function buildSetSummary(params: {
  mainCategory: string;
  subCategory: string;
  scheduleText: string;
  discordEnabled: boolean;
  aiPerspective: boolean;
}): string {
  const mainTopic = toTopicLabel(params.mainCategory);
  const subTopic = toTopicLabel(params.subCategory);
  const subTopicText =
    params.subCategory && params.subCategory !== NO_SUB_TOPIC ? ` -> ${subTopic}` : "";

  return `${mainTopic}${subTopicText} ${params.scheduleText}${
    params.discordEnabled ? " (디스코드 전송)" : ""
  }${params.aiPerspective ? " (AI 관점)" : ""}`;
}
