# Prompt Optimizer 波次 0 可信基线

> 快照日期：2026-07-11
> 对应规划：`docs/planning/MULTI-AGENT-IMPROVEMENT-PLAN.md`
> 覆盖任务：F01-F05
> 结论：G0 证据门通过；当前实现健康门未通过；未进入波次 1 的契约冻结或任何实现修改。

## 1. 基线结论

波次 0 已完成规划要求的四类取证：

1. 固定本地、远端和未提交工作区状态。
2. 实际运行现有自动测试，并区分规则测试、集成测试、宿主实测和模型实测。
3. 追踪 `core → build → dist → install → host` 的真实交付链。
4. 按“协议定义 / 源码实现 / 安装可用 / 宿主实测”标注能力等级。

G0 通过只表示“真实起点已经可复现”，不表示当前实现符合目标协议。当前存在 4 个 blocker，禁止直接进入 runtime、adapter、安装或发布开发。下一步只能进入 G1，先冻结公共 route、reason、schema 和 lifecycle 契约。

## 2. Git 与工作区快照

| 项目 | 结果 |
| --- | --- |
| 本地分支 | `main` |
| 本地 HEAD | `31eaa173aca0ee99ae692a3aba4f6c4159e315a7` |
| `origin/main` | `407c4e8d97c4506f59193300b22ec1ef101c800d` |
| merge-base | `407c4e8d97c4506f59193300b22ec1ef101c800d` |
| ahead / behind | `18 / 0` |
| 公开安装源 | GitHub `main.zip`，实际对应远端 `407c4e8`，不是本地 HEAD |
| tag / GitHub Release | 无本地 tag；无 GitHub Release 证据 |
| LICENSE / SECURITY | 仓库无 `LICENSE*`、`SECURITY.md`、`SUPPORT.md` |

开始本波时已有以下未提交内容；它们属于用户工作区，本波没有覆盖或回滚：

```text
 M README.md
 M docs/README.md
?? .agents/
?? .align/align-pipeline.sh
?? .mimocode/hooks/
?? docs/planning/MULTI-AGENT-IMPROVEMENT-PLAN.md
?? docs/reference/ECOSYSTEM-COMPARISON.md
?? skills-lock.json
```

本地领先远端的 18 个提交包含 TypeScript pipeline。公开 `origin/main` 不包含 `core/host/pipeline/`，因此不得用本地 103 项测试为公开安装包背书。

## 3. 版本面

| 位置 | 当前值 | 结论 |
| --- | --- | --- |
| README 产品介绍 | v3.1；发布状态写 v3.1.1 | 同一入口存在两个产品版本口径 |
| `CHANGELOG.md` | 最新 v3.1.1 | 与安装器不一致 |
| Bash installer | v3.1 | `--version` 实测输出 v3.1 |
| PowerShell installer | v3.1 | `-Version` 实测输出 v3.1 |
| TypeScript package | `0.1.0` | 尚未定义与产品版本的关系 |
| Git tag / Release | 无 | 没有可固定下载的发布版本 |

版本号、许可、tag、release 和 pipeline 是否独立版本化均未在波次 0 擅自决定。

## 4. `.align/` 同步状态

| 副本 | 结果 |
| --- | --- |
| `.align/align-check.sh` vs `core/host/align-check.sh` | 一致 |
| `dist/claude-code/hooks/align-route.sh` vs `core/host/align-route.sh` | 一致 |
| `.align/align-route.sh` vs `core/host/align-route.sh` | **不一致** |

`.align/align-route.sh` 的风险词、模糊词和注入文案落后于 SSOT。两份 router 仍各自通过 41 个 case，说明现有 corpus 无法检测同步漂移。

## 5. 文件所有权

波次 0 采用只读并行审计，避免公共语义未冻结时发生写入冲突。

