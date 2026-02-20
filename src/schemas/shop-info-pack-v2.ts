/**
 * SHOP_INFO_PACK_V2 - Web店情報
 *
 * ルール:
 * - 根拠URL必須（sources に記録）
 * - 矛盾は断定しない（conflicts に残す）
 * - メニュー情報は原則収集しない（事故防止）
 * - 最低2ソース照合
 */

import { z } from "zod";

const ShopSchema = z.object({
  /** 店名 */
  name: z.string(),
  /** 住所 */
  address: z.string().nullable(),
  /** アクセス（最寄り駅からの徒歩時間等） */
  access: z.string().nullable(),
  /** 営業時間 */
  hours: z.string().nullable(),
  /** 定休日 */
  closed_days: z.string().nullable(),
  /** 電話番号 */
  phone: z.string().nullable(),
  /** 支払い方法 */
  payment: z.string().nullable(),
  /** 駐車場情報 */
  parking: z.string().nullable(),
  /** 座席数 */
  seats: z.string().nullable(),
  /** 公式リンク */
  official_links: z.array(z.string()),
  /** 視聴者向け補足情報 */
  viewer_notes: z.array(z.string()),
});

const SlideCopySchema = z.object({
  /** 1行あたりの文字数目安 */
  line_length_guide: z.string(),
  /** スライド表示用の短縮テキスト行 */
  lines: z.array(z.string()),
});

const ConflictSchema = z.object({
  /** 矛盾のあるフィールド名 */
  field: z.string(),
  /** 各ソースで見つかった値 */
  values_found: z.array(z.string()),
  /** 補足メモ */
  note: z.string(),
  /** 情報源 */
  sources: z.array(z.string()),
});

const SourceSchema = z.object({
  /** ソース種別（Official / GBP / Tabelog / Gurunavi 等） */
  label: z.string(),
  /** URL */
  url: z.string(),
  /** このソースから取得した情報の種類 */
  used_for: z.array(z.string()),
});

export const ShopInfoPackV2Schema = z.object({
  schema: z.literal("SHOP_INFO_PACK_V2"),
  /** 調査日 */
  checked_at: z.string(),
  /** 店舗情報 */
  shop: ShopSchema,
  /** スライド表示用短縮コピー */
  slide_copy: SlideCopySchema,
  /** 矛盾情報（断定禁止、併記する） */
  conflicts: z.array(ConflictSchema),
  /** 情報源一覧（根拠URL必須） */
  sources: z.array(SourceSchema),
});

export type ShopInfoPackV2 = z.infer<typeof ShopInfoPackV2Schema>;
export type ShopInfo = z.infer<typeof ShopSchema>;
export type Conflict = z.infer<typeof ConflictSchema>;
