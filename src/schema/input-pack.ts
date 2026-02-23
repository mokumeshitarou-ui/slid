import { z } from "zod";

// --- OCR 要確認理由コード ---

export const ConfirmationReasonSchema = z.enum([
  "LOW_CONFIDENCE",
  "MISSING_PRICE",
  "SUSPICIOUS_CHARS",
  "MAYBE_MERGED_TEXT",
]);

// --- メニュー項目 ---

export const MenuItemSchema = z.object({
  item_id: z.string().regex(/^item_\d+$/, "item_id は item_001 形式"),
  name: z.string().min(1),
  price_text: z.string().nullable(),
  note: z.string().nullable(),
  limited: z.boolean(),
  needs_confirmation: z.boolean(),
  confirmation_reasons: z.array(ConfirmationReasonSchema),
  user_confirmed: z.boolean(),
  ocr_confidence: z.number().min(0).max(1).nullable(),
  source_image_index: z.number().int().min(0),
  location_hint: z.string().nullable(),
});

// --- カテゴリ ---

export const MenuCategorySchema = z.object({
  category_id: z.string().regex(/^cat_\d+$/, "category_id は cat_001 形式"),
  category_name: z.string().min(1),
  category_note: z.string().nullable(),
  items: z.array(MenuItemSchema).min(1),
});

// --- メニュー ---

export const MenuSchema = z.object({
  tax: z.enum(["included", "excluded", "unknown"]),
  categories: z.array(MenuCategorySchema).min(1),
});

// --- 店舗情報 ---

export const ShopSchema = z.object({
  name: z.string().min(1),
  area: z.string().nullable(),
  address: z.string().nullable(),
  access: z.string().nullable(),
  hours: z.string().nullable(),
  closed_days: z.string().nullable(),
  phone: z.string().nullable(),
  payment: z.string().nullable(),
  parking: z.string().nullable(),
  seats: z.string().nullable(),
  notes: z.array(z.string()),
});

// --- 追記 ---

export const ConfirmedAddonSchema = z.object({
  text: z.string().min(1),
  confirmed_by: z.enum(["shop", "user"]),
  date: z.string(),
});

// --- InputPack ルート ---

export const InputPackSchema = z.object({
  schema: z.literal("INPUT_PACK_V1"),
  shop: ShopSchema,
  menu: MenuSchema,
  input_source: z.enum(["manual", "ocr"]),
  confirmed_addons: z.array(ConfirmedAddonSchema),
  genre_hint: z.string().nullable(),
});

// --- 型エクスポート ---

export type ConfirmationReason = z.infer<typeof ConfirmationReasonSchema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
export type MenuCategory = z.infer<typeof MenuCategorySchema>;
export type Menu = z.infer<typeof MenuSchema>;
export type Shop = z.infer<typeof ShopSchema>;
export type ConfirmedAddon = z.infer<typeof ConfirmedAddonSchema>;
export type InputPack = z.infer<typeof InputPackSchema>;
