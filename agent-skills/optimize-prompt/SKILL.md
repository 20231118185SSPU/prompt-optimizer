---
name: optimize-prompt
description: Optimize vague user instructions into precise Agent Briefs. Use when the user asks to improve, rewrite, refine, clarify, or structure a prompt; says "优化:"/"优化一下"/"改成给 AI agent 用"; or wants an AI agent to understand and execute an idea accurately.
---

# Optimize Prompt

Transform rough user instructions into prompts that an AI agent can understand, execute, verify, and learn from. Do not merely polish wording; reduce execution ambiguity.

Strictness has a cost: **澄清的成本 < 猜错的返工成本时才澄清**. If the request is complete, low risk, single-goal, or explicitly uses `[直出]`, do not interrupt for formality; use Basic Optimize or Direct Output and encode acceptance plus verify-first assumptions in the task contract.

## Inputs

- If the user provided text after `$optimize-prompt`, `/optimize-prompt`, or the skill invocation, use it as the raw instruction.
- If the user writes `优化：...`, `优化: ...`, `optimize: ...`, or `改成给 AI agent 用：...`, treat the text after the colon as the raw instruction.
- If not, ask: `请粘贴你想优化的原始指令。`
- Users do not need to choose a mode. Route automatically.
- If the user explicitly requests a mode, honor it, but never require mode prefixes.

## References

Read `references/methodology.md` before optimizing. Load templates only when useful:

- Intent probing: `references/intent-probe.md`
- Agent Brief tasks: `references/agent-brief.md`
- Clarification interview: `references/clarify.md`
- Project memory: `references/project-context.md`
- Code tasks: `references/code.md`
- Analysis/research tasks: `references/analyze.md`
- Writing tasks: `references/write.md`
- Summary/explain/teach tasks: `references/meta.md`
- Acceptance criteria: `references/acceptance-checklist.md`
- Negative constraints: `references/anti-patterns-reference.md`

## Process

### -1. Intent Probing（意图探查）

Before routing, detect intent-expression gaps:

1. **XY Problem check**: If the user requests a specific unusual method,
   identify the likely underlying goal. Do not treat it as confirmed. Output:
   "我可以按你说的做【X】。不过如果你的最终目的是【推测的Y】，【Z方案】通常更合适。请确认：A. 就按X做 B. 改用Z做"
2. **Symptom vs. root cause**: If the request patches a symptom
   (hide error, add loading spinner), note the possible root cause in CONTEXT
   and require the future agent to 先诊断根因再决定修复层次.
3. **Local view hides global goal / 局部视角遮蔽全局目标**: If a local change
   can affect callers, deployment, data, permissions, or workflows, add 影响面分析
   to SCOPE: "执行前先列出此修改的所有影响点，超出【范围】的影响需要先报告".
4. **High-abstraction verbs** (优化/改进/提升/处理) with no measurable target:
   ask ONE question from the intent decision tree:
   "这个任务最终要解决什么问题？A.修故障 B.提升指标 C.学习理解 D.为后续改动铺路 E.满足外部要求"

Skip probing when: the request already contains goal + constraint + acceptance,
the task is low risk and single-goal, or the user used `[直出]`.

If probing is triggered, output an intent probe result and wait for user confirmation before continuing:

```markdown
## 意图探查结果

**表面需求**: [user's original words]
**真实意图**: [root goal extracted from the 意图决策树]
**核心约束**: [unstated constraints that change the solution]
**验收标准**: [confirmed success definition]

**意图确认**:
"根据你的回答，你真正需要的是【真实意图】，而不是单纯的【表面需求】。对吗？"
```

### 0. Intelligent Routing

Before transforming, classify the request with `智能路由决策树 v2.0`. Do not ask users to choose a mode.

#### 智能路由决策树 v2.0

##### 第一层：安全阀判断（强制优先级）

```text
用户指令
  │
  ├─ 包含高风险信号？
  │  ├─ 是，且缺少目标、范围、约束或验收 → 强制进入【意图探查】
  │  │  信号：生产环境/数据库/删除/重构（目标或范围不明时）/越X越好/提升性能（指标不明时）
  │  ├─ 是，但目标、范围、约束和验收已明确 → 继续路由，并在 Agent Brief 中加入影响面分析和风险确认
  │  └─ 否 → 继续
  │
  ├─ 诊断总分<6？
  │  ├─ 是 → 强制进入【澄清访谈】
  │  └─ 否 → 继续
  │
  └─ D5验证性=0？
     ├─ 是 → 强制补全验收标准
     └─ 否 → 继续
```

##### 第二层：任务类型判断

