#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const ROUTER_PATH = path.join(ROOT, 'core/host/align-route.sh');
const STRUCTURED_CLI_PATH = path.join(ROOT, 'dist/runtime/runtime/index.js');
const EVIDENCE_DIR = path.join(ROOT, 'docs/planning/evidence/w7');

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function loadJsonl(file) {
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function resolveWithinRoot(relativePath) {
  const resolved = path.resolve(ROOT, relativePath);
  const relative = path.relative(ROOT, resolved);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `path escapes repository: ${relativePath}`);
  return resolved;
}

function runProductionDecision(testCase) {
  const result = spawnSync('bash', [ROUTER_PATH, '--decision', testCase.request], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
    env: {
      ...process.env,
      ALIGN_ARBITER: 'off',
      ALIGN_CONTEXT_REFS: (testCase.contextRefs || []).join(',')
    }
  });
  assert.strictEqual(result.error, undefined, `router failed to start: ${testCase.id}`);
  assert.strictEqual(result.status, 0, `router failed: ${testCase.id}: ${result.stderr.trim()}`);
  const fields = result.stdout.trim().split('\t');
  assert.strictEqual(fields.length, 4, `invalid --decision projection: ${testCase.id}`);
  const [route, reasons, action, degraded] = fields;
  assert(['pass', 'enrich', 'clarify', 'block'].includes(route), `invalid route: ${testCase.id}`);
  assert(reasons.length > 0, `missing reasons: ${testCase.id}`);
  assert(['execute', 'ask', 'wait_confirmation', 'stop'].includes(action), `invalid action: ${testCase.id}`);
  assert(['true', 'false'].includes(degraded), `invalid degraded flag: ${testCase.id}`);
  return { route, reasons: reasons.split(','), action, degraded: degraded === 'true' };
}

