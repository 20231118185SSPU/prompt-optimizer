import * as fs from 'node:fs';
import * as path from 'node:path';
import { SourceRef } from './analyzer';
import { TaskRoute } from './task-route';
import { isCodeTask, isDocumentationTask, isPerformanceTask } from './task-classification';

export type BriefField =
  | 'objective'
  | 'context'
  | 'scope'
  | 'deliverables'
  | 'constraints'
  | 'execution'
  | 'acceptance';

export type EvidenceFreshness = 'current' | 'stale' | 'unknown';
export type ContextIssue =
  | 'budget_exceeded'
  | 'source_outside_align'
  | 'source_too_large'
  | 'stale_evidence'
  | 'source_conflict'
  | 'policy_conflict';

export interface ResolvedContextEvidence {
  source: SourceRef;
  location: string;
  appliesTo: BriefField[];
  freshness: EvidenceFreshness;
  statement: string;
}

export interface ContextResolution {
  evidence: ResolvedContextEvidence[];
  issues: ContextIssue[];
  inspectedFiles: string[];
  totalCharacters: number;
}

interface CandidateEvidence extends ResolvedContextEvidence {
  order: number;
}

const MAX_EVIDENCE = 8;
const MAX_CHARACTERS = 6000;
const MAX_SOURCE_BYTES = 64 * 1024;
const CLASSIFIED_FILES = ['facts.md', 'glossary.md', 'state.md'] as const;
const GENERIC_CHINESE_TOKENS = new Set([
  '修改', '禁止', '不得', '不可', '不要', '必须', '文件', '内容',
  '任务', '项目', '执行', '操作', '进行', '完成', '用户', '请求',
  '删除', '新增', '增加', '生成', '发布', '上传', '编辑', '写入',
  '变更', '覆盖', '所有', '全部', '任何'
]);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function requestTokens(value: string): Set<string> {
  const normalized = value.toLowerCase();
  const words = normalized.match(/[a-z][a-z0-9_-]{2,}/g) ?? [];
  const pathWords = normalized.match(/[a-z0-9_-]+(?=[./\\])/g) ?? [];
  const chineseTokens = (normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? []).flatMap(run =>
    Array.from({ length: run.length - 1 }, (_, index) => run.slice(index, index + 2))
  ).filter(token => !GENERIC_CHINESE_TOKENS.has(token));
  return new Set([...words, ...pathWords, ...chineseTokens]);
}

function hardRuleClauses(statement: string): string[] {
  return statement
    .split(/[，。；;,.]/)
    .map(clause => clause.trim())
    .filter(clause => /(?:禁止|不得|不可|must\s+not|do\s+not)/i.test(clause));
}

function isUniversalWriteRule(clause: string): boolean {
  return /(?:禁止|不得|不可).{0,20}(?:修改|编辑|写入|删除|变更|生成|发布|上传).{0,12}(?:任何|所有|全部)/i.test(clause) ||
    /(?:禁止|不得|不可).{0,20}覆盖.{0,12}(?:任何|所有|全部)(?:文件|配置|内容|数据|记录)/i.test(clause) ||
    /(?:must\s+not|do\s+not).{0,20}(?:modify|edit|write|delete|change|publish|upload).{0,12}(?:any|all)/i.test(clause);
}

function hardRuleTargetOverlap(statement: string, instruction: string): boolean {
  const instructionTokens = requestTokens(instruction);
  return hardRuleClauses(statement).some(clause => {
    if (isUniversalWriteRule(clause)) return true;
    return [...requestTokens(clause)].some(token => instructionTokens.has(token));
  });
}

function appliesTo(statement: string): BriefField[] {
  const fields: BriefField[] = ['context'];
  if (/目标|对象|target|component|file|文件|函数|接口|parser/i.test(statement)) fields.push('objective');
  if (/范围|只限|只修改|不改|不得|禁止|scope|only|public\s+api|兼容/i.test(statement)) {
    fields.push('scope', 'constraints');
  }
  if (/交付|输出|格式|deliverable|markdown|report|报告/i.test(statement)) fields.push('deliverables');
  if (/必须|不得|禁止|约束|must|do\s+not|strict|权限|授权/i.test(statement)) fields.push('constraints');
  if (/步骤|流程|先.+再|workflow|runbook|执行/i.test(statement)) fields.push('execution');
  if (/测试|验证|验收|test|verify|check|benchmark|lint/i.test(statement)) fields.push('acceptance');
  return unique(fields);
}