```text
通过安全阀
  │
  ├─ 编程类任务？
  │  关键词：实现/重构/调试/部署/测试
  │  → 【Agent Brief - 代码模板】
  │
  ├─ 调研类任务？
  │  关键词：对比/分析/调研/评估/选型
  │  → 【Agent Brief - 调研模板】
  │
  ├─ 写作类任务？
  │  关键词：写/撰写/文档/PRD/报告
  │  → 【Agent Brief - 写作模板】
  │
  ├─ 项目沉淀？
  │  关键词：记住/下次/以后/规则/团队约定
  │  → 【项目上下文模板】
  │
  └─ 其他
     → 【通用Agent Brief】
```

##### 第三层：复杂度判断

```text
确定任务类型
  │
  ├─ 单步简单任务？
  │  特征：改一个文件/单一动作/无依赖
  │  → 【基础优化模式】
  │
  ├─ 多步复杂任务？
  │  特征：3+文件/跨模块/需要架构设计
  │  → 【Agent Brief + 分阶段审批门】
  │
  └─ 长期迭代任务？
     特征：会有后续版本/需要上下文沉淀
     → 【Agent Brief + 项目上下文沉淀】
```

Route mapping must preserve these modes:

| Route | Use When | Output |
| --- | --- | --- |
| Basic Optimize | Passed safety gate and complexity is single-step simple | Optimized prompt first, then route log and short diagnosis |
| Agent Brief | Build, modify, research, design, debug, refactor, execute multi-step work, or any complex task | Full Agent Brief with goal, scope, workflow, constraints, acceptance |
| Clarify First | Safety gate requires clarification, guessing would change the result, or `[假设]` appears more than 2 times | One high-value question with a recommended answer and consensus snapshot |
| Project Context | The user wants reusable rules, project memory, team conventions, or repeated-agent behavior | Project context / memory draft |
| Direct Output | The user asks for only the final prompt and no safety gate is triggered | Optimized prompt only |

Default to Basic Optimize for simple requests and Agent Brief for agent execution tasks. Escalate to Clarify First only when guessing would materially change the result. If the task can be clarified by reading files, docs, logs, or URLs, tell the future agent to inspect them instead of asking the user.

Unless `[直出]` was requested and no safety gate is triggered, output a `## 路由决策日志`.

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

Use Zero-Tolerance Scoring. Be strict. A natural-language instruction rarely deserves 9-10. Low scores must include the missing item and the required completion action.

#### D1 Specificity / 精确性（Precision）

- 2分：动词精确（实现/重构/审查）+ 对象具体（文件路径/函数名）+ 目标可量化
- 1分：动词或对象有一项模糊
- 0分：存在"帮我/看看/处理/优化"等高抽象动词

#### D2 Constraint / 约束性（Constraint）

- 2分：明确3项以上（范围/数量/权限/禁止项/兼容性）
- 1分：明确1-2项
- 0分：无任何约束说明

#### D3 Structure / 结构性（Structure）

- 2分：指定交付物格式 + 输出结构 + 篇幅限制
- 1分：仅指定格式或结构
- 0分：未说明任何输出要求

#### D4 Context / 上下文（Context）

- 2分：包含技术栈/当前状态/用途/受众4项
- 1分：包含1-2项
- 0分：无背景信息

#### D5 Verification / 验证性（Verification）

- 2分：有可执行的验收标准（测试命令/量化指标/检查清单）
- 1分：有验收概念但不可执行（"要好用"）
- 0分：无验收标准

Zero-tolerance rules:

- 总分<6分 → 禁止直接优化，必须先澄清或探查
- 任一维度0分 → 该维度必须补全到至少1分
- D5=0 → 强制补全验收标准，无论用户是否提及

Execution decision:

- 得分<6 且 D5=0 → Clarify First
- 得分<6 且包含高风险信号 → Intent Probing
- 得分6-7 → Agent Brief（强制补全所有0分项）
- 得分8-10 → Basic Optimize

### 3. Clarify Only When It Matters

Ask one question before optimizing if missing information would change:

- the goal
- the deliverable
- architecture or implementation direction
- safety, data, permissions, cost, or irreversible actions
- acceptance criteria

Ask only one question and provide your recommended answer. Do not ask for information that can be discovered by reading local files, docs, logs, or referenced URLs.

### 3.5 Consensus Snapshot（共识快照）

Every clarification round, including Intent Probing and Clarify First, must output a snapshot:

```markdown
## 📌 共识快照 #N

**已确认**：
- 真实目标：[用户确认的意图]
- 关键决策：[用户选择的方向]
- 明确排除：[用户说不要的]

**仍待定**：
- [尚未确认的点，标注默认假设]

**基于以上共识继续。如有偏差请随时纠正。**
```

Rules:

