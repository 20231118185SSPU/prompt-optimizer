// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
/**
 * Signal Classifier for the Universal Align Pipeline.
 *
 * Detects risk, vague, specific, and educational signals in user instructions.
 * Ported from core/host/align-route.sh with identical signal dictionaries.
 */
export interface Classification {
    risk: number;
    vague: number;
    specific: number;
    edu: number;
}
/**
 * Classify a user instruction into signal counts.
 *
 * Processing pipeline:
 * 1. Strip code blocks (```...```)
 * 2. Strip inline code (`...`)
 * 3. Strip quoted content ("...", "...", 「...」, 『...』)
 * 4. Strip negation clauses (不要|不得|…)
 * 5. Count risk signals on cleaned text
 * 6. Count vague signals on cleaned text
 * 7. Count specific signals on ORIGINAL text (file names are often quoted)
 * 8. Count educational signals on text after steps 1-3 (before negation strip)
 */
/**
 * @deprecated Compatibility-only signal inspection. Use the Alignment
 * Decision returned by alignInstruction() as the route source of truth.
 */
export declare function classify(instruction: string): Classification;
//# sourceMappingURL=classifier.d.ts.map
