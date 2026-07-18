# V4 W0 范围冻结与可信基线

> 快照日期：2026-07-15
> 对应方案：`docs/planning/V4-FOCUS-IMPROVEMENT-PLAN.md`
> 基线提交：`70ce8bcb3894cb32b6431367d1f7c875820bd673`
> 状态：W0 基线已冻结；未修复案例保留为 W1 的失败输入。

## 1. 基线边界

本文件只记录 committed baseline、可复现失败、测试结果和公开能力，不改变 runtime 行为，也不修改测试 oracle。

| 项目 | committed baseline | W0 观察 |
| --- | --- | --- |
| 分支 | `codex/v4-focus-baseline` | 与要求一致 |
| HEAD | `70ce8bcb3894cb32b6431367d1f7c875820bd673` | 与要求一致 |
| 初始工作区 | clean；`git status --short --branch` 仅显示分支 | 没有待处理的用户文件改动 |
| 隔离工作 | `stash@{0}`：`wip: codewhale integration isolated before v4 baseline` | 未 apply、pop 或 drop |
| 版本面 | `v3.2.0-rc.1` | README、TypeScript package 和候选版文档保持该口径 |
| dist | 基线已生成产物 | W0 未手工编辑、未重建、未改变 |

W0 的文档修改属于本次受控观察，不与上述 committed baseline 混写。不得把本文件中的当前观察重新解释为新的发布版本或公开能力承诺。

## 2. 案例 A/B 机械复现

复现命令模板：

```powershell
node dist/runtime/runtime/index.js json "<request>" --project-dir "C:\Users\FUTIAN\Desktop\prompt-optimizer"
```

### 案例 A：方向缺失被上下文补全

请求：`帮我优化这个项目，让 AI 更懂我`

结果：进程状态 `0`；`route=enrich`；`next.action=execute`。

| 字段 | 实际结果 |
| --- | --- |
| reasons | `verification.missing`, `context.resolvable_from_project` |
| observed scores | `D1=0, D2=0, D3=0, D4=1, D5=0, total=1` |
| effective scores | `D1=2, D2=1, D3=1, D4=1, D5=1, total=6` |
| acceptance | `bash -n build/build.sh` |
| context | 采用 `.align/lessons.md`、`spec.md`、`facts.md`、`glossary.md`、`state.md`、`decisions.log.md` 和 `check-commands.txt` |

该结果违反“方向不可由上下文补全”和低分硬门；本 W0 不修复。

### 案例 B：文档修改获得无关验收

请求：`把 README.md 的一个错别字改掉`

结果：进程状态 `0`；`route=enrich`；`next.action=execute`。

| 字段 | 实际结果 |
| --- | --- |
| reasons | `context.resolvable_from_project` |
| observed scores | `D1=1, D2=0, D3=1, D4=1, D5=1, total=4` |
| effective scores | `D1=2, D2=1, D3=1, D4=1, D5=1, total=6` |
| acceptance | `bash -n build/build.sh` |
| context | 采用与案例 A 相同的七个 `.align/` 来源 |

该结果违反验收相关性要求；本 W0 不修复，也不调整 oracle。

## 3. Runtime bundle 基线

| 字段 | 值 |
| --- | --- |
| hash kind | `runtime-js-bundle-v1` |
| JS 文件数 | `14` |
| SHA-256 | `5925f20bf1a216640d1181e6ded5fcf8cf9be6989926d1989f005eebba5f2ff8` |

计算口径与 `tests/eval/run-held-out.js` 一致：递归收集 `dist/runtime/runtime/` 下全部 `.js`，按相对路径排序，依次哈希相对路径、NUL、文件字节和 NUL。历史 G5 evidence 中的 hash 属于各自执行时的 runtime，不替换本 W0 hash。

## 4. 测试基线

| 命令 | 实际结果 | 证据边界 |
| --- | --- | --- |
| `cd core/host/pipeline && npm test -- --runInBand` | `17` suites passed，`278` tests passed | 当前 TypeScript deterministic baseline |
| `bash tests/verify-context-economy.sh` | PASS | 常驻入口和硬门可达性 |
| `bash tests/verify-router.sh` | PASS；core `42/42`，`.align` `42/42` | Shell 分类回归；Windows/Git Bash 环境耗时较长 |
| `bash tests/verify-installer-wiring.sh` | PASS；安装、幂等、升级、阻断、doctor、卸载零损伤 | Bash + Claude 假 HOME 沙箱 |
| `git diff --check` | PASS | W0 文档交付检查 |

本波未运行付费模型、真实模型 benchmark 或 fresh blind review。未重新运行 build，因为 W0 没有修改 `core/`；因此没有理由刷新 `dist/`。

当前 evidence manifest 均已 consumed：`held-out` 20 条、`held-out-retest` 16 条、`held-out-final` 16 条。它们只能作为历史 evidence 或 consumed regression，不能重新声明为 fresh blind。G5-D11 fresh post-fix blind review 仍是未清偿债务。

## 5. 公开能力基线

### 5.1 Runtime exports

`dist/runtime/runtime/index.d.ts` 当前公开以下 exports：

