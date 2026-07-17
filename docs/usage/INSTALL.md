# 安装说明

> 安装器会同时安装 skills、shell fallback 和可选 Node.js 结构化 runtime。没有 Node.js 时仍可使用 shell 路由，但能力会明确降级。

推荐只看第一种方式。其他方式是为不支持 skills 的工具准备的。

## 方式 1：通用 Agent Skill 一键安装

适用于支持 `skills/` 目录的 agent 工具。默认会同时安装三个 skill 到常见目录：

- **optimize-prompt**：意图对齐器，把模糊指令优化为可执行的 Agent Brief
- **align-init**：项目接入器，为项目生成 `.align/` 运行时并注入挂载区
- **optimize-prompt-lite**：轻量协议，面向弱指令遵循模型或不支持 hook 的宿主

安装目标：

- Codex / OpenAI Agents：`~/.codex/skills` 或 `$CODEX_HOME/skills`
- Claude Code：`~/.claude/skills`
- agents-style 工具：`~/.agents/skills`

安装后可以用 `$optimize-prompt` 或 `/optimize-prompt` 调用意图对齐器，用 `/align-init` 接入项目。

runtime 安装到 `~/.prompt-optimizer/`：

- `bin/align-doctor`：检查 Node、runtime、项目 router、副本上下文、verification chain、Stop hook 和宿主能力等级。
- `bin/align-cli`：结构化 Alignment Decision 与可选生态 handoff CLI，需要 Node.js。
- `adapters/claude-code.sh`：Claude Code L3 Native Hook adapter；UserPromptSubmit 记录 Decision/handoff，Stop 记录 receipt 后才运行 completion verification。
- `adapters/codex.sh`：Codex L2 CLI wrapper；无 Node 时输出显式降级的 shell 投影。

### Windows PowerShell

默认同时安装到 Codex、Claude Code、`~/.agents` 三个 skills 目录：

```powershell
iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -UseB | iex
```

只安装到某一个工具：

```powershell
# Claude Code: ~/.claude/skills
powershell -ExecutionPolicy Bypass -Command "iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -OutFile install-skill.ps1; .\install-skill.ps1 -Target claude; Remove-Item .\install-skill.ps1"

# Codex / OpenAI Agents: $env:CODEX_HOME\skills 或 ~/.codex/skills
powershell -ExecutionPolicy Bypass -Command "iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -OutFile install-skill.ps1; .\install-skill.ps1 -Target codex; Remove-Item .\install-skill.ps1"

# Agent Reach / agents-style: ~/.agents/skills
powershell -ExecutionPolicy Bypass -Command "iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -OutFile install-skill.ps1; .\install-skill.ps1 -Target agents; Remove-Item .\install-skill.ps1"
```

### macOS / Linux

默认同时安装到 Codex、Claude Code、`~/.agents` 三个 skills 目录：

```bash
curl -fsSL https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.sh | bash
```

指定安装目标：

```bash
# Codex / OpenAI Agents
curl -fsSL https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.sh | bash -s codex

# Claude Code
curl -fsSL https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.sh | bash -s claude

# ~/.agents/skills
curl -fsSL https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.sh | bash -s agents
```

安装内容按目标工具选择对应 adapter：

- Codex / OpenAI Agents：来自 [dist/codex/](../../dist/codex/)
- Claude Code：来自 [dist/claude-code/](../../dist/claude-code/)
- `~/.agents/skills`：来自 [dist/claude-code/](../../dist/claude-code/)，因为 agents-style 工具消费 Claude-compatible skill layout

每个 adapter 都包含三个自包含 skill 包：

- `optimize-prompt/`：意图对齐器，内置方法论和模板引用
- `align-init/`：项目接入器，内置扫描协议、访谈决策树和规范章节库
- `optimize-prompt-lite/`：无 hook 或弱模型宿主的轻量协议

### 宿主能力等级

| 宿主 | 等级 | 入口约束 | 阻断 | Completion |
| --- | --- | --- | --- | --- |
| Claude Code | L3 Native Hook | enforced | enforced | Stop receipt 后生成脱敏 evidence（synthetic adapter integration E3） |
| Codex | L2 CLI wrapper / instruction-backed | enforced | advisory | unavailable |

Codex 不具备 Claude Code 的 native hook parity。禁止把 L2 描述为强制阻断。
Claude Code 的真实宿主 E4 尚未验证；当前证据不得表述为真实 Claude Code 端到端闭环。

### 预览和版本

安装前可以预览（不实际安装）：

```bash
# macOS / Linux
bash scripts/install-skill.sh --what-if

# Windows PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-skill.ps1 -WhatIf
```

查看版本：

```bash
# macOS / Linux
bash scripts/install-skill.sh --version

# Windows PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-skill.ps1 -Version
```

安装后最简单的用法：

```text
$optimize-prompt 优化：你的原始想法
```

Claude Code：

```text
/optimize-prompt 优化：你的原始想法
```

接入项目（在项目根目录运行）：

```text
/align-init
```

从零开始新项目：

```text
/align-init --new
```

### 卸载与升级

**卸载 skill**（从 skills 目录移除 optimize-prompt 和 align-init）：

```bash
# macOS / Linux
bash scripts/install-skill.sh --uninstall

# Windows PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-skill.ps1 -Uninstall
```

默认卸载会覆盖 Codex、Claude Code、`~/.agents` 三个 skills 目录，只移除本项目的三个 skill 和 `~/.prompt-optimizer/` runtime，不触碰其他 skill。项目内 `.align/` 目录保留。

**升级 skill**（重新安装最新版）：

