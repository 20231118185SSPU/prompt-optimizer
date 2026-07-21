import { createHash } from 'node:crypto';
import { AnalysisResult, analyzeInstruction, DimensionScores } from './analyzer';
import { buildExecutionBrief, ExecutionBrief } from './brief-engine';
import { AlignmentDecision, buildAlignmentDecision } from './contract-builder';
import {
  ContextIssue,
  ResolvedContextEvidence,
  resolveAlignmentContext
} from './context-resolver';
import { HostProjection, projectAlignmentDecision } from './host-projection';
import { redactSensitiveText } from './privacy';
import {
  AlignmentMode,
  AlignmentModelInput,
  DegradedReason,
  resolveTaskRoute,
  TaskRoute
} from './task-route';

export interface AlignmentHostCapabilities {
  adapter?: string;
  nativeBlocking?: boolean;
}

export interface AlignmentInterfaceResult {
  mode: AlignmentMode;
  degradedReasons: DegradedReason[];
  taskRoute: TaskRoute;
  brief: ExecutionBrief;
  trace?: AlignmentTraceAppendix;
  handoff?: BriefHandoff;
  decision: AlignmentDecision;
  host: HostProjection;
}

export interface AlignmentInterfaceOptions {
  hostCapabilities?: AlignmentHostCapabilities;
  model?: AlignmentModelInput;
  directOutput?: boolean;
  includeTrace?: boolean;
  includeHandoff?: boolean;
}

export interface BriefHandoff {
  schemaVersion: '1.0.0';
  kind: 'alignment.brief-handoff';
  summaryHash: `sha256:${string}`;
  executionBrief: string;
}

export interface AlignmentTraceAppendix {
  schemaVersion: '1.0.0';
  kind: 'alignment.trace';
  taskRoute: TaskRoute;
  decision: { route: AlignmentDecision['route']; action: string; reasons: string[] };
  evidence: ResolvedContextEvidence[];
  contextIssues: ContextIssue[];
  totalEvidenceCharacters: number;
  markdown: string;
}

function contextDegradedReasons(issues: ContextIssue[]): DegradedReason[] {
  const reasons: DegradedReason[] = [];
  if (issues.includes('budget_exceeded')) reasons.push('context_budget_exceeded');
  if (issues.includes('source_outside_align') || issues.includes('source_too_large')) {
    reasons.push('context_source_invalid');
  }
  if (issues.includes('stale_evidence')) reasons.push('context_stale');
  if (issues.includes('source_conflict')) reasons.push('context_conflict');
  return reasons;
}

function traceMarkdown(
  taskRoute: TaskRoute,
  decision: AlignmentDecision,
  evidence: ResolvedContextEvidence[],
  issues: ContextIssue[]
): string {
  const lines = [
    '# Trace Appendix',
    '',
    `- Task route: ${taskRoute.primary}${taskRoute.secondary.length ? ` + ${taskRoute.secondary.join(', ')}` : ''}`,
    `- Confidence: ${taskRoute.confidence}`,
    `- Missing: ${taskRoute.missing.length ? taskRoute.missing.join(', ') : 'none'}`,
    `- Machine decision: ${decision.route}/${String(decision.next.action)}`,
    `- Context issues: ${issues.length ? issues.join(', ') : 'none'}`,
    '',
    '## Evidence',
    ...evidence.map(item =>
      `- ${item.statement} [${item.source.ref} ${item.location}; ${item.freshness}; ${item.appliesTo.join(',')}]`
    )
  ];
  return lines.join('\n').trim();
}

function redactTaskRoute(taskRoute: TaskRoute): { taskRoute: TaskRoute; redacted: boolean } {
  let redacted = false;
  const rationale = taskRoute.rationale.map(item => {
    const result = redactSensitiveText(item.reason);
    redacted = redacted || result.redacted;
    return { ...item, reason: result.text };
  });
  return { taskRoute: { ...taskRoute, rationale }, redacted };
}

function redactEvidence(evidence: ResolvedContextEvidence[]): {
  evidence: ResolvedContextEvidence[];
  redacted: boolean;
} {
  let redacted = false;
  const safeEvidence = evidence.map(item => {
    const result = redactSensitiveText(item.statement);
    redacted = redacted || result.redacted;
    return { ...item, statement: result.text };
  });
  return { evidence: safeEvidence, redacted };
}

function scoresWithMissing(scores: DimensionScores, dimensions: Array<'d1' | 'd2' | 'd5'>): DimensionScores {
  const next = { ...scores };
  for (const dimension of dimensions) next[dimension] = 0;
  next.total = next.d1 + next.d2 + next.d3 + next.d4 + next.d5;
  return next;
}

