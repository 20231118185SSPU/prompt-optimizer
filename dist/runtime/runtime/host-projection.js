// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectAlignmentDecision = projectAlignmentDecision;
const ROUTE_ACTIONS = {
    pass: ['execute'],
    enrich: ['execute'],
    clarify: ['ask'],
    block: ['wait_confirmation', 'stop']
};
const ROUTE_VERDICTS = {
    pass: 'CLEAR',
    enrich: 'GRAY',
    clarify: 'VAGUE',
    block: 'HIGH'
};
function nextAction(decision) {
    const action = decision.next.action;
    if (!['execute', 'ask', 'wait_confirmation', 'stop'].includes(String(action))) {
        throw new Error(`Unsupported Alignment Decision next.action: ${String(action)}`);
    }
    const typedAction = action;
    if (!ROUTE_ACTIONS[decision.route].includes(typedAction)) {
        throw new Error(`Alignment Decision route/action conflict: ${decision.route}/${typedAction}`);
    }
    return typedAction;
}
function nestedString(container, key, nestedKey) {
    const nested = container[key];
    if (!nested || typeof nested !== 'object')
        return '';
    const value = nested[nestedKey];
    return typeof value === 'string' ? value : '';
}
function sourceLabel(source) {
    const kind = {
        user: '用户',
        project: '项目',
        runtime: '运行时',
        decision: '决策',
        default: '默认规则'
    }[source.kind];
    return `${kind}:${source.ref}`;
}
function receiptClaim(claim, prefix) {
    if (typeof claim.id !== 'string' || !claim.id.startsWith(prefix) || typeof claim.statement !== 'string') {
        return undefined;
    }
    if (!Array.isArray(claim.sources))
        return undefined;
    const sources = claim.sources.filter((source) => {
        if (!source || typeof source !== 'object')
            return false;
        const candidate = source;
        return typeof candidate.kind === 'string' && typeof candidate.ref === 'string';
    });
    return sources.length > 0 ? { id: claim.id, statement: claim.statement, sources } : undefined;
}
function buildEnrichmentReceipt(decision) {
    if (decision.route !== 'enrich')
        return undefined;
    const acceptanceClaim = decision.claims
        .map(claim => receiptClaim(claim, 'receipt-acceptance'))
        .find((claim) => Boolean(claim));
    const projectSources = (decision.appliedContext ?? [])
        .filter(source => source.kind === 'project' && source.ref !== '.align/check-commands.txt');
    const boundarySources = projectSources.length > 0
        ? projectSources
        : [{ kind: 'user', ref: 'request:text' }];
    const contextAddition = projectSources.length > 0
        ? `上下文注入：向执行提示词附加 ${projectSources.map(source => source.ref).join('、')}；只允许采用其中与当前请求相关的内容。`
        : '执行边界：把用户已声明的范围、恢复条件与授权固化为执行约束，未新增方向性决定。';
    const items = [
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
function renderEnrichmentReceipt(receipt) {
    const itemLines = receipt.items.map(item => `[${item.id}] ${item.addition} 来源：${item.sources.map(sourceLabel).join('、')}`);
    return [...itemLines, `撤销：回复“${receipt.undo.command}”。${receipt.undo.effect}`].join('\n');
}
function instructionsFor(decision, action, enrichmentReceipt) {
    if (action === 'execute') {
        if (enrichmentReceipt) {
            return `[对齐] route=enrich next.action=execute\n执行前向用户展示以下补全回执，然后直接执行，不等待确认。若实际采用上下文中的具体规则，必须在 B1 中列明规则及来源；若仅加载未采用，保留“上下文注入”表述，禁止把候选来源伪装成已采用规则：\n${renderEnrichmentReceipt(enrichmentReceipt)}\n执行规则：只执行 Alignment Decision scope.include，禁止扩大范围；完成后按 acceptance 验证，未验证不得交付。`;
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
function projectAlignmentDecision(decision) {
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
//# sourceMappingURL=host-projection.js.map
