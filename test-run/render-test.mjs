/**
 * テストレンダリングスクリプト
 * test-data.json → HTMLスライド生成 → Playwright PNG → ZIP
 */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMPL_DIR = join(__dirname, "..", "src", "templates");
const OUT_DIR = join(__dirname, "slides");
const CHROME_PATH = "/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome";

// テンプレート読み込み
const baseTmpl = readFileSync(join(TMPL_DIR, "base.html"), "utf-8");

// テストデータ読み込み
const data = JSON.parse(readFileSync(join(__dirname, "test-data.json"), "utf-8"));

mkdirSync(OUT_DIR, { recursive: true });

// ========== ヘルパー ==========

function wrapInBase(content, extraStyles, pageNumber) {
  return baseTmpl
    .replace("{{EXTRA_STYLES}}", extraStyles ? `<style>${extraStyles}</style>` : "")
    .replace("{{CONTENT}}", content)
    .replace("{{PAGE_NUMBER}}", String(pageNumber).padStart(2, "0"));
}

function pageHeader(sub, title, label) {
  return `
    <div class="page-header">
      <div class="page-header-sub">${sub}</div>
      <div class="page-header-row">
        <div class="page-header-title">${title}</div>
        <div class="page-header-label">${label}</div>
      </div>
      <div class="page-header-rule"></div>
    </div>`;
}

function sectionHeading(text, sub) {
  return `
    <div class="section-heading">
      <div class="section-heading-bar"></div>
      <div class="section-heading-text">${text}</div>
      ${sub ? `<div class="section-heading-sub">${sub}</div>` : ""}
    </div>`;
}

function menuItemRow(name, price, note) {
  let html = `<div class="menu-item-row">
    <div class="menu-item-name">${name}</div>
    <div class="menu-item-leader"></div>
    <div class="menu-item-price">${price || ""}</div>
  </div>`;
  if (note) {
    html += `<div class="menu-item-note">${note}</div>`;
  }
  return html;
}

// ========== スライド生成 ==========

const slides = [];

// --- Slide 1: タイトル ---
{
  const titleStyle = `
    .title-wrap { width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; position:relative; }
    .title-frame-tl { position:absolute; top:0; left:0; width:120px; height:120px; border-top:4px solid var(--accent); border-left:4px solid var(--accent); }
    .title-frame-br { position:absolute; bottom:0; right:0; width:120px; height:120px; border-bottom:4px solid var(--accent); border-right:4px solid var(--accent); }
    .title-shop-name { font-size:80px; font-weight:900; color:var(--text-primary); letter-spacing:0.08em; margin-bottom:28px; }
    .title-divider { width:160px; height:4px; background:var(--accent); margin-bottom:28px; }
    .title-area { font-size:40px; color:var(--text-sub); letter-spacing:0.05em; }
    .title-sub-label { font-size:32px; color:var(--text-muted); letter-spacing:0.12em; text-transform:uppercase; margin-top:20px; }
  `;
  const content = `
    <div class="title-wrap">
      <div class="title-frame-tl"></div>
      <div class="title-frame-br"></div>
      <div class="title-shop-name">${data.shop.name}</div>
      <div class="title-divider"></div>
      <div class="title-area">${data.shop.area}</div>
      <div class="title-sub-label">${data.shop.genre}</div>
    </div>`;
  slides.push(wrapInBase(content, titleStyle, 1));
}

