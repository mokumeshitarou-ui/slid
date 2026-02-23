import type { GenreId } from "../schema/genre.js";

/**
 * ジャンル別許可パレット定義
 * design-spec.md セクション 5.3 に準拠
 */
export interface GenrePalette {
  bg: string[];
  accent: string[];
  header: string[];
  row: string[];
  pattern: string[];
  density: string[];
}

export const PALETTES: Record<GenreId, GenrePalette> = {
  machichuuka: {
    bg: ["#FAFAF5", "#F5F0E8", "#1B1B1B", "#2A1A1A"],
    accent: ["#C93A2F", "#D4443B", "#B5342C", "#E85D4A"],
    header: ["solid", "block"],
    row: ["alternating", "band"],
    pattern: ["none", "grain"],
    density: ["tight"],
  },

  ramen: {
    bg: ["#1A1A1A", "#0D0D0D", "#2B2B2B", "#FAFAFA"],
    accent: ["#E8572A", "#FF6B35", "#D94E1F", "#FFB800"],
    header: ["solid", "thick_line"],
    row: ["band", "thick_line"],
    pattern: ["none", "grain"],
    density: ["tight"],
  },

  kaisen: {
    bg: ["#FAFAFA", "#F0F5FA", "#FFFFFF"],
    accent: ["#1A5276", "#2471A3", "#5DADE2", "#1B4F72"],
    header: ["outline", "solid"],
    row: ["alternating", "none"],
    pattern: ["none"],
    density: ["normal"],
  },

  yakiniku: {
    bg: ["#1A1A1A", "#0D0D0D", "#2B1A1A"],
    accent: ["#E8372A", "#D4443B", "#FF4500", "#CC3300"],
    header: ["solid", "block"],
    row: ["band", "thick_line"],
    pattern: ["none", "grain"],
    density: ["tight"],
  },

  izakaya: {
    bg: ["#2A2A2A", "#1A2A1A", "#3A3A3A"],
    accent: ["#E8A52A", "#4CAF50", "#FF8C00", "#66BB6A"],
    header: ["solid", "block"],
    row: ["band", "alternating"],
    pattern: ["none", "dots"],
    density: ["tight"],
  },

  soba: {
    bg: ["#FAF5EE", "#F5F0E3", "#EDEDED"],
    accent: ["#2E7D32", "#3E8948", "#5D7B3E", "#4A6741"],
    header: ["outline", "thick_line"],
    row: ["alternating", "none"],
    pattern: ["none", "grain"],
    density: ["normal"],
  },

  udon: {
    bg: ["#FFFFFF", "#FAFAFA", "#F0F5FF"],
    accent: ["#1565C0", "#1976D2", "#2196F3", "#0D47A1"],
    header: ["solid", "outline"],
    row: ["alternating", "band"],
    pattern: ["none"],
    density: ["normal"],
  },

  teishoku: {
    bg: ["#1A1A1A", "#2B2B2B", "#FAFAFA", "#FFF8E1"],
    accent: ["#FFD700", "#E8572A", "#FF6B35", "#E88B2A", "#FF9800", "#F4A460"],
    header: ["solid", "block"],
    row: ["band", "alternating"],
    pattern: ["none", "grain"],
    density: ["tight"],
  },

  bento: {
    bg: ["#FFFFFF", "#FAFAFA", "#1A1A1A"],
    accent: ["#E8372A", "#D4443B", "#5D4037", "#6D4C41", "#8D6E63"],
    header: ["solid", "block"],
    row: ["alternating", "band"],
    pattern: ["none"],
    density: ["tight"],
  },
};
