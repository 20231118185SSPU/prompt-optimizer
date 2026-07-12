// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
export interface SourceRef {
    kind: 'user' | 'project' | 'runtime' | 'decision' | 'default';
    ref: string;
}
export interface DimensionScores {
    d1: number;
    d2: number;
    d3: number;
    d4: number;
    d5: number;
    total: number;
}
export interface AnalysisResult {
    text: string;
    contextText: string;
    presentationMode: 'default' | 'direct_output';
    reasons: string[];
    observed: DimensionScores;
    effective: DimensionScores;
    assumptionCount: number;
    appliedContext: SourceRef[];
}
export declare function isLocalReleasePreparation(text: string): boolean;
export declare function analyzeInstruction(text: string, context?: SourceRef[], contextText?: string): AnalysisResult;
//# sourceMappingURL=analyzer.d.ts.map