```bash
# macOS / Linux
bash scripts/install-skill.sh

# Windows PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-skill.ps1
```

升级会覆盖旧版 skill，不影响 `.align/` 目录中的 lessons 和 decisions。

**项目内原位升级挂载区**（在项目根目录运行）：

```text
/align-init --upgrade
```

原位升级检测 CLAUDE.md/AGENTS.md 中的 `<!-- align-protocol:begin -->` 标记，替换标记区间内容，标记区外的用户内容零损伤。

**完全清除**（手动删除 .align/ 目录和挂载区）：

```bash
rm -rf .align/
# 然后手动删除 CLAUDE.md 中 <!-- align-protocol:begin --> 到 <!-- align-protocol:end --> 之间的内容
```

## 方式 2：通用 System Prompt

适用于 ChatGPT、Claude、Gemini、Poe、自建 agent、任何支持 System Prompt / Custom Instructions 的工具。

1. 打开 [SYSTEM-PROMPT.md](../dist/universal/SYSTEM-PROMPT.md)。
2. 复制 `## System Prompt Start` 到 `## System Prompt End` 之间的内容。
3. 粘贴到目标 AI 工具的 System Prompt、Custom Instructions、项目规则或第一条消息中。
4. 输入你的原始想法，例如：

```text
帮我把这个功能设计清楚，让 AI agent 能直接实现
```

5. AI 会输出可直接交给 agent 执行的 Agent Brief。

## 方式 3：手动安装 Claude Code Skill

适用于 Claude Code 的 slash command / skill 工作流。

### macOS / Linux

```bash
git clone https://github.com/20231118185SSPU/prompt-optimizer.git
mkdir -p ~/.claude/skills
cp -R prompt-optimizer/dist/claude-code/optimize-prompt ~/.claude/skills/
```

### Windows PowerShell

```powershell
git clone https://github.com/20231118185SSPU/prompt-optimizer.git
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills"
Copy-Item ".\prompt-optimizer\dist\claude-code\optimize-prompt" "$env:USERPROFILE\.claude\skills\" -Recurse -Force
```

使用：

```text
/optimize-prompt
帮我重构这个项目，让 agent 不要理解偏
```

## 方式 4：Codex / OpenAI Codex CLI

适用于支持项目级规则文件的 coding agent。

在你的项目根目录创建或更新 `AGENTS.md`，加入：

```markdown
# Agent Intent Alignment

在处理模糊需求前，先按以下协议优化用户意图：

1. 阅读 `prompt-optimizer/dist/universal/SYSTEM-PROMPT.md` 中的 System Prompt。
2. 将用户原始请求转换成 Agent Brief。
3. 如果缺失信息会改变目标、交付物、权限或验收标准，先只问一个问题。
4. 复杂任务必须包含：上下文读取、范围边界、执行策略、验收标准、完成后沉淀。
```

然后把本项目作为子目录放入你的项目：

```bash
git clone https://github.com/20231118185SSPU/prompt-optimizer.git
```

如果你不想把仓库放进项目，也可以只复制 [SYSTEM-PROMPT.md](../dist/universal/SYSTEM-PROMPT.md) 的 System Prompt 到 Codex 的全局或项目指令里。

## 方式 5：Cursor / Windsurf / Continue 等编辑器 Agent

适用于支持 Rules、Memories、Project Instructions 的编辑器。

推荐做法：

1. 复制 [SYSTEM-PROMPT.md](../dist/universal/SYSTEM-PROMPT.md) 的 System Prompt。
2. 粘贴到项目规则文件中，例如 `.cursorrules`、`.windsurfrules` 或工具提供的 Project Rules。
3. 再复制 [PROJECT-CONTEXT.md](../../core/templates/PROJECT-CONTEXT.md)，按你的项目补全后保存为项目上下文文件。

项目规则建议加入：

```markdown
当用户请求模糊、范围不清或验收标准缺失时，不要直接实现。
先把请求转换成 Agent Brief；如果关键决策缺失，一次只问一个问题，并给出推荐答案。
```

## 方式 6：只使用模板

如果你不想配置任何工具，可以直接打开 `core/templates/`：

- [AGENT-BRIEF.md](../../core/templates/AGENT-BRIEF.md)：复杂任务简报
- [CLARIFY.md](../../core/templates/CLARIFY.md)：澄清访谈
- [PROJECT-CONTEXT.md](../../core/templates/PROJECT-CONTEXT.md)：项目上下文沉淀
- [CODE.md](../../core/templates/CODE.md)：编程任务
- [ANALYZE.md](../../core/templates/ANALYZE.md)：分析调研
- [WRITE.md](../../core/templates/WRITE.md)：写作任务
- [META.md](../../core/templates/META.md)：总结解释教学

## 验证是否安装成功

先运行 doctor：

```bash
bash ~/.prompt-optimizer/bin/align-doctor
```

`Structured runtime: installed` 表示 runtime 已安装；`Node.js: missing` 表示当前使用 shell fallback，不得视为完整结构化 runtime。

用下面这句话测试：

```text
帮我优化这个项目，让 AI 更懂我
```

理想输出应包含：

- 明确目标，而不是只复述原话
- 范围和排除项
- 工作方式或执行阶段
- 验收标准
- 如果信息不足，会先问一个关键问题
- 非 `[直出]` 输出应包含路由决策日志、诊断、契约回验和改动记录
- 改动记录应区分 `[原文]`、`[推断]`、`[假设]`

如果 AI 只是把句子改得更礼貌，没有输出 Agent Brief、约束、验收标准和必要的回验信息，说明没有正确接入。
