import type { ThemeTokens } from "../schema/theme-tokens.js";
import type {
  SlideSpec,
  TitleSlide,
  InfoSlide,
  Menu1ColSlide,
  Menu2ColSlide,
  AddonSlide,
  SlideMenuItem,
} from "../schema/slide-plan.js";

// --- HTML エスケープ ---

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- ThemeTokens → CSS 変数 ---

function themeToCssVars(theme: ThemeTokens): string {
  return [
    `--bg: ${theme.colors.bg}`,
    `--fg: ${theme.colors.fg}`,
    `--accent: ${theme.colors.accent}`,
    `--accent-fg: ${theme.colors.accent_fg}`,
    `--muted: ${theme.colors.muted}`,
    `--radius: ${theme.radius}px`,
  ].join("; ");
}

// --- 背景パターン CSS ---

function patternCss(theme: ThemeTokens): string {
  if (theme.pattern === "none") return "";
  const opacity = theme.pattern_opacity;
  switch (theme.pattern) {
    case "dots":
      return `background-image: radial-gradient(circle, var(--muted) 1px, transparent 1px);
        background-size: 24px 24px; opacity: ${opacity};`;
    case "grain":
      return `background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        background-size: 200px 200px; opacity: ${opacity};`;
    case "stripes":
      return `background-image: repeating-linear-gradient(
        45deg, transparent, transparent 10px, var(--muted) 10px, var(--muted) 12px);
        opacity: ${opacity};`;
    default:
      return "";
  }
}

// --- ヘッダースタイル CSS ---

function headerStyleCss(theme: ThemeTokens): string {
  switch (theme.header_style) {
    case "solid":
      return `background: var(--accent); color: var(--accent-fg); padding: 12px 24px; border-radius: var(--radius);`;
    case "outline":
      return `border: 4px solid var(--accent); color: var(--accent); padding: 12px 24px; border-radius: var(--radius);`;
    case "thick_line":
      return `border-bottom: 6px solid var(--accent); color: var(--fg); padding: 12px 0;`;
    case "block":
      return `background: var(--accent); color: var(--accent-fg); padding: 16px 32px; border-radius: 0;`;
    default:
      return "";
  }
}

// --- 行スタイル CSS ---

function rowStyleCss(theme: ThemeTokens): string {
  switch (theme.row_style) {
    case "alternating":
      return `.menu-item:nth-child(even) { background: rgba(255,255,255,0.05); border-radius: var(--radius); }`;
    case "band":
      return `.menu-item { background: rgba(255,255,255,0.04); border-radius: var(--radius); margin-bottom: 4px; padding: 8px 16px; }`;
    case "thick_line":
      return `.menu-item { border-bottom: 4px solid rgba(255,255,255,0.1); padding-bottom: 8px; }`;
    case "none":
      return "";
    default:
      return "";
  }
}

// --- 共通 CSS ---

function baseCss(theme: ThemeTokens): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 1920px; height: 1080px;
      overflow: hidden;
      font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif;
      line-height: 1.25;
      background: var(--bg);
      color: var(--fg);
    }
    .safe-area {
      position: absolute;
      top: 54px; right: 96px; bottom: 54px; left: 96px;
      display: flex; flex-direction: column;
    }
    .page-number {
      position: absolute; bottom: 54px; right: 96px;
      font-size: 40px; font-weight: 500; color: var(--muted);
    }
    .pattern-overlay {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      ${patternCss(theme)}
    }
    .category-header {
      font-size: 72px; font-weight: 700;
      ${headerStyleCss(theme)}
      margin-bottom: 24px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .scope-page {
      font-size: 44px; font-weight: 500; opacity: 0.7;
    }
    .category-note {
      font-size: 44px; color: var(--muted); margin-bottom: 16px;
    }
    .menu-list {
      flex: 1; display: flex; flex-direction: column; gap: 8px;
    }
    .menu-item {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 24px; padding: 8px 0;
    }
    .item-name-block { flex: 1 1 auto; min-width: 0; }
    .item-name {
      font-size: 56px; font-weight: 500;
      word-break: break-word;
    }
    .item-price {
      font-size: 56px; font-weight: 700;
      flex: 0 0 auto; white-space: nowrap;
    }
    .item-note {
      font-size: 44px; color: var(--muted); margin-top: 2px;
      padding-left: 16px;
    }
    .limited-label {
      display: inline-block;
      background: var(--accent); color: var(--accent-fg);
      font-size: 36px; font-weight: 700;
      padding: 2px 12px; border-radius: var(--radius);
      margin-left: 12px; vertical-align: middle;
    }
    .tax-display {
      font-size: 44px; color: var(--muted); margin-top: auto; padding-top: 16px;
    }
    ${rowStyleCss(theme)}
  `;
}

// --- HTML ラッパー ---

function wrapHtml(theme: ThemeTokens, body: string, pageNumber: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<style>
:root { ${themeToCssVars(theme)} }
${baseCss(theme)}
</style>
</head>
<body>
${theme.pattern !== "none" ? '<div class="pattern-overlay"></div>' : ""}
<div class="safe-area">
${body}
</div>
${pageNumber}
</body>
</html>`;
}

