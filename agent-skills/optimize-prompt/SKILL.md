---
name: optimize-prompt
description: Optimize vague user instructions into precise Agent Briefs. Use when the user asks to improve, rewrite, refine, clarify, or structure a prompt, or when they want an AI agent to understand and execute an idea accurately.
---

# Optimize Prompt

Transform rough user instructions into prompts that an AI agent can understand, execute, verify, and learn from. Do not merely polish wording; reduce execution ambiguity.

## Inputs

- If the user provided text after `$optimize-prompt`, `/optimize-prompt`, or the skill invocation, use it as the raw instruction.
- If not, ask: `请粘贴你想优化的原始指令。`
- If the user uses `[直出]`, output only the optimized prompt.
- If the user uses `[访谈]`, run one-question-at-a-time clarification before producing a final prompt.
- If the user uses `[Agent Brief]`, produce the full Agent Brief structure.
- If the user uses `[项目上下文]`, produce a project context memory draft.

## References

Read `references/methodology.md` before optimizing. Load templates only when useful:

- Agent Brief tasks: `references/agent-brief.md`
- Clarification interview: `references/clarify.md`
- Project memory: `references/project-context.md`
- Code tasks: `references/code.md`
- Analysis/research tasks: `references/analyze.md`
- Writing tasks: `references/write.md`
- Summary/explain/teach tasks: `references/meta.md`
- Negative constraints: `references/anti-patterns-reference.md`

## Process

### 1. Decompose

Extract these components. Mark missing items as `[缺失]`:

- INTENT: what the user really wants
- TARGET: the object to work on
- CONTEXT: background, audience, use case, project state
- SCOPE: what is included and excluded
- DELIVERABLES: final output shape
- CONSTRAINTS: rules, permissions, negative constraints
- WORKFLOW: how the agent should proceed
- ACCEPTANCE: success criteria and verification
- MEMORY: what should be persisted or learned

### 2. Diagnose

Score each dimension 0/1/2:

- D1 Specificity
- D2 Constraint
- D3 Structure
- D4 Context
- D5 Verification

Be strict. A natural-language instruction rarely deserves 9-10.

### 3. Clarify Only When It Matters

Ask one question before optimizing if missing information would change:

- the goal
- the deliverable
- architecture or implementation direction
- safety, data, permissions, cost, or irreversible actions
- acceptance criteria

Ask only one question and provide your recommended answer. Do not ask for information that can be discovered by reading local files, docs, logs, or referenced URLs.

### 4. Transform

Apply these rules in priority order:

1. R1 precision injection
2. R3 deliverable lock
3. R5 negative constraints
4. R4 context anchor
5. R2 boundary lock
6. R6 scope trimming
7. R7 example embedding
8. R8 verification gate
9. R9 intent routing
10. R10 memory gate

Every optimized prompt must include a verification gate.

### 5. Output

Use this format unless `[直出]` was requested:

```markdown
## 优化后的 Prompt

[A complete, directly usable Agent Brief or task prompt]

## 诊断

| 维度 | 得分 | 问题 |
| --- | --- | --- |
| D1 精确性 | X/2 | ... |
| D2 约束性 | X/2 | ... |
| D3 结构性 | X/2 | ... |
| D4 上下文 | X/2 | ... |
| D5 验证性 | X/2 | ... |
| **总分** | **X/10** | ... |

## 改动记录

1. ...
2. ...
3. ...
```

For complex agent tasks, include context-reading instructions, workflow routing, scope boundaries, acceptance criteria, and reflection or memory output.

## Quality Bar

Before finalizing, check:

- Can an agent execute this without guessing the main goal?
- Are boundaries and permissions explicit?
- Is the output format clear?
- Is there a test, self-check, or acceptance standard?
- Does the prompt say what to do when information is missing?
- For long-running projects, does it preserve useful knowledge?
