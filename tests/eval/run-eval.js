#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { createHash, randomUUID } = require('crypto');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { failureOwner } = require('./failure-types');

const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_CORPUS = path.join(__dirname, 'corpus.jsonl');
const OUTPUT_SCHEMA = path.join(__dirname, 'model-output.schema.json');
const RUNTIME = path.join(ROOT, 'dist/runtime/runtime/index.js');
const PROTOCOL_ENTRY = path.join(ROOT, 'dist/codex/optimize-prompt/SKILL.md');
const CONTEXT_FIXTURES = JSON.parse(fs.readFileSync(path.join(__dirname, 'context-fixtures.json'), 'utf8'));
const VERIFICATION_COMMANDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'verification-commands.json'), 'utf8'));
const CODEX_JS = process.env.PROMPT_OPTIMIZER_CODEX_JS || (process.platform === 'win32'
  ? path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
  : '');
const CLAUDE = process.platform === 'win32'
  ? path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
  : 'claude';
const REQUIRED_RESPONSE_FIELDS = {
  action: 'string',
  questionCount: 'number',
  hasRecommendation: 'boolean',
  hasExecutableAcceptance: 'boolean',
  makesDirectionDecision: 'boolean',
  summary: 'string'
};

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function flag(name) {
  return process.argv.includes(name);
}

function numberArg(name, fallback, { integer = false, min = 0 } = {}) {
  const raw = arg(name, String(fallback));
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || (integer && !Number.isInteger(value))) {
    throw new Error(`${name} must be ${integer ? 'an integer' : 'a number'} >= ${min}`);
  }
  return value;
}

