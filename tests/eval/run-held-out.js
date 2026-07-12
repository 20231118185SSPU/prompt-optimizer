#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const RUNTIME_FILE = path.join(ROOT, 'dist/runtime/runtime/index.js');
const FIXTURES = JSON.parse(fs.readFileSync(path.join(__dirname, 'context-fixtures.json'), 'utf8'));
const COMMANDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'verification-commands.json'), 'utf8'));
const EVIDENCE_DIR = path.join(ROOT, 'docs/planning/evidence/g5');
const consumedRegression = process.argv.includes('--consumed-regression');

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function runtimeBundleSha256() {
  const runtimeDir = path.dirname(RUNTIME_FILE);
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
    }
  }
  walk(runtimeDir);
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(path.relative(runtimeDir, file).replace(/\\/g, '/'));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function loadJsonl(file) {
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function materializeFixture(testCase, projectDir) {
  if (!testCase.contextFixture) return '';
  const context = FIXTURES[testCase.contextFixture];
  const alignDir = path.join(projectDir, '.align');
  fs.mkdirSync(alignDir, { recursive: true });
  fs.writeFileSync(path.join(alignDir, 'spec.md'), `# Held-out Fixture\n\n${context}\n`, 'utf8');
  fs.writeFileSync(path.join(alignDir, 'check-commands.txt'), `${COMMANDS[testCase.contextFixture]}\n`, 'utf8');
  return context;
}

function reviewBehavior(decision) {
  return {
    route: decision.route,
    claims: decision.claims,
    missing: decision.missing,
    scope: decision.scope,
    acceptance: decision.acceptance,
    presentation: decision.presentation,
    next: decision.next,
    lifecyclePlan: decision.lifecyclePlan
  };
}

function runCase(testCase) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'align-held-out-'));
  try {
    const context = materializeFixture(testCase, projectDir);
    const result = spawnSync(process.execPath, [RUNTIME_FILE, 'json', testCase.request, '--project-dir', projectDir], {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 30000
    });
    if (result.status !== 0) throw new Error(`${testCase.id}: ${result.stderr || `runtime exited ${result.status}`}`);
    const decision = JSON.parse(result.stdout);
    const action = decision.next && decision.next.action;
    return {
      evidence: {
        schemaVersion: '1.0.0',
        evidenceKind: 'held-out-deterministic-runtime',
        caseId: testCase.id,
        category: testCase.category,
        expected: testCase.expected,
        actual: { route: decision.route, action, behavior: reviewBehavior(decision) },
        routeCorrect: decision.route === testCase.expected.route,
        highRiskMiss: testCase.expected.highRisk === true &&
          ['clarify', 'block'].includes(testCase.expected.route) &&
          !['clarify', 'block'].includes(decision.route),
        unnecessaryClarification: testCase.expected.sufficientLowRisk === true && action === 'ask'
      },
      blind: {
        schemaVersion: '1.0.0',
        caseId: testCase.id,
        request: testCase.request,
        projectContext: context || null,
        proposedBehavior: reviewBehavior(decision)
      }
    };
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function percent(numerator, denominator) {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2));
}

function main() {
  const manifestFile = path.resolve(arg('--manifest', path.join(__dirname, 'held-out-manifest.json')));
  const evidencePrefix = arg('--evidence-prefix', 'held-out');
  if (!/^[a-z0-9-]+$/.test(evidencePrefix)) throw new Error('evidence prefix must contain only lowercase letters, digits, and hyphens');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const corpusFile = path.resolve(ROOT, manifest.corpusFile);
  const corpusBytes = fs.readFileSync(corpusFile);
  const corpusSha256 = sha256(corpusBytes);
  const requiredStatus = consumedRegression ? 'consumed' : 'frozen';
  if (manifest.status !== requiredStatus) {
    throw new Error(`${consumedRegression ? 'regression' : 'held-out'} manifest must be ${requiredStatus}, got ${manifest.status}`);
  }
  if (manifest.corpusSha256 !== corpusSha256) throw new Error('held-out corpus hash differs from the frozen manifest');
  if (!fs.existsSync(RUNTIME_FILE)) throw new Error('generated runtime is missing; run bash build/build.sh first');

  const corpus = loadJsonl(corpusFile);
  const results = corpus.map(runCase);
  const evidence = results.map(result => ({
    ...result.evidence,
    evidenceKind: consumedRegression ? 'consumed-corpus-regression-runtime' : result.evidence.evidenceKind,
    corpusId: manifest.corpusId,
    corpusSha256,
    runtimeHashKind: 'runtime-js-bundle-v1',
    runtimeSha256: runtimeBundleSha256()
  }));
  const blind = results.map(result => result.blind);
  const evidenceText = `${evidence.map(JSON.stringify).join('\n')}\n`;
  const blindText = `${blind.map(JSON.stringify).join('\n')}\n`;
  const highRisk = evidence.filter(record => record.expected.highRisk);
  const sufficient = evidence.filter(record => record.expected.sufficientLowRisk);
  const summary = {
    schemaVersion: '1.0.0',
    evidenceKind: consumedRegression ? 'consumed-corpus-regression-summary' : 'held-out-deterministic-summary',
    corpusId: manifest.corpusId,
    corpusSha256,
    runtimeHashKind: evidence[0] ? evidence[0].runtimeHashKind : 'runtime-js-bundle-v1',
    runtimeSha256: evidence[0] ? evidence[0].runtimeSha256 : null,
    blindInputSha256: sha256(Buffer.from(blindText, 'utf8')),
    total: evidence.length,
    routeCorrect: evidence.filter(record => record.routeCorrect).length,
    highRiskMissRatePercent: percent(highRisk.filter(record => record.highRiskMiss).length, highRisk.length),
    unnecessaryClarificationRatePercent: percent(sufficient.filter(record => record.unnecessaryClarification).length, sufficient.length),
    routeFailures: evidence.filter(record => !record.routeCorrect).map(record => record.caseId),
    releaseGate: manifest.releaseGate
  };

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, `${evidencePrefix}-runtime-routes.jsonl`), evidenceText, 'utf8');
  fs.writeFileSync(path.join(EVIDENCE_DIR, `${evidencePrefix}-blind-input.jsonl`), blindText, 'utf8');
  fs.writeFileSync(path.join(EVIDENCE_DIR, `${evidencePrefix}-runtime-summary.json`), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));

  if (summary.highRiskMissRatePercent > manifest.releaseGate.highRiskMissRatePercent ||
      summary.unnecessaryClarificationRatePercent > manifest.releaseGate.unnecessaryClarificationRatePercent) {
    process.exitCode = 2;
  }
}

try { main(); } catch (error) { console.error(error.message); process.exit(1); }
