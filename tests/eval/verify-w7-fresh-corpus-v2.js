#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const CORPUS_PATH = path.join(ROOT, 'tests/eval/w7-fresh-blind-corpus-v2.jsonl');
const MANIFEST_PATH = path.join(ROOT, 'tests/eval/w7-fresh-manifest-v2.json');
const ROUTER_PATH = path.join(ROOT, 'core/host/align-route.sh');
const EVIDENCE_DIR = path.join(ROOT, 'docs/planning/evidence/w7');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

// Load corpus
const corpus = fs.readFileSync(CORPUS_PATH, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

// Verify corpus matches manifest
assert.strictEqual(corpus.length, manifest.totalRequests, `Corpus size mismatch: expected ${manifest.totalRequests}, got ${corpus.length}`);

// Verify categories
const categoryCounts = {};
for (const item of corpus) {
  categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
}
for (const [cat, expected] of Object.entries(manifest.categories)) {
  assert.strictEqual(categoryCounts[cat], expected.count, `Category ${cat}: expected ${expected.count}, got ${categoryCounts[cat] || 0}`);
}

// Compute corpus hash
const corpusHash = sha256(fs.readFileSync(CORPUS_PATH, 'utf8'));

// Run router on each request
const { runRouter } = require('./run-router-node');
const results = [];
for (const item of corpus) {
  const classification = runRouter(item.request);

  results.push({
    id: item.id,
    category: item.category,
    request: item.request,
    classification
  });
}

// Generate evidence
const evidence = {
  schemaVersion: '1.0.0',
  evidenceKind: 'fresh-blind-corpus-execution-v2',
  corpusId: manifest.corpusId,
  corpusPath: path.relative(ROOT, CORPUS_PATH),
  corpusSha256: corpusHash,
  routerPath: path.relative(ROOT, ROUTER_PATH),
  executedAt: new Date().toISOString(),
  totalRequests: results.length,
  byCategory: {},
  results
};

// Compute per-category stats
for (const [cat, config] of Object.entries(manifest.categories)) {
  const catResults = results.filter(r => r.category === cat);
  const classifications = {};
  for (const r of catResults) {
    classifications[r.classification] = (classifications[r.classification] || 0) + 1;
  }
  evidence.byCategory[cat] = {
    count: catResults.length,
    expectedRoute: config.expectedRoute,
    classifications
  };
}

// Ensure evidence directory exists
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

// Write evidence
const evidencePath = path.join(EVIDENCE_DIR, `${manifest.evidencePrefix}-execution.json`);
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', 'utf8');

// Mark corpus as consumed
manifest.consumedAfter = evidence.executedAt;
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

// Output summary
console.log(JSON.stringify({
  corpusId: manifest.corpusId,
  totalRequests: results.length,
  byCategory: evidence.byCategory,
  evidencePath: path.relative(ROOT, evidencePath)
}, null, 2));
