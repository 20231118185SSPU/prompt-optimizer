// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { AlignmentDecision } from './contract-builder';
/** @internal Explicit CLI composition only; never part of ordinary pipeline output. */
export declare const MATT_SKILLS: readonly ["ask-matt", "code-review", "diagnosing-bugs", "grill-with-docs", "implement", "prototype", "tdd", "to-spec", "to-tickets"];
export type MattSkill = typeof MATT_SKILLS[number];
export interface MattEnvironment {
    availableSkills: ReadonlySet<string>;
    setupComplete: boolean;
}
export interface MattEnvironmentDiscoveryOptions {
    homeDir?: string;
    skillRoots?: readonly string[];
}
export interface MattHandoff {
    schemaVersion: '1.0.0';
    kind: 'alignment.ecosystem-handoff';
    ecosystem: 'matt-pocock-skills';
    handoffId: string;
    source: {
        requestId: string;
        decisionId: string;
        route: AlignmentDecision['route'];
    };
    status: 'ready' | 'setup_required' | 'unavailable' | 'deferred';
    selectedSkill: MattSkill | null;
    invocation: string | null;
    reason: string;
    automatic: false;
    prerequisite: {
        skill: 'setup-matt-pocock-skills';
        invocation: '/setup-matt-pocock-skills';
    } | null;
    input: {
        facts: string[];
        missing: string[];
        scope: AlignmentDecision['scope'];
        acceptance: AlignmentDecision['acceptance'];
    };
}
export declare function discoverMattEnvironment(projectDir: string, options?: MattEnvironmentDiscoveryOptions): MattEnvironment;
export declare function buildMattHandoff(decision: AlignmentDecision, environment: MattEnvironment): MattHandoff;
//# sourceMappingURL=matt-handoff.d.ts.map
