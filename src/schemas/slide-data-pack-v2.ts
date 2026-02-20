/**
 * SLIDE_DATA_PACK_V2 - 統合データパック（唯一の正）
 *
 * ルール:
 * - このJSONだけを見てスライドを生成する
 * - MENU_OCR_PACK_V2 + SHOP_INFO_PACK_V2 + ユーザー確定情報を統合
 * - 禁止文字（絵文字/機種依存）は除去（意味は落とさない言い換え）
 * - 再現性のため必ず保存
 */

import { z } from "zod";
import { MenuOcrPackV2Schema } from "./menu-ocr-pack-v2.js";
import { ShopInfoPackV2Schema } from "./shop-info-pack-v2.js";

const CanvasSchema = z.object({
  /** アスペクト比 */
  ratio: z.literal("16:9"),
  /** 幅（px） */
  w: z.literal(1920),
  /** 高さ（px） */
  h: z.literal(1080),
  /** 安全領域マージン（%） */
  safe_margin_pct: z.literal(7),
});

const TypographySchema = z.object({
  /** フォント優先順 */
  font_family_preference: z.array(z.string()),
  /** 最小フォントサイズ（px） */
  min_font: z.number().int().min(32),
});

const StyleSchema = z.object({
  /** デザインの雰囲気キーワード */
  mood_keywords: z.array(z.string()),
  /** 写真禁止 */
  no_images: z.literal(true),
  /** アイコン禁止 */
  no_icons: z.literal(true),
  /** 細線禁止 */
  no_thin_lines: z.literal(true),
});

const ConfirmedAddonSchema = z.object({
  /** 追加テキスト */
  text: z.string(),
  /** 確認元: shop=店に確認, user=ユーザー入力 */
  confirmed_by: z.enum(["shop", "user"]),
  /** 確認日 */
  date: z.string(),
  /** 補足 */
  note: z.string().nullable(),
});

const QaCountsSchema = z.object({
  /** メニュー項目総数 */
  menu_total_items: z.number().int().min(0),
  /** メニューカテゴリ総数 */
  menu_total_categories: z.number().int().min(0),
  /** 要確認項目数 */
  needs_confirmation_count: z.number().int().min(0),
});

export const SlideDataPackV2Schema = z.object({
  schema: z.literal("SLIDE_DATA_PACK_V2"),
  /** キャンバス設定 */
  canvas: CanvasSchema,
  /** タイポグラフィ設定 */
  typography: TypographySchema,
  /** スタイル設定 */
  style: StyleSchema,
  /** 店舗情報（SHOP_INFO_PACK_V2.shop を取り込み） */
  shop_info: ShopInfoPackV2Schema.shape.shop,
  /** スライド表示用短縮コピー行 */
  shop_slide_copy_lines: z.array(z.string()),
  /** 矛盾情報 */
  conflicts: ShopInfoPackV2Schema.shape.conflicts,
  /** メニューデータ（MENU_OCR_PACK_V2 を取り込み） */
  menu: MenuOcrPackV2Schema,
  /** ユーザー/店確認済み追加情報 */
  confirmed_addons: z.array(ConfirmedAddonSchema),
  /** QA用件数集計 */
  qa: QaCountsSchema,
});

export type SlideDataPackV2 = z.infer<typeof SlideDataPackV2Schema>;
