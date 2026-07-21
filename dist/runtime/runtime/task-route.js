// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_ROUTE_MISSING_FIELDS = exports.TASK_FAMILIES = void 0;
exports.isTaskRoute = isTaskRoute;
exports.resolveTaskRoute = resolveTaskRoute;
exports.TASK_FAMILIES = ['change', 'inspect', 'design', 'produce', 'operate'];
exports.TASK_ROUTE_MISSING_FIELDS = [
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
];
const familySet = new Set(exports.TASK_FAMILIES);
const missingFieldSet = new Set(exports.TASK_ROUTE_MISSING_FIELDS);
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function hasOnlyKeys(value, keys) {
    const allowed = new Set(keys);
    return Object.keys(value).every(key => allowed.has(key));
}
function isTaskFamily(value) {
    return typeof value === 'string' && familySet.has(value);
}
function isTaskRoute(value) {
    if (!isRecord(value) || !hasOnlyKeys(value, [
        'schemaVersion', 'primary', 'secondary', 'rationale', 'confidence', 'missing'
    ]))
        return false;
    if (value.schemaVersion !== '1.0.0')
        return false;
    if (value.primary === 'unknown') {
        return Array.isArray(value.secondary) && value.secondary.length === 0 &&
            Array.isArray(value.rationale) && value.rationale.length === 0 &&
            value.confidence === 0 &&
            Array.isArray(value.missing) && value.missing.length <= 20 &&
            value.missing.every(item => typeof item === 'string' && missingFieldSet.has(item)) &&
            value.missing.includes('semantic_task_route') &&
            new Set(value.missing).size === value.missing.length;
    }
    if (!isTaskFamily(value.primary))
        return false;
    if (!Array.isArray(value.secondary) || value.secondary.length > 2 ||
        !value.secondary.every(isTaskFamily))
        return false;
    if (new Set(value.secondary).size !== value.secondary.length || value.secondary.includes(value.primary)) {
        return false;
    }
    if (!Array.isArray(value.rationale) || value.rationale.length !== value.secondary.length + 1) {
        return false;
    }
    const selectedModules = new Set([value.primary, ...value.secondary]);
    const rationaleModules = new Set();
    for (const item of value.rationale) {
        if (!isRecord(item) || !hasOnlyKeys(item, ['module', 'reason']) ||
            !isTaskFamily(item.module) || !selectedModules.has(item.module) ||
            typeof item.reason !== 'string' || item.reason.trim().length === 0 || item.reason.length > 500) {
            return false;
        }
        rationaleModules.add(item.module);
    }
    if (rationaleModules.size !== selectedModules.size)
        return false;
    if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) ||
        value.confidence < 0 || value.confidence > 1)
        return false;
    if (!Array.isArray(value.missing) || value.missing.length > 20 ||
        !value.missing.every(item => typeof item === 'string' && missingFieldSet.has(item))) {
        return false;
    }
    return new Set(value.missing).size === value.missing.length;
}
function degradedTaskRoute() {
    return {
        schemaVersion: '1.0.0',
        primary: 'unknown',
        secondary: [],
        rationale: [],
        confidence: 0,
        missing: ['semantic_task_route']
    };
}
function resolveTaskRoute(model) {
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
//# sourceMappingURL=task-route.js.map