| Owner | 任务 | 写入权限 | 结果 |
| --- | --- | --- | --- |
| 主代理 | F01、集成验证、基线汇总 | 仅本基线文档与文档索引 | completed |
| A1 | F02 协议硬门槛与重复清单 | 禁止写入 | completed |
| A2 | F03 Runtime 行为差异 | 禁止写入 | completed |
| A3 | F04 分发链审计 | 禁止写入 | completed |
| A4 | F05 测试与证据分级 | 禁止写入 | completed |
| A5 | 文档、版本、许可、支持口径 | 禁止写入 | completed |

冻结区仍包括 `core/protocol/`、公共类型/schema/reason、runtime、build、installer、adapter 和全部 `dist/`。

## 6. 协议与 Runtime 差异

### 6.1 硬门槛矩阵

| 硬门槛 | 协议期望 | Shell runtime | TypeScript runtime | 状态 |
| --- | --- | --- | --- | --- |
| D1-D5 | 每维 0-2 分；0 分必须补全 | 无 | 无 | P0 缺失 |
| 总分 `<6` | 禁止直出，必须澄清或探查 | 无总分 | 无总分 | P0 缺失 |
| `D5=0` | 强制补可执行验收 | 无 acceptance 状态 | 无 acceptance 状态 | P0 缺失 |
| `[假设]>2` | 必须转澄清 | 不计数 | 不计数 | P0 缺失 |
| 高风险 | 安全阀优先；确认前禁止写入 | 正则 HIGH；默认软提示 | 正则 HIGH；CLI 可选退出 2 | 语义不等价 |
| `[直出]` | 只改变展示，不得绕过安全阀 | 分类前 bypass | 分类前 BYPASS | **Blocker** |
| R8 / 门 4 | 任务执行后、交付前验证，任何档位不可跳过 | 只提醒；需手动 `align-check` | 入站 `processInstruction()` 立即执行 | **Blocker** |
| R6 范围 | 拆分 3+ 独立任务；执行中禁止静默扩范围 | 未实现 | 未实现 | P1 规范需拆义 |
| R10 / 门 5 | 事件触发、非阻塞、写入正确目标 | 仅注入提醒 | 无沉淀 coordinator | P1 规范需统一 |

### 6.2 已确认的规范内部缺口

- D1 同时使用“动词、对象、量化目标齐全为 2 分”和“包含帮我/优化即 0 分”，优先级未定义：`core/protocol/02-diagnosis.md:21-25`。
- D4 只定义 0 项、1-2 项和 4 项，正好 3 项时无分值：`core/protocol/02-diagnosis.md:57-61`。
- R8 在 `core/protocol/04-transform-rules.md:205-225` 指“向契约补验收标准”，在 `core/protocol/06-lifecycle-gates.md:174-213` 指“执行完成后的真实验证”，需要拆成两个生命周期动作。
- R6 在 `core/protocol/04-transform-rules.md:163-181` 指“多任务拆分”，在 `core/protocol/06-lifecycle-gates.md:170,277,286` 指“执行中禁止范围扩张”；两项都需要，但不应共用一个未分层定义。
- R10 候选触发见 `core/protocol/04-transform-rules.md:289-307`，门 5 的事件触发和写入见 `core/protocol/06-lifecycle-gates.md:217-257`，详细过滤见 `core/protocol/07-precipitation.md:273-297`；但 `core/templates/ALIGN-SPEC.md:13,128` 又要求把新约定写入 spec，目的地不唯一。
- `core/skills/align-init/SKILL.md:17-25` 的 `--zero` 模式要求“全部采用假设、不澄清”，同文件 `:244` 又继承 `[假设]>2` 转澄清，特例边界冲突。

这些问题是 G1 的契约输入，波次 0 不提前选择 route 名称或 schema 字段。

## 7. Runtime 行为矩阵

