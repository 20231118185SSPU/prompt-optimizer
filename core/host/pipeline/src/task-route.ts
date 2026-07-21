export const TASK_FAMILIES = ['change', 'inspect', 'design', 'produce', 'operate'] as const;
export const TASK_ROUTE_MISSING_FIELDS = [
  'objective',
  'context',
  'scope',
  'deliverables',
  'constraints',
  'execution',
  'acceptance',
  'authorization',
  'recovery',
  'semantic_task_route'
] as const;

export type TaskFamily = typeof TASK_FAMILIES[number];
export type TaskRoutePrimary = TaskFamily | 'unknown';

export interface TaskRouteRationale {
  module: TaskFamily;
  reason: string;
}

export interface TaskRoute {
  schemaVersion: '1.0.0';
  primary: TaskRoutePrimary;
  secondary: TaskFamily[];
  rationale: TaskRouteRationale[];
  confidence: number;
  missing: string[];
}

export type AlignmentModelInput =
  | { status: 'available'; output: unknown }
  | { status: 'unavailable' }
  | { status: 'timeout' };

export type AlignmentMode = 'full' | 'degraded';
export type DegradedReason =
  | 'model_unavailable'
  | 'model_timeout'
  | 'model_output_invalid'
  | 'model_semantic_conflict'
  | 'context_budget_exceeded'
  | 'context_source_invalid'
  | 'context_stale'
  | 'context_conflict'
  | 'privacy_redaction_required';

export interface TaskRouteResolution {
  mode: AlignmentMode;
  degradedReasons: DegradedReason[];
  taskRoute: TaskRoute;
}

const familySet = new Set<string>(TASK_FAMILIES);
const missingFieldSet = new Set<string>(TASK_ROUTE_MISSING_FIELDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every(key => allowed.has(key));
}

function isTaskFamily(value: unknown): value is TaskFamily {
  return typeof value === 'string' && familySet.has(value);
}

export function isTaskRoute(value: unknown): value is TaskRoute {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'schemaVersion', 'primary', 'secondary', 'rationale', 'confidence', 'missing'
  ])) return false;
  if (value.schemaVersion !== '1.0.0') return false;
  if (value.primary === 'unknown') {
    return Array.isArray(value.secondary) && value.secondary.length === 0 &&
      Array.isArray(value.rationale) && value.rationale.length === 0 &&
      value.confidence === 0 &&
      Array.isArray(value.missing) && value.missing.length <= 20 &&
      value.missing.every(item => typeof item === 'string' && missingFieldSet.has(item)) &&
      value.missing.includes('semantic_task_route') &&
      new Set(value.missing).size === value.missing.length;
  }
  if (!isTaskFamily(value.primary)) return false;
  if (!Array.isArray(value.secondary) || value.secondary.length > 2 ||
      !value.secondary.every(isTaskFamily)) return false;
  if (new Set(value.secondary).size !== value.secondary.length || value.secondary.includes(value.primary)) {
    return false;
  }
  if (!Array.isArray(value.rationale) || value.rationale.length !== value.secondary.length + 1) {
    return false;
  }
  const selectedModules = new Set<TaskFamily>([value.primary, ...value.secondary]);
  const rationaleModules = new Set<TaskFamily>();
  for (const item of value.rationale) {
    if (!isRecord(item) || !hasOnlyKeys(item, ['module', 'reason']) ||
        !isTaskFamily(item.module) || !selectedModules.has(item.module) ||
        typeof item.reason !== 'string' || item.reason.trim().length === 0 || item.reason.length > 500) {
      return false;
    }
    rationaleModules.add(item.module);
  }
  if (rationaleModules.size !== selectedModules.size) return false;
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) ||
      value.confidence < 0 || value.confidence > 1) return false;
  if (!Array.isArray(value.missing) || value.missing.length > 20 ||
      !value.missing.every(item => typeof item === 'string' && missingFieldSet.has(item))) {
    return false;
  }
  return new Set(value.missing).size === value.missing.length;
}

function degradedTaskRoute(): TaskRoute {
  return {
    schemaVersion: '1.0.0',
    primary: 'unknown',
    secondary: [],
    rationale: [],
    confidence: 0,
    missing: ['semantic_task_route']
  };
}

export function resolveTaskRoute(model: AlignmentModelInput | undefined): TaskRouteResolution {
  if (!model || model.status === 'unavailable') {
    return { mode: 'degraded', degradedReasons: ['model_unavailable'], taskRoute: degradedTaskRoute() };
  }
  if (model.status === 'timeout') {
    return { mode: 'degraded', degradedReasons: ['model_timeout'], taskRoute: degradedTaskRoute() };
  }
  if (!isRecord(model.output) || !isTaskRoute(model.output.taskRoute)) {
    return { mode: 'degraded', degradedReasons: ['model_output_invalid'], taskRoute: degradedTaskRoute() };
  }
  return { mode: 'full', degradedReasons: [], taskRoute: model.output.taskRoute };
}