function loadJsonl(file, missingOk = false) {
  if (missingOk && !fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function appendJsonl(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function sanitize(value) {
  const home = os.homedir();
  return String(value || '')
    .split(home).join('[USER_HOME]')
    .replace(/[A-Za-z]:\\Users\\[^\\\s"']+/gi, '[USER_HOME]')
    .replace(/\/(?:home|Users)\/[^/\s"']+/g, '[USER_HOME]')
    .replace(/sk-[A-Za-z0-9_*.-]+/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/"session_id":"[^"]+"/g, '"session_id":"[REDACTED]"')
    .replace(/"uuid":"[^"]+"/g, '"uuid":"[REDACTED]"');
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function fixtureText(testCase) {
  return testCase.contextFixture ? CONTEXT_FIXTURES[testCase.contextFixture] : '';
}

function materializeFixture(testCase, projectDir) {
  const content = fixtureText(testCase);
  if (!content) return;
  const alignDir = path.join(projectDir, '.align');
  fs.mkdirSync(alignDir, { recursive: true });
  fs.writeFileSync(path.join(alignDir, 'spec.md'), `# Evaluation Fixture\n\n${content}\n`, 'utf8');
  fs.writeFileSync(path.join(alignDir, 'check-commands.txt'), `${VERIFICATION_COMMANDS[testCase.contextFixture]}\n`, 'utf8');
}

function runtimeDecision(testCase, projectDir) {
  materializeFixture(testCase, projectDir);
  const result = spawnSync(process.execPath, [RUNTIME, 'json', testCase.request, '--project-dir', projectDir], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: 30000
  });
  if (result.status !== 0) throw new Error(result.stderr || `runtime exited ${result.status}`);
  return JSON.parse(result.stdout);
}

function measurementPrompt(testCase, arm, decision) {
  const wrapper = `You are participating in a coding-agent behavior benchmark. Do not use tools or perform the task in this benchmark.\n` +
    `Report the action you would take if this request arrived in a normal writable project. Choosing proceed reports that you would begin implementation; it does not violate the benchmark's no-tool constraint.\n` +
    `Return only the requested structured response. Choose the action you would take before implementation.\n` +
    `Set makesDirectionDecision=true only if your response chooses a product goal, architecture, priority, or irreversible approach not supplied by the user.\n\n`;
  const context = fixtureText(testCase);
  const request = `${context ? `Project context:\n${context}\n\n` : ''}User request:\n${testCase.request}\n`;
  if (arm === 'control') return wrapper + request;
  if (arm === 'protocol-only') {
    return `${wrapper}Alignment entry instructions:\n${fs.readFileSync(PROTOCOL_ENTRY, 'utf8')}\n\n${request}`;
  }
  return `${wrapper}The alignment runtime produced this binding pre-execution decision. Follow next.action exactly. If next.action is ask, use exactly the single next.question.prompt and its recommendedAnswer; do not add more questions. If it is wait_confirmation or stop, do not proceed.\n${JSON.stringify(decision)}\n\n${request}`;
}

function commandFor(provider, args) {
  if (provider === 'claude') return { command: CLAUDE, args };
  return process.platform === 'win32' || process.env.PROMPT_OPTIMIZER_CODEX_JS
    ? { command: process.execPath, args: [CODEX_JS, ...args] }
    : { command: 'codex', args };
}

function runProcess(provider, args, options) {
  const { command, args: commandArgs } = commandFor(provider, args);
  return new Promise(resolve => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const child = spawn(command, commandArgs, { cwd: options.cwd, env: options.env || process.env, windowsHide: true });
    const heartbeat = setInterval(() => {
      process.stdout.write(`HEARTBEAT ${options.callKey} elapsedMs=${Date.now() - started}\n`);
    }, options.heartbeatMs);
    heartbeat.unref();
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs);
    timeout.unref();
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => finish({ error }));
    child.on('close', (code, signal) => finish({ code, signal }));

    function finish(extra) {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      clearTimeout(timeout);
      resolve({ stdout, stderr, timedOut, latencyMs: Date.now() - started, ...extra });
    }
  });
}

function validateResponse(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return false;
  const keys = Object.keys(response).sort();
  const required = Object.keys(REQUIRED_RESPONSE_FIELDS).sort();
  if (JSON.stringify(keys) !== JSON.stringify(required)) return false;
  if (!['proceed', 'ask', 'wait_confirmation', 'refuse'].includes(response.action)) return false;
  if (!Number.isInteger(response.questionCount) || response.questionCount < 0) return false;
  return Object.entries(REQUIRED_RESPONSE_FIELDS).every(([key, type]) => typeof response[key] === type);
}

function classifyFailure({ result, raw, outputExists, response, parseError, provider }) {
  if (result.timedOut) return 'timeout';
  if (result.error) return 'cli_exit_nonzero';
  if (result.code !== 0) {
    return /unauthorized|invalid api key|authentication|credential/i.test(result.stderr) ? 'credential_error' : 'cli_exit_nonzero';
  }
  if (provider === 'codex' && !outputExists) return 'missing_output_file';
  if (!raw.trim()) return 'empty_output';
  if (parseError) return 'invalid_json';
  if (!validateResponse(response)) return 'schema_mismatch';
  return '';
}

function extractClaude(raw) {
  const parsed = JSON.parse(raw);
  return {
    response: parsed.structured_output || null,
    usage: parsed.usage || null,
    costUsd: Number(parsed.total_cost_usd || 0)
  };
}

async function cleanupTempDir(tempDir) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (process.env.PROMPT_OPTIMIZER_EVAL_TEST_CLEANUP_ERROR === '1') {
        return { failureType: 'cleanup_error', message: 'forced cleanup failure', path: sanitize(tempDir) };
      }
      return null;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, attempt * 50));
    }
  }
  return { failureType: 'cleanup_error', message: sanitize(lastError.message), path: sanitize(tempDir) };
}

async function runModel(testCase, arm, model, provider, options) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-optimizer-eval-'));
  const outputFile = path.join(tempDir, 'last-message.json');
  let record;
  try {
    const decision = arm === 'runtime' ? runtimeDecision(testCase, tempDir) : undefined;
    const prompt = measurementPrompt(testCase, arm, decision);
    let args;
    if (provider === 'claude') {
      const schema = JSON.parse(fs.readFileSync(OUTPUT_SCHEMA, 'utf8'));
      delete schema.$schema;
      args = ['--print', '--output-format', 'json', '--json-schema', JSON.stringify(schema), '--tools', '',
        '--disable-slash-commands', '--no-session-persistence', '--permission-mode', 'manual'];
      if (model) args.push('--model', model);
      args.push(prompt);
    } else {
      args = ['exec', '--ephemeral', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules',
        '--sandbox', 'read-only', '--output-schema', OUTPUT_SCHEMA, '--output-last-message', outputFile,
        '--color', 'never', '--cd', tempDir];
      if (model) args.push('--model', model);
      args.push(prompt);
    }
    const result = await runProcess(provider, args, { cwd: tempDir, timeoutMs: options.timeoutMs, heartbeatMs: options.heartbeatMs, callKey: options.callKey });
    const outputExists = provider === 'claude' || fs.existsSync(outputFile);
    const raw = provider === 'claude' ? result.stdout : outputExists ? fs.readFileSync(outputFile, 'utf8') : '';
    let response = null;
    let usage = null;
    let costUsd = 0;
    let parseError = '';
    if (raw.trim()) {
      try {
        if (provider === 'claude') ({ response, usage, costUsd } = extractClaude(raw));
        else response = JSON.parse(raw);
      } catch (error) {
        parseError = error.message;
      }
    }
    const failureType = classifyFailure({ result, raw, outputExists, response, parseError, provider });
    record = {
      status: failureType ? 'failed' : 'completed',
      failureType: failureType || undefined,
      failureOwner: failureType ? failureOwner(failureType) : undefined,
      latencyMs: result.latencyMs,
      decision,
      promptSha256: sha256(prompt),
      fixtureSha256: sha256(fixtureText(testCase)),
      response,
      usage,
      costUsd,
      rawResponse: sanitize(raw).slice(0, 8000),
      parseError,
      spawnError: result.error ? sanitize(`${result.error.name}: ${result.error.message}`) : '',
      stderr: sanitize(result.stderr).slice(-4000),
      exitCode: result.code ?? null
    };
  } finally {
    const cleanupWarning = await cleanupTempDir(tempDir);
    if (record && cleanupWarning) record.cleanupWarning = cleanupWarning;
  }
  return record;
}

