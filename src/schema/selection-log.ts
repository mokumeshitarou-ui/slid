import { z } from "zod";
import { ThemeTokensSchema } from "./theme-tokens.js";

// --- SelectionLog（L0: MVP に含める） ---

export const SelectionLogSchema = z.object({
  run_id: z.string(),
  genre: z.string(),
  sub_types: z.array(z.string()),
  shop_name: z.string(),
  timestamp: z.string().datetime(),

  candidates: z.array(ThemeTokensSchema),

  action: z.enum(["selected", "rejected_all"]),
  selected_variant_id: z.number().int().nullable(),
  rejection_memo: z.string().nullable(),

  retry_count: z.number().int().min(0),
});

// --- 型エクスポート ---

export type SelectionLog = z.infer<typeof SelectionLogSchema>;
