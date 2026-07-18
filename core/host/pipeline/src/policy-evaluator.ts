import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export type PolicyRoute = 'pass' | 'enrich' | 'clarify' | 'block';
export type PolicyAction = 'execute' | 'ask' | 'wait_confirmation' | 'stop';

export interface PolicyDimensionScores {
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
  total: number;
}

export interface PolicyEvaluationInput {
  reasons: string[];
  scores: {
    observed: unknown;
    effective: unknown;
  };
  assumptionCount: number;
  safetyCritical?: boolean;
}

export interface PolicyEvaluationOptions {
  policy?: unknown;
  registry?: unknown;
  schema?: unknown;
}

export interface PolicyEvaluationResult {
  route: PolicyRoute;
  action: PolicyAction;
  reasons: string[];
  matchedRule: string | null;
  degraded: boolean;
}

type JsonObject = Record<string, unknown>;
type ScoreSource = 'observed' | 'effective';

interface ReasonDefinition {
  code: string;
  meaning: string;
  priority: number;
  appliesTo: string[];
  allowedRoutes: PolicyRoute[];
  safetyCritical: boolean;
}

interface ReasonRegistry {
  schemaVersion: '1.0.0';
  kind: 'alignment.reason-registry';
  ordering: 'priority_then_code';
  reasons: ReasonDefinition[];
}

type PolicyCondition =
  | { op: 'always' }
  | { op: 'reason_any'; codes: string[] }
  | { op: 'score_total'; source: ScoreSource; comparator: 'lt' | 'gte'; value: number }
  | { op: 'score_total'; source: ScoreSource; comparator: 'between'; min: number; max: number }
  | { op: 'minimum_dimension'; source: ScoreSource; comparator: 'lt' | 'gte'; value: number }
  | { op: 'assumption_count'; comparator: 'gt' | 'lte'; value: number }
  | { op: 'scores_equal' | 'safety_critical'; value: boolean }
  | { op: 'all' | 'any'; conditions: PolicyCondition[] }
  | { op: 'not'; condition: PolicyCondition };

interface PolicyRule {
  id: string;
  priority: number;
  when: PolicyCondition;
  route: PolicyRoute;
  nextActions: PolicyAction[];
}

interface DecisionPolicy {
  schemaVersion: '1.0.0';
  kind: 'alignment.decision-policy';
  evaluation: 'first_match_wins';
  unknownOperator: 'fail_closed';
  thresholds: {
    passMinimumTotal: number;
    executionMinimumTotal: number;
    executionMinimumDimension: number;
    maximumAssumptionsForExecution: number;
  };
  routePrecedence: PolicyRule[];
  annotationRules: Array<{
    id: string;
    presentationMode: 'direct_output';
    requiresReason: 'override.explicit_direct_output';
    bidirectional: true;
    changesRoute: false;
  }>;
}

interface ValidatedPolicyEvaluationInput extends PolicyEvaluationInput {
  scores: {
    observed: PolicyDimensionScores;
    effective: PolicyDimensionScores;
  };
}

const ROUTES = new Set<PolicyRoute>(['pass', 'enrich', 'clarify', 'block']);
const ACTIONS = new Set<PolicyAction>(['execute', 'ask', 'wait_confirmation', 'stop']);
const SCORE_SOURCES = new Set<ScoreSource>(['observed', 'effective']);
const LEGAL_ACTIONS: Record<PolicyRoute, ReadonlySet<PolicyAction>> = {
  pass: new Set(['execute']),
  enrich: new Set(['execute']),
  clarify: new Set(['ask']),
  block: new Set(['wait_confirmation', 'stop']),
};
const SCORE_DIMENSIONS: Array<keyof Omit<PolicyDimensionScores, 'total'>> = [
  'd1', 'd2', 'd3', 'd4', 'd5',
];
const SCORE_KEYS: Array<keyof PolicyDimensionScores> = [...SCORE_DIMENSIONS, 'total'];
const FAIL_CLOSED: PolicyEvaluationResult = {
  route: 'clarify',
  action: 'ask',
  reasons: ['runtime.degraded'],
  matchedRule: null,
  degraded: true,
};
const TRUSTED_POLICY_SCHEMA_DIGEST = 'd233dfe3659a67dbff614fb5d6c7dd87a5330fcfaa7e68445641709d0b804aa1';

