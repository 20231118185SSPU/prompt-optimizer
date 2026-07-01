---
name: optimize-prompt
description: Optimize vague user instructions into precise Agent Briefs. Use when the user asks to improve, rewrite, refine, clarify, or structure a prompt; says "优化:"/"优化一下"/"改成给 AI agent 用"; or wants an AI agent to understand and execute an idea accurately.
---

# Optimize Prompt

Transform rough user instructions into prompts that an AI agent can understand, execute, verify, and learn from. Do not merely polish wording; reduce execution ambiguity.

## Inputs

- If the user provided text after `$optimize-prompt`, `/optimize-prompt`, or the skill invocation, use it as the raw instruction.
- If the user writes `优化：...`, `优化: ...`, `optimize: ...`, or `改成给 AI agent 用：...`, treat the text after the colon as the raw instruction.
- If not, ask: `请粘贴你想优化的原始指令。`
- Users do not need to choose a mode. Route automatically.
- If the user explicitly requests a mode, honor it, but never require mode prefixes.

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

### 0. Intelligent Routing

Before transforming, classify the request into one route. Do not expose this routing step unless it helps explain the result.

| Route | Use When | Output |
| --- | --- | --- |
| Basic Optimize | The request is simple, low risk, and mostly needs clearer wording | Optimized prompt first, then a short diagnosis |
| Agent Brief | The request asks an AI agent to build, modify, research, design, debug, refactor, or execute multi-step work | Full Agent Brief with goal, scope, workflow, constraints, acceptance |
| Clarify First | Missing information would change the goal, deliverable, permissions, safety, cost, or acceptance criteria | One high-value question with a recommended answer |
| Project Context | The user wants reusable rules, project memory, team conventions, or repeated-agent behavior | Project context / memory draft |
| Direct Output | The user asks for only the final prompt, says "不要解释", "只给结果", or the original request is already clear | Optimized prompt only |

Default to Basic Optimize for simple requests and Agent Brief for agent execution tasks. Escalate to Clarify First only when guessing would materially change the result. If the task can be clarified by reading files, docs, logs, or URLs, tell the future agent to inspect them instead of asking the user.

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