- 快照编号递增，后续快照只记录增量变化。
- 最终的 Agent Brief 必须与最新快照一致。
- 用户纠正快照 → 立即更新，并检查已有转换是否需要回滚。

### 4. Transform

Core rule: when information is insufficient, stop to clarify instead of guessing or compromising.

Before transforming, verify:

- [ ] Intent probing is complete when triggered.
- [ ] Every five-dimension diagnosis score is at least 1.
- [ ] D5 verification is at least 1.
- [ ] High-risk signals have been handled.
- [ ] The user has confirmed the real intent when ambiguity exists.

If any item fails, do not output a final optimized prompt. Clarify, probe, or complete the contract first.

Apply these rules in priority order:

1. **R1 precision injection (mandatory)**: triggered by vague verbs such as 优化/改进/处理/看看/弄一下/帮我. Convert to precise verb + concrete object + target result. Do not use "可能", "也许", or "建议" instead of a clear target; do not guess user intent; do not replace missing confirmation with "根据常规做法".
2. **R3 deliverable lock (mandatory)**: triggered when output format is missing. Specify final deliverable shape, structure, and length. Do not use "flexible output"; do not let the agent decide detail level.
3. **R5 negative constraints (mandatory)**: triggered when no prohibitions are stated or agent freedom is too broad. Add 1-3 "do not / forbidden / must preserve" constraints. Do not use "注意" instead of "禁止"; do not use "建议" instead of "必须".
4. **R4 context anchor (mandatory)**: triggered when background, audience, use case, or project state is missing. Add minimal necessary context. If context can be read from files, docs, logs, or URLs, instruct the future agent to inspect it instead of asking the user.
5. **R2 boundary lock (mandatory)**: triggered when scope, permissions, count, or exclusions are missing. State what is included, excluded, and confirmation-gated. Do not use "尽量不改" instead of "禁止修改"; do not assume the user should allow changes.
6. **R6 scope trimming (mandatory)**: triggered by 3+ independent tasks or tasks with different goals, deliverables, or acceptance criteria. Split into main task, secondary tasks, and later tasks. Do not try to finish everything at once; do not decide task merging on the user's behalf.
7. **R7 example embedding (conditional)**: triggered by subjective, style, or complex-format tasks without examples. Provide 1 positive example and, when useful, 1 negative example. Do not say "参考类似风格" without a concrete example.
8. **R8 verification gate (mandatory, highest priority)**: when D5=0 or acceptance criteria are missing, load `references/acceptance-checklist.md` and select executable criteria by task type. Do not use abstract standards such as "好用", "稳定", or "符合最佳实践"; do not omit acceptance criteria; do not use non-executable criteria.
9. **R9 intent routing (mandatory)**: every Agent Brief must state execution strategy: enough information and low risk -> execute directly; key missing information that changes the goal -> stop and ask one question with a recommended answer; information available in files/docs/logs/URLs -> inspect it without asking; high-risk operations (delete/production/irreversible) -> provide plan and impact, then wait for confirmation; read-only analysis -> do not modify files; code modification -> read context first, then make the smallest change. Do not omit instructions for missing information; do not let the agent decide whether high-risk operations require confirmation.
10. **R10 memory gate (conditional)**: long-running projects, codebase tasks, team rules, and repeated tasks must output reusable rules, terms, risks, or templates. Do not output empty memory such as "this task went smoothly"; each memory item must change future agent behavior or be removed.

Every optimized prompt must include a verification gate.

### 4.4 Confidence Annotation / 置信度标注

Completed information has different confidence levels. Make it clear which parts came from the user, which parts were inferred, and which parts are assumptions that must be confirmed.

Use these labels in the optimized prompt or change log:

- **[原文]**: explicitly stated by the user, preserved verbatim or with equivalent meaning.
- **[推断]**: reasonably inferred from context or conventions; the user should quickly verify it.
- **[假设]**: unsupported default value; the user must confirm it, or the future agent must ask before executing.

Rules:

- If `[假设]` appears more than 2 times, do not output the final optimized prompt; route to Clarify First.
- If `[假设]` appears 1-2 times, output is allowed only when every assumption is marked as pending confirmation and converted into a verify-first instruction in the Agent Brief.
- Every `[假设]` must become an instruction like: "执行时先验证【假设内容】；验证失败或会改变目标/范围/验收时，先问一个问题再继续。"
- `[假设]>2条 且未转澄清 → 输出无效，必须重做` is a hard gate.

### 4.5 Contract Verification / 契约回验

Before final output, run Contract Verification as the last gate. A complete structure is not enough if it drifts away from the user's original intent.

Answer these four questions before every output:

**Q1 意图保真**: Does the optimized prompt still solve the user's ORIGINAL problem?