function pageNumberHtml(slide: SlideSpec): string {
  if (slide.template === "T0_TITLE") return "";
  const { index, total } = slide.page.global;
  return `<div class="page-number">${String(index).padStart(2, "0")}/${String(total).padStart(2, "0")}</div>`;
}

// --- T0_TITLE ---

function renderTitle(slide: TitleSlide, theme: ThemeTokens): string {
  const body = `
    <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
      <div style="font-size:96px; font-weight:700; line-height:1.3; margin-bottom:24px;">
        ${esc(slide.payload.shop_name)}
      </div>
      ${slide.payload.area
        ? `<div style="font-size:56px; font-weight:500; color:var(--muted);">${esc(slide.payload.area)}</div>`
        : ""}
    </div>`;
  return wrapHtml(theme, body, pageNumberHtml(slide));
}

// --- T1_INFO ---

function renderInfo(slide: InfoSlide, theme: ThemeTokens): string {
  const rows = slide.payload.rows.map(r => `
    <div style="display:flex; gap:32px; padding:8px 0; font-size:54px; align-items:flex-start;">
      <div style="flex:0 0 auto; font-weight:700; min-width:180px; color:var(--accent);">${esc(r.label)}</div>
      <div style="flex:1 1 auto; font-weight:500;">${esc(r.value)}</div>
    </div>`).join("\n");

  const addons = slide.payload.addons_section
    ? `<div style="margin-top:32px; border-top:4px solid var(--accent); padding-top:16px;">
        <div style="font-size:48px; font-weight:700; color:var(--accent); margin-bottom:12px;">追記</div>
        ${slide.payload.addons_section.map(a => `
          <div style="font-size:44px; color:var(--muted); padding:4px 0;">${esc(a.text)}</div>
        `).join("\n")}
      </div>`
    : "";

  const body = `
    <div class="category-header" style="margin-bottom:32px;">
      <span>店舗情報</span>
    </div>
    <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
      ${rows}
      ${addons}
    </div>`;
  return wrapHtml(theme, body, pageNumberHtml(slide));
}

// --- メニューアイテム HTML ---

function menuItemHtml(item: SlideMenuItem, enlarged: boolean): string {
  const fontSize = enlarged ? "72px" : "56px";
  const priceFontSize = enlarged ? "72px" : "56px";
  const noteFontSize = enlarged ? "48px" : "44px";

  const limitedTag = item.limited
    ? `<span class="limited-label">期間限定</span>`
    : "";

  const noteRow = item.note
    ? `<div class="item-note" style="font-size:${noteFontSize};">${esc(item.note)}</div>`
    : "";

  if (enlarged) {
    // 特大: 中央配置
    return `
      <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; padding:16px 0;">
        <div style="font-size:${fontSize}; font-weight:700;">
          ${esc(item.name)}${limitedTag}
        </div>
        ${item.price_text
          ? `<div style="font-size:${priceFontSize}; font-weight:700; color:var(--accent);">${esc(item.price_text)}</div>`
          : ""}
        ${noteRow ? `<div style="font-size:${noteFontSize}; color:var(--muted);">${esc(item.note!)}</div>` : ""}
      </div>`;
  }

  return `
    <div class="menu-item">
      <div class="item-name-block">
        <div class="item-name">${esc(item.name)}${limitedTag}</div>
        ${noteRow}
      </div>
      ${item.price_text
        ? `<div class="item-price">${esc(item.price_text)}</div>`
        : ""}
    </div>`;
}

// --- T2_MENU_1COL ---

