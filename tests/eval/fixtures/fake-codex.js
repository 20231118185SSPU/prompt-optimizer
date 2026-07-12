#!/usr/bin/env node
'use strict';

const fs = require('fs');

const args = process.argv.slice(2);
if (process.env.FAKE_CLI_CALL_LOG) {
  fs.appendFileSync(process.env.FAKE_CLI_CALL_LOG, `${JSON.stringify(args)}\n`, 'utf8');
}
if (args.includes('--version')) {
  process.stdout.write('fake-codex 1.0.0\n');
  process.exit(0);
}

const outputIndex = args.indexOf('--output-last-message');
const outputFile = outputIndex === -1 ? '' : args[outputIndex + 1];
const behavior = process.env.FAKE_CLI_BEHAVIOR || 'success';
const valid = {
  action: 'proceed',
  questionCount: 0,
  hasRecommendation: false,
  hasExecutableAcceptance: true,
  makesDirectionDecision: false,
  summary: 'fake response'
};

if (behavior === 'empty') {
  fs.writeFileSync(outputFile, '', 'utf8');
  process.exit(0);
}
if (behavior === 'missing-output') process.exit(0);
if (behavior === 'invalid-json') {
  fs.writeFileSync(outputFile, '{invalid', 'utf8');
  process.exit(0);
}
if (behavior === 'schema-mismatch') {
  fs.writeFileSync(outputFile, JSON.stringify({ action: 'proceed' }), 'utf8');
  process.exit(0);
}
if (behavior === 'exit-nonzero') {
  process.stderr.write('fake model failure\n');
  process.exit(7);
}
if (behavior === 'credential-error') {
  process.stderr.write('Unauthorized: invalid API key\n');
  process.exit(1);
}
if (behavior === 'fail-once') {
  const stateFile = process.env.FAKE_CLI_STATE_FILE;
  if (!stateFile || !fs.existsSync(stateFile)) {
    if (stateFile) fs.writeFileSync(stateFile, 'failed', 'utf8');
    process.stderr.write('first attempt failed\n');
    process.exit(7);
  }
}
if (behavior === 'timeout') {
  setInterval(() => {}, 1000);
  return;
}

fs.writeFileSync(outputFile, JSON.stringify(valid), 'utf8');