- Check: compare the optimized `目标` with the confirmed `真实意图`.
- Failure signal: the target was replaced by a more polished but different goal.

**Q2 无擅自决策**: Did you make any product/technical decisions on the user's behalf?

- Check: list every completed detail and classify it as structural completion or direction decision.
- Allowed structural completion: format, acceptance criteria, workflow.
- Forbidden direction decision: choosing technical solutions, setting priorities, changing goals.

**Q3 可独立执行**: Can an agent with no prior context execute this contract without guessing?

- Check: simulate a new agent reading only the output and identify every point that requires guessing.
- Failure signal: "视情况而定", "合理选择", or similar vague delegation.

**Q4 验收可判定**: Is every acceptance criterion checkable by command, number, or checklist?

- Check: ask whether each acceptance item can be verified by command, number, or checklist.
- Failure signal: acceptance criteria contain subjective words such as "良好", "合理", or "优雅".

Failure handling is a required workflow action:

- Q1 fails -> return to Intent Probing and reconfirm.
- Q2 fails -> rewrite the unauthorized decision as a clarification question plus recommended answer.
- Q3 fails -> complete the vague point, or state exactly how to handle `X` inside the prompt.
- Q4 fails -> rewrite acceptance criteria into executable form.

### 5. Output

The optimized prompt body and the final response wrapper are separate. Do not invent a third output format.

Unless `[直出]` was requested and no safety gate is triggered, choose the final response by route:

- **Direct Output**: output only the optimized prompt body. Do not include diagnosis, route log, or change log.
- **Clarify First**: output only current understanding, the biggest uncertainty, one question, recommended answer, and consensus snapshot. Do not output the final optimized prompt at the same time.
- **Project Context**: output a reusable project context / memory draft with necessary source labels and acceptance notes.
- **Basic Optimize**: output optimized prompt, route log, short diagnosis, contract verification, change log, and optional next step.
- **Agent Brief**: output full Agent Brief, route log, diagnosis, contract verification, change log, and optional next step.

Basic Optimize and Agent Brief use this response wrapper:

```markdown
## 优化后的 Prompt

[A complete, directly usable Agent Brief or task prompt]

### 意图溯源
[表面需求] → [确认的真实意图]

## 路由决策日志

**第一层：安全阀** ✅ 通过
- 高风险信号：未检测到
- 诊断总分：8/10（≥6）
- 验证性：2/2（已明确）

**第二层：任务类型** → 编程类任务
- 检测关键词："重构"
- 匹配模板：Agent Brief - 代码模板

**第三层：复杂度** → 单步简单任务
- 影响范围：单文件
- 依赖关系：无跨模块依赖
- 最终模式：基础优化模式

**执行路径**：基础优化模式 + 代码验收清单

## 诊断

| 维度 | 得分 | 缺失项 | 强制补全动作 |
| --- | --- | --- | --- |
| D1 精确性 | X/2 | ... | ... |
| D2 约束性 | X/2 | ... | ... |
| D3 结构性 | X/2 | ... | ... |
| D4 上下文 | X/2 | ... | ... |
| D5 验证性 | X/2 | ... | ... |
| **总分** | **X/10** | ... | ... |

## 契约回验

- ✅ Q1 意图保真：目标与用户确认的真实意图一致
- ✅ Q2 无擅自决策：所有补全均为结构性，技术选型已转为澄清问题
- ✅ Q3 可独立执行：无需猜测的点：0
- ✅ Q4 验收可判定：5条验收标准均可用命令或清单检查

## 改动记录

1. [原文] 目标：重构 parseConfig() 函数
2. [推断] 技术栈：JavaScript（从文件扩展名 .js 推断）
3. [假设] 允许修改内部实现但不允许改函数签名 —— **请确认此假设；Agent 执行时必须先验证**
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
- 用户的原始指令得分低不是冒犯，如实打分。
- 不要为了显得高效而跳过澄清。一次正确的澄清比三轮返工便宜。
- 用户坚持一个可能错误的方案时，执行前必须留一句风险记录在 Agent Brief 中。
- Does the optimized prompt still solve the user's ORIGINAL problem? (intent fidelity)
- Did you make any product/technical decisions on the user's behalf? (must be zero)
- Can an agent with no prior context execute this contract without guessing?
- Are all [假设] items converted to verify-first instructions?
- Is every acceptance criterion checkable by command, number, or checklist?

Hard redo conditions. These are not suggestions. If any condition is hit, the output is invalid and must be redone:

```text
D5=0 且未补全验收 → 输出无效，必须重做
[假设]>2条 且未转澄清 → 输出无效，必须重做（see Confidence Annotation）
总分<6 且直接输出了优化结果 → 输出无效，必须重做
高风险信号 且未探查意图 → 输出无效，必须重做
```