function renderMenu1Col(slide: Menu1ColSlide, theme: ThemeTokens): string {
  const scopePageText = slide.header.scope_page
    ? `<span class="scope-page">(${slide.header.scope_page.index}/${slide.header.scope_page.total})</span>`
    : "";

  const noteText = slide.header.category_note
    ? `<div class="category-note">${esc(slide.header.category_note)}</div>`
    : "";

  const items = slide.payload.items.map(
    item => menuItemHtml(item, slide.layout.enlarged)
  ).join("\n");

  const taxRow = slide.tax_display
    ? `<div class="tax-display">${esc(slide.tax_display)}</div>`
    : "";

  const body = slide.layout.enlarged
    ? `
      <div class="category-header">
        <span>${esc(slide.header.title)}</span>
        ${scopePageText}
      </div>
      ${noteText}
      <div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:16px;">
        ${items}
      </div>
      ${taxRow}`
    : `
      <div class="category-header">
        <span>${esc(slide.header.title)}</span>
        ${scopePageText}
      </div>
      ${noteText}
      <div class="menu-list">
        ${items}
      </div>
      ${taxRow}`;

  return wrapHtml(theme, body, pageNumberHtml(slide));
}

// --- T3_MENU_2COL ---

function renderMenu2Col(slide: Menu2ColSlide, theme: ThemeTokens): string {
  function colHtml(col: Menu2ColSlide["columns"][0]): string {
    const noteText = col.header.category_note
      ? `<div style="font-size:40px; color:var(--muted); margin-bottom:8px;">${esc(col.header.category_note)}</div>`
      : "";

    const items = col.payload.items.map(item => `
      <div class="menu-item">
        <div class="item-name-block">
          <div style="font-size:48px; font-weight:500;">${esc(item.name)}${item.limited ? '<span class="limited-label">期間限定</span>' : ""}</div>
          ${item.note ? `<div style="font-size:38px; color:var(--muted); padding-left:12px;">${esc(item.note)}</div>` : ""}
        </div>
        ${item.price_text ? `<div style="font-size:48px; font-weight:700; flex:0 0 auto; white-space:nowrap;">${esc(item.price_text)}</div>` : ""}
      </div>`).join("\n");

    return `
      <div style="flex:1; display:flex; flex-direction:column;">
        <div style="font-size:60px; font-weight:700; ${headerStyleCss(theme)} margin-bottom:16px;">
          ${esc(col.header.title)}
        </div>
        ${noteText}
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${items}
        </div>
      </div>`;
  }

  const taxRow = slide.tax_display
    ? `<div class="tax-display">${esc(slide.tax_display)}</div>`
    : "";

  const body = `
    <div style="flex:1; display:flex; gap:48px;">
      ${colHtml(slide.columns[0])}
      <div style="width:4px; background:rgba(255,255,255,0.1);"></div>
      ${colHtml(slide.columns[1])}
    </div>
    ${taxRow}`;

  return wrapHtml(theme, body, pageNumberHtml(slide));
}

// --- T4_ADDONS ---

function renderAddons(slide: AddonSlide, theme: ThemeTokens): string {
  const rows = slide.payload.rows.map(r => `
    <div style="display:flex; gap:16px; padding:12px 0; font-size:54px; align-items:flex-start;">
      <div style="flex:1; font-weight:500;">${esc(r.text)}</div>
      <div style="flex:0 0 auto; font-size:40px; color:var(--muted);">${esc(r.date)}</div>
    </div>`).join("\n");

  const body = `
    <div class="category-header" style="margin-bottom:32px;">
      <span>追記情報</span>
    </div>
    <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
      ${rows}
    </div>`;

  return wrapHtml(theme, body, pageNumberHtml(slide));
}

// --- エントリポイント ---

export interface RenderedSlide {
  slideId: string;
  html: string;
}

export function renderSlideSpec(slide: SlideSpec, theme: ThemeTokens): RenderedSlide {
  let html: string;
  switch (slide.template) {
    case "T0_TITLE":
      html = renderTitle(slide, theme);
      break;
    case "T1_INFO":
      html = renderInfo(slide, theme);
      break;
    case "T2_MENU_1COL":
      html = renderMenu1Col(slide, theme);
      break;
    case "T3_MENU_2COL":
      html = renderMenu2Col(slide, theme);
      break;
    case "T4_ADDONS":
      html = renderAddons(slide, theme);
      break;
  }
  return { slideId: slide.slide_id, html };
}

export function renderAllSlides(slides: SlideSpec[], theme: ThemeTokens): RenderedSlide[] {
  return slides.map(s => renderSlideSpec(s, theme));
}
