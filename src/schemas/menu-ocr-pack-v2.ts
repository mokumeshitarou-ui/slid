/**
 * MENU_OCR_PACK_V2 - OCR抽出結果
 *
 * ルール:
 * - 原文のまま記録（推測・補完禁止）
 * - price_text は解釈しない（"800円(税込)" 等そのまま）
 * - 読めない箇所は needs_confirmation に積む
 * - カテゴリはメニュー表記載通り（再分類禁止）
 */

import { z } from "zod";

const EvidenceSchema = z.object({
  /** 元画像ファイル名 */
  source_image: z.string(),
  /** 画像内の位置ヒント（例: "左上", "2ページ目中央"） */
  location_hint: z.string(),
});

const MenuItemSchema = z.object({
  /** メニュー名（原文のまま） */
  item_name: z.string(),
  /** 価格テキスト（原文のまま、解釈しない） */
  price_text: z.string().nullable(),
  /** 注記テキスト（原文のまま） */
  note_text: z.string().nullable(),
  /** 限定フラグ（"期間限定" 等の記載がある場合 true） */
  limited_flag: z.boolean().default(false),
  /** 元画像の証跡 */
  evidence: EvidenceSchema,
  /** OCR読み取り信頼度 0.0-1.0 */
  confidence: z.number().min(0).max(1),
});

const CategorySchema = z.object({
  /** カテゴリ名（メニュー表記載通り） */
  category_name: z.string(),
  /** カテゴリ注記（あれば原文のまま） */
  category_note_text: z.string().nullable(),
  /** カテゴリ内のメニュー項目 */
  items: z.array(MenuItemSchema),
});

const NeedsConfirmationSchema = z.object({
  /** 問題の内容 */
  problem: z.string(),
  /** 元画像ファイル名 */
  source_image: z.string(),
  /** 画像内の位置ヒント */
  location_hint: z.string(),
  /** 修正候補（あれば） */
  suggested_fix: z.string().nullable(),
});

const CountsSchema = z.object({
  /** カテゴリ総数 */
  total_categories: z.number().int().min(0),
  /** メニュー項目総数 */
  total_items: z.number().int().min(0),
});

export const MenuOcrPackV2Schema = z.object({
  schema: z.literal("MENU_OCR_PACK_V2"),
  /** 税表記: included=税込, excluded=税抜, unknown=不明 */
  tax: z.enum(["included", "excluded", "unknown"]),
  /** 通貨 */
  currency: z.literal("JPY"),
  /** メニューカテゴリ一覧 */
  categories: z.array(CategorySchema),
  /** 要確認項目（OCRで読めない箇所等） */
  needs_confirmation: z.array(NeedsConfirmationSchema),
  /** 件数集計 */
  counts: CountsSchema,
});

export type MenuOcrPackV2 = z.infer<typeof MenuOcrPackV2Schema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
export type MenuCategory = z.infer<typeof CategorySchema>;
