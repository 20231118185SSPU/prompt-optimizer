# Prompt Optimizer / Agent 意图对齐器

> 可注入任意项目的对齐运行时：接入时为项目生成开发规范，运行时让每条开发指令在执行前静默通过意图对齐管线，执行后把经验沉淀回项目。

这个项目不只是”润色提示词”。它的目标是解决 AI agent 最大的失败来源：用户以为自己说清楚了，agent 以为自己听懂了，最后做出来的东西偏了。

## 项目介绍

Prompt Optimizer v3.1 是一个可注入任意项目的 **Alignment Runtime**（对齐运行时）。它通过三个 skill 实现：

- **optimize-prompt**：意图对齐器，把模糊指令优化为可执行的 Agent Brief。v3 默认静默运行——简单任务直接执行（零感知），有缺口时静默补全+微披露（不等待），高风险时浮出澄清（必须拦截）。
- **align-init**：项目接入器，为项目生成 `.align/` 运行时（开发规范+上下文+经验+决策），并注入挂载区到 CLAUDE.md/AGENTS.md。
- **optimize-prompt-lite**：轻量协议，面向弱指令遵循模型或不支持 hook 的宿主，无需 .align/ 运行时即可使用基础对齐。

它适合经常使用 Codex、Claude Code、Cursor、ChatGPT、Claude、Gemini 等 AI 工具的人，用来减少误解、跑偏、过度发挥、提前完成和缺少验证的问题。

### 三档路由（v3 核心设计）

| 档位 | 覆盖 | 条件 | 用户感知 |
| --- | --- | --- | --- |
| A 档直通 | ~60% | 简单+低风险+意图明确 | 零感知，直接执行 |
| B 档静默对齐 | ~30% | 有缺口但可从 .align/ 补全 | 1-3 行披露，不等待 |
| C 档浮出澄清 | ~10% | 高风险/总分<6/假设>2 | 停下，一次一问 |

对齐的存在感与任务风险成正比，与任务频率成反比。简单指令零卡顿，高风险指令必拦截。

### v3.1 发布状态

- 安装闭环：PowerShell / Bash 默认覆盖 Codex、Claude Code、`~/.agents` 三个 skills 目录。
- Adapter 路由：Codex 安装使用 `dist/codex`；Claude Code 和 `~/.agents` 使用 Claude-compatible 的 `dist/claude-code`。
- 协议硬门槛：`[假设]>2`、`总分<6`、`D5=0`、高风险信号和 R8 验证门在 `core/` 与 `dist/` 中保持一致。
- 回测证据：`docs/planning/BENCHMARK-V3.md` 是 18 case 协议规则推演回测，不声明为外部模型实测。

## 快速开始

### 1. 一行安装

Windows PowerShell：

```powershell
iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -UseB | iex
```

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.sh | bash
```

安装三个 skill：`optimize-prompt`（意图对齐器）、`align-init`（项目接入器）和 `optimize-prompt-lite`（轻量协议）。默认安装到 Codex、Claude Code、`~/.agents` 三个目录。
Codex 使用 `dist/codex` 包；Claude Code 和 `~/.agents` 使用 Claude-compatible 的 `dist/claude-code` 包。

### 2. 接入项目

进入你的项目目录，运行：

```text
/align-init
```

`align-init` 会扫描项目，生成 `.align/` 运行时（开发规范+上下文+经验+决策），并注入挂载区到 CLAUDE.md。从此每条开发指令自动经过三档路由。

从零开始新项目：

```text
/align-init --new
```

### 3. 正常干活

接入后直接开发即可。不需要说"优化："——对齐在后台静默发生：

- 简单指令（如"改个变量名"）→ **直接执行**，零感知
- 有缺口的指令（如"加个搜索功能"）→ **1-3 行披露后直接执行**，不等待
- 高风险指令（如"清空数据库"）→ **停下问一个问题**，必须确认

想看完整优化结果时，显式使用：

```text
优化：帮我做一个用户登录功能
```

这会输出完整 Agent Brief 文档（v2.0 兼容行为）。

### 4. 其他接入方式

不支持 skills 的工具可以复制 System Prompt：

1. 打开 [SYSTEM-PROMPT.md](dist/universal/SYSTEM-PROMPT.md)
2. 复制 `## System Prompt Start` 到 `## System Prompt End` 之间的内容
3. 粘贴到目标 AI 工具的 System Prompt、Custom Instructions、项目规则或第一条消息
4. 发送你的原始指令
5. 获得可直接交给 agent 执行的优化版任务说明

