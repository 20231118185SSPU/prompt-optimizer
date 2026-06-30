# Prompt Optimizer / Agent 意图对齐器

> 把用户脑中的粗糙想法，转换成 AI agent 能准确执行、能自检、能沉淀的任务契约。

这个项目不只是“润色提示词”。它的目标是解决 AI agent 最大的失败来源：用户以为自己说清楚了，agent 以为自己听懂了，最后做出来的东西偏了。

## 项目介绍

Prompt Optimizer 是一个面向 AI agent 的意图对齐工具包。它通过五维诊断、澄清访谈、Agent Brief、项目上下文沉淀和验收门，把一句模糊的自然语言请求转换成一份可执行的任务说明。

它适合经常使用 Codex、Claude Code、Cursor、ChatGPT、Claude、Gemini 等 AI 工具的人，用来减少误解、跑偏、过度发挥、提前完成和缺少验证的问题。

本项目提供一套 **Agent Intent Alignment Protocol**：

1. 识别用户真实意图，而不只改写表面文字
2. 把模糊需求拆成可执行的 Agent Brief
3. 在信息不足时触发澄清访谈，而不是让 agent 猜
4. 为复杂任务加入感知、自设计、深度思考、执行、反思、沉淀
5. 让每次任务都留下可复用的上下文、验收标准和经验规则

## 快速开始

### 方式 1：安装到你的 AI 工具

阅读 [INSTALL.md](INSTALL.md)，按你的工具选择接入方式：

- 通用 agent skills：一键安装 `optimize-prompt` skill
- Claude Code：安装为 `/optimize-prompt` skill
- Codex / OpenAI Agents：安装为 `$optimize-prompt` skill
- ChatGPT / Claude / Gemini：复制 System Prompt
- Cursor / Windsurf / Continue：写入 Project Rules
- 其他 agent：使用通用 Agent Brief 模板

### 方式 2：直接使用

阅读 [USAGE.md](USAGE.md)，按场景选择：

- `[直出]`：只要优化后的 prompt
- `[访谈]`：需求没想清楚，先让 AI 一次问一个问题
- `[Agent Brief]`：生成可交给 agent 执行的完整任务简报
- `[项目上下文]`：生成长期项目的上下文记忆

### 方式 3：复制 System Prompt

1. 打开 [TRANSFORM.md](TRANSFORM.md)
2. 复制 `## System Prompt 开始` 到 `## System Prompt 结束` 之间的内容
3. 粘贴到目标 AI 工具的 System Prompt、Custom Instructions、项目规则或第一条消息
4. 发送你的原始指令
5. 获得可直接交给 agent 执行的优化版任务说明

### 方式 4：按模板手写

从 `templates/` 选择最接近的模板：

- [AGENT-BRIEF.md](templates/AGENT-BRIEF.md)：把想法整理成完整 agent 任务简报
- [CLARIFY.md](templates/CLARIFY.md)：让 agent 先追问，再执行
- [PROJECT-CONTEXT.md](templates/PROJECT-CONTEXT.md)：沉淀项目上下文，减少每次重复解释
- [CODE.md](templates/CODE.md)：编程任务
- [ANALYZE.md](templates/ANALYZE.md)：分析 / 调研 / 对比
- [WRITE.md](templates/WRITE.md)：写作任务
- [META.md](templates/META.md)：总结 / 解释 / 教学

## 适用场景

| 你的原始想法 | 本项目输出 |
| --- | --- |
| “帮我优化这个项目” | 明确目标、范围、约束、验收标准和执行阶段的 Agent Brief |
| “帮我做个功能” | 带上下文读取、方案选择、最小变更、测试门的开发任务 |
| “我还没想清楚” | 一次只问一个关键问题的澄清访谈 |
| “以后让 AI 都按这个项目规则来” | 可持久化的项目上下文和规则文件 |
| “AI 老是理解偏” | 显性化用户意图、隐性约束、反面约束和成功标准 |

## 核心方法

本项目融合三类方法：

- **五维诊断**：精确性、约束性、结构性、上下文、验证性
- **Agent 对齐协议**：意图、背景、范围、交付物、约束、执行策略、验收、沉淀
- **自主思维循环**：感知 → 自设计 → 深度思考 → 执行 → 反思 → 沉淀

详细说明见 [METHODOLOGY.md](METHODOLOGY.md)。

## 参考内容取舍

本项目参考了 AI 自主思维模型、AI 编程开发规则手册和 `mattpocock/skills`。具体吸收了什么、没有照搬什么、为什么这样取舍，见 [REFERENCE-DIGEST.md](REFERENCE-DIGEST.md)。

## 项目结构

```text
├── README.md
├── METHODOLOGY.md
├── TRANSFORM.md
├── INSTALL.md
├── USAGE.md
├── REFERENCE-DIGEST.md
├── agent-skills/
│   └── optimize-prompt/       ← 通用可安装 skill 包
│       ├── SKILL.md
│       ├── agents/openai.yaml
│       └── references/
├── scripts/
│   ├── install-skill.ps1
│   └── install-skill.sh
├── templates/
│   ├── AGENT-BRIEF.md
│   ├── CLARIFY.md
│   ├── PROJECT-CONTEXT.md
│   ├── CODE.md
│   ├── WRITE.md
│   ├── ANALYZE.md
│   ├── META.md
│   └── ANTI-PATTERNS-REFERENCE.md
├── examples/
│   ├── transformations.md
│   └── anti-patterns.md
```

## 设计原则

1. **先对齐，再执行**：复杂任务先确认理解和边界，不急着输出。
2. **把隐含意图显性化**：用户没说出口但影响结果的信息，要被挖出来。
3. **一问一答澄清**：需要追问时一次只问一个最高价值问题。
4. **最小必要补全**：补齐缺口，不替用户改目标。
5. **任务即契约**：优化后的 prompt 必须包含交付物、范围、约束和验收。
6. **反思和沉淀**：复杂任务结束后，要求 agent 记录项目模式、风险和复用规则。

## License

MIT
