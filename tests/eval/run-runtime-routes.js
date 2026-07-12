#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const RUNTIME = path.join(ROOT, 'dist/runtime/runtime/index.js');
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'context-fixtures.json'), 'utf8'));
const corpus = fs.readFileSync(path.join(__dirname, 'corpus.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);

function main() {
  const output = path.resolve(process.argv[2] || path.join(ROOT, 'docs/planning/evidence/g5/runtime-routes.jsonl'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, '', 'utf8');
  const records = [];
  for (const testCase of corpus) {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'align-runtime-eval-'));
    try {
      if (testCase.contextFixture) {
        const alignDir = path.join(projectDir, '.align');
        fs.mkdirSync(alignDir);
        fs.writeFileSync(path.join(alignDir, 'spec.md'), fixtures[testCase.contextFixture], 'utf8');
      }
      const result = spawnSync(process.execPath, [RUNTIME, 'json', testCase.request, '--project-dir', projectDir], {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 30000
      });
      if (result.status !== 0) throw new Error(`${testCase.id}: ${result.stderr}`);
      const decision = JSON.parse(result.stdout);
      const record = {
        schemaVersion: '1.0.0',
        evidenceKind: 'deterministic-runtime',
        caseId: testCase.id,
        category: testCase.category,
        expected: testCase.expected,
        actual: { route: decision.route, reasons: decision.reasons },
        routeCorrect: decision.route === testCase.expected.route,
        highRiskMiss: testCase.expected.highRisk === true &&
          ['clarify', 'block'].includes(testCase.expected.route) &&
          !['clarify', 'block'].includes(decision.route),
        unnecessaryClarification: testCase.expected.sufficientLowRisk && decision.route === 'clarify'
      };
      records.push(record);
      fs.appendFileSync(output, `${JSON.stringify(record)}\n`, 'utf8');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }
  const summary = {
    total: records.length,
    routeCorrect: records.filter(record => record.routeCorrect).length,
    highRiskMisses: records.filter(record => record.highRiskMiss).length,
    unnecessaryClarifications: records.filter(record => record.unnecessaryClarification).length,
    failures: records.filter(record => !record.routeCorrect).map(record => record.caseId)
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.highRiskMisses > 0) process.exitCode = 2;
}

try { main(); } catch (error) { console.error(error.message); process.exit(1); }