```text
VERSION
classify, Classification
route, Verdict, RoutingResult
enrich, AlignContext, EnrichmentResult
getVerificationCommands, runVerification, VerificationResult
processInstruction, PipelineEcosystem, PipelineOptions, PipelineResult
analyzeInstruction, AnalysisResult, DimensionScores, SourceRef
decideRoute, DecisionRoute, RouteDecision
buildAlignmentDecision, AlignmentDecision
projectAlignmentDecision, CompatibilityVerdict, EnrichmentReceipt,
EnrichmentReceiptItem, HostNextAction, HostProjection
LifecycleCoordinator, LifecycleState
writeContextProjection, ProjectionResult
buildMattHandoff, discoverMattEnvironment, MATT_SKILLS, MattEnvironment,
MattEnvironmentDiscoveryOptions, MattHandoff, MattSkill
generateCopilotRules, generateAiderRules, generateWindsurfRules
```

### 5.2 CLI modes

`dist/runtime/runtime/index.js` 当前公开 mode：`claude-code`、`codex`、`cursor`、`generic`、`json`、`matt`、`context-project`。

### 5.3 Skills、宿主和入口

| surface | 当前入口/产物 | 能力基线 |
| --- | --- | --- |
| Skills | `optimize-prompt`、`align-init`、`optimize-prompt-lite` | 三个公开触发名全部保留 |
| Claude Code | `dist/runtime/adapters/claude-code.sh`、`dist/claude-code/hooks/`、`CLAUDE.align.md` | README 声明 L3 Native Hook |
| Codex CLI | `dist/runtime/adapters/codex.sh`、`AGENTS.align.md` | README 声明 L2 CLI wrapper / instruction-backed，不宣称 native parity |
| Cursor | `dist/cursor/rules/align.mdc` | L1 project rule；无真实宿主 E4 证据 |
| Universal | `dist/universal/SYSTEM-PROMPT.md` | L0 copy-paste；遵循度取决于目标模型 |
| Runtime utility | `align-cli`、`align-doctor` | 已存在公开 CLI 和诊断入口 |

### 5.4 未接入默认生产路径的 module

默认 `processInstruction()` 路径实际调用 analyzer、contract builder、enricher、verification plan 和 host projection；Matt handoff 只有在显式 ecosystem 选项下接入。以下能力不是默认请求路径的一部分，W0 只记录，不删除：

| module/API | 当前状态 |
| --- | --- |
| `classifier`、`router` | 顶层兼容 exports 和测试使用；不由 `pipeline.ts` 默认生成 route |
| `LifecycleCoordinator`、`runVerification` | 已导出并有测试；默认 pipeline 只生成 verification plan，不接 execution receipt 后的真实验证 |
| `writeContextProjection` | 仅由显式 `context-project` mode 调用 |
| `generateCopilotRules`、`generateAiderRules`、`generateWindsurfRules` | 顶层 exports 和测试使用；无默认 CLI/宿主路径 |
| `buildMattHandoff`、`discoverMattEnvironment` | 仅显式 `matt` mode 或 ecosystem handoff 使用，不是普通 pipeline 默认能力 |

## 6. D1-D5 未确认项

以下均为 blocker，不由 W0 代替用户确认：

| Gate | 推荐决定 | 当前状态和 blocker |
| --- | --- | --- |
| D1 reference host | Claude Code 是唯一完整 reference host；Codex 是第二个薄 Adapter | 未单独确认；在确认前不得降低其他宿主声明或删除产物 |
| D2 用户可见 skill 数量 | 长期一个主入口；`optimize-prompt-lite` 改内部 fallback，`align-init` 变薄 setup 入口 | 未确认；涉及公开触发方式，不能重命名或删除现有三个入口 |
| D3 兼容窗口 | Alignment Decision v1 在 v4 首个 minor 保持可读，旧 surface 提供明确迁移窗口 | 未确认；不能删除 legacy verdict、router 或 context projection |
| D4 付费评测预算 | 先以 deterministic/fresh blind 做 Gate；真实模型需明确 provider、model、case、repeat 和预算 | 未提供授权与预算；本波禁止付费模型调用 |
| D5 相邻能力归档 | Matt handoff、通用模板和额外规则生成器进入 maintenance/experimental；拆仓库在核心 Gate 后再定 | 未确认；本波不归档、不删除、不扩展生态 |

## 7. W0 范围冻结

从本基线起，连续两个版本内不新增 `skill`、宿主、模板、handoff 或 route 名称。任何公开入口、默认安装目标、公开 schema 或宿主能力声明变化，都必须单独经过用户确认和对应决策 Gate。

本冻结不授权 runtime 修复、module 删除、公开入口重命名、测试 oracle 调整、stash 操作或发布动作。

## 8. W1 进入条件

只有以下条件全部满足，才可进入 W1：

1. 本 W0 基线已保存，案例 A/B 能用单条命令稳定复现，且结果仍按 committed baseline 记录。
2. 工作区观察已与 committed baseline 分开；`dist/`、runtime、测试 oracle 和 `stash@{0}` 未被 W0 改动。
3. `git diff --check` 与 W0 定向验证通过，D1-D5 未确认项仍明确列为 blocker。
4. W1 先在公开 Alignment Decision interface 上添加失败测试和临时 `.align/` fixture，只覆盖 I-01 至 I-07 相关失败；不得先提交行为修复。
5. W1 新增语料标记为 deterministic regression，不得冒充 held-out；既有高风险 case 不得通过调整 oracle 掩盖。

W1 的首批失败断言包括：方向含混即使有完整 `.align/` 仍为 `clarify`；README 错别字不能使用 `bash -n build/build.sh` 验收；未采用的上下文不得进入 `appliedContext`；`clarify` 必须恰好一个最高价值问题并附推荐答案。
