import { z } from "zod";

// --- ThemeTokens ---

export const ThemeColorsSchema = z.object({
  bg: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fg: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accent_fg: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  muted: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const ThemeTokensSchema = z.object({
  variant_id: z.number().int().min(1).max(5),
  variant_label: z.string().min(1),
  colors: ThemeColorsSchema,
  header_style: z.enum(["solid", "outline", "thick_line", "block"]),
  row_style: z.enum(["alternating", "band", "thick_line", "none"]),
  radius: z.union([
    z.literal(0),
    z.literal(8),
    z.literal(12),
    z.literal(16),
    z.literal(20),
  ]),
  pattern: z.enum(["none", "dots", "grain", "stripes"]),
  pattern_opacity: z.number().min(0.02).max(0.08),
  density: z.enum(["tight", "normal"]),
});

// --- 型エクスポート ---

export type ThemeColors = z.infer<typeof ThemeColorsSchema>;
export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