interface PolicyAssets {
  policy: unknown;
  registry: unknown;
  schema: unknown;
}

let defaultAssets: PolicyAssets | undefined;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: JsonObject, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isIntegerInRange(value: unknown, minimum: number, maximum?: number): value is number {
  return Number.isInteger(value) && (value as number) >= minimum &&
    (maximum === undefined || (value as number) <= maximum);
}

function isUniqueStringArray(value: unknown, allowEmpty = false): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) &&
    value.every(item => typeof item === 'string') && new Set(value).size === value.length;
}

function hasStringSet(value: unknown, expected: string[]): value is string[] {
  return isUniqueStringArray(value, expected.length === 0) && value.length === expected.length &&
    expected.every(item => value.includes(item));
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function canonicalDigest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function propertyOf(definition: JsonObject, name: string): JsonObject | undefined {
  if (!isObject(definition.properties)) return undefined;
  const property = definition.properties[name];
  return isObject(property) ? property : undefined;
}

function isClosedObjectDefinition(
  value: unknown,
  required: string[],
  properties: string[] = required
): value is JsonObject {
  return isObject(value) && hasExactKeys(value, ['type', 'additionalProperties', 'required', 'properties']) &&
    value.type === 'object' && value.additionalProperties === false &&
    hasStringSet(value.required, required) && isObject(value.properties) &&
    hasExactKeys(value.properties, properties);
}

function hasConstProperty(definition: JsonObject, name: string, expected: unknown): boolean {
  const property = propertyOf(definition, name);
  return property !== undefined && hasExactKeys(property, ['const']) && property.const === expected;
}

function hasEnumProperty(definition: JsonObject, name: string, expected: string[]): boolean {
  const property = propertyOf(definition, name);
  return property !== undefined && hasExactKeys(property, ['enum']) && hasStringSet(property.enum, expected);
}

function hasRefProperty(definition: JsonObject, name: string, expected: string): boolean {
  const property = propertyOf(definition, name);
  return property !== undefined && hasExactKeys(property, ['$ref']) && property.$ref === expected;
}

function isTrustedPolicySchema(value: unknown): boolean {
  if (!isObject(value) || !hasExactKeys(value, [
    '$schema', '$id', 'title', 'type', 'additionalProperties', 'required', 'properties', '$defs',
      ]) || value.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
      value.$id !== 'https://prompt-optimizer.dev/contracts/decision-policy/1.0.0' ||
      value.type !== 'object' || value.additionalProperties !== false ||
      !hasStringSet(value.required, [
        'schemaVersion', 'kind', 'evaluation', 'unknownOperator',
        'thresholds', 'routePrecedence', 'annotationRules',
      ]) || !isObject(value.properties) || !isObject(value.$defs) ||
      !hasExactKeys(value.properties, [
        'schemaVersion', 'kind', 'evaluation', 'unknownOperator',
        'thresholds', 'routePrecedence', 'annotationRules',
      ]) || !hasExactKeys(value.$defs, [
        'routeRule', 'condition', 'alwaysCondition', 'reasonAnyCondition',
        'scoreScalarCondition', 'scoreBetweenCondition', 'minimumDimensionCondition',
        'assumptionCountCondition', 'booleanCondition', 'compoundCondition',
        'notCondition', 'annotationRule',
      ])) {
    return false;
  }
  if (canonicalDigest(value) !== TRUSTED_POLICY_SCHEMA_DIGEST) return false;

  const root = value as JsonObject;
  if (!hasConstProperty(root, 'schemaVersion', '1.0.0') ||
      !hasConstProperty(root, 'kind', 'alignment.decision-policy') ||
      !hasConstProperty(root, 'evaluation', 'first_match_wins') ||
      !hasConstProperty(root, 'unknownOperator', 'fail_closed')) {
    return false;
  }

  const thresholds = propertyOf(root, 'thresholds');
  const routePrecedence = propertyOf(root, 'routePrecedence');
  const annotationRules = propertyOf(root, 'annotationRules');
  if (!isClosedObjectDefinition(thresholds, [
    'passMinimumTotal', 'executionMinimumTotal',
    'executionMinimumDimension', 'maximumAssumptionsForExecution',
  ]) || !routePrecedence || routePrecedence.type !== 'array' || routePrecedence.minItems !== 1 ||
      !isObject(routePrecedence.items) || routePrecedence.items.$ref !== '#/$defs/routeRule' ||
      !annotationRules || annotationRules.type !== 'array' ||
      !isObject(annotationRules.items) || annotationRules.items.$ref !== '#/$defs/annotationRule') {
    return false;
  }

  const definitions = value.$defs as JsonObject;
  const routeRule = definitions.routeRule;
  const annotationRule = definitions.annotationRule;
  if (!isClosedObjectDefinition(routeRule, ['id', 'priority', 'when', 'route', 'nextActions']) ||
      !hasRefProperty(routeRule, 'when', '#/$defs/condition') ||
      !hasEnumProperty(routeRule, 'route', ['pass', 'enrich', 'clarify', 'block'])) {
    return false;
  }
  const nextActions = propertyOf(routeRule, 'nextActions');
  if (!nextActions || nextActions.type !== 'array' || nextActions.minItems !== 1 ||
      nextActions.uniqueItems !== true || !isObject(nextActions.items) ||
      !hasStringSet(nextActions.items.enum, ['execute', 'ask', 'wait_confirmation', 'stop'])) {
    return false;
  }
  if (!isClosedObjectDefinition(annotationRule, [
    'id', 'presentationMode', 'requiresReason', 'bidirectional', 'changesRoute',
  ]) || !hasConstProperty(annotationRule, 'presentationMode', 'direct_output') ||
      !hasConstProperty(annotationRule, 'requiresReason', 'override.explicit_direct_output') ||
      !hasConstProperty(annotationRule, 'bidirectional', true) ||
      !hasConstProperty(annotationRule, 'changesRoute', false)) {
    return false;
  }

  const condition = definitions.condition;
  const conditionRefs = [
    'alwaysCondition', 'reasonAnyCondition', 'scoreScalarCondition', 'scoreBetweenCondition',
    'minimumDimensionCondition', 'assumptionCountCondition', 'booleanCondition',
    'compoundCondition', 'notCondition',
  ].map(name => `#/$defs/${name}`);
  if (!isObject(condition) || !hasExactKeys(condition, ['oneOf']) || !Array.isArray(condition.oneOf) ||
      condition.oneOf.length !== conditionRefs.length || condition.oneOf.some(item => !isObject(item)) ||
      !hasStringSet(condition.oneOf.map(item => (item as JsonObject).$ref), conditionRefs)) {
    return false;
  }

  const conditionDefinitions: Array<[string, string[], string[]?]> = [
    ['alwaysCondition', ['op']],
    ['reasonAnyCondition', ['op', 'codes']],
    ['scoreScalarCondition', ['op', 'source', 'comparator', 'value']],
    ['scoreBetweenCondition', ['op', 'source', 'comparator', 'min', 'max']],
    ['minimumDimensionCondition', ['op', 'source', 'comparator', 'value']],
    ['assumptionCountCondition', ['op', 'comparator', 'value']],
    ['booleanCondition', ['op', 'value']],
    ['compoundCondition', ['op', 'conditions']],
    ['notCondition', ['op', 'condition']],
  ];
  for (const [name, required, properties] of conditionDefinitions) {
    if (!isClosedObjectDefinition(definitions[name], required, properties)) return false;
  }

  const always = definitions.alwaysCondition as JsonObject;
  const reasonAny = definitions.reasonAnyCondition as JsonObject;
  const scoreScalar = definitions.scoreScalarCondition as JsonObject;
  const scoreBetween = definitions.scoreBetweenCondition as JsonObject;
  const minimumDimension = definitions.minimumDimensionCondition as JsonObject;
  const assumptionCount = definitions.assumptionCountCondition as JsonObject;
  const booleanCondition = definitions.booleanCondition as JsonObject;
  const compound = definitions.compoundCondition as JsonObject;
  const notCondition = definitions.notCondition as JsonObject;
  return hasConstProperty(always, 'op', 'always') &&
    hasConstProperty(reasonAny, 'op', 'reason_any') &&
    hasConstProperty(scoreScalar, 'op', 'score_total') &&
    hasEnumProperty(scoreScalar, 'source', ['observed', 'effective']) &&
    hasEnumProperty(scoreScalar, 'comparator', ['lt', 'gte']) &&
    hasConstProperty(scoreBetween, 'op', 'score_total') &&
    hasEnumProperty(scoreBetween, 'source', ['observed', 'effective']) &&
    hasConstProperty(scoreBetween, 'comparator', 'between') &&
    hasConstProperty(minimumDimension, 'op', 'minimum_dimension') &&
    hasEnumProperty(minimumDimension, 'source', ['observed', 'effective']) &&
    hasEnumProperty(minimumDimension, 'comparator', ['lt', 'gte']) &&
    hasConstProperty(assumptionCount, 'op', 'assumption_count') &&
    hasEnumProperty(assumptionCount, 'comparator', ['gt', 'lte']) &&
    hasEnumProperty(booleanCondition, 'op', ['scores_equal', 'safety_critical']) &&
    hasEnumProperty(compound, 'op', ['all', 'any']) &&
    hasConstProperty(notCondition, 'op', 'not') &&
    hasRefProperty(notCondition, 'condition', '#/$defs/condition');
}

function isRoute(value: unknown): value is PolicyRoute {
  return typeof value === 'string' && ROUTES.has(value as PolicyRoute);
}

function isAction(value: unknown): value is PolicyAction {
  return typeof value === 'string' && ACTIONS.has(value as PolicyAction);
}

function parseReasonRegistry(value: unknown): ReasonRegistry | undefined {
  if (!isObject(value) || !hasExactKeys(value, ['schemaVersion', 'kind', 'ordering', 'reasons']) ||
      value.schemaVersion !== '1.0.0' || value.kind !== 'alignment.reason-registry' ||
      value.ordering !== 'priority_then_code' || !Array.isArray(value.reasons) || value.reasons.length === 0) {
    return undefined;
  }

  const codes = new Set<string>();
  for (const candidate of value.reasons) {
    if (!isObject(candidate) || !hasExactKeys(candidate, [
      'code', 'meaning', 'priority', 'appliesTo', 'allowedRoutes', 'safetyCritical',
    ]) || typeof candidate.code !== 'string' || !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(candidate.code) ||
        typeof candidate.meaning !== 'string' || candidate.meaning.length === 0 ||
        !isIntegerInRange(candidate.priority, 0) ||
        !isUniqueStringArray(candidate.appliesTo) ||
        candidate.appliesTo.some(stage => !['decision', 'baseline', 'completion'].includes(stage)) ||
        !Array.isArray(candidate.allowedRoutes) ||
        candidate.allowedRoutes.some(route => !isRoute(route)) ||
        new Set(candidate.allowedRoutes).size !== candidate.allowedRoutes.length ||
        (candidate.appliesTo.includes('decision') && candidate.allowedRoutes.length === 0) ||
        typeof candidate.safetyCritical !== 'boolean' || codes.has(candidate.code)) {
      return undefined;
    }
    codes.add(candidate.code);
  }

  const registry = value as unknown as ReasonRegistry;
  const degraded = registry.reasons.find(reason => reason.code === 'runtime.degraded');
  if (!degraded || !degraded.appliesTo.includes('decision') || !degraded.allowedRoutes.includes('clarify')) {
    return undefined;
  }
  return registry;
}

function validateCondition(
  value: unknown,
  reasonCodes: ReadonlySet<string>,
  ancestors: WeakSet<object>,
  depth = 0
): value is PolicyCondition {
  if (!isObject(value) || depth > 32 || ancestors.has(value)) return false;
  ancestors.add(value);
  const finish = (valid: boolean): boolean => {
    ancestors.delete(value);
    return valid;
  };

  switch (value.op) {
    case 'always':
      return finish(hasExactKeys(value, ['op']));
    case 'reason_any':
      return finish(hasExactKeys(value, ['op', 'codes']) && isUniqueStringArray(value.codes) &&
        value.codes.every(code => reasonCodes.has(code)));
    case 'score_total': {
      if (!SCORE_SOURCES.has(value.source as ScoreSource)) return finish(false);
      if (value.comparator === 'between') {
        return finish(hasExactKeys(value, ['op', 'source', 'comparator', 'min', 'max']) &&
          isIntegerInRange(value.min, 0, 10) && isIntegerInRange(value.max, 0, 10) &&
          value.min <= value.max);
      }
      return finish((value.comparator === 'lt' || value.comparator === 'gte') &&
        hasExactKeys(value, ['op', 'source', 'comparator', 'value']) &&
        isIntegerInRange(value.value, 0, 10));
    }
    case 'minimum_dimension':
      return finish(SCORE_SOURCES.has(value.source as ScoreSource) &&
        (value.comparator === 'lt' || value.comparator === 'gte') &&
        hasExactKeys(value, ['op', 'source', 'comparator', 'value']) &&
        isIntegerInRange(value.value, 0, 2));
    case 'assumption_count':
      return finish((value.comparator === 'gt' || value.comparator === 'lte') &&
        hasExactKeys(value, ['op', 'comparator', 'value']) && isIntegerInRange(value.value, 0));
    case 'scores_equal':
    case 'safety_critical':
      return finish(hasExactKeys(value, ['op', 'value']) && typeof value.value === 'boolean');
    case 'all':
    case 'any':
      return finish(hasExactKeys(value, ['op', 'conditions']) && Array.isArray(value.conditions) &&
        value.conditions.length > 0 &&
        value.conditions.every(condition => validateCondition(condition, reasonCodes, ancestors, depth + 1)));
    case 'not':
      return finish(hasExactKeys(value, ['op', 'condition']) &&
        validateCondition(value.condition, reasonCodes, ancestors, depth + 1));
    default:
      return finish(false);
  }
}

function parseDecisionPolicy(value: unknown, registry: ReasonRegistry): DecisionPolicy | undefined {
  if (!isObject(value) || !hasExactKeys(value, [
    'schemaVersion', 'kind', 'evaluation', 'unknownOperator', 'thresholds', 'routePrecedence', 'annotationRules',
  ]) || value.schemaVersion !== '1.0.0' || value.kind !== 'alignment.decision-policy' ||
      value.evaluation !== 'first_match_wins' || value.unknownOperator !== 'fail_closed' ||
      !isObject(value.thresholds) || !hasExactKeys(value.thresholds, [
        'passMinimumTotal', 'executionMinimumTotal', 'executionMinimumDimension', 'maximumAssumptionsForExecution',
      ]) || !isIntegerInRange(value.thresholds.passMinimumTotal, 0, 10) ||
      !isIntegerInRange(value.thresholds.executionMinimumTotal, 0, 10) ||
      !isIntegerInRange(value.thresholds.executionMinimumDimension, 0, 2) ||
      !isIntegerInRange(value.thresholds.maximumAssumptionsForExecution, 0) ||
      !Array.isArray(value.routePrecedence) || value.routePrecedence.length === 0 ||
      !Array.isArray(value.annotationRules)) {
    return undefined;
  }

  const reasonCodes = new Set(registry.reasons
    .filter(reason => reason.appliesTo.includes('decision'))
    .map(reason => reason.code));
  const ruleIds = new Set<string>();
  const rulePriorities = new Set<number>();
  for (const candidate of value.routePrecedence) {
    if (!isObject(candidate) || !hasExactKeys(candidate, ['id', 'priority', 'when', 'route', 'nextActions']) ||
        typeof candidate.id !== 'string' || candidate.id.length === 0 || ruleIds.has(candidate.id) ||
        !isIntegerInRange(candidate.priority, 0) || rulePriorities.has(candidate.priority) || !isRoute(candidate.route) ||
        !Array.isArray(candidate.nextActions) || candidate.nextActions.length === 0 ||
        candidate.nextActions.some(action => !isAction(action)) ||
        new Set(candidate.nextActions).size !== candidate.nextActions.length ||
        candidate.nextActions.some(action => !LEGAL_ACTIONS[candidate.route as PolicyRoute].has(action as PolicyAction)) ||
        !validateCondition(candidate.when, reasonCodes, new WeakSet())) {
      return undefined;
    }
    ruleIds.add(candidate.id);
    rulePriorities.add(candidate.priority as number);
  }

  const annotationIds = new Set<string>();
  for (const annotation of value.annotationRules) {
    if (!isObject(annotation) || !hasExactKeys(annotation, [
      'id', 'presentationMode', 'requiresReason', 'bidirectional', 'changesRoute',
    ]) || typeof annotation.id !== 'string' || annotation.id.length === 0 || annotationIds.has(annotation.id) ||
        annotation.presentationMode !== 'direct_output' ||
        annotation.requiresReason !== 'override.explicit_direct_output' ||
        annotation.bidirectional !== true || annotation.changesRoute !== false ||
        !reasonCodes.has(annotation.requiresReason)) {
      return undefined;
    }
    annotationIds.add(annotation.id);
  }

  return value as unknown as DecisionPolicy;
}

function validScores(value: unknown): value is PolicyDimensionScores {
  if (!isObject(value) || !hasExactKeys(value, [...SCORE_DIMENSIONS, 'total'])) return false;
  if (!SCORE_DIMENSIONS.every(dimension => isIntegerInRange(value[dimension], 0, 2)) ||
      !isIntegerInRange(value.total, 0, 10)) return false;
  return SCORE_DIMENSIONS.reduce((sum, dimension) => sum + (value[dimension] as number), 0) === value.total;
}

function validInput(input: unknown): input is ValidatedPolicyEvaluationInput {
  return isObject(input) && Array.isArray(input.reasons) && input.reasons.every(reason => typeof reason === 'string') &&
    isObject(input.scores) && validScores(input.scores.observed) && validScores(input.scores.effective) &&
    isIntegerInRange(input.assumptionCount, 0) &&
    (input.safetyCritical === undefined || typeof input.safetyCritical === 'boolean');
}

function evaluateCondition(condition: PolicyCondition, input: Required<ValidatedPolicyEvaluationInput>): boolean {
  switch (condition.op) {
    case 'always':
      return true;
    case 'reason_any':
      return condition.codes.some(code => input.reasons.includes(code));
    case 'score_total': {
      const total = input.scores[condition.source].total;
      if ('min' in condition) return total >= condition.min && total <= condition.max;
      if (condition.comparator === 'lt') return total < condition.value;
      return total >= condition.value;
    }
    case 'minimum_dimension': {
      const minimum = Math.min(...SCORE_DIMENSIONS.map(key => input.scores[condition.source][key]));
      return condition.comparator === 'lt' ? minimum < condition.value : minimum >= condition.value;
    }
    case 'assumption_count':
      return condition.comparator === 'gt'
        ? input.assumptionCount > condition.value
        : input.assumptionCount <= condition.value;
    case 'scores_equal':
      return SCORE_KEYS.every(
        key => input.scores.observed[key] === input.scores.effective[key]
      ) === condition.value;
    case 'safety_critical':
      return input.safetyCritical === condition.value;
    case 'all':
      return condition.conditions.every(item => evaluateCondition(item, input));
    case 'any':
      return condition.conditions.some(item => evaluateCondition(item, input));
    case 'not':
      return !evaluateCondition(condition.condition, input);
  }
}

function matchedReasonCodes(condition: PolicyCondition, reasons: ReadonlySet<string>): string[] {
  switch (condition.op) {
    case 'reason_any':
      return condition.codes.filter(code => reasons.has(code));
    case 'all':
    case 'any':
      return condition.conditions.flatMap(item => matchedReasonCodes(item, reasons));
    case 'not':
      return [];
    default:
      return [];
  }
}

function loadDefaultAssets(): PolicyAssets {
  if (defaultAssets) return defaultAssets;
  const directories = [
    path.resolve(__dirname, '../contracts'),
    path.resolve(__dirname, '../../../contracts'),
  ];
  for (const directory of directories) {
    try {
      defaultAssets = {
        policy: JSON.parse(fs.readFileSync(path.join(directory, 'decision-policy.json'), 'utf8')),
        registry: JSON.parse(fs.readFileSync(path.join(directory, 'reason-registry.json'), 'utf8')),
        schema: JSON.parse(fs.readFileSync(path.join(directory, 'decision-policy.schema.json'), 'utf8')),
      };
      return defaultAssets;
    } catch {
      // Try the source-tree or distribution layout before failing closed.
    }
  }
  return { policy: undefined, registry: undefined, schema: undefined };
}

function resolveAssets(options: PolicyEvaluationOptions): PolicyAssets {
  const hasPolicy = Object.prototype.hasOwnProperty.call(options, 'policy');
  const hasRegistry = Object.prototype.hasOwnProperty.call(options, 'registry');
  const hasSchema = Object.prototype.hasOwnProperty.call(options, 'schema');
  if (hasPolicy && hasRegistry && hasSchema) {
    return { policy: options.policy, registry: options.registry, schema: options.schema };
  }
  const defaults = loadDefaultAssets();
  return {
    policy: hasPolicy ? options.policy : defaults.policy,
    registry: hasRegistry ? options.registry : defaults.registry,
    schema: hasSchema ? options.schema : defaults.schema,
  };
}

export function evaluateDecisionPolicy(
  input: PolicyEvaluationInput,
  options: PolicyEvaluationOptions = {}
): PolicyEvaluationResult {
  try {
    const assets = resolveAssets(options);
    if (!isTrustedPolicySchema(assets.schema)) {
      return { ...FAIL_CLOSED, reasons: [...FAIL_CLOSED.reasons] };
    }
    const registry = parseReasonRegistry(assets.registry);
    if (!registry || !validInput(input)) return { ...FAIL_CLOSED, reasons: [...FAIL_CLOSED.reasons] };
    const policy = parseDecisionPolicy(assets.policy, registry);
    if (!policy) return { ...FAIL_CLOSED, reasons: [...FAIL_CLOSED.reasons] };

    const reasonByCode = new Map(registry.reasons.map(reason => [reason.code, reason] as const));
    const normalizedReasons = [...input.reasons];
    if (input.scores.effective.total < policy.thresholds.executionMinimumTotal) {
      normalizedReasons.push('diagnosis.score_below_threshold');
    }
    if (input.scores.effective.d5 < policy.thresholds.executionMinimumDimension) {
      normalizedReasons.push('verification.missing');
    }
    if (input.assumptionCount > policy.thresholds.maximumAssumptionsForExecution) {
      normalizedReasons.push('assumption.too_many');
    }
    const uniqueReasons = [...new Set(normalizedReasons)];
    const definitions = uniqueReasons.map(code => reasonByCode.get(code));
    if (definitions.some(reason => !reason || !reason.appliesTo.includes('decision'))) {
      return { ...FAIL_CLOSED, reasons: [...FAIL_CLOSED.reasons] };
    }

    const canonicalDefinitions = (definitions as ReasonDefinition[])
      .sort((left, right) => left.priority - right.priority ||
        (left.code < right.code ? -1 : left.code > right.code ? 1 : 0));
    const safetyCritical = input.safetyCritical ?? canonicalDefinitions.some(reason => reason.safetyCritical);
    const normalizedInput: Required<ValidatedPolicyEvaluationInput> = {
      ...input,
      reasons: canonicalDefinitions.map(reason => reason.code),
      safetyCritical,
    };
    const rule = [...policy.routePrecedence]
      .sort((left, right) => left.priority - right.priority)
      .find(candidate => evaluateCondition(candidate.when, normalizedInput));
    if (!rule) return { ...FAIL_CLOSED, reasons: [...FAIL_CLOSED.reasons] };

    const compatible = canonicalDefinitions.filter(reason => reason.allowedRoutes.includes(rule.route));
    const incompatible = canonicalDefinitions.filter(reason => !reason.allowedRoutes.includes(rule.route));
    if (incompatible.length > 0) {
      const inputReasonSet = new Set(normalizedInput.reasons);
      const compatibleTriggers = matchedReasonCodes(rule.when, inputReasonSet)
        .filter(code => reasonByCode.get(code)?.allowedRoutes.includes(rule.route));
      if (compatibleTriggers.length === 0) {
        return { ...FAIL_CLOSED, reasons: [...FAIL_CLOSED.reasons] };
      }
    }

    const action = rule.nextActions[0];
    if (!action || !LEGAL_ACTIONS[rule.route].has(action)) {
      return { ...FAIL_CLOSED, reasons: [...FAIL_CLOSED.reasons] };
    }
    return {
      route: rule.route,
      action,
      reasons: compatible.map(reason => reason.code),
      matchedRule: rule.id,
      degraded: false,
    };
  } catch {
    return { ...FAIL_CLOSED, reasons: [...FAIL_CLOSED.reasons] };
  }
}
