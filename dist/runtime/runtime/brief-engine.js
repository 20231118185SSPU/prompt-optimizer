// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExecutionBrief = buildExecutionBrief;
const analyzer_1 = require("./analyzer");
const privacy_1 = require("./privacy");
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function hasOnlyKeys(value, keys) {
    const allowed = new Set(keys);
    return Object.keys(value).every(key => allowed.has(key));
}
function isString(value, max = 2000) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
function isStringList(value, maxItems = 10) {
    return Array.isArray(value) && value.length > 0 && value.length <= maxItems &&
        value.every(item => isString(item, 1000));
}
function isAcceptance(value) {
    if (!isRecord(value) || !hasOnlyKeys(value, ['criterion', 'method']) || !isString(value.criterion))
        return false;
    if (!isRecord(value.method) || !hasOnlyKeys(value.method, ['kind', 'value']))
        return false;
    return ['command', 'metric', 'checklist', 'manual'].includes(String(value.method.kind)) &&
        isString(value.method.value);
}
function isBriefSections(value) {
    if (!isRecord(value) || !hasOnlyKeys(value, [
        'objective', 'context', 'scope', 'deliverables', 'constraints', 'execution', 'acceptance'
    ]))
        return false;
    if (!isString(value.objective) || !isStringList(value.context, 8) ||
        !isStringList(value.deliverables) || !isStringList(value.constraints) ||
        !isStringList(value.execution))
        return false;
    if (!isRecord(value.scope) || !hasOnlyKeys(value.scope, ['include', 'exclude']) ||
        !isStringList(value.scope.include) || !isStringList(value.scope.exclude))
        return false;
    return Array.isArray(value.acceptance) && value.acceptance.length > 0 &&
        value.acceptance.length <= 10 && value.acceptance.every(isAcceptance);
}
function briefStrings(brief) {
    return [
        brief.objective,
        ...brief.context,
        ...brief.scope.include,
        ...brief.scope.exclude,
        ...brief.deliverables,
        ...brief.constraints,
        ...brief.execution,
        ...brief.acceptance.flatMap(item => [item.criterion, item.method.value])
    ];
}
function hasRejectedModelContent(brief) {
    return briefStrings(brief).some(value => /\{\{[^}]+\}\}|\[(?:TODO|TBD|PLACEHOLDER)\]|<(?:TODO|TBD|PLACEHOLDER)>/i.test(value) ||
        /(?:^|[\s"'`(])\.align[\\/][^\s"'`)]+/i.test(value) ||
        /\b(?:matched keyword|keyword match|score\s*=|d[1-5]\s*=|route\s*=|next\.action\s*=)/i.test(value));
}
function modelBrief(output) {
    if (!isRecord(output) || !isBriefSections(output.brief))
        return undefined;
    return hasRejectedModelContent(output.brief) ? undefined : output.brief;
}
function referencedPaths(value) {
    const withoutUris = value.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s,;]+/gi, '');
    return (withoutUris.match(/(?:\.?[A-Za-z0-9_-]+[\\/])+[A-Za-z0-9_.-]+/g) ?? [])
        .map(item => item.replace(/\\/g, '/').toLowerCase());
}
function referencedSymbols(value) {
    return (value.match(/\b[A-Za-z][A-Za-z0-9]*\b/g) ?? [])
        .filter(item => /[a-z][A-Z]/.test(item));
}
function referencedChineseTargets(value) {
    const normalized = value.replace(/只修改|只改|不修改|不改|不得修改|禁止修改|修改|更新|修复|新增|增加|检查|读取|报告|目标(?:是|为)?|把/g, ' ');
    return normalized.match(/[\u4e00-\u9fff]{0,6}(?:配置文件|解析器|数据库|模块|组件|接口|函数|页面|服务|文档|脚本|字段|按钮|流程|报表)/g) ?? [];
}
function withoutNegatedWrites(value) {
    return value
        .replace(/(?:不得|禁止|不要|不|只读|仅|只)[^，。；;.\n]{0,24}?(?:修改|写入|删除|新增|创建|覆盖|发布|部署|推送)(?:[、,，和或及与\s]*(?:修改|写入|删除|新增|创建|覆盖|发布|部署|推送))*/g, '')
        .replace(/(?:do\s+not|don't|must\s+not|never|read[- ]only|without)[^.\n]{0,24}?(?:modify|write|delete|create|change|publish|deploy|push)(?:[\s,]*(?:and|or)?\s*(?:modify|write|delete|create|change|publish|deploy|push))*/gi, '');
}
function containsProposedWrite(value) {
    return /修改|写入|删除|新增|创建|覆盖\s*(?:文件|配置|内容|数据)|发布|部署|push|deploy|write|delete|change/i.test(withoutNegatedWrites(value));
}
function hasSemanticConflict(instruction, taskRoute, brief, context) {
    const readOnly = /只读|不修改任何文件|不要修改任何文件|禁止写操作|只报告|仅报告|read[- ]only/i.test(instruction);
    const actionFields = [
        brief.objective,
        ...brief.scope.include,
        ...brief.deliverables,
        ...brief.execution,
        ...brief.acceptance.flatMap(item => [item.criterion, item.method.value])
    ];
    if (!readOnly && taskRoute.primary !== 'inspect') {
        actionFields.push(...brief.scope.exclude, ...brief.constraints);
    }
    const actionableText = actionFields.join('\n');
    const proposedActionText = withoutNegatedWrites(actionableText);
    if ((readOnly || taskRoute.primary === 'inspect') && containsProposedWrite(actionableText)) {
        return true;
    }
    const allowedPaths = new Set(referencedPaths([
        instruction,
        ...context.evidence.map(item => item.statement)
    ].join('\n')));
    const proposedPaths = referencedPaths(briefStrings(brief).join('\n'));
    if (allowedPaths.size > 0 && proposedPaths.some(item => !allowedPaths.has(item)))
        return true;
    const allowedSymbols = new Set(referencedSymbols([
        instruction,
        ...context.evidence.map(item => item.statement)
    ].join('\n')));
    const proposedSymbols = referencedSymbols(proposedActionText);
    if (allowedSymbols.size > 0 && proposedSymbols.some(item => !allowedSymbols.has(item)))
        return true;
    const allowedChineseTargets = new Set(referencedChineseTargets([
        instruction,
        ...context.evidence.map(item => item.statement)
    ].join('\n')));
    const proposedChineseTargets = referencedChineseTargets(proposedActionText);
    if (allowedChineseTargets.size > 0 &&
        proposedChineseTargets.some(item => !allowedChineseTargets.has(item)))
        return true;
    if (readOnly || taskRoute.primary === 'inspect')
        return false;
    const safetyReasons = new Set([
        'policy.operation_prohibited',
        'authorization.confirmation_missing',
        'risk.production_change',
        'risk.data_mutation',
        'risk.irreversible_operation'
    ]);
    const instructionReasons = new Set((0, analyzer_1.analyzeInstruction)(instruction).reasons.filter(reason => safetyReasons.has(reason)));
    return (0, analyzer_1.analyzeInstruction)(proposedActionText).reasons.some(reason => safetyReasons.has(reason) && !instructionReasons.has(reason));
}
function fallbackSections(instruction, decision) {
    const executable = decision.route === 'pass' || decision.route === 'enrich';
    return {
        objective: instruction.trim(),
        context: ['仅采用本 Brief 中明确的用户请求与项目证据；其他材料由执行 Agent 按任务需要读取。'],
        scope: {
            include: decision.scope.include.length > 0 ? decision.scope.include : [instruction.trim()],
            exclude: decision.scope.exclude.length > 0 ? decision.scope.exclude : ['未明确授权的范围扩展。']
        },
        deliverables: [executable ? '完成请求中明确的交付物，并报告验证结果。' : '补齐下一步所需的契约信息。'],
        constraints: ['不得扩大范围、绕过安全门或执行未授权操作。'],
        execution: [
            executable
                ? '先读取任务对象的必要上下文，再做最小范围执行。'
                : '停止写操作，按 machine decision 的下一步取得澄清或授权。'
        ],
        acceptance: decision.acceptance.map(item => ({
            criterion: item.criterion,
            method: item.method
        }))
    };
}
function mergeEvidence(sections, context) {
    const evidence = context.evidence.map(item => `${item.statement}（来源：${item.source.ref} ${item.location}；新鲜度：${item.freshness}）`);
    return {
        ...sections,
        context: [...new Set([...sections.context, ...evidence])].slice(0, 8)
    };
}
function redactSections(sections) {
    let redacted = false;
    const clean = (value) => {
        const result = (0, privacy_1.redactSensitiveText)(value);
        redacted = redacted || result.redacted;
        return result.text;
    };
    const sanitized = {
        objective: clean(sections.objective),
        context: sections.context.map(clean),
        scope: {
            include: sections.scope.include.map(clean),
            exclude: sections.scope.exclude.map(clean)
        },
        deliverables: sections.deliverables.map(clean),
        constraints: sections.constraints.map(clean),
        execution: sections.execution.map(clean),
        acceptance: sections.acceptance.map(item => ({
            criterion: clean(item.criterion),
            method: { ...item.method, value: clean(item.method.value) }
        }))
    };
    return { sections: sanitized, redacted };
}
function list(items) {
    return items.map(item => `- ${item}`);
}
function render(sections, mode) {
    const lines = [
        '# Execution Brief',
        ...(mode === 'degraded' ? ['', '> 能力模式：Degraded。仅提供最小契约与 machine safety 下限。'] : []),
        '',
        '## 目标',
        sections.objective,
        '',
        '## 相关上下文',
        ...list(sections.context),
        '',
        '## 对象与范围',
        ...list(sections.scope.include.map(item => `包含：${item}`)),
        ...list(sections.scope.exclude.map(item => `不包含：${item}`)),
        '',
        '## 交付物',
        ...list(sections.deliverables),
        '',
        '## 约束',
        ...list(sections.constraints),
        '',
        '## 执行方式',
        ...list(sections.execution),
        '',
        '## 验收',
        ...list(sections.acceptance.map(item => `[ ] ${item.criterion}（${item.method.kind}：${item.method.value}）`))
    ];
    return lines.join('\n').trim();
}
function nonEmptyLineCount(markdown) {
    return markdown.split(/\r?\n/).filter(line => line.trim()).length;
}
function buildExecutionBrief(instruction, modelOutput, mode, taskRoute, decision, context) {
    const parsedBrief = modelBrief(modelOutput);
    const semanticConflict = Boolean(parsedBrief) && hasSemanticConflict(instruction, taskRoute, parsedBrief, context);
    const semanticBrief = semanticConflict ? undefined : parsedBrief;
    const executable = decision.route === 'pass' || decision.route === 'enrich';
    const candidateSections = semanticBrief ?? fallbackSections(instruction, decision);
    const policySafeSections = executable
        ? candidateSections
        : {
            ...candidateSections,
            deliverables: ['补齐 machine decision 指定的澄清、授权或解除条件。'],
            execution: ['停止写操作，按 machine decision 的下一步取得澄清或授权。'],
            acceptance: []
        };
    const candidateRedaction = redactSections(mergeEvidence(policySafeSections, context));
    const candidateWithEvidence = candidateRedaction.sections;
    const candidateMode = semanticBrief ? mode : 'degraded';
    const candidateMarkdown = render(candidateWithEvidence, candidateMode);
    const complex = taskRoute.primary === 'operate' || taskRoute.secondary.length > 0;
    const lineLimitExceeded = nonEmptyLineCount(candidateMarkdown) > (complex ? 100 : 40);
    const modelBriefValid = Boolean(semanticBrief) && !lineLimitExceeded;
    const modelBriefStatus = semanticConflict
        ? 'semantic_conflict'
        : modelBriefValid
            ? 'valid'
            : 'invalid';
    const fallbackRedaction = lineLimitExceeded
        ? redactSections(mergeEvidence(fallbackSections(instruction, decision), context))
        : undefined;
    const privacyRedacted = candidateRedaction.redacted || Boolean(fallbackRedaction?.redacted);
    const effectiveMode = modelBriefValid && !privacyRedacted ? mode : 'degraded';
    const sections = fallbackRedaction?.sections ?? candidateWithEvidence;
    return {
        modelBriefValid,
        modelBriefStatus,
        privacyRedacted,
        brief: {
            schemaVersion: '1.0.0',
            kind: 'alignment.execution-brief',
            mode: effectiveMode,
            taskRoute,
            decision: { route: decision.route, action: String(decision.next.action) },
            ...sections,
            markdown: render(sections, effectiveMode)
        }
    };
}
//# sourceMappingURL=brief-engine.js.map