| 能力 | 协议 / Skill | Shell | TypeScript | 实际宿主路径 |
| --- | --- | --- | --- | --- |
| Route | A/B/C + D1-D5 | HIGH/VAGUE/GRAY/CLEAR | HIGH/VAGUE/GRAY/CLEAR | 无稳定 IR / reason |
| Bypass | 展示覆盖，不越安全阀 | `[直出]`、`直出`、`ALIGN_BYPASS` 短路 | 同上，加 `options.bypass` | adapter 再短路一次 |
| 显式模式 | 5 个前缀各有语义 | 仅识别直出 | 仅识别直出 | 其余前缀按普通文本分类 |
| Context | 先读项目态再决定 A/B/C | route 后只注入 lessons/debt | route 后才 enrich 四文件 | Claude CLI 丢弃 enriched message |
| Verification | completion gate | 提醒或手动脚本 | 入站执行命令 | 无 completion event |
| Block | 高风险确认前停止 | 默认关闭；可 exit 2 | CLI 可 exit 2 | settings/adapter 用 `||` 吞掉退出码 |
| CLI/API | 稳定、可机器检查 | `--classify` 单 verdict | 人类文本，无 JSON/schema/reason | Codex/Cursor 只打印，不调用下游 |

主代理复核探针：

```text
bash core/host/align-route.sh --classify '[直出] 删除数据库'
=> [对齐] [直出] 模式，跳过路由。

node core/host/pipeline/dist/index.js generic '[直出] 删除数据库'
=> Verdict: BYPASS
```

这直接违反“`[直出]` 不能绕过高风险安全阀”的总体验收。

## 8. 分发与安装事实

### 8.1 实际链路

| 能力 | 协议定义 | 源码实现 | 根 `dist/` | 公开安装可用 | 宿主实测 |
| --- | --- | --- | --- | --- | --- |
| 生成 skill / references | 是 | 是 | 是 | 是 | 无 |
| Shell router/check | 是 | 是 | Claude hooks 有 | Claude 可接线；agents-style 仅复制文件 | 无 |
| TypeScript runtime | 规划中 | 本地有，103 tests | **无** | **无** | 无 |
| TS Claude adapter | 规划中 | 本地有 | 无 | 无 | 无 |
| TS Codex CLI wrapper / adapter | 规划中 | 只打印内容 | 无 | 无 | 无 |
| Completion gate | 是 | 手动 `align-check` | shell 文件有 | 无 completion adapter | 无 |

build 会在 `core/host/pipeline/` 内执行 `npm install && npm run build`，输出到被忽略的源码目录；它没有把 JS、类型、bin 或 adapter 复制到根 `dist/`。安装器也没有复制或注册 `align-cli`。

### 8.2 公开安装得到什么

- 每个 adapter 包含三个 skill：`optimize-prompt`、`align-init`、`optimize-prompt-lite`。
- Bash 默认向 Codex、Claude Code 和 `~/.agents` 复制 skill；仅 Claude/agents 路径复制 5 个 shell hook 文件。
- Codex-only 安装没有 native hook，当前最高只能按 L1 instruction-backed 描述。
- 安装不会自动创建项目 `.align/`；用户仍需运行 `/align-init`。
- 安装器不会复制 `CLAUDE.align.md`、`AGENTS.align.md`、TypeScript runtime 或 TS adapter。

### 8.3 公开 PowerShell blocker

公开 `origin/main` 的 PowerShell installer 对 `[ordered]@{}` 调用 `.ContainsKey()`。Windows PowerShell 5.1 实测返回：

```text
Method invocation failed because [System.Collections.Specialized.OrderedDictionary]
does not contain a method named 'ContainsKey'.
```

因此公开默认安装可能先复制 skill，再在 hook 接线阶段失败，形成部分安装。该问题已在本地领先提交修复，但尚未进入公开 `main.zip`。

### 8.4 其他分发缺口

- 两安装器硬编码旧的 `2>/dev/null || true` hook 命令，没有消费 `settings.fragment.json` 的新命令。
- Bash 缺 Python 3 时跳过 settings 接线；Windows hook 命令仍依赖 Bash，但安装器不检查 Bash。
- 重装删除整个 skill 目录后复制，无 manifest、原子替换或回滚。
- 卸载不删除全局 hooks 目录中的 5 个残留文件，并可能跨 target 移除 Claude hook。
- 147 个 dist 文件中 7 个缺少要求的双 generated 标记。
- 没有 install manifest、install plan 或 doctor/status 实现。

### 8.5 Bash / PowerShell 逐阶段对照

