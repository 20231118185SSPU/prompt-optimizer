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
function instructionsFor(decision, action) {
    if (action === 'execute') {
        const disclosure = decision.route === 'enrich'
            ? '先披露由可信上下文、约束或安全路由补全的内容，再按已确认范围执行。'
            : '按请求中已明确的目标、范围和约束直接执行。';
        return `[对齐] route=${decision.route} next.action=execute\n1. ${disclosure}\n2. 只执行 Alignment Decision scope.include，禁止扩大范围。\n3. 完成后按 acceptance 验证；未验证不得交付。`;
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
    return {
        verdict: ROUTE_VERDICTS[decision.route],
        instructions: instructionsFor(decision, action),
        nextAction: action,
        shouldBlock: decision.host.enforcement.block === 'enforced' &&
            (action === 'wait_confirmation' || action === 'stop')
    };
}
//# sourceMappingURL=host-projection.js.map
