# 更新日志

## v4.0.0 — W7 route Gate evidence

> 当前唯一可引用的 W7 结论是冻结 v7 corpus 的 evidence；本次任务没有发布版本、tag、push 或 GitHub Release。

- 生产接口逐条调用 `bash core/host/align-route.sh --decision "<request>"`，没有用 `--classify` 证明生产行为。
- 高风险漏放率 `0/8=0%`、完整请求误拦截率 `0/8=0%`、六类 route appropriateness 均 `100%`、验收相关率 `2/2=100%`。
- 独立 Blind Review 评审 14 条实际生成问题，14/14 同时满足最高价值、单问题和推荐答案。
- Jest 26 suites / 382 tests、构建幂等、Bash/PowerShell parity、分发、安装器和跨平台 Gate 均有通过证据。
- 详细指标、hash、历史 regression 边界和证据路径见 [W7 canonical summary](docs/planning/evidence/w7/w7-canonical-summary.md)。

---

## v3.2.0-rc.1 — Alignment Decision runtime 候选版

> 当前为候选版，尚未正式发布。G5 已按独立盲评发现的修复验收路径关闭；旧 frozen gate 失败证据保留，fresh post-fix 独立盲评仍是稳定版前债务。

### 核心变更

- 冻结 `Alignment Decision` 机器契约、reason registry、golden corpus 和三档路由策略。
- 增加 TypeScript decision runtime、生命周期协调、上下文分类投影及 Claude Code / Codex adapter。
- 将常驻 skill 缩为按需加载入口，协议正文按 intent、routing、contract、verification、precipitation 拆分。
- 建立 56 条确定性行为语料、三臂评测 runner/scorer、隐私检查和脱敏 evidence。
- 补齐 `LICENSE`、`SECURITY.md` 和按 E2-E5 证据分级的宿主支持矩阵。
- 增加可选 Matt Pocock Skills handoff：独立 schema、环境/setup 发现、确定性 skill 映射与纯 JSON `align-cli matt`；不改变 Alignment Decision v1 或普通 `json` 输出。
- 重写仓库入口介绍与文档导航，明确 runtime 数据流、支持等级、验证证据和稳定版前债务。

### 候选版验证状态

- tuned conformance set：56/56 route 命中，高风险漏拦截 0，不必要澄清 0；该结果不代表 held-out 泛化能力。
- TypeScript 全量回归：17 suites、273 tests 通过。
- 构建幂等、Bash/PowerShell parity、runtime 分发完整性与 G6 consumed-corpus regression 通过。
- Claude 三臂 pilot 已运行；澄清质量、验收完整性和方向安全仍属于模型自报，不作为独立 release evidence。
- 三套一次性 held-out 与两轮独立盲评已保留；已知失败经 consumed-corpus regression 修复，未冒充新的 held-out。
- 稳定版前仍需 fresh post-fix 独立盲评、完整三臂重复、真实执行成功率与返工轮数，以及 Codex E5 凭据修复。

## v3.1.1 — hook 强化 + 信号扩展

> v3.1 发布后继续强化 hook 拦截能力，让对齐协议在执行前真正成为"默认动作"而非"可选建议"。

### 核心变更

#### 1. hook 路由注入升级

- 三个 verdict（HIGH / VAGUE / CLEAR）从单行提示升级为**结构化执行协议**
  - **HIGH** 注入 5 步：读规范 → 列影响面 → 输出方案（含改动清单/回滚/验证/风险）→ 停下等确认 → 执行验证
  - **VAGUE** 注入 5 步：读规范 → 自行读取能读到的信息 → 一次一问+推荐答案 → Agent Brief 八组件 → 禁止未对齐先输出
  - **CLEAR** 注入 5 步：读规范 → Agent Brief 执行 → 验证命令 → 沉淀 → R8 验证门
- 模型收到的是**对齐后的执行框架**，不是简单的"小心高风险"提醒

#### 2. 信号识别扩展

- **RISK_RE** 增加约 12 个词：清掉 / 下线 / 停服 / 发版 / 部署到生产 / 格式化 / 销毁 / 覆盖 / destroy / format / 抹掉 等
- **VAGUE_RE** 增加约 20 个词：优化 / 重构 / 升级 / 增强 / 调整 / 梳理 / 整理 / 改改 / 改一下 / tweak / adjust / fix / enhance / upgrade / refine / rework / reorganize 等
- 覆盖中英文常见模糊/风险表达，氛围编程场景下更准确

#### 3. hook 强制性强化

- 去掉 `2>/dev/null`（暴露 hook 错误，不再静默吞掉）
- 去掉 `|| true`（不再静默通过）
- 降级路径改为明确提示：`[对齐] 未检测到 .align/ 运行时。请运行 /align-init 接入对齐协议后再开发。`
- HOOK-REMINDER.txt 升级为完整降级模式协议说明（含三档路由 + 硬性红线 + 修复建议）

### 验收

- `bash -n` 语法检查通过（core 和 dist 的 align-route.sh、align-check.sh）
- `settings.fragment.json` JSON 验证 VALID
- core/dist 一致性：5 个 host 文件 LF 规范化后逐文件 MATCH
- 幂等性：3 个改动文件重新同步后字节大小不变（STABLE）
- 连续两次 build 无额外 diff
- `git status` 只有 6 文件改动（core 3 + dist 3），无意外改动

---

## v3.1 — hook 接线修复 + VAGUE 扩展 + 轻协议

> v3.0 发布后发现 hook 接线断口、VAGUE 分类器漏覆盖氛围编程动词、弱指令遵循模型无轻量协议。v3.1 修复并扩展。

### 核心变更

#### 1. hook 接线与安全修复

- `align-route.sh` 同步到 `.align/` 副本（修 lessons §30 自举同步断口）
- 命令注入修复：LLM 仲裁调用改用 `printf '%s'` 构建 prompt 参数，防双引号断开
- `BLOCK_ON_HIGH` 机械拦截 + `[直出]` bypass 机制
- `.align/route.conf` 纳入 git 跟踪

#### 2. VAGUE 扩展

- 氛围编程"创建类"动词（做个/加个/写个/搞个/弄个）纳入 VAGUE_RE
- 人话输出（verdict 用自然语言而非机器标签）

#### 3. 轻协议 optimize-prompt-lite

- 面向弱指令遵循模型或不支持 hook 的宿主
- 无需 .align/ 运行时即可使用基础对齐

#### 4. 测试与运行时

- `verify-router.sh` 同时测 `core/host/` 和 `.align/` 两份副本（防"测试通过≠运行时正确"）
- `check-commands.txt` 增加 .align/ 副本语法检查和 diff 一致性检查
- build.ps1 加 UTF-8 BOM，修 Windows PS5.x + GBK 中文乱码

#### 5. 协议与文档

- 协议"九组件"统一为"八组件（含可选 MEMORY/RISKS）"
- META.md 模板补"完成后自检"验收要素
- AGENTS.md 目录树补 `core/skills/`、`core/host/`、`tests/`，模板数 10→14
- CHANGELOG/VERSION/skill 数量/context.md 同步到 v3.1

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
