import type { InputPack } from "../schema/input-pack.js";
import type { SlidePlan } from "../schema/slide-plan.js";

// --- QA 結果型 ---

export interface QACheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface QAReport {
  shopName: string;
  totalSlides: number;
  totalItems: number;
  checks: QACheck[];
  allPassed: boolean;
}

// --- 禁止文字パターン ---

const FORBIDDEN_CHARS_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu;

// --- チェック関数群 ---

/** 全件掲載チェック: item_id 集合比較 */
function checkAllItems(input: InputPack, plan: SlidePlan): QACheck {
  const inputIds = new Set(
    input.menu.categories.flatMap(c => c.items.map(i => i.item_id))
  );

  const planIds = new Set(
    plan.slides.flatMap(s => {
      if (s.template === "T2_MENU_1COL") return s.payload.items.map(i => i.item_id);
      if (s.template === "T3_MENU_2COL") return s.columns.flatMap(c => c.payload.items.map(i => i.item_id));
      return [];
    })
  );

  const missing = [...inputIds].filter(id => !planIds.has(id));
  const extra = [...planIds].filter(id => !inputIds.has(id));

  const passed = missing.length === 0 && extra.length === 0;
  let detail = `入力${inputIds.size}件 / 掲載${planIds.size}件`;
  if (missing.length > 0) detail += ` / 掲載漏れ: ${missing.join(", ")}`;
  if (extra.length > 0) detail += ` / 余分: ${extra.join(", ")}`;

  return { name: "全件掲載", passed, detail };
}

/** カテゴリ順チェック */
function checkCategoryOrder(input: InputPack, plan: SlidePlan): QACheck {
  const inputOrder = input.menu.categories.map(c => c.category_id);

  // SlidePlan からカテゴリ ID を出現順に抽出（重複除去）
  const planOrder: string[] = [];
  for (const slide of plan.slides) {
    if (slide.template === "T2_MENU_1COL") {
      const catId = slide.payload.category_id;
      if (!planOrder.includes(catId)) planOrder.push(catId);
    } else if (slide.template === "T3_MENU_2COL") {
      for (const col of slide.columns) {
        const catId = col.payload.category_id;
        if (!planOrder.includes(catId)) planOrder.push(catId);
      }
    }
  }

  const passed = JSON.stringify(inputOrder) === JSON.stringify(planOrder);
  const detail = passed
    ? "InputPack のカテゴリ順と一致"
    : `順序不一致: input=[${inputOrder.join(",")}] plan=[${planOrder.join(",")}]`;

  return { name: "カテゴリ順", passed, detail };
}

/** 禁止文字チェック */
function checkForbiddenChars(input: InputPack): QACheck {
  const issues: string[] = [];

  for (const cat of input.menu.categories) {
    for (const item of cat.items) {
      const nameMatch = item.name.match(FORBIDDEN_CHARS_REGEX);
      if (nameMatch) {
        issues.push(`${item.item_id}: 品名に禁止文字 "${nameMatch.join("")}"`);
      }
      if (item.note) {
        const noteMatch = item.note.match(FORBIDDEN_CHARS_REGEX);
        if (noteMatch) {
          issues.push(`${item.item_id}: 注記に禁止文字 "${noteMatch.join("")}"`);
        }
      }
    }
  }

  return {
    name: "禁止文字",
    passed: issues.length === 0,
    detail: issues.length === 0 ? "検知なし" : issues.join("; "),
  };
}

/** スライド数の妥当性チェック */
function checkSlideCount(plan: SlidePlan): QACheck {
  return {
    name: "スライド数",
    passed: plan.total_slides === plan.slides.length,
    detail: `total_slides=${plan.total_slides} / 実数=${plan.slides.length}`,
  };
}

// --- メインバリデーション ---

export function validatePlan(input: InputPack, plan: SlidePlan): QAReport {
  const checks = [
    checkAllItems(input, plan),
    checkCategoryOrder(input, plan),
    checkForbiddenChars(input),
    checkSlideCount(plan),
  ];

  return {
    shopName: input.shop.name,
    totalSlides: plan.total_slides,
    totalItems: plan.total_items,
    checks,
    allPassed: checks.every(c => c.passed),
  };
}

// --- RUN_REPORT.md 生成 ---

export function generateRunReport(
  input: InputPack,
  plan: SlidePlan,
  report: QAReport,
  overflowSlides: string[],
): string {
  const lines: string[] = [];

  lines.push("# 生成レポート");
  lines.push("");
  lines.push("## 基本情報");
  lines.push(`- 店名: ${input.shop.name}`);
  if (input.shop.area) lines.push(`- エリア: ${input.shop.area}`);
  lines.push(`- ジャンル: ${input.genre_hint ?? "(未判定)"}`);
  lines.push(`- テーマID: ${plan.theme_id}`);
  lines.push(`- 生成スライド数: ${plan.total_slides}枚`);
  lines.push(`- メニュー掲載数: ${plan.total_items}品`);
  lines.push(`- run_id: ${plan.run_id}`);
  lines.push(`- input_hash: ${plan.input_hash}`);
  lines.push("");

  lines.push("## QA結果");
  for (const check of report.checks) {
    const status = check.passed ? "OK" : "NG";
    lines.push(`- ${check.name}: ${status} (${check.detail})`);
  }
  lines.push("");

  if (overflowSlides.length > 0) {
    lines.push("## overflow 検知");
    for (const slideId of overflowSlides) {
      lines.push(`- ${slideId}: overflow 検知`);
    }
    lines.push("");
  }

  if (input.input_source === "ocr") {
    const needsConf = input.menu.categories.flatMap(c =>
      c.items.filter(i => i.needs_confirmation)
    );
    lines.push("## OCR確認状況");
    lines.push(`- 入力方法: OCR`);
    lines.push(`- 要確認件数: ${needsConf.length}件`);
    const confirmed = needsConf.filter(i => i.user_confirmed).length;
    lines.push(`- 確認済み: ${confirmed}/${needsConf.length}件`);
    lines.push("");
  }

  lines.push("## スライド一覧");
  for (const slide of plan.slides) {
    const pageStr = `${String(slide.page.global.index).padStart(2, "0")}/${String(slide.page.global.total).padStart(2, "0")}`;
    let desc = slide.template;
    if (slide.template === "T2_MENU_1COL") {
      desc += ` - ${slide.header.title} (${slide.payload.items.length}品)`;
    } else if (slide.template === "T3_MENU_2COL") {
      desc += ` - ${slide.columns[0].header.title} + ${slide.columns[1].header.title}`;
    }
    lines.push(`- ${slide.slide_id} [${pageStr}] ${desc}`);
  }

  return lines.join("\n");
}
