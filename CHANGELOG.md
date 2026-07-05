# 更新日志

## v3.0 — Alignment Runtime（对齐运行时）

> 从「显式调用的意图对齐器」升级为「嵌入任意项目、静默运行的对齐运行时」。

### 核心变更

#### 1. SSOT 重构

- `core/` 成为唯一事实来源，`dist/` 由 `build/` 脚本生成
- 删除所有镜像文件（`docs/core/`、`agent-skills/`、`templates/`）
- 修改协议后只需改 `core/` → 跑 `build` → `dist/` 自动生成

#### 2. 三档路由（静默化）

- **A 档直通**（~60%）：简单+低风险+意图明确 → 直接执行，零感知
- **B 档静默对齐**（~30%）：有缺口但可从 .align/ 补全 → 1-3 行披露后直接执行，不等待
- **C 档浮出澄清**（~10%）：高风险/总分<6/假设>2 → 停下，一次一问+推荐答案

#### 3. 生命周期五门

- 门 1 需求门：每条指令进入时，三档路由评估
- 门 2 设计门：3+文件或跨模块时，5 行微方案
- 门 3 执行门：偏离微方案时必须声明，禁止静默扩大范围
- 门 4 验证门：交付前必须自验证（R8，任何档位不可跳过）
- 门 5 沉淀门：踩坑/纠正/新约定时写入 .align/lessons.md

#### 4. .align/ 项目运行时

- `spec.md`：项目开发规范（技术栈/目录/分支/测试/风格/评审/高风险清单）
- `context.md`：项目上下文契约（目标/术语/架构决策）
- `lessons.md`：经验规则（每条 ≤2 行，50 条归档）
- `decisions.log.md`：重大决策日志

#### 5. 双 Skill

- **optimize-prompt**：v3 行为（隐式走三档路由，显式 `优化：` 输出完整 Agent Brief）
- **align-init**：项目接入器（扫描模式 `/align-init` + 从零模式 `/align-init --new`）

#### 6. 宿主适配

- Claude Code：CLAUDE.align.md 挂载区 + UserPromptSubmit hook + HOOK-REMINDER.txt
- Codex：AGENTS.align.md 挂载区
- Cursor：.cursor/rules/align.mdc（alwaysApply: true）
- 通用：dist/universal/SYSTEM-PROMPT.md

#### 7. 安装脚本 v3

- 双 skill 安装（optimize-prompt + align-init）
- 默认安装和卸载覆盖 Codex、Claude Code、`~/.agents` 三个 skills 目录
- Codex 安装源使用 `dist/codex`；Claude Code 使用 `dist/claude-code`
- `~/.agents/skills` 使用 Claude-compatible 的 `dist/claude-code` 包，并在脚本与文档中明确说明
- `--version` / `-Version`：版本输出
- `--what-if` / `-WhatIf`：预览不安装
- `--uninstall` / `-Uninstall`：卸载双 skill，零损伤用户内容

#### 8. v3.0 最终审查修复

- 修复 Bash 参数解析：`--what-if` / `--uninstall` 不再覆盖默认 `all` target
- 修复 PowerShell / Bash adapter 路由：Codex 不再安装 Claude Code adapter
- `align-init` 的 `[假设]` 硬门槛统一为 `>2`
- 模板运行时引用统一为 `references/acceptance-checklist.md`
- `BENCHMARK-V3.md` 明确为协议规则推演回测，修正 C 档统计和文档类验证门
- 文档索引更新为 14 个模板，并将 `BENCHMARK-V3-DRAFT.md` 标注为历史草案

### 新增文件

- `core/protocol/00-07`：协议内核（定位/意图探查/诊断/路由/转换规则/契约回验/生命周期门/沉淀）
- `core/templates/`：14 个模板（含 4 个 ALIGN 模板）
- `core/spec-kit/`：规范生成器素材库（scan.md + interview.md + 7 个 spec-sections）
- `core/skills/align-init/`：align-init skill 源文件
- `core/host/`：宿主适配源文件（mount-area.md + hook-reminder.txt + settings.fragment.json）
- `build/`：构建脚本（build.sh + build.ps1）
- `dist/`：构建产物（claude-code + codex + cursor + universal）
- `.align/`：自举生成的四件套
- `tests/`：卸载零损伤测试 fixture + 验证脚本
- `docs/planning/BENCHMARK-V3.md`：18 case 全量回测报告
- `docs/planning/BENCHMARK-V3-DRAFT.md`：8 个 v3 新 case 历史草案
- `docs/planning/ALIGN-SCAN-SELFTEST.md`：自举扫描测试报告
- `docs/usage/MIGRATION.md`：v2→v3 迁移指南

### 删除文件

- `docs/core/METHODOLOGY.md`：内容拆入 `core/protocol/00-05`
- `docs/core/TRANSFORM.md`：成为构建产物 `dist/universal/SYSTEM-PROMPT.md`
- `agent-skills/optimize-prompt/`：由 `dist/*/optimize-prompt/` 取代
- `templates/`：平移至 `core/templates/`

### 验收

- 18/18 协议规则推演回测全绿（10 v2 + 8 v3）
- 三个卡顿指标：A 档零感知 ✓ B 档不等待 ✓ C 档仍拦截 ✓
- 零容忍门槛原样继承：D5=0 / 总分<6 / [假设]>2 / 高风险必探查
- 安装预览和卸载预览默认覆盖三目录，且 Codex / Claude Code adapter 路由正确
- build 幂等 ✓
- 卸载零损伤 ✓
- 本项目自举运行 ✓

---

## v2.0 — Agent Intent Alignment Protocol

- 五维诊断、智能路由、转换规则 R1-R10、契约回验
- 10 个模板、agent-skills 可安装 skill 包
- System Prompt（TRANSFORM.md）可复制到任意 AI 工具

## v1.0 — Prompt Optimizer

- 基础 prompt 优化工具
- 模板化输出
