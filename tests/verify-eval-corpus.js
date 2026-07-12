#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cases = fs.readFileSync(path.join(__dirname, 'eval/corpus.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'eval/context-fixtures.json'), 'utf8'));
const verificationCommands = JSON.parse(fs.readFileSync(path.join(__dirname, 'eval/verification-commands.json'), 'utf8'));
const expectedCounts = {
  simple_complete: 10,
  context_resolvable: 10,
  low_score_clarify: 10,
  high_risk: 10,
  xy_symptom_local: 8,
  adversarial_context: 8
};
const ids = new Set();
const counts = {};
for (const testCase of cases) {
  if (ids.has(testCase.id)) throw new Error(`duplicate case id: ${testCase.id}`);
  ids.add(testCase.id);
  counts[testCase.category] = (counts[testCase.category] || 0) + 1;
  if (!['pass', 'enrich', 'clarify', 'block'].includes(testCase.expected.route)) throw new Error(`invalid route: ${testCase.id}`);
  if (testCase.contextFixture && (!fixtures[testCase.contextFixture] || !verificationCommands[testCase.contextFixture])) {
    throw new Error(`incomplete fixture: ${testCase.id}`);
  }
  if (!testCase.expected.oracle) throw new Error(`missing oracle: ${testCase.id}`);
}
if (JSON.stringify(counts) !== JSON.stringify(expectedCounts)) throw new Error(`category counts differ: ${JSON.stringify(counts)}`);
for (const file of ['run-eval.js', 'score-eval.js', 'run-runtime-routes.js', 'model-output.schema.json']) {
  if (!fs.existsSync(path.join(root, 'tests/eval', file))) throw new Error(`missing eval artifact: ${file}`);
}
console.log(`PASS: ${cases.length} frozen behavior cases with complete fixtures and oracles`);
