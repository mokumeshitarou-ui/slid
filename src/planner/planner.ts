import { createHash } from "node:crypto";
import type { InputPack, MenuCategory, MenuItem } from "../schema/input-pack.js";
import type { ThemeTokens } from "../schema/theme-tokens.js";
import type {
  SlidePlan,
  SlideSpec,
  TitleSlide,
  InfoSlide,
  Menu1ColSlide,
  Menu2ColSlide,
  AddonSlide,
  SlideMenuItem,
} from "../schema/slide-plan.js";

// --- 定数 ---

/** 1COL メニューの1スライドあたり最大アイテム数（note なし） */
const MAX_ITEMS_1COL = 7;
/** 1COL メニューの note 付きアイテムがある場合のデフォルト */
const MAX_ITEMS_1COL_WITH_NOTES = 6;
/** 2COL の1列あたり最大アイテム数 */
const MAX_ITEMS_2COL = 6;
/** 特大表示の閾値 */
const ENLARGED_THRESHOLD = 3;
/** INFO スライドの最大行数 */
const MAX_INFO_ROWS = 8;
/** addons を INFO に統合する閾値 */
const ADDONS_INLINE_THRESHOLD = 3;
/** 2COL 採用条件: 商品名の最大全角文字数 */
const MAX_NAME_WIDTH_2COL = 10;
/** 2COL 採用条件: note 付き比率上限 */
const MAX_NOTE_RATIO_2COL = 0.2;

// --- ユーティリティ ---

function computeInputHash(input: InputPack): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return hash.slice(0, 16);
}

function generateRunId(): string {
  const now = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `run_${now}_${random}`;
}

/** 文字列の表示幅を推定（全角=2, 半角=1） */
function estimateWidth(s: string): number {
  let width = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    // ASCII + 半角カナ以外は全角扱い
    if (code <= 0x7e || (code >= 0xff61 && code <= 0xff9f)) {
      width += 1;
    } else {
      width += 2;
    }
  }
  return width;
}

/** note がある item は2行分としてカウント */
function countLines(items: MenuItem[]): number {
  return items.reduce((sum, item) => sum + (item.note ? 2 : 1), 0);
}

/** MenuItem → SlideMenuItem への変換 */
function toSlideMenuItem(item: MenuItem): SlideMenuItem {
  return {
    item_id: item.item_id,
    name: item.name,
    price_text: item.price_text,
    note: item.note,
    limited: item.limited,
  };
}

/** 税表示テキスト */
function taxDisplayText(tax: "included" | "excluded" | "unknown"): string | null {
  switch (tax) {
    case "included": return "税込表示";
    case "excluded": return "税別表示";
    case "unknown": return "税表記不明（店頭表記優先）";
  }
}

// --- SlidePlanner 本体 ---