function applySemanticMissing(analysis: AnalysisResult, taskRoute: TaskRoute): AnalysisResult {
  const dimensions: Array<'d1' | 'd2' | 'd5'> = [];
  if (taskRoute.missing.includes('objective')) dimensions.push('d1');
  if (taskRoute.missing.some(field => ['scope', 'constraints', 'authorization', 'recovery'].includes(field))) {
    dimensions.push('d2');
  }
  if (taskRoute.missing.includes('acceptance')) dimensions.push('d5');
  if (dimensions.length === 0) return analysis;

  const reasons = analysis.reasons.filter(reason => ![
    'requirements.sufficient',
    'requirements.needs_enrichment',
    'context.resolvable_from_project'
  ].includes(reason));
  if (dimensions.includes('d1')) reasons.push('intent.ambiguous_goal');
  if (dimensions.includes('d2')) reasons.push('scope.impact_unknown');
  if (dimensions.includes('d5')) reasons.push('verification.missing');
  const observed = scoresWithMissing(analysis.observed, dimensions);
  const effective = scoresWithMissing(analysis.effective, dimensions);
  if (effective.total < 6) reasons.push('diagnosis.score_below_threshold');
  return { ...analysis, observed, effective, reasons: [...new Set(reasons)] };
}

/**
 * Primary caller seam for the runtime. Context loading, acceptance planning,
 * and compatibility presentation stay behind this small interface.
 */
export function alignInstruction(
  instruction: string,
  projectDir: string,
  options: AlignmentInterfaceOptions = {}
): AlignmentInterfaceResult {
  const semantic = resolveTaskRoute(options.model);
  const safeSemantic = redactTaskRoute(semantic.taskRoute);
  const taskRoute = safeSemantic.taskRoute;
  const context = resolveAlignmentContext(projectDir, instruction, semantic.taskRoute);
  const verificationCommands = context.evidence
    .filter(item => item.source.ref === '.align/check-commands.txt')
    .map(item => item.statement);
  const semanticContext = [...new Map(context.evidence.map(item =>
    [`${item.source.kind}:${item.source.ref}`, item.source] as const
  )).values()];
  const contextText = context.evidence.map(item => item.statement).join('\n');
  const analysisInstruction = options.directOutput && !/^\s*(?:\[直出\]|直出)/.test(instruction)
    ? `[直出] ${instruction}`
    : instruction;
  const analyzed = analyzeInstruction(analysisInstruction, semanticContext, contextText);
  const withSemanticMissing = semantic.mode === 'full'
    ? applySemanticMissing(analyzed, taskRoute)
    : analyzed;
  const analysis = context.issues.includes('policy_conflict')
    ? { ...withSemanticMissing, reasons: [...new Set([...withSemanticMissing.reasons, 'policy.operation_prohibited'])] }
    : withSemanticMissing;
  const decision = buildAlignmentDecision(analysis, {
    verificationCommands,
    adapter: options.hostCapabilities?.adapter,
    nativeHook: options.hostCapabilities?.nativeBlocking
  });
  const projection = projectAlignmentDecision(decision);
  const modelOutput = options.model?.status === 'available' ? options.model.output : undefined;
  const contextReasons = contextDegradedReasons(context.issues);
  const preBriefMode = semantic.mode === 'degraded' || contextReasons.length > 0 || safeSemantic.redacted
    ? 'degraded'
    : 'full';
  const briefResult = buildExecutionBrief(
    instruction,
    modelOutput,
    preBriefMode,
    taskRoute,
    decision,
    context
  );
  const degradedReasons = [...new Set<DegradedReason>([
    ...semantic.degradedReasons,
    ...contextReasons,
    ...(briefResult.modelBriefStatus === 'semantic_conflict' ? ['model_semantic_conflict' as const] : []),
    ...(briefResult.modelBriefStatus === 'invalid' && semantic.mode === 'full' ? ['model_output_invalid' as const] : []),
    ...(safeSemantic.redacted || briefResult.privacyRedacted ? ['privacy_redaction_required' as const] : [])
  ])];
  const mode = degradedReasons.length > 0 ? 'degraded' : 'full';
  const safeContext = redactEvidence(context.evidence);
  const trace: AlignmentTraceAppendix | undefined = options.includeTrace
    ? {
        schemaVersion: '1.0.0',
        kind: 'alignment.trace',
        taskRoute,
        decision: {
          route: decision.route,
          action: String(decision.next.action),
          reasons: [...decision.reasons]
        },
        evidence: safeContext.evidence,
        contextIssues: context.issues,
        totalEvidenceCharacters: context.totalCharacters,
        markdown: traceMarkdown(taskRoute, decision, safeContext.evidence, context.issues)
      }
    : undefined;
  if (safeContext.redacted && !degradedReasons.includes('privacy_redaction_required')) {
    degradedReasons.push('privacy_redaction_required');
  }
  const handoff: BriefHandoff | undefined = options.includeHandoff
    ? {
        schemaVersion: '1.0.0',
        kind: 'alignment.brief-handoff',
        summaryHash: `sha256:${createHash('sha256').update(briefResult.brief.markdown).digest('hex')}`,
        executionBrief: briefResult.brief.markdown
      }
    : undefined;
  return {
    mode: degradedReasons.length > 0 ? 'degraded' : mode,
    degradedReasons,
    taskRoute,
    brief: briefResult.brief,
    ...(trace ? { trace } : {}),
    ...(handoff ? { handoff } : {}),
    decision,
    host: projection
  };
}