// --- Slide 2: 店舗情報 ---
{
  const infoStyle = `
    .info-body { flex:1; display:flex; gap:40px; }
    .info-col { flex:1; display:flex; flex-direction:column; gap:16px; }
    .hours-card { background:var(--bg-card); border:1px solid var(--border); padding:28px 32px; flex:1; }
    .hours-block { display:flex; align-items:baseline; gap:16px; margin-bottom:16px; }
    .hours-block-bar { width:4px; min-height:60px; background:var(--accent); flex-shrink:0; align-self:stretch; }
    .hours-block-content { flex:1; }
    .hours-label { font-size:36px; font-weight:700; color:var(--text-primary); margin-bottom:4px; }
    .hours-time { font-size:48px; font-weight:700; color:var(--text-primary); }
    .closed-bar { text-align:center; padding:16px 0; border-top:1px solid var(--border); margin-top:auto; }
    .closed-value { font-size:44px; font-weight:700; color:var(--text-primary); }
    .closed-label { font-size:34px; color:var(--text-sub); }
    .closed-note { font-size:32px; color:var(--text-muted); margin-top:4px; }
    .info-card { background:var(--bg-card); border:1px solid var(--border); padding:20px 28px; }
    .info-card-label { font-size:32px; color:var(--text-muted); margin-bottom:6px; }
    .info-card-value { font-size:36px; font-weight:500; color:var(--text-primary); line-height:1.4; }
  `;

  let hoursHtml = "";
  for (const block of data.shop.hours_blocks) {
    hoursHtml += `
      <div class="hours-block">
        <div class="hours-block-bar"></div>
        <div class="hours-block-content">
          <div class="hours-label">${block.label}</div>
          <div class="hours-time">${block.time}</div>
        </div>
      </div>`;
  }

  const infoCards = [
    { label: "住所", value: data.shop.address },
    { label: "アクセス", value: data.shop.access },
    { label: "席数", value: data.shop.seats },
    { label: "駐車場", value: data.shop.parking },
    { label: "支払い", value: data.shop.payment },
    { label: "喫煙", value: data.shop.smoking },
  ];

  let cardsHtml = "";
  for (const card of infoCards) {
    cardsHtml += `
      <div class="info-card">
        <div class="info-card-label">${card.label}</div>
        <div class="info-card-value">${card.value}</div>
      </div>`;
  }

  const content = `
    ${pageHeader("SHOP INFORMATION", "店舗情報・営業時間", "ACCESS & HOURS")}
    <div class="info-body">
      <div class="info-col">
        ${sectionHeading("営業時間", "Business Hours")}
        <div class="hours-card">${hoursHtml}</div>
        <div class="closed-bar">
          <div class="closed-label">定休日:</div>
          <div class="closed-value">${data.shop.closed_days}</div>
          <div class="closed-note">${data.shop.closed_note}</div>
        </div>
      </div>
      <div class="info-col">
        ${sectionHeading("店舗情報", "Access & Info")}
        ${cardsHtml}
      </div>
    </div>`;
  slides.push(wrapInBase(content, infoStyle, 2));
}

// --- Menu slides ---
let pageNum = 3;

