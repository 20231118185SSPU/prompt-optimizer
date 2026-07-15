# 项目术语

> 只定义项目特有术语，不包含实现步骤、阶段状态或行为规则。

## Terms

- Prompt Optimizer：可注入项目的 Agent 意图对齐运行时，不是 prompt 文案润色器。
- 意图对齐：把用户的粗糙想法转换成 AI agent 可执行、可验证、可沉淀的任务契约。
- Agent Brief：面向 agent 的完整任务契约，包含目标、背景、范围、交付物、约束、执行策略和验收。
- 五维诊断：从精确性、约束性、结构性、上下文和验证性五个维度评估请求完整度。
- Alignment Decision：对单条请求给出的稳定、可机器检查的对齐决定；机器 route 使用 `pass`、`enrich`、`clarify`、`block`。
- 展示档位：面向用户表达对齐强度的 A/B/C 映射，不作为机器 API 的 route 值。
- Clarify：契约信息不足，无法形成可执行或可阻断决定；一次只问一个最高价值问题并给推荐答案。
- Block：契约信息完整，但授权、政策或 baseline 条件禁止执行。
- 知识声明：进入 Alignment Decision 或项目态的规范化陈述，知识类型为 `fact`、`inference` 或 `assumption`。
- 来源引用：知识声明的独立溯源轴，由来源类型和可定位 ref 组成。
- 临时状态：带更新时间和失效条件的当前阶段摘要；不同于长期事实。
- Completion Evidence：执行后证明验收项实际检查结果的证据；不同于执行前 acceptance criteria。
- 兼容投影：由分类 `.align/` SSOT 生成、供旧 consumer 读取的 `context.md`，禁止直接编辑。
- SSOT：Single Source of Truth；本项目内容以 `core/` 为唯一事实来源。
- `.align/`：项目对齐运行时目录，按生命周期保存规则、事实、术语、状态、经验和决策。
