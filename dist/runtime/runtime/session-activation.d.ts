// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
export interface ClaudeSessionActivationOptions {
    now?: number;
    stateHome?: string;
}
export interface ClaudeSessionActivationRecord {
    kind: 'alignment.claude-session-activation';
    schemaVersion: '1.0.0';
    activatedAtMs: number;
    expiresAtMs: number;
}
export type ClaudeSessionActivationResult = {
    status: 'active';
    expiresAtMs: number;
} | {
    status: 'inactive';
    reason?: 'invalid_session_ref' | 'storage_unavailable';
};
export declare function activateClaudeSession(projectDir: string, sessionRef: string, options?: ClaudeSessionActivationOptions): ClaudeSessionActivationResult;
export declare function readClaudeSessionActivation(projectDir: string, sessionRef: string, options?: ClaudeSessionActivationOptions): ClaudeSessionActivationResult;
//# sourceMappingURL=session-activation.d.ts.map
