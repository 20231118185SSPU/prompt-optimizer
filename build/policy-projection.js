#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BEGIN_MARKER = '# policy-projection:begin';
const END_MARKER = '# policy-projection:end';
const SUPPORTED_OPERATORS = new Set([
  'all',
  'any',
  'not',
  'reason_any',
  'score_total',
  'minimum_dimension',
  'assumption_count',
  'scores_equal',
  'safety_critical',
  'always'
]);
const ROUTE_ACTIONS = new Map([
  ['pass', new Set(['execute'])],
  ['enrich', new Set(['execute'])],
  ['clarify', new Set(['ask'])],
  ['block', new Set(['wait_confirmation', 'stop'])]
]);
const SCHEMA_KEYWORDS = new Set([
  '$schema', '$id', '$ref', '$defs', 'title', 'type', 'additionalProperties',
  'required', 'properties', 'oneOf', 'const', 'enum', 'minimum', 'maximum',
  'minItems', 'uniqueItems', 'items', 'minLength', 'pattern'
]);
const TRUSTED_SCHEMA_DIGEST = 'd233dfe3659a67dbff614fb5d6c7dd87a5330fcfaa7e68445641709d0b804aa1';

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const repoRoot = path.resolve(__dirname, '..');
  const options = {
    mode: 'check',
    policy: path.join(repoRoot, 'core', 'contracts', 'decision-policy.json'),
    schema: path.join(repoRoot, 'core', 'contracts', 'decision-policy.schema.json'),
    registry: path.join(repoRoot, 'core', 'contracts', 'reason-registry.json'),
    router: path.join(repoRoot, 'core', 'host', 'align-route.sh')
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (['--check', '--write', '--render', '--validate'].includes(argument)) {
      options.mode = argument.slice(2);
      continue;
    }
    if (['--policy', '--schema', '--registry', '--router'].includes(argument)) {
      const value = argv[index + 1];
      if (!value) fail(`Missing value for ${argument}`);
      options[argument.slice(2)] = path.resolve(value);
      index += 1;
      continue;
    }
    fail(`Unknown argument: ${argument}`);
  }
  return options;
}

function readJson(file, label) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(`${label} is missing or unreadable: ${file}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`${label} is not valid JSON: ${file}: ${error.message}`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function fileDigest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function schemaPointer(root, reference) {
  if (!reference.startsWith('#/')) fail(`Only local JSON Schema references are supported: ${reference}`);
  return reference.slice(2).split('/').reduce((current, segment) => {
    const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!current || typeof current !== 'object' || !(key in current)) {
      fail(`Unresolvable JSON Schema reference: ${reference}`);
    }
    return current[key];
  }, root);
}

function validateSchemaNode(schema, root, location = '#') {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    fail(`Invalid JSON Schema node at ${location}`);
  }
  for (const keyword of Object.keys(schema)) {
    if (!SCHEMA_KEYWORDS.has(keyword)) fail(`Unsupported JSON Schema keyword at ${location}: ${keyword}`);
  }
  if ('$ref' in schema) schemaPointer(root, schema.$ref);
  if ('type' in schema && !['object', 'array', 'string', 'integer', 'boolean'].includes(schema.type)) {
    fail(`Unsupported JSON Schema type at ${location}: ${schema.type}`);
  }
  if ('pattern' in schema) {
    try { new RegExp(schema.pattern); } catch (error) { fail(`Invalid pattern at ${location}`); }
  }
  if (schema.properties) {
    if (typeof schema.properties !== 'object' || Array.isArray(schema.properties)) fail(`Invalid properties at ${location}`);
    for (const [key, child] of Object.entries(schema.properties)) validateSchemaNode(child, root, `${location}/properties/${key}`);
  }
  if (schema.$defs) {
    if (typeof schema.$defs !== 'object' || Array.isArray(schema.$defs)) fail(`Invalid $defs at ${location}`);
    for (const [key, child] of Object.entries(schema.$defs)) validateSchemaNode(child, root, `${location}/$defs/${key}`);
  }
  if (schema.items) validateSchemaNode(schema.items, root, `${location}/items`);
  if (schema.oneOf) {
    if (!Array.isArray(schema.oneOf) || schema.oneOf.length === 0) fail(`Invalid oneOf at ${location}`);
    schema.oneOf.forEach((child, index) => validateSchemaNode(child, root, `${location}/oneOf/${index}`));
  }
}

function valueTypeMatches(value, type) {
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}

function schemaErrors(value, schema, root, location = '$') {
  if (schema.$ref) return schemaErrors(value, schemaPointer(root, schema.$ref), root, location);
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(candidate => schemaErrors(value, candidate, root, location).length === 0);
    return matches.length === 1 ? [] : [`${location} must match exactly one schema branch (matched ${matches.length})`];
  }
  const errors = [];
  if (schema.type && !valueTypeMatches(value, schema.type)) {
    return [`${location} must be ${schema.type}`];
  }
  if ('const' in schema && !sameValue(value, schema.const)) errors.push(`${location} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some(candidate => sameValue(value, candidate))) errors.push(`${location} is not in the enum`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${location} is below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${location} is above maximum`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${location} is shorter than minLength`);
    if (schema.pattern !== undefined && !(new RegExp(schema.pattern)).test(value)) errors.push(`${location} does not match pattern`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${location} has too few items`);
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) errors.push(`${location} has duplicate items`);
    if (schema.items) value.forEach((item, index) => errors.push(...schemaErrors(item, schema.items, root, `${location}[${index}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required || []) {
      if (!(required in value)) errors.push(`${location}.${required} is required`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in value) errors.push(...schemaErrors(value[key], child, root, `${location}.${key}`));
    }
    if (schema.additionalProperties === false) {
      const known = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(value)) if (!known.has(key)) errors.push(`${location}.${key} is not allowed`);
    }
  }
  return errors;
}

