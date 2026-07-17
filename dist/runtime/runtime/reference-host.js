// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareReferenceHostBaseline = prepareReferenceHostBaseline;
exports.checkReferenceHostBaseline = checkReferenceHostBaseline;
exports.issueReferenceHostHandoff = issueReferenceHostHandoff;
exports.recordReferenceHostHandoff = recordReferenceHostHandoff;
exports.reportExecution = reportExecution;
exports.completionVerify = completionVerify;
exports.completeReferenceHostRun = completeReferenceHostRun;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const acceptance_plan_1 = require("./acceptance-plan");
const verifier_1 = require("./verifier");
const RUNTIME_DIR = path.join('.align', '.runtime');
const LIFECYCLE_DIR = 'lifecycle';
const LIFECYCLE_REF_PREFIX = `artifact:.align/.runtime/${LIFECYCLE_DIR}/`;
const LOG_FILE = 'reference-host.log';
function runtimePath(projectDir, file) {
    return path.join(projectDir, RUNTIME_DIR, file);
}
function hash(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 24);
}
function sha256(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(',')}]`;
    if (isRecord(value)) {
        return `{${Object.keys(value).sort()
            .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}
function canonicalDigest(domain, value) {
    return sha256(`${domain}\0${canonicalJson(value)}`);
}
function opaqueRef(prefix) {
    return `${prefix}-${crypto.randomBytes(12).toString('hex')}`;
}
function ensureRuntimeDir(projectDir) {
    const directory = path.join(projectDir, RUNTIME_DIR);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    try {
        fs.chmodSync(directory, 0o700);
    }
    catch {
        // Windows does not expose Unix directory modes.
    }
    return directory;
}
function ensureLifecycleDir(projectDir) {
    const directory = path.join(ensureRuntimeDir(projectDir), LIFECYCLE_DIR);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    try {
        fs.chmodSync(directory, 0o700);
    }
    catch {
        // Windows does not expose Unix directory modes.
    }
    return directory;
}
function writeLifecycleArtifact(projectDir, fileName, artifact) {
    const directory = ensureLifecycleDir(projectDir);
    const file = path.join(directory, fileName);
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(artifact)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, file);
    return `${LIFECYCLE_REF_PREFIX}${fileName}`;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function hasExactKeys(value, expected) {
    const actual = Object.keys(value).sort();
    return actual.length === expected.length && expected.slice().sort()
        .every((key, index) => actual[index] === key);
}
function isBoundedString(value, maxLength) {
    return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}
function hasUniqueItems(values) {
    return new Set(values.map(canonicalJson)).size === values.length;
}
function isEvidenceRef(value) {
    return isRecord(value) &&
        hasExactKeys(value, ['kind', 'ref']) &&
        ['local', 'artifact', 'command', 'manual', 'external'].includes(String(value.kind)) &&
        isBoundedString(value.ref, 1000);
}
function isBaselineObservation(value) {
    return isRecord(value) &&
        hasExactKeys(value, ['conditionId', 'status', 'evidenceRefs']) &&
        isBoundedString(value.conditionId, 128) &&
        ['satisfied', 'failed', 'not_observed'].includes(String(value.status)) &&
        Array.isArray(value.evidenceRefs) && value.evidenceRefs.every(isEvidenceRef) &&
        hasUniqueItems(value.evidenceRefs);
}
function readBaselineReport(projectDir, ref) {
    if (!ref.startsWith(LIFECYCLE_REF_PREFIX))
        return { state: 'invalid' };
    const fileName = ref.slice(LIFECYCLE_REF_PREFIX.length);
    if (!/^[A-Za-z0-9._-]+$/.test(fileName))
        return { state: 'invalid' };
    const file = path.join(projectDir, RUNTIME_DIR, LIFECYCLE_DIR, fileName);
    let value;
    try {
        value = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch (error) {
        return isRecord(error) && error.code === 'ENOENT' ? { state: 'missing' } : { state: 'invalid' };
    }
    if (!isRecord(value) || !hasExactKeys(value, [
        'schemaVersion', 'requestId', 'decisionId', 'runId', 'revision',
        'kind', 'phase', 'status', 'reasons', 'observations'
    ]))
        return { state: 'invalid' };
    if (value.schemaVersion !== '1.0.0' || value.kind !== 'alignment.baseline-report' || value.phase !== 'baseline') {
        return { state: 'invalid' };
    }
    if (![value.requestId, value.decisionId, value.runId]
        .every(field => isBoundedString(field, 128)))
        return { state: 'invalid' };
    if (!Number.isInteger(value.revision) || Number(value.revision) < 0)
        return { state: 'invalid' };
    if (!['passed', 'failed', 'incomplete'].includes(String(value.status)))
        return { state: 'invalid' };
    if (!Array.isArray(value.reasons) ||
        !value.reasons.every(reason => typeof reason === 'string' &&
            /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(reason)) ||
        !hasUniqueItems(value.reasons)) {
        return { state: 'invalid' };
    }
    if (value.status === 'failed' && !value.reasons.includes('lifecycle.baseline_failed')) {
        return { state: 'invalid' };
    }
    if (value.status === 'passed' && value.reasons.length !== 0)
        return { state: 'invalid' };
    if (!Array.isArray(value.observations) || value.observations.length === 0 ||
        !value.observations.every(isBaselineObservation))
        return { state: 'invalid' };
    return { state: 'valid', report: value };
}
function readExecutionHandoff(projectDir, ref) {
    if (!ref.startsWith(LIFECYCLE_REF_PREFIX))
        return undefined;
    const fileName = ref.slice(LIFECYCLE_REF_PREFIX.length);
    if (!/^[A-Za-z0-9._-]+$/.test(fileName))
        return undefined;
    let value;
    try {
        value = JSON.parse(fs.readFileSync(path.join(projectDir, RUNTIME_DIR, LIFECYCLE_DIR, fileName), 'utf8'));
    }
    catch {
        return undefined;
    }
    if (!isRecord(value) || !hasExactKeys(value, [
        'schemaVersion', 'requestId', 'decisionId', 'runId', 'revision',
        'kind', 'phase', 'handoffId', 'baselineReportRef', 'acceptancePlanRef', 'scopeFingerprint'
    ]))
        return undefined;
    if (value.schemaVersion !== '1.0.0' || value.kind !== 'alignment.execution-handoff' || value.phase !== 'handoff') {
        return undefined;
    }
    if (![value.requestId, value.decisionId, value.runId, value.handoffId]
        .every(field => isBoundedString(field, 128)))
        return undefined;
    if (![value.baselineReportRef, value.acceptancePlanRef]
        .every(field => isBoundedString(field, 1000)) ||
        !isBoundedString(value.scopeFingerprint, 256))
        return undefined;
    if (!Number.isInteger(value.revision) || Number(value.revision) < 0)
        return undefined;
    return value;
}
function isExecutionReceiptArtifact(value) {
    if (!isRecord(value) || !hasExactKeys(value, [
        'schemaVersion', 'requestId', 'decisionId', 'runId', 'revision',
        'kind', 'phase', 'handoffId', 'status', 'executionRef'
    ]))
        return false;
    return value.schemaVersion === '1.0.0' &&
        value.kind === 'alignment.execution-receipt' && value.phase === 'execution' &&
        [value.requestId, value.decisionId, value.runId, value.handoffId]
            .every(field => isBoundedString(field, 128)) &&
        Number.isInteger(value.revision) && Number(value.revision) >= 0 &&
        ['completed', 'failed', 'cancelled'].includes(String(value.status)) &&
        isBoundedString(value.executionRef, 1000);
}
function readExecutionReceipt(projectDir, ref) {
    if (!ref.startsWith(LIFECYCLE_REF_PREFIX))
        return undefined;
    const fileName = ref.slice(LIFECYCLE_REF_PREFIX.length);
    if (!/^[A-Za-z0-9._-]+$/.test(fileName))
        return undefined;
    try {
        const value = JSON.parse(fs.readFileSync(path.join(projectDir, RUNTIME_DIR, LIFECYCLE_DIR, fileName), 'utf8'));
        return isExecutionReceiptArtifact(value) ? value : undefined;
    }
    catch {
        return undefined;
    }
}
function executionReceiptMatchesRun(receipt, run) {
    return receipt.requestId === run.requestId && receipt.decisionId === run.decisionId &&
        receipt.runId === run.runId && receipt.handoffId === run.handoffId &&
        receipt.revision === run.revision + 1;
}
function passedBaselineMatchesRun(report, run) {
    const observations = new Map(report.observations.map(observation => [observation.conditionId, observation]));
    const identity = observations.get('decision-identity-bound');
    const acceptance = observations.get('acceptance-plan-bound');
    const scope = observations.get('scope-snapshot-bound');
    return report.status === 'passed' && report.reasons.length === 0 && report.observations.length === 3 &&
        observations.size === 3 && [identity, acceptance, scope].every(observation => observation?.status === 'satisfied') &&
        identity?.evidenceRefs.some(ref => ref.kind === 'artifact' && ref.ref === `decision:${run.decisionId}#identity`) === true &&
        acceptance?.evidenceRefs.some(ref => ref.kind === 'artifact' && ref.ref === run.acceptancePlanRef) === true &&
        scope?.evidenceRefs.some(ref => ref.kind === 'artifact' &&
            ref.ref === `decision:${run.decisionId}#scope@${run.scopeFingerprint}`) === true &&
        report.requestId === run.requestId && report.decisionId === run.decisionId && report.runId === run.runId &&
        report.revision === (run.handoffRevision ?? run.revision);
}
function lifecyclePairMatchesRun(projectDir, run) {
    if (!run.baselineReportRef || !run.executionHandoffRef || !run.handoffId ||
        !Number.isInteger(run.handoffRevision))
        return false;
    const baseline = readBaselineReport(projectDir, run.baselineReportRef);
    const handoff = readExecutionHandoff(projectDir, run.executionHandoffRef);
    if (baseline.state !== 'valid' || !handoff || !passedBaselineMatchesRun(baseline.report, run))
        return false;
    return handoff.requestId === run.requestId && handoff.decisionId === run.decisionId &&
        handoff.runId === run.runId && handoff.revision === run.handoffRevision &&
        handoff.handoffId === run.handoffId && handoff.baselineReportRef === run.baselineReportRef &&
        handoff.acceptancePlanRef === run.acceptancePlanRef && handoff.scopeFingerprint === run.scopeFingerprint;
}
function acceptancePlanRef(decision) {
    return `decision:${decision.decisionId}#acceptance@sha256:${canonicalDigest('alignment.acceptance-plan.v1', decision.acceptance)}`;
}
function scopeFingerprint(decision) {
    return `sha256:${canonicalDigest('alignment.scope.v1', decision.scope)}`;
}
function recordBaselineReport(projectDir, identity, planRef, scopeRef, observationStatuses) {
    const observedStatuses = Object.values(observationStatuses);
    const status = observedStatuses.includes('failed')
        ? 'failed'
        : observedStatuses.includes('not_observed')
            ? 'incomplete'
            : 'passed';
    const report = {
        schemaVersion: '1.0.0',
        requestId: identity.requestId,
        decisionId: identity.decisionId,
        runId: identity.runId,
        revision: identity.revision,
        kind: 'alignment.baseline-report',
        phase: 'baseline',
        status,
        reasons: status === 'failed'
            ? ['lifecycle.baseline_failed']
            : status === 'incomplete'
                ? ['runtime.degraded']
                : [],
        observations: [
            {
                conditionId: 'decision-identity-bound',
                status: observationStatuses.identity,
                evidenceRefs: [{ kind: 'artifact', ref: `decision:${identity.decisionId}#identity` }]
            },
            {
                conditionId: 'acceptance-plan-bound',
                status: observationStatuses.acceptance,
                evidenceRefs: [{ kind: 'artifact', ref: planRef }]
            },
            {
                conditionId: 'scope-snapshot-bound',
                status: observationStatuses.scope,
                evidenceRefs: [{ kind: 'artifact', ref: `decision:${identity.decisionId}#scope@${scopeRef}` }]
            }
        ]
    };
    return {
        ref: writeLifecycleArtifact(projectDir, `${identity.runId}-baseline-r${identity.revision}.json`, report),
        status
    };
}
function recordExecutionHandoff(projectDir, decision, runId, revision, handoffId, baselineReportRef, planRef, scopeRef) {
    const handoff = {
        schemaVersion: '1.0.0',
        requestId: decision.requestId,
        decisionId: decision.decisionId,
        runId,
        revision,
        kind: 'alignment.execution-handoff',
        phase: 'handoff',
        handoffId,
        baselineReportRef,
        acceptancePlanRef: planRef,
        scopeFingerprint: scopeRef
    };
    return writeLifecycleArtifact(projectDir, `${runId}-handoff-r${revision}.json`, handoff);
}
function appendEvent(projectDir, event) {
    const directory = ensureRuntimeDir(projectDir);
    fs.appendFileSync(path.join(directory, LOG_FILE), `${JSON.stringify(event)}\n`, 'utf8');
}
function stateFile(projectDir, sessionRef) {
    const suffix = sessionRef ? `-${hash(sessionRef)}` : '';
    return runtimePath(projectDir, `reference-host${suffix}.json`);
}
function writeRun(projectDir, run, sessionRef) {
    ensureRuntimeDir(projectDir);
    const file = stateFile(projectDir, sessionRef);
    const temporary = `${file}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(run)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, file);
}
function readRun(projectDir, sessionRef) {
    try {
        const value = JSON.parse(fs.readFileSync(stateFile(projectDir, sessionRef), 'utf8'));
        if (!value || value.kind !== 'alignment.reference-host-run' || value.stateVersion !== '1.0.0')
            return undefined;
        const phase = String(value.phase);
        if (![
            'ready_for_baseline', 'ready_for_handoff', 'baseline_failed', 'baseline_incomplete',
            'handoff_issued', 'receipt_recorded', 'execution_failed', 'execution_cancelled',
            'verified', 'verification_failed', 'verification_inconclusive'
        ].includes(phase)) {
            return undefined;
        }
        if (![value.requestRef, value.requestId, value.decisionId, value.runId,
            value.acceptancePlanRef, value.scopeFingerprint]
            .every(field => typeof field === 'string' && field.length > 0))
            return undefined;
        if (phase !== 'ready_for_baseline' &&
            (typeof value.baselineReportRef !== 'string' || value.baselineReportRef.length === 0))
            return undefined;
        const handoffPhases = [
            'handoff_issued', 'receipt_recorded', 'execution_failed', 'execution_cancelled',
            'verified', 'verification_failed', 'verification_inconclusive'
        ];
        const receiptPhases = [
            'receipt_recorded', 'execution_failed', 'execution_cancelled',
            'verified', 'verification_failed', 'verification_inconclusive'
        ];
        if (handoffPhases.includes(phase) &&
            ![value.handoffId, value.executionHandoffRef]
                .every(field => typeof field === 'string' && field.length > 0))
            return undefined;
        if (handoffPhases.includes(phase) &&
            (!Number.isInteger(value.handoffRevision) || Number(value.handoffRevision) < 0))
            return undefined;
        if (receiptPhases.includes(phase) &&
            ![value.executionRef, value.executionReceiptRef]
                .every(field => typeof field === 'string' && field.length > 0))
            return undefined;
        if (['verified', 'verification_failed', 'verification_inconclusive'].includes(phase) &&
            (typeof value.completionReportRef !== 'string' || value.completionReportRef.length === 0))
            return undefined;
        if (!Number.isInteger(value.revision) || (value.revision ?? 0) < 1)
            return undefined;
        if (value.route !== 'pass' && value.route !== 'enrich')
            return undefined;
        if (!Number.isInteger(value.acceptanceCount) || (value.acceptanceCount ?? 0) < 0)
            return undefined;
        if (!Array.isArray(value.acceptanceIds) || value.acceptanceIds.length !== value.acceptanceCount ||
            !value.acceptanceIds.every(acceptanceId => isBoundedString(acceptanceId, 128)) ||
            !hasUniqueItems(value.acceptanceIds))
            return undefined;
        if (!Array.isArray(value.acceptanceBindings) || !value.acceptanceBindings.every(binding => binding && isBoundedString(binding.acceptanceId, 128) && value.acceptanceIds.includes(binding.acceptanceId) &&
            typeof binding.commandHash === 'string' && binding.commandHash.length > 0))
            return undefined;
        return value;
    }
    catch {
        return undefined;
    }
}
function matchesTransition(run, transition, expectedPhase) {
    return isBoundedString(transition?.runId, 128) &&
        Number.isInteger(transition?.expectedRevision) && transition.expectedRevision >= 0 &&
        run.runId === transition.runId && run.revision === transition.expectedRevision &&
        run.phase === expectedPhase;
}
function clearRun(projectDir, sessionRef) {
    try {
        fs.rmSync(stateFile(projectDir, sessionRef), { force: true });
    }
    catch {
        // A stale or already-cleared run must not block a later request.
    }
}
function requestEvent(requestText, decision, requestRef) {
    return {
        event: 'hook-request',
        requestRef,
        requestLength: requestText.length,
        route: decision.route,
        nextAction: decision.next.action,
    };
}
function completionDeadlineMs() {
    const configured = Number(process.env.ALIGN_COMPLETION_TIMEOUT_MS);
    return Number.isInteger(configured) && configured > 0 ? configured : 29000;
}
function prepareReferenceHostBaseline(projectDir, requestText, decision, sessionRef) {
    const requestRef = opaqueRef('request');
    appendEvent(projectDir, requestEvent(requestText, decision, requestRef));
    if (decision.route !== 'pass' && decision.route !== 'enrich') {
        clearRun(projectDir, sessionRef);
        return { status: 'not_executable' };
    }
    if (decision.lifecyclePlan.baseline !== 'required') {
        clearRun(projectDir, sessionRef);
        return { status: 'invalid_transition' };
    }
    const existingRun = readRun(projectDir, sessionRef);
    if (existingRun && [
        'ready_for_baseline', 'ready_for_handoff', 'handoff_issued', 'receipt_recorded'
    ].includes(existingRun.phase)) {
        return { status: 'invalid_transition' };
    }
    const runId = opaqueRef('run');
    const revision = 1;
    const planRef = acceptancePlanRef(decision);
    const scopeRef = scopeFingerprint(decision);
    const projectCommands = (0, acceptance_plan_1.getVerificationCommands)(projectDir);
    const acceptedCommands = decision.acceptance
        .filter(acceptance => acceptance.method.kind === 'command')
        .map(acceptance => ({ id: acceptance.id, command: acceptance.method.value }));
    const acceptedCommandIds = new Map(acceptedCommands.map(acceptance => [acceptance.command, acceptance.id]));
    const run = {
        kind: 'alignment.reference-host-run',
        stateVersion: '1.0.0',
        phase: 'ready_for_baseline',
        requestRef,
        requestId: decision.requestId,
        decisionId: decision.decisionId,
        runId,
        revision,
        route: decision.route,
        acceptancePlanRef: planRef,
        scopeFingerprint: scopeRef,
        acceptanceCount: decision.acceptance.length,
        acceptanceIds: decision.acceptance.map(acceptance => acceptance.id),
        acceptanceBindings: projectCommands
            .filter(command => acceptedCommandIds.has(command))
            .map(command => ({ acceptanceId: acceptedCommandIds.get(command), commandHash: hash(command) })),
    };
    ensureLifecycleDir(projectDir);
    writeRun(projectDir, run, sessionRef);
    return {
        status: 'ready_for_baseline',
        transition: { runId, expectedRevision: revision }
    };
}
function checkReferenceHostBaseline(projectDir, decision, transition, sessionRef) {
    const run = readRun(projectDir, sessionRef);
    if (!run || !matchesTransition(run, transition, 'ready_for_baseline')) {
        return { status: 'invalid_transition' };
    }
    const identityObservable = typeof decision.requestId === 'string' && decision.requestId.length > 0 &&
        typeof decision.decisionId === 'string' && decision.decisionId.length > 0;
    const acceptanceObservable = Array.isArray(decision.acceptance) && decision.acceptance.length > 0;
    const scopeObservable = isRecord(decision.scope) &&
        Array.isArray(decision.scope.include) && decision.scope.include.every(item => typeof item === 'string') &&
        Array.isArray(decision.scope.exclude) && decision.scope.exclude.every(item => typeof item === 'string');
    const identityStatus = !identityObservable
        ? 'not_observed'
        : decision.requestId === run.requestId && decision.decisionId === run.decisionId
            ? 'satisfied'
            : 'failed';
    const acceptanceStatus = !acceptanceObservable
        ? 'not_observed'
        : acceptancePlanRef(decision) === run.acceptancePlanRef
            ? 'satisfied'
            : 'failed';
    const scopeStatus = !scopeObservable
        ? 'not_observed'
        : scopeFingerprint(decision) === run.scopeFingerprint
            ? 'satisfied'
            : 'failed';
    const baseline = recordBaselineReport(projectDir, run, run.acceptancePlanRef, run.scopeFingerprint, { identity: identityStatus, acceptance: acceptanceStatus, scope: scopeStatus });
    run.baselineReportRef = baseline.ref;
    run.phase = baseline.status === 'passed'
        ? 'ready_for_handoff'
        : baseline.status === 'failed'
            ? 'baseline_failed'
            : 'baseline_incomplete';
    writeRun(projectDir, run, sessionRef);
    appendEvent(projectDir, {
        event: 'baseline-check',
        requestRef: run.requestRef,
        status: baseline.status,
        observationCount: 3
    });
    return { status: run.phase, transition };
}
function issueReferenceHostHandoff(projectDir, decision, transition, sessionRef) {
    const run = readRun(projectDir, sessionRef);
    if (!run || !matchesTransition(run, transition, 'ready_for_handoff') || !run.baselineReportRef) {
        return { status: 'invalid_transition' };
    }
    const baseline = readBaselineReport(projectDir, run.baselineReportRef);
    if (baseline.state === 'missing')
        return { status: 'baseline_incomplete' };
    if (baseline.state === 'invalid')
        return { status: 'invalid_transition' };
    const report = baseline.report;
    if (report.requestId !== decision.requestId || report.requestId !== run.requestId ||
        report.decisionId !== decision.decisionId || report.decisionId !== run.decisionId ||
        report.runId !== run.runId || report.revision !== run.revision ||
        acceptancePlanRef(decision) !== run.acceptancePlanRef ||
        scopeFingerprint(decision) !== run.scopeFingerprint) {
        return { status: 'invalid_transition' };
    }
    if (report.status === 'failed')
        return { status: 'baseline_failed' };
    if (report.status === 'incomplete')
        return { status: 'baseline_incomplete' };
    if (!passedBaselineMatchesRun(report, run))
        return { status: 'invalid_transition' };
    const handoffId = opaqueRef('handoff');
    const executionHandoffRef = recordExecutionHandoff(projectDir, decision, run.runId, run.revision, handoffId, run.baselineReportRef, run.acceptancePlanRef, run.scopeFingerprint);
    run.phase = 'handoff_issued';
    run.handoffId = handoffId;
    run.executionHandoffRef = executionHandoffRef;
    run.handoffRevision = run.revision;
    writeRun(projectDir, run, sessionRef);
    appendEvent(projectDir, {
        event: 'execution-handoff',
        requestRef: run.requestRef,
        handoffId,
        route: run.route,
        acceptanceCount: run.acceptanceCount,
    });
    return { status: 'handoff_issued', transition };
}
/**
 * Record the Claude UserPromptSubmit decision and issue an execution handoff.
 * Public lifecycle artifacts stay separate from the redacted audit log.
 */
function recordReferenceHostHandoff(projectDir, requestText, decision, sessionRef) {
    const prepared = prepareReferenceHostBaseline(projectDir, requestText, decision, sessionRef);
    if (prepared.status !== 'ready_for_baseline' || !prepared.transition)
        return prepared;
    const baseline = checkReferenceHostBaseline(projectDir, decision, prepared.transition, sessionRef);
    if (baseline.status !== 'ready_for_handoff')
        return baseline;
    return issueReferenceHostHandoff(projectDir, decision, prepared.transition, sessionRef);
}
/** Persist an explicit, schema-valid execution receipt for an issued handoff. */
function reportExecution(projectDir, receipt, transition, sessionRef) {
    const run = readRun(projectDir, sessionRef);
    if (!run)
        return { status: 'not_observable' };
    if (!matchesTransition(run, transition, 'handoff_issued') ||
        !run.handoffId || !run.executionHandoffRef ||
        !isExecutionReceiptArtifact(receipt) ||
        !executionReceiptMatchesRun(receipt, run) ||
        !lifecyclePairMatchesRun(projectDir, run)) {
        return { status: 'invalid_transition' };
    }
    const receiptRef = writeLifecycleArtifact(projectDir, `${run.runId}-receipt-r${receipt.revision}.json`, receipt);
    run.executionRef = receipt.executionRef;
    run.executionReceiptRef = receiptRef;
    run.revision = receipt.revision;
    run.phase = receipt.status === 'completed'
        ? 'receipt_recorded'
        : receipt.status === 'failed'
            ? 'execution_failed'
            : 'execution_cancelled';
    writeRun(projectDir, run, sessionRef);
    appendEvent(projectDir, {
        event: 'execution-receipt',
        requestRef: run.requestRef,
        handoffId: run.handoffId,
        executionRef: 'claude-code:stop',
        status: receipt.status
    });
    return {
        status: run.phase,
        artifactRef: receiptRef,
        transition: { runId: run.runId, expectedRevision: run.revision }
    };
}
/** Run acceptance only after a completed receipt has been durably registered. */
function completionVerify(projectDir, transition, sessionRef) {
    const run = readRun(projectDir, sessionRef);
    if (!run)
        return { status: 'not_observable' };
    if (!matchesTransition(run, transition, 'receipt_recorded') ||
        !run.handoffId || !run.executionRef || !run.executionReceiptRef ||
        !lifecyclePairMatchesRun(projectDir, run)) {
        return { status: 'invalid_transition' };
    }
    const receipt = readExecutionReceipt(projectDir, run.executionReceiptRef);
    if (!receipt || receipt.status !== 'completed' ||
        receipt.requestId !== run.requestId || receipt.decisionId !== run.decisionId ||
        receipt.runId !== run.runId || receipt.handoffId !== run.handoffId ||
        receipt.revision !== run.revision || receipt.executionRef !== run.executionRef) {
        return { status: 'invalid_transition' };
    }
    const currentCommands = new Map((0, acceptance_plan_1.getVerificationCommands)(projectDir).map(command => [hash(command), command]));
    const verificationCommands = run.acceptanceBindings
        .map(binding => currentCommands.get(binding.commandHash))
        .filter((command) => typeof command === 'string');
    const uniqueVerificationCommands = [...new Set(verificationCommands)];
    const deadlineMs = completionDeadlineMs();
    const verification = (0, verifier_1.runVerificationCommands)(projectDir, uniqueVerificationCommands, {
        commandTimeoutMs: deadlineMs,
        totalTimeoutMs: deadlineMs
    });
    const resultByHash = new Map(verification.results.map(result => [hash(result.command), result]));
    const bindingByAcceptance = new Map(run.acceptanceBindings.map(binding => [binding.acceptanceId, binding]));
    const checks = run.acceptanceIds.map(acceptanceId => {
        const binding = bindingByAcceptance.get(acceptanceId);
        const result = binding ? resultByHash.get(binding.commandHash) : undefined;
        return {
            acceptanceId,
            status: result ? (result.success ? 'passed' : 'failed') : 'not_observed',
            evidenceRefs: result
                ? [{ kind: 'command', ref: `command:sha256:${sha256(result.command)}` }]
                : []
        };
    });
    const status = checks.some(check => check.status === 'failed')
        ? 'verification_failed'
        : checks.every(check => check.status === 'passed')
            ? 'verified'
            : 'verification_inconclusive';
    const completionRevision = run.revision + 1;
    const report = {
        schemaVersion: '1.0.0',
        requestId: run.requestId,
        decisionId: run.decisionId,
        runId: run.runId,
        revision: completionRevision,
        kind: 'alignment.completion-report',
        phase: 'completion',
        executionRef: receipt.executionRef,
        status,
        reasons: status === 'verified'
            ? []
            : status === 'verification_failed'
                ? ['lifecycle.completion_failed']
                : ['runtime.degraded'],
        checks
    };
    const completionReportRef = writeLifecycleArtifact(projectDir, `${run.runId}-completion-r${completionRevision}.json`, report);
    run.phase = status;
    run.revision = completionRevision;
    run.completionReportRef = completionReportRef;
    writeRun(projectDir, run, sessionRef);
    const passedCount = checks.filter(check => check.status === 'passed').length;
    appendEvent(projectDir, {
        event: 'completion-evidence',
        requestRef: run.requestRef,
        handoffId: run.handoffId,
        executionRef: 'claude-code:stop',
        status,
        checkCount: checks.length,
        passedCount,
        evidenceRefs: checks.map(check => check.acceptanceId)
    });
    return {
        status,
        evidenceCount: checks.length,
        artifactRef: completionReportRef,
        transition: { runId: run.runId, expectedRevision: run.revision }
    };
}
/**
 * Convenience seam for a normal Claude Stop observation. A missing observation
 * is not an execution receipt and therefore cannot trigger completion checks.
 */
function completeReferenceHostRun(projectDir, observation, sessionRef) {
    if (!observation || observation.kind !== 'claude-code.stop') {
        return { status: 'not_observable' };
    }
    const run = readRun(projectDir, sessionRef);
    if (!run)
        return { status: 'not_observable' };
    if (run.phase !== 'handoff_issued' || !run.handoffId) {
        return { status: 'invalid_transition' };
    }
    const transition = { runId: run.runId, expectedRevision: run.revision };
    const receipt = {
        schemaVersion: '1.0.0',
        requestId: run.requestId,
        decisionId: run.decisionId,
        runId: run.runId,
        revision: run.revision + 1,
        kind: 'alignment.execution-receipt',
        phase: 'execution',
        handoffId: run.handoffId,
        status: 'completed',
        executionRef: `claude-code:stop:${run.runId}`
    };
    const reported = reportExecution(projectDir, receipt, transition, sessionRef);
    if (reported.status !== 'receipt_recorded' || !reported.transition)
        return reported;
    return completionVerify(projectDir, reported.transition, sessionRef);
}
//# sourceMappingURL=reference-host.js.map
