import { GoogleGenAI } from "@google/genai";
import { GeneratedSlidesSchema, type GeneratedSlides } from "../schema/gemini-output.js";
import type { SlideDataPack } from "../schema/slide-data.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";

const MODEL = "gemini-2.5-pro";

export interface GenerateOptions {
  apiKey: string;
  model?: string;
}

/**
 * Gemini API を使ってスライドデータから HTML/CSS を生成する
 */
export async function generateSlides(
  data: SlideDataPack,
  options: GenerateOptions
): Promise<GeneratedSlides> {
  const ai = new GoogleGenAI({ apiKey: options.apiKey });

  const systemPrompt = buildSystemPrompt(data.meta);
  const userPrompt = buildUserPrompt(data);
  const model = options.model ?? MODEL;

  console.log(`[generator] Using model: ${model}`);
  console.log(`[generator] Generating ${data.slides.length} slides...`);

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini API returned empty response");
  }

  // JSON パース & Zod バリデーション
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON:\n${text.slice(0, 500)}`);
  }

  const result = GeneratedSlidesSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Gemini output validation failed:\n${result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`
    );
  }

  console.log(`[generator] Successfully generated ${result.data.slides.length} slides`);
  return result.data;
}
