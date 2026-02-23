import type { ThemeTokens } from "../schema/theme-tokens.js";

/**
 * E2E テスト用の固定 ThemeTokens。
 * API 接続前に Planner → Renderer → QA のパイプラインを検証するために使う。
 */
export const DEFAULT_THEME: ThemeTokens = {
  variant_id: 1,
  variant_label: "町中華・赤看板",
  colors: {
    bg: "#1B1B1B",
    fg: "#FFFFFF",
    accent: "#C93A2F",
    accent_fg: "#FFFFFF",
    muted: "#AAAAAA",
  },
  header_style: "solid",
  row_style: "alternating",
  radius: 8,
  pattern: "none",
  pattern_opacity: 0.04,
  density: "tight",
};
