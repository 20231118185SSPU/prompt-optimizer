# 参考内容取舍说明

> 本文件说明本项目从外部材料中吸收了什么，以及哪些内容没有照搬。

## 1. AI 编程自主思维模型

来源重点：

- 不预设固定角色，让 AI 根据任务自适应角色和能力
- 感知 → 自设计 → 深度思考 → 执行 → 反思 → 沉淀
- 反思循环和经验沉淀

已吸收：

- 写入 [METHODOLOGY.md](METHODOLOGY.md) 的“自主思维循环”
- 写入 [templates/AGENT-BRIEF.md](templates/AGENT-BRIEF.md) 的工作方式
- 写入 [TRANSFORM.md](TRANSFORM.md) 的复杂任务要求
- 写入 [templates/PROJECT-CONTEXT.md](templates/PROJECT-CONTEXT.md) 的沉淀结构

没有照搬：

- 没有要求 AI 展示完整思维链。项目只要求输出关键决策、风险、验收和沉淀，避免冗长推理污染结果。
- 没有让 AI 无限自我进化。规则沉淀必须可读、可审查、可由用户确认。

## 2. AI 编程开发规则手册

来源重点：

- 先理解，后动手
- 最小变更原则
- 上下文持久化
- 渐进式披露
- 需求分析、架构设计、开发、质量保障、部署的阶段规则

已吸收：

- “先阅读上下文再执行”进入 Agent Brief 和 skill 质量门
- “最小变更”进入项目上下文模板
- “上下文持久化”进入 PROJECT-CONTEXT 模板
- “质量保障”转化为验收标准和自检门
- “需求不明确先澄清”转化为 CLARIFY 模板

没有照搬：

- 没有强制所有输出中文注释或固定数据库/API 规范，因为本项目要跨语言、跨工具、跨任务类型。
- 没有把整本开发手册塞进 System Prompt，因为过长规则会增加上下文负担，降低 agent 执行稳定性。
- 没有强制“禁止创建新文件”作为通用规则，只在编程/项目场景里作为可选约束。对文档型项目，新增模板文件是合理行为。

## 3. mattpocock/skills

来源重点：

- skill 要小、可组合、可预测
- user-invoked 和 model-invoked 的区别
- grilling：一次只问一个问题，直到共享理解
- CONTEXT.md：用共享术语降低沟通成本
- PRD / issue / testing decisions：把讨论转为可执行工作单元
- writing-great-skills：减少 no-op、重复和上下文负担

已吸收：

- `CLARIFY.md` 采用“一次只问一个问题 + 推荐答案”的访谈方式
- `PROJECT-CONTEXT.md` 采用共享术语和项目记忆思路
- `AGENT-BRIEF.md` 采用可执行工作单元，而不是泛泛 prompt
- `agent-skills/optimize-prompt/SKILL.md` 保持短小，详细方法论和模板放入 `references/`
- `TRANSFORM.md` 使用模式路由，而不是所有输入都走同一个流程

没有照搬：

- 没有复制其 issue tracker、triage、ADR 工作流，因为本项目不是工程项目管理系统。
- 没有照搬其英文术语体系，而是转成中文用户更容易使用的 Agent Brief / 澄清访谈 / 项目上下文。
- 没有拆成大量 skills，因为当前项目规模还小；过早拆分会增加用户记忆成本。

## 4. 当前仍可改进的地方

还没有完全解决的点：

1. 没有针对每个工具提供真实截图或录屏。
2. 没有测试不同 AI 工具实际输出质量的 benchmark。
3. 没有接入 skills.sh 或其他公共 skill marketplace。
4. 没有为 Cursor / Windsurf 这类非 skills 目录工具做专属安装器。

推荐后续方向：

- 增加一组 “原始请求 → Agent Brief → 执行结果” benchmark
- 增加 `docs/` 下的工具专题指南
- 为项目上下文模板增加真实示例
