// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MATT_SKILLS = void 0;
exports.discoverMattEnvironment = discoverMattEnvironment;
exports.buildMattHandoff = buildMattHandoff;
const crypto_1 = require("crypto");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
exports.MATT_SKILLS = [
    'ask-matt',
    'code-review',
    'diagnosing-bugs',
    'grill-with-docs',
    'implement',
    'prototype',
    'tdd',
    'to-spec',
    'to-tickets'
];
const DISCOVERABLE_SKILLS = [...exports.MATT_SKILLS, 'setup-matt-pocock-skills'];
const SETUP_FILES = [
    'docs/agents/issue-tracker.md',
    'docs/agents/triage-labels.md',
    'docs/agents/domain.md'
];
function isFile(filePath) {
    if (!(0, node_fs_1.existsSync)(filePath))
        return false;
    try {
        return (0, node_fs_1.statSync)(filePath).isFile();
    }
    catch {
        return false;
    }
}
function defaultSkillRoots(projectDir, homeDir, includeCodexHome) {
    const roots = [
        (0, node_path_1.join)(projectDir, '.agents', 'skills'),
        (0, node_path_1.join)(projectDir, '.claude', 'skills'),
        (0, node_path_1.join)(projectDir, '.codex', 'skills'),
        (0, node_path_1.join)(homeDir, '.agents', 'skills'),
        (0, node_path_1.join)(homeDir, '.claude', 'skills'),
        (0, node_path_1.join)(homeDir, '.codex', 'skills')
    ];
    if (includeCodexHome && process.env.CODEX_HOME) {
        roots.push((0, node_path_1.join)(process.env.CODEX_HOME, 'skills'));
    }
    return roots;
}
function discoverMattEnvironment(projectDir, options = {}) {
    const homeDir = options.homeDir ?? (0, node_os_1.homedir)();
    const roots = options.skillRoots
        ? [...options.skillRoots]
        : defaultSkillRoots(projectDir, homeDir, options.homeDir === undefined);
    const uniqueRoots = [...new Set(roots.map(root => (0, node_path_1.resolve)(root)))];
    const availableSkills = new Set();
    for (const skill of DISCOVERABLE_SKILLS) {
        if (uniqueRoots.some(root => isFile((0, node_path_1.join)(root, skill, 'SKILL.md')))) {
            availableSkills.add(skill);
        }
    }
    return {
        availableSkills,
        setupComplete: SETUP_FILES.every(file => isFile((0, node_path_1.join)(projectDir, ...file.split('/'))))
    };
}
function requestText(decision) {
    const claim = decision.claims.find(item => {
        if (item.type !== 'fact' || typeof item.statement !== 'string' || !Array.isArray(item.sources)) {
            return false;
        }
        return item.sources.some(source => {
            if (!source || typeof source !== 'object')
                return false;
            const candidate = source;
            return candidate.kind === 'user' && candidate.ref === 'request:text';
        });
    }) ?? decision.claims.find(item => item.type === 'fact' && typeof item.statement === 'string');
    return typeof claim?.statement === 'string' ? claim.statement : '';
}
function selectSkill(text) {
    if (/代码审查|审查.+(?:改动|分支|PR)|\breview\b/i.test(text)) {
        return { skill: 'code-review', reason: 'workflow.code_review' };
    }
    if (/诊断|调试|根因|难复现|间歇性|性能回归|diagnos|debug/i.test(text)) {
        return { skill: 'diagnosing-bugs', reason: 'workflow.diagnosis' };
    }
    if (/原型|prototype|throwaway|验证.+状态模型|探索.+界面/i.test(text)) {
        return { skill: 'prototype', reason: 'workflow.prototype' };
    }
    if (/(?:拆成|拆分|分解).*(?:tickets?|工单|任务)|阻塞关系|to-tickets/i.test(text)) {
        return { skill: 'to-tickets', reason: 'workflow.ticket_breakdown' };
    }
    if (/(?:整理|转|生成|发布).*(?:spec|规格)|to-spec/i.test(text)) {
        return { skill: 'to-spec', reason: 'workflow.specification' };
    }
    if (/\bTDD\b|测试驱动|红绿|red[- ]green/i.test(text)) {
        return { skill: 'tdd', reason: 'workflow.test_driven_development' };
    }
    if (/访谈|grill|(?:设计方案|需求).*(?:梳理|澄清|敲定)/i.test(text)) {
        return { skill: 'grill-with-docs', reason: 'workflow.design_interview' };
    }
    if (/实现|开发|构建|新增|添加|修复|修改|\bbuild\b|implement/i.test(text)) {
        return { skill: 'implement', reason: 'workflow.implementation' };
    }
    return { skill: 'ask-matt', reason: 'workflow.router_fallback' };
}
function buildMattHandoff(decision, environment) {
    const facts = decision.claims
        .filter(item => item.type === 'fact' && typeof item.statement === 'string')
        .map(item => item.statement);
    const executable = decision.route === 'pass' || decision.route === 'enrich';
    const selection = executable ? selectSkill(requestText(decision)) : null;
    const selectedSkill = selection?.skill ?? null;
    const handoffId = `matt-${(0, crypto_1.createHash)('sha256')
        .update(`${decision.decisionId}:${selectedSkill ?? 'deferred'}`)
        .digest('hex')
        .slice(0, 16)}`;
    if (!selection) {
        return {
            schemaVersion: '1.0.0',
            kind: 'alignment.ecosystem-handoff',
            ecosystem: 'matt-pocock-skills',
            handoffId,
            source: { requestId: decision.requestId, decisionId: decision.decisionId, route: decision.route },
            status: 'deferred',
            selectedSkill: null,
            invocation: null,
            reason: decision.route === 'block' ? 'alignment.blocked' : 'alignment.clarification_pending',
            automatic: false,
            prerequisite: null,
            input: { facts, missing: [...decision.missing], scope: decision.scope, acceptance: decision.acceptance }
        };
    }
    const installed = environment.availableSkills.has(selection.skill);
    const setupRequired = !environment.setupComplete;
    const status = installed ? (setupRequired ? 'setup_required' : 'ready') : 'unavailable';
    return {
        schemaVersion: '1.0.0',
        kind: 'alignment.ecosystem-handoff',
        ecosystem: 'matt-pocock-skills',
        handoffId,
        source: { requestId: decision.requestId, decisionId: decision.decisionId, route: decision.route },
        status,
        selectedSkill: selection.skill,
        invocation: `/${selection.skill}`,
        reason: selection.reason,
        automatic: false,
        prerequisite: installed && setupRequired
            ? { skill: 'setup-matt-pocock-skills', invocation: '/setup-matt-pocock-skills' }
            : null,
        input: {
            facts,
            missing: [...decision.missing],
            scope: decision.scope,
            acceptance: decision.acceptance
        }
    };
}
//# sourceMappingURL=matt-handoff.js.map