| 阶段 | Bash | PowerShell | 差异结论 |
| --- | --- | --- | --- |
| skill target / adapter | 默认 Codex、Claude、agents；Codex 用 `dist/codex`，其余用 Claude 包 | 相同 | 无语义差异 |
| 下载 / 解压 | curl 或 wget + unzip | `Invoke-WebRequest` + `Expand-Archive` | 平台必要差异 |
| settings JSON | 依赖 Python 3；缺失时跳过自动接线 | 原生 JSON；公开版本有 `ContainsKey` blocker | 行为不等价 |
| hook 文件 | 复制到 Claude 与 agents；Codex-only 不复制 | 相同目标 | 两者都未证明 agents-style 会执行 |
| Windows hook 前置条件 | 不适用 | 写入 `bash ...`，但不检测 Bash | Windows 可安装不等于 hook 可运行 |
| TS build 检测 | 同时检查 node 和 npm | 只检查 node | PowerShell 可能在缺 npm 时继续 |
| TS build 失败 | `set -e` 终止 | 不检查 `$LASTEXITCODE` | PowerShell 可能误报 build 成功 |
| WhatIf | 跳过 dist 写入，但仍执行 npm build | `ShouldProcess` 只包裹 dist 写入，仍执行 npm build | 两者都不是纯只读 dry-run |
| build 输出 | 隔离 clone 实测与 PowerShell 逐字节一致 | 同左 | 当前 parity 通过 |
| 自定义路径卸载 | 有 `*/skills/*` 护栏 | 无同等路径护栏 | PowerShell 风险更高 |
| hook 卸载 | 都可能残留全局 hook 文件；缺 Python 时 Bash 不能自动移除 settings hook | 会处理 Claude settings，但可能跨 target 移除 hook | 两者均不闭环，失败模式不同 |
| 升级 | 删除整个 skill 目录后复制 | 相同 | 都无 manifest、原子替换或回滚 |

## 9. 测试与证据

### 9.1 本机环境

```text
Node.js v24.14.1
npm 11.11.0
GNU bash 5.3.9
PowerShell 7.6.3
Windows PowerShell 5.1 parser
git 2.54.0.rc2.windows.1
```

### 9.2 实际执行结果

| 验证 | 结果 | 证据边界 |
| --- | --- | --- |
| Bash 语法 | 12 个相关脚本通过 | E1 文本/语法 |
| PowerShell 语法 | build + installer 在 PS 7 / PS 5.1 parser 通过 | E1 |
| TypeScript build | `npm run build` 通过 | E1 编译/类型检查 |
| TypeScript Jest | 7 suites，103/103 passed | E2/E3；验证当前旧语义 |
| Shell router | core 41/41，`.align` 41/41 | E2；不证明两副本一致 |
| Uninstall fixture | 10 个 PASS | E2；模拟删除，不是真实完整升级 |
| Installer sandbox | 13 个 PASS | E3；仅 Bash + Claude + 假 HOME |
| Build idempotence | PASS | 在隔离 clone 运行，避免测试内 `git add dist/` 污染用户 index |
| Bash / PowerShell parity | PASS | 在同一隔离 clone 运行 |
| `.align` router 同步 diff | **FAIL** | 两副本内容不同 |
| Claude/Codex 真实宿主 | 未执行；`tests/live-cases.md` 为空 | E0 |
| 真实模型 benchmark | 无 | E0；现有 18 case 是规则推演 |

证据等级：E0=无证据，E1=文本/语法，E2=确定性单元或 corpus，E3=沙箱集成，E4=真实宿主端到端，E5=真实模型对照 benchmark。

现有测试的关键局限：

- 103/103 把高风险 BYPASS 和执行前 verification 固化为预期行为。
- 41 case 没有让 TS 与 shell 消费同一预期 reason/route，也未发现 `.align` 漂移。
- `verify-build-idempotence.sh` 与 cross-platform test 会执行 `git add dist/`，不能直接在脏工作区运行。
- `.align/check-commands.txt` 不包含 Jest、类型检查、build parity 或 live eval，并会丢弃子命令原始输出。
- 仓库无 CI workflow，当前结果只证明本机基线。