function runStructuredDecision(testCase) {
  const result = spawnSync(process.execPath, [
    STRUCTURED_CLI_PATH,
    'json',
    testCase.request,
    '--project-dir',
    ROOT
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
    env: { ...process.env, ALIGN_ARBITER: 'off' }
  });
  assert.strictEqual(result.error, undefined, `structured runtime failed to start: ${testCase.id}`);
  assert.strictEqual(result.status, 0, `structured runtime failed: ${testCase.id}: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}

function percent(passing, total) {
  return total === 0 ? 0 : Number(((passing / total) * 100).toFixed(2));
}

const manifestPath = path.resolve(arg('--manifest', ''));
assert(process.argv.includes('--manifest'), 'usage: verify-w7-production-corpus.js --manifest <path> [--regression] [--evidence-prefix <prefix>]');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const regression = process.argv.includes('--regression');
const evidencePrefix = arg('--evidence-prefix', regression ? `${manifest.evidencePrefix}-regression` : manifest.evidencePrefix);
assert(/^[a-z0-9-]+$/.test(evidencePrefix), 'evidence prefix must contain only lowercase letters, digits, and hyphens');

const corpusPath = resolveWithinRoot(manifest.corpusPath);
const corpusBytes = fs.readFileSync(corpusPath);
const corpus = loadJsonl(corpusPath);
assert.strictEqual(manifest.status, 'frozen');
assert.strictEqual(manifest.frozenBeforeExecution, true);
assert.strictEqual(sha256(corpusBytes), manifest.corpusSha256, 'corpus hash differs from frozen manifest');
assert.strictEqual(corpus.length, manifest.caseCount);

const ids = new Set();
const categoryCounts = {};
for (const testCase of corpus) {
  assert(!ids.has(testCase.id), `duplicate id: ${testCase.id}`);
  assert(testCase.expected && testCase.expected.route && Array.isArray(testCase.expected.reasons), `missing oracle: ${testCase.id}`);
  assert.strictEqual(typeof testCase.safetyCritical, 'boolean', `missing safetyCritical: ${testCase.id}`);
  assert.strictEqual(typeof testCase.sufficientLowRisk, 'boolean', `missing sufficientLowRisk: ${testCase.id}`);
  ids.add(testCase.id);
  categoryCounts[testCase.category] = (categoryCounts[testCase.category] || 0) + 1;
}
assert.deepStrictEqual(categoryCounts, manifest.categoryCounts);

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
const executionPath = path.join(EVIDENCE_DIR, `${evidencePrefix}-production-execution.json`);
const blindInputPath = path.join(EVIDENCE_DIR, `${evidencePrefix}-blind-input.jsonl`);
const gatePath = path.join(EVIDENCE_DIR, `${evidencePrefix}-production-gate.json`);
if (!regression) {
  assert(!fs.existsSync(executionPath), `fresh corpus already consumed: ${path.relative(ROOT, executionPath)}`);
} else {
  const originalExecution = path.join(EVIDENCE_DIR, `${manifest.evidencePrefix}-production-execution.json`);
  assert(fs.existsSync(originalExecution), 'regression requires the original fresh execution evidence');
}

const results = [];
const blindInput = [];
for (const testCase of corpus) {
  const actual = runProductionDecision(testCase);
  const needsStructuredDecision = actual.route === 'clarify' || Boolean(testCase.acceptanceOracle);
  const structured = needsStructuredDecision ? runStructuredDecision(testCase) : null;
  const question = structured && structured.next && structured.next.question ? structured.next.question : null;
  if (actual.route === 'clarify') {
    blindInput.push({ caseId: testCase.id, request: testCase.request, question });
  }

  const acceptanceText = structured
    ? structured.acceptance.map(item => `${item.method.kind}:${item.method.value} ${item.criterion}`).join('\n')
    : '';
  const acceptanceRelevant = testCase.acceptanceOracle
    ? acceptanceText.includes(testCase.acceptanceOracle.mustInclude)
    : null;
  results.push({
    caseId: testCase.id,
    category: testCase.category,
    request: testCase.request,
    safetyCritical: testCase.safetyCritical,
    sufficientLowRisk: testCase.sufficientLowRisk,
    expected: testCase.expected,
    actual,
    assertions: {
      route: actual.route === testCase.expected.route,
      reasons: JSON.stringify(actual.reasons) === JSON.stringify(testCase.expected.reasons),
      action: actual.action === testCase.expected.action
    },
    structured: structured ? {
      route: structured.route,
      reasons: structured.reasons,
      question,
      acceptance: structured.acceptance
    } : null,
    acceptanceRelevant
  });
}

const exactFailures = results.filter(record => !Object.values(record.assertions).every(Boolean));
const byCategory = {};
for (const [category, total] of Object.entries(manifest.categoryCounts)) {
  const records = results.filter(record => record.category === category);
  const passing = records.filter(record => record.assertions.route).length;
  byCategory[category] = { passing, total, percent: percent(passing, total) };
}
const safetyCases = results.filter(record => record.safetyCritical);
const highRiskMisses = safetyCases.filter(record => ['pass', 'enrich'].includes(record.actual.route));
const completeCases = results.filter(record => record.sufficientLowRisk);
const unnecessaryBlocks = completeCases.filter(record => ['clarify', 'block'].includes(record.actual.route));
const acceptanceCases = results.filter(record => record.acceptanceRelevant !== null);
const relevantAcceptance = acceptanceCases.filter(record => record.acceptanceRelevant);
const questionCases = results.filter(record => record.actual.route === 'clarify');
const questionsPresent = questionCases.filter(record => record.structured && record.structured.question);

const metrics = {
  highRiskMissRate: { misses: highRiskMisses.length, total: safetyCases.length, percent: percent(highRiskMisses.length, safetyCases.length) },
  unnecessaryBlockRate: { blocked: unnecessaryBlocks.length, total: completeCases.length, percent: percent(unnecessaryBlocks.length, completeCases.length) },
  routeAppropriatenessByCategory: byCategory,
  acceptanceRelevance: { passing: relevantAcceptance.length, total: acceptanceCases.length, percent: percent(relevantAcceptance.length, acceptanceCases.length) },
  generatedQuestionAvailability: { passing: questionsPresent.length, total: questionCases.length, percent: percent(questionsPresent.length, questionCases.length) }
};
const gates = {
  exactProductionAssertions: exactFailures.length === 0,
  highRiskMissRate: metrics.highRiskMissRate.percent <= manifest.releaseGate.highRiskMissRatePercent,
  unnecessaryBlockRate: metrics.unnecessaryBlockRate.percent <= manifest.releaseGate.unnecessaryBlockRatePercent,
  routeAppropriateness: Object.values(byCategory).every(metric => metric.percent >= manifest.releaseGate.routeAppropriatenessPercent),
  acceptanceRelevance: metrics.acceptanceRelevance.percent >= manifest.releaseGate.acceptanceRelevancePercent,
  generatedQuestionAvailability: metrics.generatedQuestionAvailability.percent === 100
};
const productionGatePassed = Object.values(gates).every(Boolean);
const executedAt = new Date().toISOString();
const evidence = {
  schemaVersion: '1.0.0',
  evidenceKind: regression ? 'consumed-corpus-production-regression' : 'fresh-blind-production-execution',
  corpusId: manifest.corpusId,
  corpusSha256: manifest.corpusSha256,
  manifestPath: path.relative(ROOT, manifestPath).replace(/\\/g, '/'),
  routerPath: path.relative(ROOT, ROUTER_PATH).replace(/\\/g, '/'),
  routerSha256: sha256(fs.readFileSync(ROUTER_PATH)),
  structuredRuntimePath: path.relative(ROOT, STRUCTURED_CLI_PATH).replace(/\\/g, '/'),
  structuredRuntimeSha256: sha256(fs.readFileSync(STRUCTURED_CLI_PATH)),
  invocation: 'bash core/host/align-route.sh --decision <request>',
  executedAt,
  consumedAt: executedAt,
  results
};
const gateSummary = {
  schemaVersion: '1.0.0',
  evidenceKind: regression ? 'consumed-corpus-production-regression-gate' : 'fresh-blind-production-gate',
  corpusId: manifest.corpusId,
  corpusSha256: manifest.corpusSha256,
  executedAt,
  metrics,
  thresholds: manifest.releaseGate,
  gates,
  exactFailures: exactFailures.map(record => ({
    caseId: record.caseId,
    expected: record.expected,
    actual: record.actual,
    assertions: record.assertions
  })),
  productionGatePassed,
  blindReviewPending: productionGatePassed
};

fs.writeFileSync(executionPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
fs.writeFileSync(blindInputPath, blindInput.map(record => JSON.stringify(record)).join('\n') + '\n', 'utf8');
gateSummary.blindInputSha256 = sha256(fs.readFileSync(blindInputPath));
fs.writeFileSync(gatePath, `${JSON.stringify(gateSummary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(gateSummary, null, 2));
if (!productionGatePassed) process.exitCode = 2;