// スライド計画: カテゴリごとに分割
for (const cat of data.categories) {
  const isGrid = cat.layout === "grid";
  const isSet = cat.layout === "set";
  const isLimited = cat.limited;
  const items = cat.items;

  if (isGrid) {
    // グリッドレイアウト（トッピング）
    const gridStyle = `
      .grid-body { flex:1; display:flex; flex-direction:column; }
      .grid-container { display:grid; gap:20px; flex:1; grid-template-columns:repeat(3, 1fr); }
      .grid-card { background:var(--bg-card); border:1px solid var(--border); padding:28px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:12px; }
      .grid-card-name { font-size:40px; font-weight:700; color:var(--text-primary); }
      .grid-card-price { font-size:48px; font-weight:700; color:var(--text-primary); }
      .grid-card-price-unit { font-size:32px; font-weight:400; color:var(--text-sub); }
    `;

    let gridHtml = '<div class="grid-container">';
    for (const item of items) {
      const priceNum = item.price.replace(/[^0-9]/g, "");
      gridHtml += `
        <div class="grid-card">
          <div class="grid-card-name">${item.name}</div>
          <div class="grid-card-price">${priceNum}<span class="grid-card-price-unit">円</span></div>
        </div>`;
    }
    gridHtml += "</div>";

    const content = `
      ${pageHeader(cat.name_en, cat.name, "TOPPINGS / EXTRAS")}
      <div class="grid-body">${gridHtml}</div>`;
    slides.push(wrapInBase(content, gridStyle, pageNum++));

  } else if (isSet) {
    // セットメニュー（カード型）
    const setStyle = `
      .set-list { flex:1; display:flex; flex-direction:column; gap:16px; }
      .set-card { background:var(--bg-card); border:1px solid var(--border); border-left:4px solid var(--accent); padding:24px 30px; display:flex; justify-content:space-between; align-items:center; }
      .set-card-left { flex:1; }
      .set-card-name { font-size:38px; font-weight:700; color:var(--text-primary); }
      .set-card-desc { font-size:32px; color:var(--text-sub); margin-top:6px; }
      .set-card-right { text-align:right; flex-shrink:0; padding-left:24px; }
      .set-card-price { font-size:44px; font-weight:700; color:var(--text-primary); }
      .set-card-price-label { font-size:32px; color:var(--text-sub); }
    `;

    let setHtml = '<div class="set-list">';
    for (const item of items) {
      const isPlus = item.price.startsWith("+");
      setHtml += `
        <div class="set-card">
          <div class="set-card-left">
            <div class="set-card-name">${item.name}</div>
            ${item.note ? `<div class="set-card-desc">${item.note}</div>` : ""}
          </div>
          <div class="set-card-right">
            ${isPlus ? '<div class="set-card-price-label">麺類代に</div>' : ""}
            <div class="set-card-price">${item.price}</div>
          </div>
        </div>`;
    }
    setHtml += "</div>";

    const content = `
      ${pageHeader(cat.name_en, cat.name, "SET MENU")}
      ${setHtml}`;
    slides.push(wrapInBase(content, setStyle, pageNum++));

  } else {
    // リスト型メニュー（2カラム対応）
    const listStyle = `
      .menu-body { flex:1; display:flex; flex-direction:column; }
      .menu-columns { display:flex; gap:40px; flex:1; }
      .menu-col { flex:1; min-width:0; }
      .menu-category-block { background:var(--bg-card); border:1px solid var(--border); padding:24px 28px; margin-bottom:16px; }
      .menu-category-header { display:flex; align-items:center; gap:14px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border); }
      .menu-category-bar { width:4px; height:32px; background:var(--accent); flex-shrink:0; }
      .menu-category-name { font-size:40px; font-weight:700; color:var(--text-primary); }
      .menu-category-note { font-size:32px; color:var(--text-sub); padding:4px 0 8px 20px; }
      .menu-items { display:flex; flex-direction:column; }
      .limited-badge { display:inline-block; background:var(--accent); color:var(--bg-primary); font-size:32px; font-weight:700; padding:2px 14px; margin-left:12px; }
      .menu-tax-note { font-size:32px; color:var(--text-muted); text-align:right; margin-top:auto; padding-top:16px; }
    `;

    // 小さいカテゴリ同士は1枚にまとめる
    const maxItemsPerSlide = 12; // 2カラムなら6+6

    if (items.length <= maxItemsPerSlide) {
      // 1枚に収まる
      const mid = Math.ceil(items.length / 2);
      const leftItems = items.slice(0, mid);
      const rightItems = items.slice(mid);

      let leftHtml = leftItems.map(i => menuItemRow(i.name, i.price, i.note)).join("");
      let rightHtml = rightItems.map(i => menuItemRow(i.name, i.price, i.note)).join("");

      const headerLabel = isLimited ? "LIMITED MENU" : "FULL MENU LIST";
      const limitedBadge = isLimited ? '<span class="limited-badge">期間限定</span>' : '';

      const content = `
        ${pageHeader(cat.name_en, cat.name, headerLabel)}
        <div class="menu-body">
          <div class="menu-category-block">
            <div class="menu-category-header">
              <div class="menu-category-bar"></div>
              <div class="menu-category-name">${cat.name}${limitedBadge}</div>
            </div>
            ${cat.category_note ? `<div class="menu-category-note">${cat.category_note}</div>` : ""}
            <div class="menu-columns">
              <div class="menu-col"><div class="menu-items">${leftHtml}</div></div>
              <div class="menu-col"><div class="menu-items">${rightHtml}</div></div>
            </div>
          </div>
        </div>`;
      slides.push(wrapInBase(content, listStyle, pageNum++));
    } else {
      // 複数枚に分割
      const itemsPerPage = 10;
      const totalPages = Math.ceil(items.length / itemsPerPage);
      for (let p = 0; p < totalPages; p++) {
        const pageItems = items.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
        const mid = Math.ceil(pageItems.length / 2);
        const leftItems = pageItems.slice(0, mid);
        const rightItems = pageItems.slice(mid);

        let leftHtml = leftItems.map(i => menuItemRow(i.name, i.price, i.note)).join("");
        let rightHtml = rightItems.map(i => menuItemRow(i.name, i.price, i.note)).join("");

        const content = `
          ${pageHeader(cat.name_en, cat.name, "FULL MENU LIST")}
          <div class="menu-body">
            <div class="menu-category-block">
              <div class="menu-category-header">
                <div class="menu-category-bar"></div>
                <div class="menu-category-name">${cat.name}</div>
                <div style="margin-left:auto; font-size:32px; color:var(--text-muted);">(${p + 1}/${totalPages})</div>
              </div>
              ${p === 0 && cat.category_note ? `<div class="menu-category-note">${cat.category_note}</div>` : ""}
              <div class="menu-columns">
                <div class="menu-col"><div class="menu-items">${leftHtml}</div></div>
                <div class="menu-col"><div class="menu-items">${rightHtml}</div></div>
              </div>
            </div>
          </div>`;
        slides.push(wrapInBase(content, listStyle, pageNum++));
      }
    }
  }
}