### 9.3 关键行为证据矩阵

| 关键行为 | 当前最高证据 | 已证明 | 缺失证据 |
| --- | --- | --- | --- |
| route / classification | E2 | shell 两副本各过 41 case；TS 103 tests 含分类/router | 统一 route + reason golden corpus；TS/shell 100% parity |
| bypass / `[直出]` | E2 反证 | 高风险输入在 shell 与 TS 都 bypass | 修复后安全优先级回归；adapter E4 |
| verification | E2 反证 | TS 会执行命令并返回结果 | baseline/completion 分离测试；真实完成事件 E4 |
| context loading | E2 | TS 能读 lessons/spec/context/decisions | context 参与 route 的 B/enrich 行为；宿主收到 enriched context |
| high-risk block | E3 包装级反证 | 原始 CLI 可 exit 2，现有 settings/adapter 会吞退出码 | Claude 新会话实际阻断 E4；Codex 能力边界证据 |
| install / upgrade / uninstall | E3 | Bash + Claude 假 HOME 的新装、幂等、旧 hook 升级、卸载 | PowerShell 行为；Codex/all targets；真实 archive；runtime 可调用性 |
| build / generated parity | E3 | 两次 build 幂等；Bash/PowerShell 根 dist 一致 | CI 多平台复现；被忽略 TS 输出进入产物后的 parity |
| CLI / downstream handoff | E1 | 源码能打印 human-readable 结果 | JSON/schema/exit code contract；真实调用下游宿主 |
| 真实宿主 | E0 | 无 | Claude Code + Codex 端到端原始记录 |
| 真实模型效果 | E0 | 无；18 case 仅规则推演 | control/protocol/runtime 对照 benchmark E5 |

### 9.4 精确命令与关键输出摘录

以下命令均在本波实际执行。代码块保留测试程序的原始结果行；网络代理提示和无关过程输出已省略。完整结果的判定依据是退出状态、测试计数和下列程序输出，不把整理后的安装预览误称为逐字 transcript。

#### TypeScript Jest

```text
$ cd core/host/pipeline && npm test -- --runInBand
PASS src/__tests__/pipeline.test.ts
PASS src/__tests__/verifier.test.ts
PASS src/__tests__/rules.test.ts
PASS src/__tests__/classifier.test.ts
PASS src/__tests__/integration.test.ts
PASS src/__tests__/router.test.ts
PASS src/__tests__/enricher.test.ts
Test Suites: 7 passed, 7 total
Tests:       103 passed, 103 total
Snapshots:   0 total
```

#### TypeScript build

```text
$ cd core/host/pipeline && npm run build
> @prompt-optimizer/align-pipeline@0.1.0 build
> tsc
```

#### Shell 语法

```text
$ bash -n build/build.sh
$ bash -n scripts/install-skill.sh
$ bash -n core/host/align-route.sh
$ bash -n core/host/align-check.sh
$ bash -n .align/align-route.sh
$ bash -n .align/align-check.sh
$ bash -n tests/verify-build-idempotence.sh
$ bash -n tests/verify-cross-platform-parity.sh
$ bash -n tests/verify-uninstall.sh
$ bash -n tests/verify-router.sh
$ bash -n tests/verify-installer-wiring.sh
$ bash -n core/host/pipeline/adapters/hook/claude-code.sh
exit 0; no output
```

合计 12/12 通过。

#### Router corpus

```text
$ bash tests/verify-router.sh
core/host/align-route.sh: 41 passed, 0 failed
.align/align-route.sh: 41 passed, 0 failed
=== All router cases passed (both core/host and .align) ===
```

#### Uninstall fixture

```text
$ bash tests/verify-uninstall.sh
PASS: User content before mount area preserved
PASS: User content after mount area preserved
PASS: Custom instructions preserved
PASS: Mount area content removed
PASS: Begin marker removed
PASS: End marker removed
PASS: User content before mount area preserved after upgrade
PASS: User content after mount area preserved after upgrade
PASS: Old mount area content removed
PASS: Old begin marker removed
=== All tests passed: zero damage to user content ===
```

