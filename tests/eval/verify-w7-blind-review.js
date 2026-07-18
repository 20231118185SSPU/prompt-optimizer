#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
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

function percent(passing, total) {
  return total === 0 ? 0 : Number(((passing / total) * 100).toFixed(2));
}

assert(process.argv.includes('--manifest'), 'usage: verify-w7-blind-review.js --manifest <path> --review <path>');
assert(process.argv.includes('--review'), 'blind review path is required');
const manifest = JSON.parse(fs.readFileSync(path.resolve(arg('--manifest')), 'utf8'));
const review = JSON.parse(fs.readFileSync(path.resolve(arg('--review')), 'utf8'));
const prefix = manifest.evidencePrefix;
const blindInputPath = path.join(EVIDENCE_DIR, `${prefix}-blind-input.jsonl`);
const productionGatePath = path.join(EVIDENCE_DIR, `${prefix}-production-gate.json`);
const releaseGatePath = path.join(EVIDENCE_DIR, `${prefix}-release-gate.json`);
const blindInput = loadJsonl(blindInputPath);
const production = JSON.parse(fs.readFileSync(productionGatePath, 'utf8'));

assert.strictEqual(production.productionGatePassed, true, 'production gate must pass before blind review');
assert.strictEqual(review.evidenceKind, 'independent-blind-review');
assert.strictEqual(review.corpusId, manifest.corpusId);
assert.strictEqual(review.inputSha256, sha256(fs.readFileSync(blindInputPath)));
assert.strictEqual(review.reviewer.independentSubAgent, true);
assert.deepStrictEqual(review.reviewer.blindedTo, [
  'expected route and reasons',
  'router implementation',
  'reference answers'
]);

const inputIds = blindInput.map(record => record.caseId).sort();
const reviewIds = review.records.map(record => record.caseId).sort();
assert.deepStrictEqual(reviewIds, inputIds, 'blind review must cover every generated question exactly once');
for (const record of review.records) {
  assert.strictEqual(typeof record.highestValueQuestion, 'boolean', `missing highestValueQuestion: ${record.caseId}`);
  assert.strictEqual(typeof record.oneQuestion, 'boolean', `missing oneQuestion: ${record.caseId}`);
  assert.strictEqual(typeof record.hasRecommendation, 'boolean', `missing hasRecommendation: ${record.caseId}`);
  assert(record.rationale, `missing rationale: ${record.caseId}`);
}

const passing = review.records.filter(record =>
  record.highestValueQuestion && record.oneQuestion && record.hasRecommendation
).length;
const highestValueQuestion = {
  passing,
  total: review.records.length,
  percent: percent(passing, review.records.length)
};
const reviewGatePassed = highestValueQuestion.percent >= manifest.releaseGate.highestValueQuestionPercent;
const releaseGate = {
  schemaVersion: '1.0.0',
  evidenceKind: 'w7-release-gate',
  corpusId: manifest.corpusId,
  corpusSha256: manifest.corpusSha256,
  production,
  independentBlindReview: {
    inputSha256: review.inputSha256,
    reviewer: review.reviewer,
    highestValueQuestion,
    reviewGatePassed
  },
  releaseGatePassed: production.productionGatePassed && reviewGatePassed
};
fs.writeFileSync(releaseGatePath, `${JSON.stringify(releaseGate, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(releaseGate, null, 2));
if (!releaseGate.releaseGatePassed) process.exitCode = 2;
