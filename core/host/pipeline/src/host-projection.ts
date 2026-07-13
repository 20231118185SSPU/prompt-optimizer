import { AlignmentDecision } from './contract-builder';
import { SourceRef } from './analyzer';

export type CompatibilityVerdict = 'HIGH' | 'VAGUE' | 'GRAY' | 'CLEAR';
export type HostNextAction = 'execute' | 'ask' | 'wait_confirmation' | 'stop';

export interface HostProjection {
  verdict: CompatibilityVerdict;
  instructions: string;
  nextAction: HostNextAction;
  shouldBlock: boolean;
  enrichmentReceipt?: EnrichmentReceipt;
  enrichmentUndo?: EnrichmentUndo;
}

export interface EnrichmentReceiptItem {
  id: `B${number}`;
  addition: string;
  sources: SourceRef[];
}

export interface EnrichmentReceipt {
  items: EnrichmentReceiptItem[];
  undo: {
    command: string;
    effect: string;
  };
}

export interface EnrichmentUndo {
  ids: string[];
}

const ROUTE_ACTIONS: Record<AlignmentDecision['route'], HostNextAction[]> = {
  pass: ['execute'],
  enrich: ['execute'],
  clarify: ['ask'],
  block: ['wait_confirmation', 'stop']
};

const ROUTE_VERDICTS: Record<AlignmentDecision['route'], CompatibilityVerdict> = {
  pass: 'CLEAR',
  enrich: 'GRAY',
  clarify: 'VAGUE',
  block: 'HIGH'
};

function nextAction(decision: AlignmentDecision): HostNextAction {
  const action = decision.next.action;
  if (!['execute', 'ask', 'wait_confirmation', 'stop'].includes(String(action))) {
    throw new Error(`Unsupported Alignment Decision next.action: ${String(action)}`);
  }

  const typedAction = action as HostNextAction;
  if (!ROUTE_ACTIONS[decision.route].includes(typedAction)) {
    throw new Error(`Alignment Decision route/action conflict: ${decision.route}/${typedAction}`);
  }
  return typedAction;
}

function nestedString(container: Record<string, unknown>, key: string, nestedKey: string): string {
  const nested = container[key];
  if (!nested || typeof nested !== 'object') return '';
  const value = (nested as Record<string, unknown>)[nestedKey];
  return typeof value === 'string' ? value : '';
}

function sourceLabel(source: SourceRef): string {
  const kind = {
    user: '用户',
    project: '项目',
    runtime: '运行时',
    decision: '决策',
    default: '默认规则'
  }[source.kind];
  return `${kind}:${source.ref}`;
}

interface ReceiptClaim {
  id: string;
  statement: string;
  sources: SourceRef[];
}

function receiptClaim(claim: Record<string, unknown>, prefix: string): ReceiptClaim | undefined {
  if (typeof claim.id !== 'string' || !claim.id.startsWith(prefix) || typeof claim.statement !== 'string') {
    return undefined;
  }
  if (!Array.isArray(claim.sources)) return undefined;
  const sources = claim.sources.filter((source): source is SourceRef => {
    if (!source || typeof source !== 'object') return false;
    const candidate = source as Record<string, unknown>;
    return typeof candidate.kind === 'string' && typeof candidate.ref === 'string';
  });
  return sources.length > 0 ? { id: claim.id, statement: claim.statement, sources } : undefined;
}

