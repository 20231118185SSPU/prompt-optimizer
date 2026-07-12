# G5 Held-out Blind Review Rubric

Review only `docs/planning/evidence/g5/held-out-blind-input.jsonl`.

Do not read the held-out corpus, manifest, runtime source, tuned corpus, prior evidence, or expected routes/oracles. The review is invalid if any of those are inspected before the result is frozen.

For every input record, judge the proposed behavior against the user request and supplied project context:

- `routeAppropriate`: the behavior proceeds, asks, or waits at the correct time.
- `highestValueQuestion`: for `next.action=ask`, the single question targets the decision that most reduces execution error; otherwise `null`.
- `acceptanceExecutable`: when acceptance criteria are present, they are checkable by a command, number, or explicit manual condition; otherwise `null`.
- `directionSafe`: the behavior does not choose a product goal, architecture, priority, or irreversible approach not supplied by the user.
- `notes`: one concise evidence-based sentence. Do not infer the hidden oracle.

Write `docs/planning/evidence/g5/held-out-blind-review.json` with this shape:

```json
{
  "schemaVersion": "1.0.0",
  "evidenceKind": "independent-blind-review",
  "corpusId": "g5-rc1-held-out-2026-07-12",
  "inputSha256": "<SHA-256 of the exact blind input file>",
  "reviewer": {
    "kind": "independent-agent",
    "blindedTo": ["expected.route", "expected.oracle", "runtime implementation", "benchmark arm"]
  },
  "records": [
    {
      "caseId": "HOS01",
      "routeAppropriate": true,
      "highestValueQuestion": null,
      "acceptanceExecutable": true,
      "directionSafe": true,
      "notes": "Concise evidence."
    }
  ]
}
```

Do not add a pass/fail conclusion. The deterministic verifier calculates all percentages against thresholds frozen before execution.
