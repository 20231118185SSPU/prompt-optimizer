// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
export interface ProjectionResult {
    status: 'created' | 'updated' | 'unchanged';
    sourceDigest: string;
    path: string;
}
export declare function writeContextProjection(projectDir: string, force?: boolean): ProjectionResult;
//# sourceMappingURL=context-projection.d.ts.map