// --- Ending slide ---
{
  const endStyle = `
    .ending-wrap { width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; position:relative; }
    .ending-rule-top { position:absolute; top:60px; left:0; right:0; height:2px; background:var(--border); }
    .ending-rule-bottom { position:absolute; bottom:100px; left:0; right:0; height:2px; background:var(--border); }
    .ending-message { font-size:56px; font-weight:700; color:var(--text-primary); letter-spacing:0.1em; margin-bottom:24px; }
    .ending-divider { width:120px; height:3px; background:var(--accent); margin-bottom:24px; }
    .ending-shop-info { position:absolute; bottom:120px; left:0; right:0; text-align:center; }
    .ending-shop-name { font-size:34px; font-weight:700; color:var(--accent); letter-spacing:0.15em; text-transform:uppercase; margin-bottom:8px; }
    .ending-thanks { font-size:32px; color:var(--text-muted); letter-spacing:0.1em; text-transform:uppercase; }
  `;
  const content = `
    <div class="ending-wrap">
      <div class="ending-rule-top"></div>
      <div class="ending-message">ご来店お待ちしています</div>
      <div class="ending-divider"></div>
      <div class="ending-shop-info">
        <div class="ending-shop-name">${data.shop.name_en}</div>
        <div class="ending-thanks">THANK YOU FOR WATCHING</div>
      </div>
      <div class="ending-rule-bottom"></div>
    </div>`;
  slides.push(wrapInBase(content, endStyle, pageNum));
}

// ========== Playwright レンダリング ==========

console.log(`Generated ${slides.length} slide HTMLs. Starting Playwright render...`);

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

for (let i = 0; i < slides.length; i++) {
  const page = await context.newPage();
  const htmlPath = join(OUT_DIR, `slide_${String(i + 1).padStart(3, "0")}.html`);
  const pngPath = join(OUT_DIR, `slide_${String(i + 1).padStart(3, "0")}.png`);

  // HTMLを保存（デバッグ用）
  writeFileSync(htmlPath, slides[i], "utf-8");

  await page.setContent(slides[i], { waitUntil: "load" });
  await page.waitForTimeout(200); // フォントレンダリング待ち
  await page.screenshot({ path: pngPath, fullPage: false });
  await page.close();

  console.log(`  slide_${String(i + 1).padStart(3, "0")}.png`);
}

await browser.close();

// ========== 集計 ==========
let totalItems = 0;
for (const cat of data.categories) {
  totalItems += cat.items.length;
}
console.log(`\nDone! ${slides.length} slides rendered.`);
console.log(`Total menu items: ${totalItems}`);
console.log(`Output: ${OUT_DIR}/`);