function buildEnrichmentReceipt(decision: AlignmentDecision): EnrichmentReceipt | undefined {
  if (decision.route !== 'enrich') return undefined;

  const contextClaims = decision.claims
    .map(claim => receiptClaim(claim, 'receipt-context-'))
    .filter((claim): claim is ReceiptClaim => Boolean(claim));
  const acceptanceClaim = decision.claims
    .map(claim => receiptClaim(claim, 'receipt-acceptance'))
    .find((claim): claim is ReceiptClaim => Boolean(claim));
  const boundarySources: SourceRef[] = contextClaims.length > 0
    ? contextClaims.flatMap(claim => claim.sources)
    : [{ kind: 'user', ref: 'request:text' }];
  const contextAddition = contextClaims.length > 0
    ? `项目上下文：${contextClaims.map(claim => `${claim.sources.map(sourceLabel).join('、')} → ${claim.statement}`).join('；')}`
    : '执行边界：沿用用户请求中已声明的范围、恢复条件与授权。';
  const items: EnrichmentReceiptItem[] = [
    { id: 'B1', addition: contextAddition, sources: boundarySources }
  ];
  if (acceptanceClaim) {
    items.push({
      id: 'B2',
      addition: `验收：${acceptanceClaim.statement}`,
      sources: acceptanceClaim.sources
    });
  }

  return {
    items,
    undo: {
      command: '撤销补全 <ID>',
      effect: '立即停止沿用该项并重新分析；若已产生改动，先报告影响，未经确认不自动回滚。'
    }
  };
}

export function projectEnrichmentUndo(decision: AlignmentDecision, ids: string[]): HostProjection {
  return {
    verdict: ROUTE_VERDICTS[decision.route],
    nextAction: 'execute',
    shouldBlock: false,
    enrichmentUndo: { ids },
    instructions: `[补全撤销] ids=${ids.join(',')}\n1. 立即停止沿用当前会话最近一条补全回执中的这些项目；找不到对应回执时，只问用户粘贴该回执。\n2. 回到原始请求，排除已撤销项目后重新执行 analyze -> decide；禁止沿用旧决定直接继续。\n3. 若已产生改动，先报告受影响文件和状态；未经用户确认不得自动回滚。`
  };
}

function renderEnrichmentReceipt(receipt: EnrichmentReceipt): string {
  const itemLines = receipt.items.map(item =>
    `[${item.id}] ${item.addition} 来源：${item.sources.map(sourceLabel).join('、')}`
  );
  return [...itemLines, `撤销：回复“${receipt.undo.command}”。${receipt.undo.effect}`].join('\n');
}

function instructionsFor(
  decision: AlignmentDecision,
  action: HostNextAction,
  enrichmentReceipt?: EnrichmentReceipt
): string {
  if (action === 'execute') {
    if (enrichmentReceipt) {
      return `[对齐] route=enrich next.action=execute\n执行前向用户原样展示以下补全回执，然后直接执行，不等待确认：\n${renderEnrichmentReceipt(enrichmentReceipt)}\n执行规则：只执行 Alignment Decision scope.include，禁止扩大范围；完成后按 acceptance 验证，未验证不得交付。`;
    }
    return `[对齐] route=pass next.action=execute\n1. 按请求中已明确的目标、范围和约束直接执行。\n2. 只执行 Alignment Decision scope.include，禁止扩大范围。\n3. 完成后按 acceptance 验证；未验证不得交付。`;
  }

  if (action === 'ask') {
    const prompt = nestedString(decision.next, 'question', 'prompt');
    const recommendation = nestedString(decision.next, 'question', 'recommendedAnswer');
    return `[对齐] route=clarify next.action=ask\n停止执行，一次只问一个问题：${prompt}\n推荐答案：${recommendation}`;
  }

  if (action === 'wait_confirmation') {
    const prompt = nestedString(decision.next, 'requirement', 'prompt');
    return `[对齐] route=block next.action=wait_confirmation\n停止执行并等待明确确认：${prompt}\n确认后必须重新分析，禁止沿用旧决定直接执行。`;
  }

  const reason = typeof decision.next.reason === 'string' ? decision.next.reason : '策略禁止执行该操作。';
  return `[对齐] route=block next.action=stop\n停止执行：${reason}`;
}

export function projectAlignmentDecision(decision: AlignmentDecision): HostProjection {
  const action = nextAction(decision);
  const enrichmentReceipt = buildEnrichmentReceipt(decision);
  return {
    verdict: ROUTE_VERDICTS[decision.route],
    instructions: instructionsFor(decision, action, enrichmentReceipt),
    nextAction: action,
    shouldBlock: decision.host.enforcement.block === 'enforced' &&
      (action === 'wait_confirmation' || action === 'stop'),
    ...(enrichmentReceipt ? { enrichmentReceipt } : {})
  };
}