function freshnessFor(file: string, content: string, now: Date): EvidenceFreshness {
  if (file !== 'state.md') return file === 'decisions.log.md' ? 'unknown' : 'current';
  const match = content.match(/updatedAt\s*:\s*`?(\d{4}-\d{2}-\d{2})/i);
  if (!match) return 'unknown';
  const updatedAt = new Date(`${match[1]}T00:00:00Z`).getTime();
  if (!Number.isFinite(updatedAt)) return 'unknown';
  return now.getTime() - updatedAt > 90 * 24 * 60 * 60 * 1000 ? 'stale' : 'current';
}

function isRelevant(statement: string, instruction: string, route: TaskRoute, file: string): boolean {
  if (hardRuleTargetOverlap(statement, instruction)) return true;
  const statementTokens = requestTokens(statement);
  const instructionTokens = requestTokens(instruction);
  if ([...statementTokens].some(token => instructionTokens.has(token))) return true;
  if (/所有任务|任何任务|全局规则|all tasks|always/i.test(statement)) return true;
  if (/(?:禁止|不得|不可).*(?:任何|所有|全部)/.test(statement)) return true;
  const codeRequest = isCodeTask(instruction);
  const documentationRequest = isDocumentationTask(instruction);
  const performanceRequest = isPerformanceTask(instruction);
  if (file === 'check-commands.txt') {
    if (performanceRequest && /benchmark|perf|p95/i.test(statement)) return true;
    if (codeRequest) {
      return /(?:^|\s)(?:(?:npm|pnpm|yarn)\s+(?:run\s+)?test\b|pytest\b|jest\b|vitest\b|tsc\b|ruff\b|go\s+test\b|cargo\s+test\b)|^echo\b/i.test(statement);
    }
    if (documentationRequest) {
      return /markdownlint|remark|vale|textlint|(?:^|\s)(?:rg|grep)\b|git\s+diff\s+--check/i.test(statement);
    }
  }
  if (file === 'lessons.md' || file === 'spec.md') {
    if (codeRequest && /\b(?:target|component|parser|public\s+api|compatible|compatibility|react|node|python|typescript|strict|test|verify|performance|p95|dependency|ui|i18n|button)\b|测试|类型|兼容|界面|按钮/i.test(statement)) {
      return true;
    }
    if ((route.primary === 'produce' || documentationRequest) && /markdown|documentation|heading|文档|写作|格式|标题|链接/i.test(statement)) return true;
    if (route.primary === 'operate' && /授权|权限|回滚|恢复|备份|runbook|生产|staging/i.test(statement)) return true;
  }
  return false;
}

function keyedStatement(statement: string): { key: string; value: string } | undefined {
  const match = statement.match(/^([^:：]{2,80})[:：]\s*(.+)$/);
  if (!match) return undefined;
  const key = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
  const value = match[2].trim().toLowerCase().replace(/\s+/g, ' ');
  return key && value ? { key, value } : undefined;
}

function conflictsWithHardRule(statement: string, instruction: string): boolean {
  if (!/(?:修改|改(?:为|成|动)?|编辑|写入|删除|变更|覆盖|生成|发布|上传|push|deploy)/i.test(instruction)) return false;
  const instructionTokenSet = requestTokens(instruction);
  return hardRuleClauses(statement).some(clause => {
    const sharedTarget = [...requestTokens(clause)].find(token => instructionTokenSet.has(token));
    const universal = isUniversalWriteRule(clause);
    if (!sharedTarget && !universal) return false;
    if (!sharedTarget) {
      return !/(?:不|不要|不得|禁止).{0,30}(?:修改|编辑|写入|删除|变更|覆盖|生成|发布|上传|push|deploy)/i.test(instruction);
    }
    const escaped = sharedTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp(`(?:不|不要|不得|禁止).{0,30}${escaped}`, 'i').test(instruction);
  });
}

function safeFile(
  alignDir: string,
  alignRealPath: string,
  file: string,
  issues: ContextIssue[]
): string | undefined {
  const candidate = path.join(alignDir, file);
  try {
    if (!fs.statSync(candidate).isFile()) return undefined;
    const realPath = fs.realpathSync(candidate);
    const relative = path.relative(alignRealPath, realPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      issues.push('source_outside_align');
      return undefined;
    }
    if (fs.statSync(realPath).size > MAX_SOURCE_BYTES) {
      issues.push('source_too_large');
      return undefined;
    }
    return realPath;
  } catch {
    return undefined;
  }
}

export function resolveAlignmentContext(
  projectDir: string,
  instruction: string,
  route: TaskRoute,
  now: Date = new Date()
): ContextResolution {
  const alignDir = path.join(projectDir, '.align');
  if (!fs.existsSync(alignDir)) {
    return { evidence: [], issues: [], inspectedFiles: [], totalCharacters: 0 };
  }

  let alignRealPath: string;
  try {
    alignRealPath = fs.realpathSync(alignDir);
  } catch {
    return { evidence: [], issues: [], inspectedFiles: [], totalCharacters: 0 };
  }

  const issues: ContextIssue[] = [];
  const inspectedFiles: string[] = [];
  const classifiedComplete = CLASSIFIED_FILES.every(file =>
    Boolean(safeFile(alignDir, alignRealPath, file, issues))
  );
  const files = [
    'lessons.md',
    'spec.md',
    ...CLASSIFIED_FILES,
    ...(classifiedComplete ? [] : ['context.md']),
    'decisions.log.md',
    'check-commands.txt'
  ];
  const candidates: CandidateEvidence[] = [];

  files.forEach((file, order) => {
    const filePath = safeFile(alignDir, alignRealPath, file, issues);
    if (!filePath) return;
    inspectedFiles.push(`.align/${file}`);
    const content = fs.readFileSync(filePath, 'utf8');
    const freshness = freshnessFor(file, content, now);
    content.split(/\r?\n/).forEach((rawLine, index) => {
      const statement = rawLine
        .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
        .trim();
      if (!statement || statement.startsWith('#') || statement.startsWith('>') || statement.startsWith('<!--')) {
        return;
      }
      if (!isRelevant(statement, instruction, route, file)) return;
      candidates.push({
        source: { kind: 'project', ref: `.align/${file}` },
        location: `line:${index + 1}`,
        appliesTo: appliesTo(statement),
        freshness,
        statement: statement.slice(0, 1000),
        order
      });
    });
  });

  const currentCandidates = candidates.filter(candidate => {
    if (candidate.freshness !== 'stale') return true;
    issues.push('stale_evidence');
    return false;
  });
  if (currentCandidates.some(candidate => conflictsWithHardRule(candidate.statement, instruction))) {
    issues.push('policy_conflict');
  }
  currentCandidates.sort((left, right) => left.order - right.order);
  const keyed = new Map<string, Set<string>>();
  for (const candidate of currentCandidates) {
    const entry = keyedStatement(candidate.statement);
    if (!entry) continue;
    const values = keyed.get(entry.key) ?? new Set<string>();
    values.add(entry.value);
    keyed.set(entry.key, values);
  }
  const conflictingKeys = new Set(
    [...keyed.entries()].filter(([, values]) => values.size > 1).map(([key]) => key)
  );
  if (conflictingKeys.size > 0) issues.push('source_conflict');
  const usableCandidates = currentCandidates.filter(candidate => {
    const entry = keyedStatement(candidate.statement);
    return !entry || !conflictingKeys.has(entry.key);
  });
  const evidence: ResolvedContextEvidence[] = [];
  let totalCharacters = 0;
  for (const candidate of usableCandidates) {
    if (evidence.length >= MAX_EVIDENCE || totalCharacters + candidate.statement.length > MAX_CHARACTERS) {
      issues.push('budget_exceeded');
      break;
    }
    const { order: _order, ...selected } = candidate;
    evidence.push(selected);
    totalCharacters += selected.statement.length;
  }

  return {
    evidence,
    issues: unique(issues),
    inspectedFiles,
    totalCharacters
  };
}