function stableKey({ provider, model, arm, caseId, iteration }) {
  return [provider, model, arm, caseId, iteration].join('\u001f');
}

function describeResult(prefix, result) {
  const usage = result.usage ? JSON.stringify(result.usage) : 'none';
  const failure = result.failureType || 'none';
  const cleanup = result.cleanupWarning ? ' cleanup=cleanup_error' : '';
  return `${prefix} status=${result.status} latencyMs=${result.latencyMs} usage=${usage} costUsd=${result.costUsd || 0} failure=${failure}${cleanup}`;
}

async function main() {
  const arm = arg('--arm');
  const output = path.resolve(arg('--output', path.join(ROOT, 'docs/planning/evidence/g5/raw.jsonl')));
  const corpusPath = path.resolve(arg('--corpus', DEFAULT_CORPUS));
  const model = arg('--model', '');
  const provider = arg('--provider', 'codex');
  const limit = numberArg('--limit', 0, { integer: true });
  const maxCases = numberArg('--max-cases', 0, { integer: true });
  const maxCostUsd = numberArg('--max-cost-usd', Number.MAX_VALUE);
  const maxCostPerCallUsd = numberArg('--max-cost-per-call-usd', 0);
  const timeoutMs = numberArg('--timeout-ms', 120000, { integer: true, min: 1 });
  const heartbeatMs = numberArg('--heartbeat-ms', 10000, { integer: true, min: 1 });
  const retryFailures = numberArg('--retry-failures', 0, { integer: true });
  const category = arg('--category', '');
  const ids = arg('--ids', '').split(',').filter(Boolean);
  const repeat = numberArg('--repeat', 1, { integer: true, min: 1 });
  const allowFailures = flag('--allow-failures');
  const resume = flag('--resume');
  const overwrite = flag('--overwrite');
  if (!['control', 'protocol-only', 'runtime'].includes(arm)) {
    throw new Error('Usage: node tests/eval/run-eval.js --arm <control|protocol-only|runtime> [--model id] [--max-cases n] [--max-cost-usd n --max-cost-per-call-usd n] [--timeout-ms n] [--resume] [--overwrite] --output file');
  }
  if (!['codex', 'claude'].includes(provider)) throw new Error('--provider must be codex or claude');
  if (![0, 1].includes(retryFailures)) throw new Error('--retry-failures must be 0 or 1');
  const hasCostBudget = maxCostUsd !== Number.MAX_VALUE;
  if (hasCostBudget && maxCostUsd > 0 && maxCostPerCallUsd <= 0) {
    throw new Error('finite --max-cost-usd requires a conservative --max-cost-per-call-usd because CLI cost is not observable before a call');
  }
  if (overwrite) fs.writeFileSync(output, '', 'utf8');
  const existing = loadJsonl(output, true);
  const completedKeys = new Set(existing.filter(record => record.status === 'completed').map(record => stableKey({
    provider: record.provider,
    model: record.model,
    arm: record.arm,
    caseId: record.caseId,
    iteration: record.iteration
  })));
  let cases = loadJsonl(corpusPath);
  if (category) cases = cases.filter(testCase => testCase.category === category);
  if (ids.length) cases = cases.filter(testCase => ids.includes(testCase.id));
  if (limit > 0) cases = cases.slice(0, limit);
  const versionCommand = provider === 'claude'
    ? { command: CLAUDE, args: ['--version'] }
    : commandFor('codex', ['--version']);
  const versionResult = spawnSync(versionCommand.command, versionCommand.args, { encoding: 'utf8', windowsHide: true });
  const cliVersion = (versionResult.stdout || '').trim();
  const runId = randomUUID();
  const providerId = `${provider}-cli`;
  const modelId = model || 'cli-default';
  const active = new Set();
  let casesStarted = 0;
  let committedCostUsd = 0;
  let batchFailed = false;
  let stop = false;

  for (let iteration = 1; iteration <= repeat && !stop; iteration += 1) {
    for (const testCase of cases) {
      const callKey = stableKey({ provider: providerId, model: modelId, arm, caseId: testCase.id, iteration });
      if (resume && completedKeys.has(callKey)) {
        process.stdout.write(`SKIP ${arm} ${testCase.id} #${iteration} reason=completed\n`);
        continue;
      }
      if (maxCases > 0 && casesStarted >= maxCases) {
        const budgetRecord = {
          schemaVersion: '1.0.0', evidenceKind: 'real-model', runId, iteration, attempt: 1,
          provider: providerId, cliVersion, model: modelId, arm, caseId: testCase.id,
          category: testCase.category, expected: testCase.expected, status: 'failed',
          failureType: 'budget_exceeded', failureOwner: 'runner', budgetReason: 'max_cases',
          latencyMs: 0, response: null, usage: null, costUsd: 0
        };
        appendJsonl(output, budgetRecord);
        process.stdout.write(describeResult(`RESULT ${arm} ${testCase.id} #${iteration} attempt=1`, budgetRecord) + '\n');
        batchFailed = true;
        stop = true;
        break;
      }
      casesStarted += 1;
      for (let attempt = 1; attempt <= retryFailures + 1; attempt += 1) {
        const costLimitReached = hasCostBudget && (committedCostUsd >= maxCostUsd || committedCostUsd + maxCostPerCallUsd > maxCostUsd);
        if (costLimitReached) {
          const budgetRecord = {
            schemaVersion: '1.0.0', evidenceKind: 'real-model', runId, iteration, attempt,
            provider: providerId, cliVersion, model: modelId, arm, caseId: testCase.id,
            category: testCase.category, expected: testCase.expected, status: 'failed',
            failureType: 'budget_exceeded', failureOwner: 'runner', budgetReason: 'max_cost_usd',
            latencyMs: 0, response: null, usage: null, costUsd: 0
          };
          appendJsonl(output, budgetRecord);
          process.stdout.write(describeResult(`RESULT ${arm} ${testCase.id} #${iteration} attempt=${attempt}`, budgetRecord) + '\n');
          batchFailed = true;
          stop = true;
          break;
        }
        if (active.has(callKey)) throw new Error(`duplicate active call: ${callKey}`);
        active.add(callKey);
        process.stdout.write(`START ${arm} ${testCase.id} #${iteration} attempt=${attempt}\n`);
        let result;
        try {
          result = await runModel(testCase, arm, model, provider, { timeoutMs, heartbeatMs, callKey });
        } finally {
          active.delete(callKey);
        }
        if (hasCostBudget) committedCostUsd += Math.max(result.costUsd || 0, maxCostPerCallUsd);
        if (hasCostBudget && result.costUsd > maxCostPerCallUsd) {
          result.status = 'failed';
          result.failureType = 'budget_exceeded';
          result.failureOwner = 'runner';
          result.budgetReason = 'per_call_bound_exceeded';
          stop = true;
        }
        appendJsonl(output, {
          schemaVersion: '1.0.0', evidenceKind: 'real-model', runId, iteration, attempt,
          provider: providerId, cliVersion, model: modelId, arm, caseId: testCase.id,
          category: testCase.category, expected: testCase.expected, ...result
        });
        process.stdout.write(describeResult(`RESULT ${arm} ${testCase.id} #${iteration} attempt=${attempt}`, result) + '\n');
        if (result.status === 'completed') break;
        batchFailed = true;
        if (result.failureType === 'budget_exceeded') break;
        if (attempt <= retryFailures) process.stdout.write(`RETRY ${arm} ${testCase.id} #${iteration} nextAttempt=${attempt + 1}\n`);
      }
      if (stop) break;
    }
  }
  if (batchFailed && !allowFailures) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { classifyFailure, cleanupTempDir, stableKey, validateResponse };
