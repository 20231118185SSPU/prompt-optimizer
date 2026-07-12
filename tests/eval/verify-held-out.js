#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const EVIDENCE_DIR = path.join(ROOT, 'docs/planning/evidence/g5');

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const manifestFile = path.resolve(arg('--manifest', path.join(__dirname, 'held-out-manifest.json')));
const evidencePrefix = arg('--evidence-prefix', 'held-out');
const allowFailedGate = process.argv.includes('--allow-failed-gate');
const skipReview = process.argv.includes('--skip-review');
if (!/^[a-z0-9-]+$/.test(evidencePrefix)) throw new Error('evidence prefix must contain only lowercase letters, digits, and hyphens');
const MANIFEST = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const CORPUS_FILE = path.resolve(ROOT, MANIFEST.corpusFile);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function loadJsonl(file) {
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function metric(records, field) {
  const applicable = records.filter(record => record[field] !== null);
  const passing = applicable.filter(record => record[field]).length;
  return {
    passing,
    total: applicable.length,
    percent: applicable.length === 0 ? 0 : Number(((passing / applicable.length) * 100).toFixed(2))
  };
}

const corpus = loadJsonl(CORPUS_FILE);
const comparisonFiles = ['corpus.jsonl', 'held-out-corpus.jsonl', 'held-out-retest-corpus.jsonl', 'held-out-final-corpus.jsonl']
  .map(file => path.resolve(__dirname, file))
  .filter(file => file !== CORPUS_FILE && fs.existsSync(file));
const priorIds = new Set(comparisonFiles.flatMap(file => loadJsonl(file).map(testCase => testCase.id)));
const ids = new Set();
const counts = {};

assert.strictEqual(MANIFEST.status, 'consumed', 'manifest must be marked consumed after the first run');
assert.strictEqual(MANIFEST.frozenBeforeExecution, true);
assert.strictEqual(sha256(fs.readFileSync(CORPUS_FILE)), MANIFEST.corpusSha256, 'corpus hash differs from manifest');
assert.strictEqual(corpus.length, MANIFEST.caseCount);
for (const testCase of corpus) {
  assert(!ids.has(testCase.id), `duplicate held-out id: ${testCase.id}`);
  assert(!priorIds.has(testCase.id), `held-out id overlaps an existing corpus: ${testCase.id}`);
  assert(testCase.expected && testCase.expected.oracle, `missing oracle: ${testCase.id}`);
  ids.add(testCase.id);
  counts[testCase.category] = (counts[testCase.category] || 0) + 1;
}
assert.deepStrictEqual(counts, MANIFEST.categoryCounts);

const evidence = loadJsonl(path.join(EVIDENCE_DIR, `${evidencePrefix}-runtime-routes.jsonl`));
const summary = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, `${evidencePrefix}-runtime-summary.json`), 'utf8'));
const blindInputFile = path.join(EVIDENCE_DIR, `${evidencePrefix}-blind-input.jsonl`);
const review = skipReview
  ? null
  : JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, `${evidencePrefix}-blind-review.json`), 'utf8'));

assert.strictEqual(evidence.length, corpus.length);
assert.strictEqual(summary.corpusSha256, MANIFEST.corpusSha256);
assert.strictEqual(summary.blindInputSha256, sha256(fs.readFileSync(blindInputFile)));
for (const record of evidence) {
  const expectedHighRiskMiss = record.expected.highRisk === true &&
    ['clarify', 'block'].includes(record.expected.route) &&
    !['clarify', 'block'].includes(record.actual.route);
  const expectedUnnecessaryClarification = record.expected.sufficientLowRisk === true && record.actual.route === 'clarify';
  assert.strictEqual(record.highRiskMiss, expectedHighRiskMiss, `high-risk scoring mismatch: ${record.caseId}`);
  assert.strictEqual(record.unnecessaryClarification, expectedUnnecessaryClarification, `clarification scoring mismatch: ${record.caseId}`);
}
if (review) {
  assert.strictEqual(review.evidenceKind, 'independent-blind-review');
  assert.strictEqual(review.corpusId, MANIFEST.corpusId);
  assert.strictEqual(review.inputSha256, summary.blindInputSha256);
  assert.deepStrictEqual(review.reviewer.blindedTo, ['expected.route', 'expected.oracle', 'runtime implementation', 'benchmark arm']);
  assert.strictEqual(review.records.length, corpus.length);
  assert.deepStrictEqual(new Set(review.records.map(record => record.caseId)), ids);
}

const metrics = review ? {
  routeAppropriate: metric(review.records, 'routeAppropriate'),
  highestValueQuestion: metric(review.records, 'highestValueQuestion'),
  acceptanceExecutable: metric(review.records, 'acceptanceExecutable'),
  directionSafety: metric(review.records, 'directionSafe')
} : null;
const gates = {
  highRiskMiss: summary.highRiskMissRatePercent <= MANIFEST.releaseGate.highRiskMissRatePercent,
  unnecessaryClarification: summary.unnecessaryClarificationRatePercent <= MANIFEST.releaseGate.unnecessaryClarificationRatePercent,
  independentRoute: metrics ? metrics.routeAppropriate.percent >= MANIFEST.releaseGate.independentRouteAppropriatePercent : null,
  independentQuestion: metrics ? metrics.highestValueQuestion.percent >= MANIFEST.releaseGate.independentHighestValueQuestionPercent : null,
  independentAcceptance: metrics ? metrics.acceptanceExecutable.percent >= MANIFEST.releaseGate.independentAcceptanceExecutablePercent : null,
  independentDirectionSafety: metrics ? metrics.directionSafety.percent >= MANIFEST.releaseGate.independentDirectionSafetyPercent : null
};
const rawGatePassed = !skipReview && Object.values(gates).every(value => value === true);
const acceptedDeviation = Boolean(MANIFEST.deviationAcceptance && MANIFEST.deviationAcceptance.accepted === true);
const gateSummary = {
  schemaVersion: '1.0.0',
  evidenceKind: 'held-out-release-gate',
  corpusId: MANIFEST.corpusId,
  corpusSha256: MANIFEST.corpusSha256,
  deterministic: {
    total: summary.total,
    routeCorrect: summary.routeCorrect,
    highRiskMissRatePercent: summary.highRiskMissRatePercent,
    unnecessaryClarificationRatePercent: summary.unnecessaryClarificationRatePercent,
    routeFailures: summary.routeFailures
  },
  independentReview: metrics,
  reviewSkipped: skipReview,
  thresholds: MANIFEST.releaseGate,
  gates,
  rawGatePassed,
  deviationAcceptance: MANIFEST.deviationAcceptance || null,
  releaseGatePassed: rawGatePassed || acceptedDeviation
};
fs.writeFileSync(path.join(EVIDENCE_DIR, `${evidencePrefix}-gate-summary.json`), `${JSON.stringify(gateSummary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(gateSummary, null, 2));
if (!gateSummary.releaseGatePassed && !allowFailedGate) process.exitCode = 2;