function assertExactKeys(value, keys, location) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!sameValue(actual, expected)) fail(`${location} must contain exactly: ${expected.join(', ')}`);
}

function validateRegistry(registry) {
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) fail('Reason registry must be an object');
  assertExactKeys(registry, ['schemaVersion', 'kind', 'ordering', 'reasons'], 'reason registry');
  if (registry.schemaVersion !== '1.0.0' || registry.kind !== 'alignment.reason-registry' || registry.ordering !== 'priority_then_code') {
    fail('Unsupported reason registry version, kind, or ordering');
  }
  if (!Array.isArray(registry.reasons) || registry.reasons.length === 0) fail('Reason registry must contain reasons');
  const codes = new Set();
  for (const [index, reason] of registry.reasons.entries()) {
    const location = `reason registry entry ${index}`;
    if (!reason || typeof reason !== 'object' || Array.isArray(reason)) fail(`${location} must be an object`);
    assertExactKeys(reason, ['code', 'meaning', 'priority', 'appliesTo', 'allowedRoutes', 'safetyCritical'], location);
    if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(reason.code)) fail(`${location} has invalid code`);
    if (codes.has(reason.code)) fail(`Duplicate reason code: ${reason.code}`);
    codes.add(reason.code);
    if (typeof reason.meaning !== 'string' || reason.meaning.length === 0) fail(`${reason.code} has no meaning`);
    if (!Number.isInteger(reason.priority) || reason.priority < 0) fail(`${reason.code} has invalid priority`);
    if (!Array.isArray(reason.appliesTo) || reason.appliesTo.length === 0 ||
        reason.appliesTo.some(stage => !['decision', 'baseline', 'completion'].includes(stage))) fail(`${reason.code} has invalid appliesTo`);
    if (!Array.isArray(reason.allowedRoutes) || reason.allowedRoutes.some(route => !ROUTE_ACTIONS.has(route))) {
      fail(`${reason.code} has an unknown allowed route`);
    }
    if (new Set(reason.allowedRoutes).size !== reason.allowedRoutes.length) fail(`${reason.code} has duplicate allowed routes`);
    if (typeof reason.safetyCritical !== 'boolean') fail(`${reason.code} has invalid safetyCritical`);
  }
  const degraded = registry.reasons.find(reason => reason.code === 'runtime.degraded');
  if (!degraded || !degraded.appliesTo.includes('decision') || !degraded.allowedRoutes.includes('clarify')) {
    fail('Reason registry must define runtime.degraded for fail-closed clarify decisions');
  }
  return new Map(registry.reasons.map(reason => [reason.code, reason]));
}

function walkCondition(condition, visit) {
  visit(condition);
  if (condition.op === 'all' || condition.op === 'any') condition.conditions.forEach(child => walkCondition(child, visit));
  if (condition.op === 'not') walkCondition(condition.condition, visit);
}

