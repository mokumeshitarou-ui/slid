import { z } from "zod";

// --- メニュー項目（描画用） ---

export const SlideMenuItemSchema = z.object({
  item_id: z.string(),
  name: z.string(),
  price_text: z.string().nullable(),
  note: z.string().nullable(),
  limited: z.boolean(),
});

// --- ページ番号 ---

const PageNumberSchema = z.object({
  index: z.number().int().min(1),
  total: z.number().int().min(1),
});

// --- スライド共通ベース ---

const SlideBaseSchema = z.object({
  slide_id: z.string().regex(/^S\d{3}$/),
  page: z.object({
    global: PageNumberSchema,
  }),
});

// --- T0_TITLE ---

export const TitleSlideSchema = SlideBaseSchema.extend({
  template: z.literal("T0_TITLE"),
  payload: z.object({
    shop_name: z.string(),
    area: z.string().nullable(),
  }),
});

// --- T1_INFO ---

export const InfoSlideSchema = SlideBaseSchema.extend({
  template: z.literal("T1_INFO"),
  payload: z.object({
    rows: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })),
    addons_section: z.array(z.object({
      text: z.string(),
    })).nullable(),
  }),
});

// --- T2_MENU_1COL ---

export const Menu1ColSlideSchema = SlideBaseSchema.extend({
  template: z.literal("T2_MENU_1COL"),
  header: z.object({
    title: z.string(),
    category_note: z.string().nullable(),
    scope_page: PageNumberSchema.nullable(),
  }),
  payload: z.object({
    category_id: z.string(),
    items: z.array(SlideMenuItemSchema),
  }),
  layout: z.object({
    items_per_slide: z.number().int().min(1),
    leader_style: z.enum(["none", "dash", "dot"]),
    density: z.enum(["tight", "normal"]),
    enlarged: z.boolean(),
  }),
  tax_display: z.string().nullable(),
});

// --- T3_MENU_2COL ---

const MenuColumnSchema = z.object({
  header: z.object({
    title: z.string(),
    category_note: z.string().nullable(),
  }),
  payload: z.object({
    category_id: z.string(),
    items: z.array(SlideMenuItemSchema),
  }),
});

export const Menu2ColSlideSchema = SlideBaseSchema.extend({
  template: z.literal("T3_MENU_2COL"),
  columns: z.tuple([MenuColumnSchema, MenuColumnSchema]),
  layout: z.object({
    items_per_col: z.number().int().min(1),
    leader_style: z.enum(["none", "dash", "dot"]),
    density: z.enum(["tight", "normal"]),
  }),
  tax_display: z.string().nullable(),
});

// --- T4_ADDONS ---

export const AddonSlideSchema = SlideBaseSchema.extend({
  template: z.literal("T4_ADDONS"),
  payload: z.object({
    rows: z.array(z.object({
      text: z.string(),
      confirmed_by: z.enum(["shop", "user"]),
      date: z.string(),
    })),
  }),
});

// --- SlideSpec union ---

export const SlideSpecSchema = z.discriminatedUnion("template", [
  TitleSlideSchema,
  InfoSlideSchema,
  Menu1ColSlideSchema,
  Menu2ColSlideSchema,
  AddonSlideSchema,
]);

// --- SlidePlan ルート ---

export const SlidePlanSchema = z.object({
  run_id: z.string(),
  input_hash: z.string().length(16),
  theme_id: z.string(),
  total_slides: z.number().int().min(1),
  total_items: z.number().int().min(0),
  slides: z.array(SlideSpecSchema).min(1),
});

// --- 型エクスポート ---

export type SlideMenuItem = z.infer<typeof SlideMenuItemSchema>;
export type TitleSlide = z.infer<typeof TitleSlideSchema>;
export type InfoSlide = z.infer<typeof InfoSlideSchema>;
export type Menu1ColSlide = z.infer<typeof Menu1ColSlideSchema>;
export type Menu2ColSlide = z.infer<typeof Menu2ColSlideSchema>;
export type AddonSlide = z.infer<typeof AddonSlideSchema>;
export type SlideSpec = z.infer<typeof SlideSpecSchema>;
export type SlidePlan = z.infer<typeof SlidePlanSchema>;