也可以直接按模板手写：

从 `core/templates/` 选择最接近的模板：

- [AGENT-BRIEF.md](core/templates/AGENT-BRIEF.md)：把想法整理成完整 agent 任务简报
- [CLARIFY.md](core/templates/CLARIFY.md)：让 agent 先追问，再执行
- [INTENT-PROBE.md](core/templates/INTENT-PROBE.md)：意图探查决策树和偏差检测模板
- [PROJECT-CONTEXT.md](core/templates/PROJECT-CONTEXT.md)：沉淀项目上下文，减少每次重复解释
- [CODE.md](core/templates/CODE.md)：编程任务
- [ANALYZE.md](core/templates/ANALYZE.md)：分析 / 调研 / 对比
- [WRITE.md](core/templates/WRITE.md)：写作任务
- [META.md](core/templates/META.md)：总结 / 解释 / 教学
- [ACCEPTANCE-CHECKLIST.md](core/templates/ACCEPTANCE-CHECKLIST.md)：分类型可复制验收清单库

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

详细说明见 [core/protocol/](core/protocol/)（协议内核 00-07）。

## 文档导航

全部开发、使用、参考和规划文档集中在 [docs/](docs/README.md)：

- [使用文档](docs/README.md#使用文档)：安装与日常使用
- [参考文档](docs/README.md#参考文档)：外部参考取舍
- [规划文档](docs/README.md#规划文档)：深度优化方案和会话任务拆解

## 参考内容取舍

本项目参考了 AI 自主思维模型、AI 编程开发规则手册和 `mattpocock/skills`。具体吸收了什么、没有照搬什么、为什么这样取舍，见 [REFERENCE-DIGEST.md](docs/reference/REFERENCE-DIGEST.md)。

## 项目结构

```text
├── README.md
├── AGENTS.md
├── core/                          # ★ 唯一事实来源（SSOT）
│   ├── protocol/                  # 协议内核 00-07
│   ├── templates/                 # 14 个模板（含 4 个 ALIGN 模板）
│   ├── spec-kit/                  # 规范生成器素材库
│   ├── skills/align-init/         # align-init skill 源文件
│   └── host/                      # 宿主适配源文件（挂载区/hook/reminder）
├── build/                         # 构建脚本
│   ├── build.ps1
│   └── build.sh
├── dist/                          # 构建产物（禁止手改）
│   ├── claude-code/
│   │   ├── optimize-prompt/       # skill 1 + references + agents/
│   │   ├── align-init/            # skill 2 + references + spec-sections/
│   │   ├── hooks/                 # HOOK-REMINDER.txt + settings.fragment.json
│   │   └── CLAUDE.align.md        # 挂载区片段
│   ├── codex/
│   │   ├── optimize-prompt/
│   │   ├── align-init/
│   │   └── AGENTS.align.md
│   ├── cursor/
│   │   ├── rules/align.mdc
│   │   └── references/
│   └── universal/
│       ├── SYSTEM-PROMPT.md       # 可复制 System Prompt
│       ├── optimize-prompt/
│       └── align-init/
├── docs/
│   ├── README.md
│   ├── usage/                     # INSTALL + USAGE + MIGRATION
│   ├── reference/
│   └── planning/                  # BENCHMARK + BENCHMARK-V3 + 方案文档
├── scripts/                       # 安装脚本（双 skill + 卸载 + 版本）
├── tests/                         # 卸载零损伤测试 fixture
└── examples/
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
