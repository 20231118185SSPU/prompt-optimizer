import { createHash } from 'crypto';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { AlignmentDecision } from './contract-builder';

/** @internal Explicit CLI composition only; never part of ordinary pipeline output. */
export const MATT_SKILLS = [
  'ask-matt',
  'code-review',
  'diagnosing-bugs',
  'grill-with-docs',
  'implement',
  'prototype',
  'tdd',
  'to-spec',
  'to-tickets'
] as const;

export type MattSkill = typeof MATT_SKILLS[number];

export interface MattEnvironment {
  availableSkills: ReadonlySet<string>;
  setupComplete: boolean;
}

export interface MattEnvironmentDiscoveryOptions {
  homeDir?: string;
  skillRoots?: readonly string[];
}

export interface MattHandoff {
  schemaVersion: '1.0.0';
  kind: 'alignment.ecosystem-handoff';
  ecosystem: 'matt-pocock-skills';
  handoffId: string;
  source: { requestId: string; decisionId: string; route: AlignmentDecision['route'] };
  status: 'ready' | 'setup_required' | 'unavailable' | 'deferred';
  selectedSkill: MattSkill | null;
  invocation: string | null;
  reason: string;
  automatic: false;
  prerequisite: { skill: 'setup-matt-pocock-skills'; invocation: '/setup-matt-pocock-skills' } | null;
  input: {
    facts: string[];
    missing: string[];
    scope: AlignmentDecision['scope'];
    acceptance: AlignmentDecision['acceptance'];
  };
}

const DISCOVERABLE_SKILLS = [...MATT_SKILLS, 'setup-matt-pocock-skills'] as const;
const SETUP_FILES = [
  'docs/agents/issue-tracker.md',
  'docs/agents/triage-labels.md',
  'docs/agents/domain.md'
] as const;

function isFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function defaultSkillRoots(projectDir: string, homeDir: string, includeCodexHome: boolean): string[] {
  const roots = [
    join(projectDir, '.agents', 'skills'),
    join(projectDir, '.claude', 'skills'),
    join(projectDir, '.codex', 'skills'),
    join(homeDir, '.agents', 'skills'),
    join(homeDir, '.claude', 'skills'),
    join(homeDir, '.codex', 'skills')
  ];

  if (includeCodexHome && process.env.CODEX_HOME) {
    roots.push(join(process.env.CODEX_HOME, 'skills'));
  }

  return roots;
}

export function discoverMattEnvironment(
  projectDir: string,
  options: MattEnvironmentDiscoveryOptions = {}
): MattEnvironment {
  const homeDir = options.homeDir ?? homedir();
  const roots = options.skillRoots
    ? [...options.skillRoots]
    : defaultSkillRoots(projectDir, homeDir, options.homeDir === undefined);
  const uniqueRoots = [...new Set(roots.map(root => resolve(root)))];
  const availableSkills = new Set<string>();

  for (const skill of DISCOVERABLE_SKILLS) {
    if (uniqueRoots.some(root => isFile(join(root, skill, 'SKILL.md')))) {
      availableSkills.add(skill);
    }
  }

  return {
    availableSkills,
    setupComplete: SETUP_FILES.every(file => isFile(join(projectDir, ...file.split('/'))))
  };
}

function requestText(decision: AlignmentDecision): string {
  const claim = decision.claims.find(item => {
    if (item.type !== 'fact' || typeof item.statement !== 'string' || !Array.isArray(item.sources)) {
      return false;
    }
    return item.sources.some(source => {
      if (!source || typeof source !== 'object') return false;
      const candidate = source as Record<string, unknown>;
      return candidate.kind === 'user' && candidate.ref === 'request:text';
    });
  }) ?? decision.claims.find(item => item.type === 'fact' && typeof item.statement === 'string');
  return typeof claim?.statement === 'string' ? claim.statement : '';
}

function selectSkill(text: string): { skill: MattSkill; reason: string } {
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

export function buildMattHandoff(decision: AlignmentDecision, environment: MattEnvironment): MattHandoff {
  const facts = decision.claims
    .filter(item => item.type === 'fact' && typeof item.statement === 'string')
    .map(item => item.statement as string);
  const executable = decision.route === 'pass' || decision.route === 'enrich';
  const selection = executable ? selectSkill(requestText(decision)) : null;
  const selectedSkill = selection?.skill ?? null;
  const handoffId = `matt-${createHash('sha256')
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