export function planSlides(input: InputPack, theme: ThemeTokens): SlidePlan {
  const slides: SlideSpec[] = [];
  let slideIndex = 0;

  function nextSlideId(): string {
    slideIndex++;
    return `S${String(slideIndex).padStart(3, "0")}`;
  }

  // --- T0_TITLE ---
  const titleSlide: Omit<TitleSlide, "page"> = {
    slide_id: nextSlideId(),
    template: "T0_TITLE",
    payload: {
      shop_name: input.shop.name,
      area: input.shop.area,
    },
  };
  slides.push(titleSlide as TitleSlide);

  // --- T1_INFO ---
  const infoRows: { label: string; value: string }[] = [];

  if (input.shop.hours) infoRows.push({ label: "営業", value: input.shop.hours });
  if (input.shop.closed_days) infoRows.push({ label: "定休", value: input.shop.closed_days });
  if (input.shop.access) infoRows.push({ label: "アクセス", value: input.shop.access });
  if (input.shop.seats) infoRows.push({ label: "席数", value: input.shop.seats });
  if (input.shop.payment) infoRows.push({ label: "支払", value: input.shop.payment });
  if (input.shop.parking) infoRows.push({ label: "駐車", value: input.shop.parking });
  if (input.shop.phone) infoRows.push({ label: "電話", value: input.shop.phone });
  if (input.shop.address) infoRows.push({ label: "住所", value: input.shop.address });
  for (const note of input.shop.notes) {
    infoRows.push({ label: "備考", value: note });
  }

  // addons が 3行以下なら INFO に統合
  const inlineAddons = input.confirmed_addons.length <= ADDONS_INLINE_THRESHOLD
    ? input.confirmed_addons.map(a => ({ text: a.text }))
    : null;

  // INFO 行が MAX_INFO_ROWS を超える場合は分割
  const infoChunks: { label: string; value: string }[][] = [];
  for (let i = 0; i < infoRows.length; i += MAX_INFO_ROWS) {
    infoChunks.push(infoRows.slice(i, i + MAX_INFO_ROWS));
  }

  for (let i = 0; i < infoChunks.length; i++) {
    const isLast = i === infoChunks.length - 1;
    const infoSlide: Omit<InfoSlide, "page"> = {
      slide_id: nextSlideId(),
      template: "T1_INFO",
      payload: {
        rows: infoChunks[i]!,
        addons_section: isLast ? inlineAddons : null,
      },
    };
    slides.push(infoSlide as InfoSlide);
  }

  // --- T4_ADDONS（4行以上の場合） ---
  if (input.confirmed_addons.length > ADDONS_INLINE_THRESHOLD) {
    const addonSlide: Omit<AddonSlide, "page"> = {
      slide_id: nextSlideId(),
      template: "T4_ADDONS",
      payload: {
        rows: input.confirmed_addons.map(a => ({
          text: a.text,
          confirmed_by: a.confirmed_by,
          date: a.date,
        })),
      },
    };
    slides.push(addonSlide as AddonSlide);
  }

  // --- メニュースライド ---
  const taxDisplay = taxDisplayText(input.menu.tax);
  let totalItems = 0;

  const categories = input.menu.categories;

  for (let catIdx = 0; catIdx < categories.length; catIdx++) {
    const category = categories[catIdx]!;
    totalItems += category.items.length;

    // 2COL 検討: 次のカテゴリと組み合わせ可能か
    const nextCat = catIdx + 1 < categories.length ? categories[catIdx + 1]! : null;
    if (nextCat && canUse2Col(category, nextCat)) {
      // 2COL スライドを生成
      const slide2Col: Omit<Menu2ColSlide, "page"> = {
        slide_id: nextSlideId(),
        template: "T3_MENU_2COL",
        columns: [
          {
            header: {
              title: category.category_name,
              category_note: category.category_note,
            },
            payload: {
              category_id: category.category_id,
              items: category.items.map(toSlideMenuItem),
            },
          },
          {
            header: {
              title: nextCat.category_name,
              category_note: nextCat.category_note,
            },
            payload: {
              category_id: nextCat.category_id,
              items: nextCat.items.map(toSlideMenuItem),
            },
          },
        ],
        layout: {
          items_per_col: MAX_ITEMS_2COL,
          leader_style: "none",
          density: theme.density,
        },
        tax_display: taxDisplay,
      };
      slides.push(slide2Col as Menu2ColSlide);
      totalItems += nextCat.items.length;
      catIdx++; // 次のカテゴリをスキップ
      continue;
    }

    // 1COL: 特大表示かどうか
    const enlarged = category.items.length <= ENLARGED_THRESHOLD;

    if (enlarged) {
      // 特大表示: 1スライドに収める
      const slide1Col: Omit<Menu1ColSlide, "page"> = {
        slide_id: nextSlideId(),
        template: "T2_MENU_1COL",
        header: {
          title: category.category_name,
          category_note: category.category_note,
          scope_page: null,
        },
        payload: {
          category_id: category.category_id,
          items: category.items.map(toSlideMenuItem),
        },
        layout: {
          items_per_slide: category.items.length,
          leader_style: "none",
          density: theme.density,
          enlarged: true,
        },
        tax_display: taxDisplay,
      };
      slides.push(slide1Col as Menu1ColSlide);
    } else {
      // 通常分割
      const hasNotes = category.items.some(i => i.note !== null);
      const itemsPerSlide = hasNotes ? MAX_ITEMS_1COL_WITH_NOTES : MAX_ITEMS_1COL;
      const chunks = splitItems(category.items, itemsPerSlide);

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const scopePage = chunks.length > 1
          ? { index: chunkIdx + 1, total: chunks.length }
          : null;

        const slide1Col: Omit<Menu1ColSlide, "page"> = {
          slide_id: nextSlideId(),
          template: "T2_MENU_1COL",
          header: {
            title: category.category_name,
            category_note: category.category_note,
            scope_page: scopePage,
          },
          payload: {
            category_id: category.category_id,
            items: chunks[chunkIdx]!.map(toSlideMenuItem),
          },
          layout: {
            items_per_slide: itemsPerSlide,
            leader_style: "none",
            density: theme.density,
            enlarged: false,
          },
          tax_display: taxDisplay,
        };
        slides.push(slide1Col as Menu1ColSlide);
      }
    }
  }

  // --- ページ番号を付与 ---
  const totalSlides = slides.length;
  for (let i = 0; i < slides.length; i++) {
    (slides[i] as any).page = {
      global: { index: i + 1, total: totalSlides },
    };
  }

  return {
    run_id: generateRunId(),
    input_hash: computeInputHash(input),
    theme_id: String(theme.variant_id),
    total_slides: totalSlides,
    total_items: totalItems,
    slides,
  };
}

// --- 分割ヘルパー ---

/** note 付きアイテムの行数を考慮してチャンクに分割 */
function splitItems(items: MenuItem[], maxPerSlide: number): MenuItem[][] {
  const chunks: MenuItem[][] = [];
  let current: MenuItem[] = [];
  let lineCount = 0;

  for (const item of items) {
    const lines = item.note ? 2 : 1;
    if (lineCount + lines > maxPerSlide && current.length > 0) {
      chunks.push(current);
      current = [];
      lineCount = 0;
    }
    current.push(item);
    lineCount += lines;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/** 2カラム採用条件チェック */
function canUse2Col(cat1: MenuCategory, cat2: MenuCategory): boolean {
  // 両方6アイテム以下
  if (cat1.items.length > MAX_ITEMS_2COL || cat2.items.length > MAX_ITEMS_2COL) {
    return false;
  }

  // 全商品名が全角10文字以内
  const allItems = [...cat1.items, ...cat2.items];
  if (allItems.some(i => estimateWidth(i.name) > MAX_NAME_WIDTH_2COL * 2)) {
    return false;
  }

  // note 付き比率が20%以下
  const noteCount = allItems.filter(i => i.note !== null).length;
  if (noteCount / allItems.length > MAX_NOTE_RATIO_2COL) {
    return false;
  }

  return true;
}
