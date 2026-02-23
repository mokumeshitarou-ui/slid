import { z } from "zod";

// --- ジャンルID ---

export const GenreIdSchema = z.enum([
  "machichuuka",
  "ramen",
  "kaisen",
  "yakiniku",
  "izakaya",
  "soba",
  "udon",
  "teishoku",
  "bento",
]);

export type GenreId = z.infer<typeof GenreIdSchema>;

// --- サブタイプ（タグ）定義 ---

/** ジャンルごとに許可されるサブタイプ */
export const SUBTYPE_MAP: Record<GenreId, readonly string[]> = {
  machichuuka: ["standard"],
  ramen: ["shoyu", "shio", "miso", "tonkotsu", "gyokai", "jiro", "iekei", "tantan", "tsukemen"],
  kaisen: ["sushi", "kaisendon", "robata"],
  yakiniku: ["standard", "hormone", "luxury"],
  izakaya: ["standard", "neo", "standing"],
  soba: ["standing", "oldshop", "modern", "heavy"],
  udon: ["standing", "oldshop", "modern", "heavy"],
  teishoku: ["family", "workers", "junk", "healthy", "teishoku_sake"],
  bento: ["budget", "karaage", "healthy", "gourmet"],
} as const;

// --- ジャンル判定結果（GenreResult） ---

export const GenreCandidateSchema = z.object({
  genre: GenreIdSchema,
  subtypes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
});

export const GenreSelectedSchema = z.object({
  genre: GenreIdSchema,
  subtypes: z.array(z.string()),
  selected_by: z.enum(["model", "user", "hint"]),
});

export const GenreResultSchema = z.object({
  candidates: z.array(GenreCandidateSchema).min(1).max(5),
  selected: GenreSelectedSchema,
});

// --- 型エクスポート ---

export type GenreCandidate = z.infer<typeof GenreCandidateSchema>;
export type GenreSelected = z.infer<typeof GenreSelectedSchema>;
export type GenreResult = z.infer<typeof GenreResultSchema>;
