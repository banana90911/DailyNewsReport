import { getRequiredEnv } from "@/lib/env";

export type FirecrawlSearchItem = {
  title: string;
  url: string;
  markdown: string;
  snippet?: string;
  publishedDate?: string;
};

type FirecrawlApiItem = {
  title?: string;
  url?: string;
  markdown?: string;
  description?: string;
  snippet?: string;
  publishedDate?: string;
  metadata?: {
    title?: string;
    publishedDate?: string;
  };
};

function normalizeItem(item: FirecrawlApiItem): FirecrawlSearchItem | null {
  const url = item.url?.trim();
  if (!url) {
    return null;
  }

  return {
    title: item.title || item.metadata?.title || "제목 없음",
    url,
    markdown: item.markdown || item.description || item.snippet || "",
    snippet: item.description || item.snippet,
    publishedDate: item.publishedDate || item.metadata?.publishedDate
  };
}

export async function searchLatestNews(query: string, limit = 8): Promise<FirecrawlSearchItem[]> {
  const apiKey = getRequiredEnv("FIRECRAWL_API_KEY");
  const apiUrl = (process.env.FIRECRAWL_API_URL || "https://api.firecrawl.dev/v1").replace(/\/$/, "");

  const response = await fetch(`${apiUrl}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: {
        formats: ["markdown"]
      },
      tbs: "qdr:d"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Firecrawl 검색 실패: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: FirecrawlApiItem[];
    results?: FirecrawlApiItem[];
  };

  const rawItems = payload.data ?? payload.results ?? [];
  const normalized = rawItems.map(normalizeItem).filter((item): item is FirecrawlSearchItem => Boolean(item));

  return normalized;
}
