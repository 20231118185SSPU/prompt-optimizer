// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
export type FeasibilityStatus = 'supported' | 'available' | 'blocked' | 'unknown';
export interface FeasibilityItem {
    status: FeasibilityStatus;
    detail: string;
}
export interface HostFeasibilityReport {
    schemaVersion: '1.0.0';
    kind: 'alignment.host-feasibility';
    readOnly: true;
    host: {
        name: string;
        version: string;
        status: FeasibilityStatus;
    };
    configuration: Array<FeasibilityItem & {
        path: string;
    }>;
    capabilities: {
        promptIngress: FeasibilityItem;
        mechanicalBlocking: FeasibilityItem;
        completion: FeasibilityItem;
        session: FeasibilityItem;
    };
    conflicts: Array<FeasibilityItem & {
        kind: 'project_policy' | 'permission' | 'invalid_configuration' | 'parallel_router';
        ref: string;
    }>;
    dependencies: Array<FeasibilityItem & {
        name: string;
        version?: string;
    }>;
    degradedPath: FeasibilityItem & {
        mode: 'explicit';
        activationLevel: 'advisory' | 'none';
    };
    plannedChanges: [];
}
export interface HostFeasibilityOptions {
    host?: {
        name: string;
        version?: string;
    };
    requestedIngress?: 'hook' | 'explicit';
    homeDir?: string;
}
export declare function probeHostFeasibility(projectDir: string, options?: HostFeasibilityOptions): HostFeasibilityReport;
//# sourceMappingURL=host-feasibility.d.ts.map
