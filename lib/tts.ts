import fs from "node:fs/promises";
import path from "node:path";
import { getOpenAIClient } from "@/lib/openai";

export function markdownToTtsFriendlyText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\|/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[#>*_`~-]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function splitTextForTts(input: string, maxChars = 3200): string[] {
  if (input.length <= maxChars) {
    return [input];
  }

  const lines = input.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current} ${line}` : line;

    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (line.length <= maxChars) {
      current = line;
      continue;
    }

    for (let i = 0; i < line.length; i += maxChars) {
      const fragment = line.slice(i, i + maxChars);
      if (fragment.length === maxChars) {
        chunks.push(fragment);
      } else {
        current = fragment;
      }
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export async function generateKoreanTtsMp3(params: {
  reportId: string;
  title: string;
  markdown: string;
}): Promise<{ ttsText: string; relativePath: string }> {
  const client = getOpenAIClient();
  const ttsText = markdownToTtsFriendlyText(`# ${params.title}\n\n${params.markdown}`);
  const chunks = splitTextForTts(ttsText);
  const audioBuffers: Buffer[] = [];

  for (const chunk of chunks) {
    const audioResponse = await client.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: "alloy",
      input: chunk,
      response_format: "mp3"
    });

    const buffer = Buffer.from(await audioResponse.arrayBuffer());
    audioBuffers.push(buffer);
  }

  const mergedBuffer = Buffer.concat(audioBuffers);

  const configuredDir = process.env.TTS_STORAGE_DIR?.trim();
  const storageDir = configuredDir
    ? path.isAbsolute(configuredDir)
      ? configuredDir
      : path.join(process.cwd(), configuredDir)
    : path.join(process.cwd(), "storage", "tts");
  const absolutePath = path.join(storageDir, `${params.reportId}.mp3`);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, mergedBuffer);

  return { ttsText, relativePath: absolutePath };
}
