import { route, Verdict } from '../router';
import { Classification } from '../classifier';

describe('route', () => {
  // ── HIGH verdict ──
  it('returns HIGH when risk >= 1 and no edu signal', () => {
    const classification: Classification = { risk: 1, vague: 0, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('HIGH');
    expect(result.instructions).toContain('高风险指令');
  });

  it('returns HIGH when risk >= 2 and no edu signal', () => {
    const classification: Classification = { risk: 2, vague: 0, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('HIGH');
  });

  it('returns HIGH when risk >= 1, vague >= 1, but edu = 0', () => {
    const classification: Classification = { risk: 1, vague: 1, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('HIGH');
  });

  // ── GRAY verdict (risk + edu) ──
  it('returns GRAY when risk >= 1 and edu >= 1', () => {
    const classification: Classification = { risk: 1, vague: 0, specific: 0, edu: 1 };
    const result = route(classification);
    expect(result.verdict).toBe('GRAY');
    expect(result.instructions).toContain('歧义');
  });

  // ── VAGUE verdict ──
  it('returns VAGUE when vague >= 1 and specific = 0', () => {
    const classification: Classification = { risk: 0, vague: 1, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('VAGUE');
    expect(result.instructions).toContain('不够明确');
  });

  it('returns VAGUE when vague >= 2 and specific = 0', () => {
    const classification: Classification = { risk: 0, vague: 2, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('VAGUE');
  });

  // ── GRAY verdict (vague + specific) ──
  it('returns GRAY when vague >= 1 and specific >= 1', () => {
    const classification: Classification = { risk: 0, vague: 1, specific: 1, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('GRAY');
    expect(result.instructions).toContain('歧义');
  });

  // ── CLEAR verdict ──
  it('returns CLEAR when all signals are zero', () => {
    const classification: Classification = { risk: 0, vague: 0, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('CLEAR');
    expect(result.instructions).toContain('指令清楚');
  });

  it('returns CLEAR when only specific signals present', () => {
    const classification: Classification = { risk: 0, vague: 0, specific: 2, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('CLEAR');
  });

  it('returns CLEAR when only edu signal present', () => {
    const classification: Classification = { risk: 0, vague: 0, specific: 0, edu: 1 };
    const result = route(classification);
    expect(result.verdict).toBe('CLEAR');
  });

  // ── Instructions are non-empty for all verdicts ──
  it('always returns non-empty instructions', () => {
    const cases: Classification[] = [
      { risk: 1, vague: 0, specific: 0, edu: 0 },
      { risk: 1, vague: 0, specific: 0, edu: 1 },
      { risk: 0, vague: 1, specific: 0, edu: 0 },
      { risk: 0, vague: 1, specific: 1, edu: 0 },
      { risk: 0, vague: 0, specific: 0, edu: 0 },
      { risk: 0, vague: 0, specific: 2, edu: 0 },
    ];
    for (const c of cases) {
      const result = route(c);
      expect(result.instructions.length).toBeGreaterThan(0);
    }
  });

  // ── Edge case: HIGH takes priority over VAGUE/GRAY(vague+specific) ──
  it('HIGH takes priority when risk >= 1 even with vague and specific signals', () => {
    const classification: Classification = { risk: 1, vague: 1, specific: 1, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('HIGH');
  });

  // ── Edge case: risk + edu takes priority over vague-only path ──
  it('risk + edu GRAY takes priority over vague path', () => {
    const classification: Classification = { risk: 1, vague: 1, specific: 0, edu: 1 };
    const result = route(classification);
    expect(result.verdict).toBe('GRAY');
  });
});