function validatePolicySemantics(policy, reasons) {
  if (policy.schemaVersion !== '1.0.0' || policy.kind !== 'alignment.decision-policy' ||
      policy.evaluation !== 'first_match_wins' || policy.unknownOperator !== 'fail_closed') {
    fail('Unsupported policy version, kind, evaluation mode, or unknown-operator behavior');
  }
  const ids = new Set();
  const priorities = new Set();
  for (const rule of policy.routePrecedence) {
    if (ids.has(rule.id)) fail(`Duplicate policy rule id: ${rule.id}`);
    if (priorities.has(rule.priority)) fail(`Duplicate policy priority: ${rule.priority}`);
    ids.add(rule.id);
    priorities.add(rule.priority);
    const allowedActions = ROUTE_ACTIONS.get(rule.route);
    if (!allowedActions || rule.nextActions.some(action => !allowedActions.has(action))) {
      fail(`Unknown route/action combination in ${rule.id}: ${rule.route}/${rule.nextActions.join(',')}`);
    }
    walkCondition(rule.when, condition => {
      if (!SUPPORTED_OPERATORS.has(condition.op)) fail(`Unknown policy operator in ${rule.id}: ${condition.op}`);
      if (condition.op === 'reason_any') {
        for (const code of condition.codes) {
          const reason = reasons.get(code);
          if (!reason) fail(`Unknown reason in ${rule.id}: ${code}`);
          if (!reason.appliesTo.includes('decision')) fail(`Non-decision reason used by ${rule.id}: ${code}`);
        }
      }
    });
  }
  for (const annotation of policy.annotationRules) {
    const reason = reasons.get(annotation.requiresReason);
    if (!reason || !reason.appliesTo.includes('decision')) fail(`Unknown annotation reason: ${annotation.requiresReason}`);
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function compileCondition(condition) {
  switch (condition.op) {
    case 'always':
      return ':';
    case 'reason_any':
      return `policy_reason_any ${condition.codes.map(shellQuote).join(' ')}`;
    case 'score_total':
      return `policy_score_total ${shellQuote(condition.source)} ${shellQuote(condition.comparator)} ${shellQuote(condition.value ?? condition.min)}${condition.comparator === 'between' ? ` ${shellQuote(condition.max)}` : ''}`;
    case 'minimum_dimension':
      return `policy_minimum_dimension ${shellQuote(condition.source)} ${shellQuote(condition.comparator)} ${shellQuote(condition.value)}`;
    case 'assumption_count':
      return `policy_assumption_count ${shellQuote(condition.comparator)} ${shellQuote(condition.value)}`;
    case 'scores_equal':
      return `policy_scores_equal ${shellQuote(condition.value)}`;
    case 'safety_critical':
      return `policy_safety_critical ${shellQuote(condition.value)}`;
    case 'not':
      return `! ( ${compileCondition(condition.condition)} )`;
    case 'all':
      return `( ${condition.conditions.map(compileCondition).join(' && ')} )`;
    case 'any':
      return `( ${condition.conditions.map(compileCondition).join(' || ')} )`;
    default:
      fail(`Unknown policy operator during projection: ${condition.op}`);
  }
}

function renderProjection(policy, schema, registry, sourceHashes) {
  const policyHash = digest(policy);
  const registryHash = digest(registry);
  const combinedHash = digest({ policy, schema, registry });
  const lines = [
    BEGIN_MARKER,
    '# Generated from core/contracts/decision-policy.json and reason-registry.json.',
    '# Do not edit this block manually; run: node build/policy-projection.js --write',
    `POLICY_PROJECTION_SHA256=${shellQuote(combinedHash)}`,
    `POLICY_PROJECTION_POLICY_SHA256=${shellQuote(policyHash)}`,
    `POLICY_PROJECTION_REGISTRY_SHA256=${shellQuote(registryHash)}`,
    `POLICY_PROJECTION_POLICY_FILE_SHA256=${shellQuote(sourceHashes.policy)}`,
    `POLICY_PROJECTION_SCHEMA_FILE_SHA256=${shellQuote(sourceHashes.schema)}`,
    `POLICY_PROJECTION_REGISTRY_FILE_SHA256=${shellQuote(sourceHashes.registry)}`,
    `POLICY_PROJECTION_VERSION=${shellQuote(policy.schemaVersion)}`,
    `POLICY_THRESHOLD_PASS_MINIMUM_TOTAL=${shellQuote(policy.thresholds.passMinimumTotal)}`,
    `POLICY_THRESHOLD_EXECUTION_MINIMUM_TOTAL=${shellQuote(policy.thresholds.executionMinimumTotal)}`,
    `POLICY_THRESHOLD_EXECUTION_MINIMUM_DIMENSION=${shellQuote(policy.thresholds.executionMinimumDimension)}`,
    `POLICY_THRESHOLD_MAXIMUM_ASSUMPTIONS=${shellQuote(policy.thresholds.maximumAssumptionsForExecution)}`,
    '',
    'policy_projection_reason_meta() {',
    '  case "$1" in'
  ];
  for (const reason of registry.reasons) {
    lines.push(`    ${shellQuote(reason.code)}) printf '%s\\t%s\\t%s\\n' ${shellQuote(reason.priority)} ${shellQuote(reason.allowedRoutes.join(','))} ${shellQuote(reason.safetyCritical)} ;;`);
  }
  lines.push('    *) return 1 ;;', '  esac', '}', '', 'policy_projection_action_allowed() {', '  case "$1:$2" in');
  const pairs = [...new Set(policy.routePrecedence.flatMap(rule => rule.nextActions.map(action => `${rule.route}:${action}`)))].sort();
  lines.push(`    ${pairs.map(shellQuote).join('|')}) return 0 ;;`, '    *) return 1 ;;', '  esac', '}', '', 'policy_projection_evaluate() {', '  POLICY_ROUTE=', '  POLICY_ACTION=');
  const rules = policy.routePrecedence.map((rule, index) => ({ rule, index }))
    .sort((left, right) => left.rule.priority - right.rule.priority || left.index - right.index)
    .map(entry => entry.rule);
  for (const rule of rules) {
    lines.push(`  # ${rule.priority}: ${rule.id}`, `  if ${compileCondition(rule.when)}; then`, `    POLICY_ROUTE=${shellQuote(rule.route)}`, `    POLICY_ACTION=${shellQuote(rule.nextActions[0])}`, '    return 0', '  fi');
  }
  lines.push('  return 1', '}', END_MARKER);
  return `${lines.join('\n')}\n`;
}

function loadAndValidate(options) {
  const schema = readJson(options.schema, 'Decision policy schema');
  validateSchemaNode(schema, schema);
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
      schema.$id !== 'https://prompt-optimizer.dev/contracts/decision-policy/1.0.0') {
    fail('Unsupported decision policy schema identity');
  }
  if (digest(schema) !== TRUSTED_SCHEMA_DIGEST) fail('Decision policy schema fingerprint is not trusted');
  const policy = readJson(options.policy, 'Decision policy');
  const errors = schemaErrors(policy, schema, schema);
  if (errors.length > 0) fail(`Decision policy schema validation failed: ${errors.slice(0, 5).join('; ')}`);
  const registry = readJson(options.registry, 'Reason registry');
  const reasons = validateRegistry(registry);
  validatePolicySemantics(policy, reasons);
  return {
    policy,
    schema,
    registry,
    sourceHashes: {
      policy: fileDigest(options.policy),
      schema: fileDigest(options.schema),
      registry: fileDigest(options.registry)
    }
  };
}

function replaceProjection(router, projection) {
  const begin = router.indexOf(BEGIN_MARKER);
  const end = router.indexOf(END_MARKER);
  if (begin < 0 || end < begin) fail('Router is missing policy projection markers');
  const after = end + END_MARKER.length;
  return `${router.slice(0, begin)}${projection.trimEnd()}${router.slice(after)}`.replace(/\r\n?/g, '\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { policy, schema, registry, sourceHashes } = loadAndValidate(options);
  const projection = renderProjection(policy, schema, registry, sourceHashes);
  if (options.mode === 'validate') return;
  if (options.mode === 'render') {
    process.stdout.write(projection);
    return;
  }
  let router;
  try { router = fs.readFileSync(options.router, 'utf8').replace(/\r\n?/g, '\n'); } catch (error) {
    fail(`Router is missing or unreadable: ${options.router}`);
  }
  const updated = replaceProjection(router, projection);
  if (options.mode === 'check') {
    if (updated !== router) fail(`Stale shell policy projection: ${options.router}`);
    return;
  }
  if (options.mode === 'write') {
    fs.writeFileSync(options.router, updated, 'utf8');
    return;
  }
  fail(`Unsupported mode: ${options.mode}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`policy-projection: ${error.message}\n`);
  process.exitCode = 1;
}
