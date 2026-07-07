/**
 * Signal Classifier for the Universal Align Pipeline.
 *
 * Detects risk, vague, specific, and educational signals in user instructions.
 * Ported from core/host/align-route.sh with identical signal dictionaries.
 */

export interface Classification {
  risk: number;
  vague: number;
  specific: number;
  edu: number;
}

// ── Signal dictionaries (bilingual, kept in sync with align-route.sh) ──

const RISK_SIGNALS: RegExp[] = [
  /删除/gi, /删掉/gi, /删库/gi, /清空/gi, /清库/gi, /清掉/gi,
  /重置/gi, /回滚/gi, /强推/gi, /上线/gi, /下线/gi, /停服/gi,
  /发版/gi, /部署到生产/gi, /生产环境/gi, /生产库/gi, /数据库迁移/gi,
  /格式化/gi, /抹掉/gi, /销毁/gi, /覆盖/gi,
  /drop\s+table/gi, /truncate/gi, /rm\s+-rf/gi,
  /reset\s+--hard/gi, /force\s+push/gi, /push\s+--force/gi,
  /rollback/gi, /production/gi, /db\s+migration/gi,
  /deploy\s+to\s+prod/gi, /destroy/gi, /format/gi,
];

const VAGUE_SIGNALS: RegExp[] = [
  /优化一下/gi, /优化下/gi, /优化/gi, /改进/gi, /完善/gi, /完善一下/gi,
  /提升一下/gi, /提升/gi, /处理一下/gi, /处理/gi, /看看/gi,
  /弄一下/gi, /弄好/gi, /搞一下/gi, /搞定/gi, /搞定它/gi,
  /修一下/gi, /修好/gi, /美化/gi, /改改/gi, /改一下/gi, /改下/gi,
  /调整一下/gi, /调整下/gi, /梳理一下/gi, /梳理下/gi,
  /整理一下/gi, /整理下/gi, /重构/gi, /升级/gi, /升级一下/gi, /增强/gi,
  /更好/gi, /更快/gi, /更优雅/gi, /更稳定/gi,
  /optimi[sz]e/gi, /improve/gi, /clean\s?up/gi, /polish/gi,
  /make\s+it\s+better/gi, /refactor/gi, /tweak/gi, /adjust/gi,
  /fix/gi, /enhance/gi, /upgrade/gi, /refine/gi, /rework/gi, /reorganize/gi,
  /做个/gi, /做一个/gi, /做一下/gi, /加个/gi, /加一个/gi, /加一下/gi,
  /写个/gi, /写一个/gi, /写一下/gi, /搞个/gi, /搞一个/gi,
  /弄个/gi, /弄一个/gi, /实现个/gi, /实现一个/gi, /实现一下/gi,
  /建个/gi, /建一个/gi, /新建一个/gi, /创建一个/gi,
];

const SPECIFIC_SIGNALS: RegExp[] = [
  // File paths with common extensions
  /[A-Za-z0-9_./\\-]+\.(sh|ps1|md|js|jsx|ts|tsx|py|json|yml|yaml|toml|go|rs|java|c|cpp|h|css|html|sql)/g,
  // Function call syntax: word()
  /[A-Za-z_][A-Za-z0-9_]*\(\)/g,
  // Chinese line reference: 第 N 行
  /第\s*[0-9]+\s*行/g,
  // English line reference: line N
  /line\s+[0-9]+/gi,
  // Colon-number suffix: :42
  /:[0-9]+\b/g,
];

const EDU_SIGNALS: RegExp[] = [
  /解释/gi, /什么是/gi, /介绍一下/gi, /翻译/gi,
  /explain/gi, /what\s+is/gi, /translate/gi,
];

// ── Text preprocessing ──

/** Strip fenced code blocks (```...```). */
function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '');
}

/** Strip inline code (`...`). */
function stripInlineCode(text: string): string {
  return text.replace(/`[^`]*`/g, '');
}

/** Strip quoted content: "…", "…", 「…」, 『…』. */
function stripQuoted(text: string): string {
  return text
    .replace(/"[^"]*"/g, '')
    .replace(/\u201C[^\u201D]*\u201D/g, '')
    .replace(/「[^」]*」/g, '')
    .replace(/『[^』]*』/g, '');
}

/**
 * Strip negation clauses.
 * '不要删除这个文件' → removes '不要删除这个文件' so risk signals inside
 * negated context are not counted.
 */
function stripNegation(text: string): string {
  const negationRe =
    /(不要|不得|不准|不能|别动|别去|禁止|避免|[Dd]o\s+[Nn]ot|[Dd]on'?t|[Nn]ever|[Aa]void)[^,，。;；.!?！？]*/g;
  return text.replace(negationRe, '');
}

/** Count all regex matches in text. */
function countMatches(text: string, patterns: RegExp[]): number {
  let count = 0;
  for (const re of patterns) {
    // Reset lastIndex for global regexes
    re.lastIndex = 0;
    const matches = text.match(re);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

// ── Public API ──

/**
 * Classify a user instruction into signal counts.
 *
 * Processing pipeline:
 * 1. Strip code blocks (```...```)
 * 2. Strip inline code (`...`)
 * 3. Strip quoted content ("...", "...", 「...」, 『...』)
 * 4. Strip negation clauses (不要|不得|…)
 * 5. Count risk signals on cleaned text
 * 6. Count vague signals on cleaned text
 * 7. Count specific signals on ORIGINAL text (file names are often quoted)
 * 8. Count educational signals on text after steps 1-3 (before negation strip)
 */
export function classify(instruction: string): Classification {
  if (!instruction) {
    return { risk: 0, vague: 0, specific: 0, edu: 0 };
  }

  // Steps 1-3: strip noise
  const stripped = stripQuoted(stripInlineCode(stripCodeBlocks(instruction)));

  // Step 4: strip negation
  const signalText = stripNegation(stripped);

  // Step 5-6: count on negation-stripped text
  const risk = countMatches(signalText, RISK_SIGNALS);
  const vague = countMatches(signalText, VAGUE_SIGNALS);

  // Step 7: specific signals on original text (file names live inside quotes/backticks)
  const specific = countMatches(instruction, SPECIFIC_SIGNALS);

  // Step 8: edu signals on noise-stripped text (before negation removal)
  const edu = countMatches(stripped, EDU_SIGNALS);

  return { risk, vague, specific, edu };
}