#### Installer wiring sandbox

```text
$ bash tests/verify-installer-wiring.sh
PASS: hook added on fresh install
PASS: existing env preserved
PASS: lite skill installed
PASS: hook not duplicated (count=1)
PASS: legacy hook upgraded
PASS: legacy command removed after upgrade
PASS: old relative hook upgraded to anchored
PASS: vulnerable relative command removed after upgrade
PASS: no duplicate hook after relative->anchored upgrade (count=1)
PASS: our hook removed on uninstall
PASS: user's own hook untouched
PASS: env still preserved after uninstall
PASS: skills removed
=== All installer wiring tests passed ===
```

#### Build 幂等与跨平台 parity

这两个脚本会执行 `git add dist/`，因此在同一临时 clone 中运行，结束后删除该隔离目录；没有修改用户 index。

```text
$ bash tests/verify-build-idempotence.sh
PASS: build.sh idempotent (two runs produce identical dist/)

$ bash tests/verify-cross-platform-parity.sh
=== Step 1: build.sh ===
=== Step 2: build.ps1 (pwsh) ===
=== Step 3: Compare dist/ ===
PASS: build.sh and build.ps1 produce identical dist/
```

#### PowerShell 与 installer 入口

```text
$ powershell.exe -NoProfile -Command '$tokens1=$null; $errors1=$null; $tokens2=$null; $errors2=$null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "build/build.ps1"),[ref]$tokens1,[ref]$errors1) > $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "scripts/install-skill.ps1"),[ref]$tokens2,[ref]$errors2) > $null; $all=@($errors1)+@($errors2); if ($all.Count) { $all | ForEach-Object { $_.Message }; exit 1 }; Write-Output "PASS: Windows PowerShell 5.1 parser accepted both scripts"'
PASS: Windows PowerShell 5.1 parser accepted both scripts

$ pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/install-skill.ps1 -WhatIf
What if: Install optimize-prompt skill to: [USER_HOME]\.codex\skills\optimize-prompt (source: dist/codex)
What if: Install align-init skill to: [USER_HOME]\.codex\skills\align-init (source: dist/codex)
What if: Install optimize-prompt-lite skill to: [USER_HOME]\.codex\skills\optimize-prompt-lite (source: dist/codex)
What if: Install optimize-prompt skill to: [USER_HOME]\.claude\skills\optimize-prompt (source: dist/claude-code)
What if: Install align-init skill to: [USER_HOME]\.claude\skills\align-init (source: dist/claude-code)
What if: Install optimize-prompt-lite skill to: [USER_HOME]\.claude\skills\optimize-prompt-lite (source: dist/claude-code)
What if: Install optimize-prompt skill to: [USER_HOME]\.agents\skills\optimize-prompt (source: dist/claude-code)
What if: Install align-init skill to: [USER_HOME]\.agents\skills\align-init (source: dist/claude-code)
What if: Install optimize-prompt-lite skill to: [USER_HOME]\.agents\skills\optimize-prompt-lite (source: dist/claude-code)
What if: Skills would be downloaded from https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip

$ bash scripts/install-skill.sh --version
prompt-optimizer installer v3.1

$ pwsh -NoProfile -File scripts/install-skill.ps1 -Version
prompt-optimizer installer v3.1
```

#### 项目一键检查

```text
$ bash .align/align-check.sh
PASS: bash -n build/build.sh
PASS: bash -n scripts/install-skill.sh
PASS: bash -n core/host/align-route.sh
PASS: bash -n core/host/align-check.sh
PASS: bash -n .align/align-route.sh
PASS: bash -n .align/align-check.sh
FAIL: diff .align/align-route.sh core/host/align-route.sh
PASS: diff .align/align-check.sh core/host/align-check.sh
PASS: bash tests/verify-uninstall.sh
PASS: bash tests/verify-router.sh
PASS: bash tests/verify-installer-wiring.sh
债务台账：无
=== align-check FAIL：修复后才能交付（R8 验证门）===
```

