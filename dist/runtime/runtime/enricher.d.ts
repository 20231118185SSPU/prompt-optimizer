// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
export interface AlignContext {
    lessons: string;
    spec: string;
    facts: string;
    glossary: string;
    state: string;
    context: string;
    decisions: string;
}
export interface EnrichmentResult {
    enrichedMessage: string;
    context: AlignContext;
}
export declare function enrich(instruction: string, projectDir: string): EnrichmentResult;
//# sourceMappingURL=enricher.d.ts.map
