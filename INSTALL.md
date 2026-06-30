# 安装说明

> 本项目没有运行时依赖。所谓“安装”，本质是把这套意图对齐协议接入你正在使用的 AI 工具。

你可以按使用场景选择一种接入方式。推荐优先使用“通用 Agent Skill 一键安装”。

## 方式 1：通用 Agent Skill 一键安装

适用于支持 `skills/` 目录的 agent 工具。安装后可以用 `$optimize-prompt` 或 `/optimize-prompt` 调用，具体取决于你的工具。

### Windows PowerShell

自动安装到优先检测到的 skills 目录：

```powershell
iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -UseB | iex
```

指定安装目标：

```powershell
# Codex / OpenAI Agents: $env:CODEX_HOME\skills 或 ~/.codex/skills
iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -UseB | iex

# Claude Code: ~/.claude/skills
powershell -ExecutionPolicy Bypass -Command "iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -OutFile install-skill.ps1; .\install-skill.ps1 -Target claude; Remove-Item .\install-skill.ps1"

# Agent Reach / agents-style: ~/.agents/skills
powershell -ExecutionPolicy Bypass -Command "iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -OutFile install-skill.ps1; .\install-skill.ps1 -Target agents; Remove-Item .\install-skill.ps1"
```

### macOS / Linux

自动安装：

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

安装内容来自 [agent-skills/optimize-prompt](agent-skills/optimize-prompt)，是自包含 skill 包，内置方法论和模板引用。

## 方式 2：通用 System Prompt

适用于 ChatGPT、Claude、Gemini、Poe、自建 agent、任何支持 System Prompt / Custom Instructions 的工具。

1. 打开 [TRANSFORM.md](TRANSFORM.md)。
2. 复制 `## System Prompt 开始` 到 `## System Prompt 结束` 之间的内容。
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
cp -R prompt-optimizer/agent-skills/optimize-prompt ~/.claude/skills/
```

### Windows PowerShell

```powershell
git clone https://github.com/20231118185SSPU/prompt-optimizer.git
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills"
Copy-Item ".\prompt-optimizer\agent-skills\optimize-prompt" "$env:USERPROFILE\.claude\skills\" -Recurse -Force
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

1. 阅读 `prompt-optimizer/TRANSFORM.md` 中的 System Prompt。
2. 将用户原始请求转换成 Agent Brief。
3. 如果缺失信息会改变目标、交付物、权限或验收标准，先只问一个问题。
4. 复杂任务必须包含：上下文读取、范围边界、执行策略、验收标准、完成后沉淀。
```

然后把本项目作为子目录放入你的项目：

```bash
git clone https://github.com/20231118185SSPU/prompt-optimizer.git
```

如果你不想把仓库放进项目，也可以只复制 [TRANSFORM.md](TRANSFORM.md) 的 System Prompt 到 Codex 的全局或项目指令里。

## 方式 5：Cursor / Windsurf / Continue 等编辑器 Agent

适用于支持 Rules、Memories、Project Instructions 的编辑器。

推荐做法：

1. 复制 [TRANSFORM.md](TRANSFORM.md) 的 System Prompt。
2. 粘贴到项目规则文件中，例如 `.cursorrules`、`.windsurfrules` 或工具提供的 Project Rules。
3. 再复制 [templates/PROJECT-CONTEXT.md](templates/PROJECT-CONTEXT.md)，按你的项目补全后保存为项目上下文文件。

项目规则建议加入：

```markdown
当用户请求模糊、范围不清或验收标准缺失时，不要直接实现。
先把请求转换成 Agent Brief；如果关键决策缺失，一次只问一个问题，并给出推荐答案。
```

## 方式 6：只使用模板

如果你不想配置任何工具，可以直接打开 `templates/`：

- [AGENT-BRIEF.md](templates/AGENT-BRIEF.md)：复杂任务简报
- [CLARIFY.md](templates/CLARIFY.md)：澄清访谈
- [PROJECT-CONTEXT.md](templates/PROJECT-CONTEXT.md)：项目上下文沉淀
- [CODE.md](templates/CODE.md)：编程任务
- [ANALYZE.md](templates/ANALYZE.md)：分析调研
- [WRITE.md](templates/WRITE.md)：写作任务
- [META.md](templates/META.md)：总结解释教学

## 验证是否安装成功

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

如果 AI 只是把句子改得更礼貌，没有输出 Agent Brief、约束和验收标准，说明没有正确接入。