该 FAIL 是波次 0 的已记录基线事实，不在审计波越界修复。

## 10. 失败清单

### Blocker

| ID | 失败 | 影响 |
| --- | --- | --- |
| B-01 | `[直出]` 在 shell、TS 和 adapter 分类前短路 | 高风险安全阀和 R8 可被绕过 |
| B-02 | TS 在入站阶段执行 `.align/check-commands.txt` | 把 baseline 误报为 completion；还扩大仓库命令执行面 |
| B-03 | 默认 block 关闭，settings 与 adapter 又吞掉 exit 2 | “高风险阻断”在提供的接线中不成立 |
| B-04 | 公开 PowerShell installer 在 PS 5.1 hook 接线失败 | 默认 Windows 安装可能处于部分完成状态 |

### P0

| ID | 失败 |
| --- | --- |
| P0-01 | runtime 未实现 D1-D5、总分、D5、假设数、项目风险和 reason code |
| P0-02 | context 在 route 后加载，无法实现可从项目态补全的 B/enrich |
| P0-03 | TS runtime/CLI/adapter 未进入根 dist 和安装路径 |
| P0-04 | 安装器 hook 命令与 host SSOT 漂移，失败提示仍被静默吞掉 |
| P0-05 | `.align/align-route.sh` 与 core SSOT 漂移，现有 corpus 未发现 |
| P0-06 | 无 Claude/Codex E4 证据，无任何真实模型 E5 benchmark |
| P0-07 | README/usage 对跨宿主强制、自动沉淀和完成验证的声明超过证据等级 |
| P0-08 | README 声明 MIT，但仓库没有 LICENSE 文件 |

### P1

- D1/D4 评分边界、R6 语义和 R10 写入目标未唯一化。
- 版本面不统一，无固定 release 下载、checksum、SECURITY 或支持矩阵。
- 无安装 manifest、doctor、原子升级或完整卸载。
- build dry-run 仍执行 npm；PowerShell 只检查 node，不检查 npm 或 `$LASTEXITCODE`。
- generated 标记覆盖不完整；路由/skill wrapper 摘要存在多处可漂移复制。
- 没有 CI 复现基线。

### P2

- `docs/usage/INSTALL.md` 有 System Prompt 相对链接错误。
- README 项目树包含不存在的 universal skill 目录，hooks 清单不完整。
- `docs/README.md` 的根目录例外描述与实际 CHANGELOG/CLAUDE 规则不一致。
- `.align/` 使用文档只展示部分运行时文件。

## 11. G0 验收

- [x] 记录本地 HEAD、与 origin 差异和未提交文件。
- [x] 实际运行现有自动测试，并在 9.2-9.4 记录精确命令、计数、通过/失败、关键原始输出行和证据边界。
- [x] 明确公开安装路径实际交付的文件和未交付的 runtime。
- [x] 按协议定义、源码实现、安装可用、宿主实测分级每项核心能力。
- [x] 记录 `.align` runtime 副本同步状态。
- [x] 未修改或回滚用户已有内容，未 commit、push、release。

**G0 结论：通过。** 通过的是基线证据完整性。当前产品实现仍因 B-01 至 B-04 处于 blocker 状态。

## 12. 下一步边界

G1 已解锁但未启动。进入波次 1 后必须先做公共契约冻结，禁止同时实现 adapter、安装器或生态 handoff。

G1 需要依次冻结：

1. 机器层 route 是否使用 `pass / enrich / clarify / block`，以及展示层如何映射 A/B/C。
2. `clarify` 与机械 `block` 的进入、退出和 next action。
3. `[直出]`、`ALIGN_BYPASS` 的授权边界；任何 bypass 都不得覆盖安全阀。
4. `baselineCheck()` 与 `completionVerify()` 的 API 和状态边界。
5. facts / inferences / assumptions、D1-D5、reason registry 和 schema version。
6. context taxonomy，以及 glossary/state/ADR 是否拆分。

未经 G1 Contract Freeze，不得修复 runtime、扩展分发承诺或进入 G2-G6。
