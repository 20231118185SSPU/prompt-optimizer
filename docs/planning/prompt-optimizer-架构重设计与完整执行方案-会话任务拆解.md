# Prompt Optimizer v3.0 架构重设计与完整执行方案：多会话任务拆解

> 本文件将 `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 拆解为可逐个交给新 Codex 会话执行的任务。  
> 拆解原则：**最大程度保留原始内容**，只补充每个会话的执行边界、交付物、验收方式和衔接说明。

---

## 全局目标与不可变原则

### v3.0 一句话定义

> **Prompt Optimizer v3.0 是一个可注入任意项目的对齐运行时（Alignment Runtime）：接入时为项目生成开发规范，运行时让每条开发指令在执行前静默通过意图对齐管线，执行后把经验沉淀回项目。**

### 产品化目标

| 用户原话 | 产品化定义 |
| --- | --- |
| "用在任何一个项目上" | 项目接入能力：一条命令把对齐协议 + 开发规范注入任意新/旧项目 |
| "规范好开发规范" | 规范生成器：扫描项目现状（或从零访谈），生成项目专属开发规范与上下文契约 |
| "内置为一个必须的路由" | 强制前置门：所有开发指令在执行前必经对齐管线，由宿主工具机制保证，而非用户自觉 |
| "减少卡顿，用户不用明显要求优化" | 静默模式：优化在后台发生，只在必要时浮出水面；简单指令零延迟直通 |
| "原子级别融入整个开发流程" | 全生命周期覆盖：需求→设计→实现→验证→沉淀，每个环节都有对应的微对齐动作 |

### v2.0 的三个根本局限

1. **触发模式是"拉"不是"推"**  
   现在用户必须说 `优化：` / `/optimize-prompt` 才会触发。这意味着最需要对齐的场景（用户随口一句"帮我改一下登录"）恰恰是最不会触发的场景。v3.0 必须把触发权从用户手里转移到**宿主工具的机制**手里（hooks / 规则文件 / 隐式调用）。

2. **输出模式是"展示"不是"执行"**  
   现在的输出是一份完整的 Agent Brief 文档，用户看完还要再发一次给 agent 执行——这就是"卡顿"的来源。v3.0 的默认输出必须是**直接继续执行**：对齐发生在 agent 的思考过程内部，产物是行为的改变，不是一篇给人看的文档。文档形态只在高风险/复杂任务时才出现。

3. **无项目态，每次都是冷启动**  
   现在的 PROJECT-CONTEXT.md 是一个"用户可以选择用的模板"。v3.0 要让项目上下文成为**接入项目后必然存在、自动读取、自动沉淀**的运行时状态。

### 总体架构：四层模型

```text
┌─────────────────────────────────────────────────────────────┐
│  L4 宿主适配层（Host Adapters）                                │
│  Claude Code / Codex / Cursor / Windsurf / 通用 System Prompt │
│  职责：把协议以宿主原生机制（hooks、规则文件、skill）挂载进去      │
├─────────────────────────────────────────────────────────────┤
│  L3 项目运行时（Project Runtime — 注入到目标项目内）             │
│  .align/ 目录：项目规范 + 项目上下文 + 决策日志 + 经验规则        │
│  职责：让对齐状态随项目走、随 git 走，任何 agent 进来都能读到      │
├─────────────────────────────────────────────────────────────┤
│  L2 管线引擎（Alignment Pipeline）                             │
│  静默三档路由 + 生命周期门 + 沉淀回写                            │
│  职责：决定每条指令"直通 / 静默对齐 / 浮出澄清"，零卡顿是默认态     │
├─────────────────────────────────────────────────────────────┤
│  L1 协议内核（Protocol Core — SSOT 单一事实来源）               │
│  意图探查 / 五维诊断 / 转换规则 R1-R10 / 契约回验 / 置信度标注     │
│  职责：唯一权威定义，所有上层文件由它生成，消灭镜像手工同步         │
└─────────────────────────────────────────────────────────────┘
```

### 全局不可妥协原则

1. 所有 v2.0 硬性门槛原样保留：`D5=0 必补验收`、`总分<6 禁直出`、`[假设]>2 转澄清`、`高风险必探查`
2. 新增红线：**任何档位不得跳过验证门（R8）**；**档位 B 披露超 5 行必须升档 C**
3. 禁止把"必须/禁止"弱化为"建议/尽量"
4. 内容只改 `core/`，`dist/` 只能由构建生成
5. 保持零运行时依赖：构建与安装只用 PowerShell/Bash
6. 每阶段完成后跑回测基准（BENCHMARK v3.0），全绿才进入下一阶段

### 阶段总览

| 阶段 | 名称 | 产出 | 预估工作量 |
| --- | --- | --- | --- |
| P0 | SSOT 重构（还债） | core/ + build/ + dist/，删除镜像 | 2-3 个会话 |
| P1 | 静默三档路由 + 生命周期五门 | 03-routing.md v3、06-lifecycle-gates.md、07-precipitation.md | 2 个会话 |
| P2 | 项目运行时 + 规范生成器 | .align/ 规格、spec-kit、align-init skill | 3 个会话 |
| P3 | 宿主适配 + 安装器升级 | 挂载区、hooks、install 脚本 v3 | 2 个会话 |
| P4 | 回测、文档、发布 | BENCHMARK v3、README v3、迁移指南 | 2 个会话 |

---

## 会话 00：实施前基线确认与迁移边界

### 适合单独开新会话的原因

这是只读准备任务，用来确认当前仓库实际状态、镜像关系、未跟踪文件和后续删除风险，避免 P0 直接大改导致误删用户内容。

### 对应原方案

- `1.2 v2.0 的三个根本局限`
- `2.2 L1 协议内核：SSOT 重构`
- `3.0 全局不可妥协原则`
- `附录 B：本方案对 v2.0 关键资产的处置清单`

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请先做只读基线确认，不要修改任何文件。

目标：
确认 v3.0 架构重设计方案涉及的目标文件、镜像关系、构建产物边界和删除风险，输出后续会话的实施映射。

必须先阅读：
1. `README.md`
2. `docs/core/METHODOLOGY.md`
3. `docs/core/TRANSFORM.md`
4. `agent-skills/optimize-prompt/SKILL.md`
5. `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md`
6. `docs/planning/prompt-optimizer-架构重设计与完整执行方案-会话任务拆解.md`

必须保留的原始目标：

v3.0 要从「显式调用的意图对齐器」升级为「嵌入任意项目、静默运行的开发治理基础设施」。

v2.0 的三个根本局限：
1. 触发模式是"拉"不是"推"
2. 输出模式是"展示"不是"执行"
3. 无项目态，每次都是冷启动

v3.0 一句话定义：
Prompt Optimizer v3.0 是一个可注入任意项目的对齐运行时（Alignment Runtime）：接入时为项目生成开发规范，运行时让每条开发指令在执行前静默通过意图对齐管线，执行后把经验沉淀回项目。

附录 B 的处置清单必须逐项核对：

| v2.0 资产 | 处置 |
| --- | --- |
| docs/core/METHODOLOGY.md | 拆分进 core/protocol/00-05，原文件删除 |
| docs/core/TRANSFORM.md | 成为构建产物 dist/universal/SYSTEM-PROMPT.md |
| agent-skills/optimize-prompt/ | 成为构建产物 dist/*/optimize-prompt/ |
| templates/ | 平移至 core/templates/（唯一一份） |
| skills/（空目录） | 删除 |
| examples/ | 保留，P4 补充三档路由新示例 |
| docs/planning/BENCHMARK.md | 保留为 v2 基线，新增 BENCHMARK-V3.md |
| scripts/install-skill.* | 升级为 v3（双 skill + 卸载 + 版本） |
| AGENTS.md | 重写 §2/§3（SSOT 工作流），其余原则保留 |
| 所有零容忍门槛 | 原样继承，一条不弱化 |

执行步骤：
1. 用 `rg --files`、`rg`、`Get-ChildItem` 确认当前仓库文件结构。
2. 找出所有语义镜像：
   - `docs/core/METHODOLOGY.md`
   - `agent-skills/optimize-prompt/references/methodology.md`
   - `docs/core/TRANSFORM.md`
   - `agent-skills/optimize-prompt/SKILL.md`
   - `templates/*`
   - `agent-skills/optimize-prompt/references/*`
3. 标记哪些文件未来应成为 `core/` 唯一来源，哪些文件未来应成为 `dist/` 构建产物。
4. 检查工作区是否已有未提交或未跟踪文件，不要回滚。
5. 输出 P0-P4 的执行依赖图和删除确认清单。

交付物：
1. 当前仓库文件映射表：原路径 → v3 目标路径 → 处置方式。
2. 镜像/重复内容清单。
3. 删除前必须让用户确认的文件清单。
4. 推荐执行顺序和每阶段阻塞条件。

禁止：
- 不要修改任何文件。
- 不要删除或移动任何文件。
- 不要自动 commit。
```

### 验收标准

- 输出覆盖 `docs/core/`、`agent-skills/`、`templates/`、`examples/`、`scripts/`、`docs/planning/`、`AGENTS.md`。
- 明确列出未来 `core/`、`build/`、`dist/` 的边界。
- 明确 P0-3 删除动作必须二次确认。
- 没有产生任何 git diff。

---

## 会话 01：P0-1 建立 `core/` 目录与协议内核骨架

### 对应原方案

`3.2 P0：SSOT 重构（先还债，否则后面每一步都要改三处）`

**任务 P0-1：建立 core/ 目录**
- 把 METHODOLOGY.md 按 2.2 的章节拆分为 `core/protocol/00-07`（07 先留空壳）
- `templates/` 平移为 `core/templates/`（内容不动）
- 验收：`rg "五维诊断|零容忍|契约回验" core/` 命中；拆分前后关键术语清单（AGENTS.md §4）逐条比对无丢失

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P0-1：建立 `core/` 目录与协议内核骨架。

必须先阅读：
- `AGENTS.md`
- `docs/core/METHODOLOGY.md`
- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md`
- 本会话任务拆解文档中的"全局目标与不可变原则"和"会话 01"

必须最大程度保留原始内容：

## L1 协议内核：SSOT 重构

现状问题：METHODOLOGY.md（731行×2份）、TRANSFORM.md↔SKILL.md、10对模板↔references 全靠 AGENTS.md 的人工纪律同步，无任何自动化。

新结构：

```text
prompt-optimizer/
├── core/                          # ★ 唯一事实来源，只在这里改内容
│   ├── protocol/
│   │   ├── 00-positioning.md      # 定位与总纲（澄清成本 < 猜错返工成本）
│   │   ├── 01-intent-probe.md     # 意图探查 + 三类偏差（XY/症状/局部）
│   │   ├── 02-diagnosis.md        # 五维零容忍诊断
│   │   ├── 03-routing.md          # 路由决策树（v3.0 静默三档版）
│   │   ├── 04-transform-rules.md  # R1-R10 转换规则
│   │   ├── 05-contract-check.md   # 契约回验四问 + 硬性重做条件
│   │   ├── 06-lifecycle-gates.md  # ★新增：开发生命周期五门
│   │   └── 07-precipitation.md    # ★新增：自动沉淀协议
│   ├── templates/                 # 10 个模板（唯一一份）
│   └── spec-kit/                  # ★新增：开发规范生成器素材库
│       ├── interview.md           # 从零项目：规范访谈决策树
│       ├── scan.md                # 存量项目：规范扫描与推断协议
│       └── spec-sections/         # 规范章节库（技术栈/分支/测试/提交/评审…）
├── build/
│   └── build.ps1 / build.sh       # 由 core/ 生成 dist/ 所有适配产物
└── dist/                          # 构建产物，禁止手工编辑
    ├── claude-code/               # skill + hooks + CLAUDE.md 片段
    ├── codex/                     # skill + AGENTS.md 片段
    ├── cursor/                    # .cursor/rules 片段
    └── universal/                 # 可复制 System Prompt（原 TRANSFORM.md）
```

关键决策：
- `docs/core/METHODOLOGY.md`、`TRANSFORM.md`、`agent-skills/**/references/` 全部退役为构建产物或直接删除
- AGENTS.md 中的"同步镜像"规则改为"只改 core/，跑 build，禁止手改 dist/"
- 构建脚本本质是拼接 + 模板替换（PowerShell/Bash 即可，无需引入 Node 等依赖，保持项目零依赖特性）

执行要求：
1. 新增 `core/protocol/` 目录并创建 `00-positioning.md` 到 `07-precipitation.md`。
2. 将 `docs/core/METHODOLOGY.md` 的现有内容按主题拆入 `00-05`，不要压缩关键规则。
3. `06-lifecycle-gates.md`、`07-precipitation.md` 可以先建立 v3 方案中的标题和 TODO 壳，但必须保留原始方案对这两块的定位。
4. 新增 `core/templates/`，将现有 `templates/` 内容复制为唯一来源草案；本会话不要删除旧 `templates/`。
5. 新增 `core/spec-kit/`、`core/spec-kit/spec-sections/` 空骨架，保留 README 或占位说明。
6. 不要改动 `docs/core/`、`agent-skills/`、`templates/` 的旧文件，删除动作留到 P0-3。

关键术语必须保留：
- 意图对齐
- Agent Brief
- 五维诊断
- 精确性、约束性、结构性、上下文、验证性
- 澄清访谈
- 一次一问 + 推荐答案
- 反面约束
- 验证门
- 智能路由
- 沉淀门
- 契约
- 意图探查
- 零容忍评分
- 三层智能路由
- 零妥协转换
- 共识快照
- 契约回验
- 置信度标注
- `[原文]`、`[推断]`、`[假设]`
- `D5=0`、`总分<6`、`[假设]>2条`

验收：
- `rg "五维诊断|零容忍|契约回验" core/` 有命中。
- `rg "D5=0|总分<6|\\[假设\\]>2" core/` 有命中。
- `rg "澄清的成本 < 猜错的返工成本" core/` 有命中。
- `Get-ChildItem -Recurse -File core | Select-Object FullName,Length` 显示新增文件。
- 不删除旧镜像文件。
```

### 验收标准

- `core/protocol/00-07` 存在。
- `core/templates/` 存在且保留现有模板内容。
- `core/spec-kit/` 骨架存在。
- 关键术语无丢失。
- 未执行删除动作。

---

## 会话 02：P0-2 编写构建脚本与 `dist/` 初始产物

### 对应原方案

**任务 P0-2：编写构建脚本**
- `build/build.ps1` + `build/build.sh`：拼接 core/protocol/* → dist/universal/SYSTEM-PROMPT.md 与 dist/*/SKILL.md；复制 templates → 各 dist 的 references/
- 验收：两次构建产物逐字节一致（幂等）；`bash -n` / `-WhatIf` 通过

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P0-2：编写构建脚本并生成 `dist/` 初始产物。

必须先阅读：
- `core/protocol/*`
- `core/templates/*`
- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.2 和 3.2

必须最大程度保留原始内容：

## L1 协议内核：SSOT 重构

构建脚本本质是拼接 + 模板替换（PowerShell/Bash 即可，无需引入 Node 等依赖，保持项目零依赖特性）。

目标结构：

```text
build/
└── build.ps1 / build.sh       # 由 core/ 生成 dist/ 所有适配产物
dist/
├── claude-code/               # skill + hooks + CLAUDE.md 片段
├── codex/                     # skill + AGENTS.md 片段
├── cursor/                    # .cursor/rules 片段
└── universal/                 # 可复制 System Prompt（原 TRANSFORM.md）
```

执行要求：
1. 新增 `build/build.ps1` 和 `build/build.sh`。
2. 构建脚本只使用 PowerShell/Bash 基础能力，不引入 Node、Python 或第三方依赖。
3. 脚本从 `core/` 读取：
   - `core/protocol/*.md`
   - `core/templates/*`
   - 后续可扩展的 `core/spec-kit/*`
4. 生成初始 `dist/`：
   - `dist/universal/SYSTEM-PROMPT.md`
   - `dist/claude-code/optimize-prompt/SKILL.md`
   - `dist/codex/optimize-prompt/SKILL.md`
   - `dist/cursor/rules/align.mdc` 或占位规则文件
   - 各适配目录下必要的 `references/` 或模板副本
5. 在产物顶部写明：
   - `Generated from core/`
   - `Do not edit dist/ manually`
6. 产物内容可以先保持 v2 行为，但必须可由 `core/` 重新生成。
7. 本会话不要删除旧 `docs/core/`、`agent-skills/`、`templates/`。

幂等性要求：
- 连续运行两次构建，第二次不应产生额外 diff。
- 产物排序固定，换行固定，避免随机时间戳。

验证：
- `bash -n build/build.sh`
- PowerShell 解析或 dry-run 验证：优先给 `build.ps1` 增加 `-WhatIf`，并运行 `powershell -NoProfile -ExecutionPolicy Bypass -File build/build.ps1 -WhatIf`
- 实际运行构建脚本两次。
- `git status --short` 检查两次构建后 diff 是否稳定。
```

### 验收标准

- `build/build.ps1`、`build/build.sh` 存在。
- `dist/` 初始产物存在。
- 构建脚本可重复运行且产物稳定。
- 未引入新依赖。

---

## 会话 03：P0-3 退役镜像并重写 AGENTS 工作流

### 对应原方案

**任务 P0-3：退役镜像**
- 删除 `agent-skills/`（由 dist/ 取代）、`docs/core/`（TRANSFORM/METHODOLOGY 成为构建产物）、空的 `skills/` 目录
- 重写 AGENTS.md：§2/§3 的"同步镜像"规则替换为"改 core → 跑 build → 禁改 dist"
- 验收：全仓库 `rg` 检索不再存在两份相同的方法论文本；git 提交前用户确认删除清单

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P0-3：退役镜像并重写 `AGENTS.md` 的工作流规则。

这是高风险任务。开始删除或移动前，必须先输出删除清单并等待用户确认。用户确认前只能做只读分析或编辑非删除性规则草案。

必须先阅读：
- `AGENTS.md`
- `core/protocol/*`
- `build/build.ps1`
- `build/build.sh`
- `dist/`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.2、3.2、附录 B

必须最大程度保留原始内容：

关键决策：
- `docs/core/METHODOLOGY.md`、`TRANSFORM.md`、`agent-skills/**/references/` 全部退役为构建产物或直接删除
- AGENTS.md 中的"同步镜像"规则改为"只改 core/，跑 build，禁止手改 dist/"
- 构建脚本本质是拼接 + 模板替换（PowerShell/Bash 即可，无需引入 Node 等依赖，保持项目零依赖特性）

附录 B 处置清单：

| v2.0 资产 | 处置 |
| --- | --- |
| docs/core/METHODOLOGY.md | 拆分进 core/protocol/00-05，原文件删除 |
| docs/core/TRANSFORM.md | 成为构建产物 dist/universal/SYSTEM-PROMPT.md |
| agent-skills/optimize-prompt/ | 成为构建产物 dist/*/optimize-prompt/ |
| templates/ | 平移至 core/templates/（唯一一份） |
| skills/（空目录） | 删除 |
| examples/ | 保留，P4 补充三档路由新示例 |
| docs/planning/BENCHMARK.md | 保留为 v2 基线，新增 BENCHMARK-V3.md |
| scripts/install-skill.* | 升级为 v3（双 skill + 卸载 + 版本） |
| AGENTS.md | 重写 §2/§3（SSOT 工作流），其余原则保留 |
| 所有零容忍门槛 | 原样继承，一条不弱化 |

执行步骤：
1. 先运行 `git status --short`，识别用户已有改动。
2. 用 `rg` 找出镜像内容重复点。
3. 输出计划删除/移动清单，明确每个文件的替代来源。
4. 等用户确认后再删除：
   - `docs/core/METHODOLOGY.md`
   - `docs/core/TRANSFORM.md`
   - `agent-skills/optimize-prompt/`
   - 旧 `templates/`（如果 `core/templates/` 已完整承接）
   - 空的 `skills/` 目录（如果存在且确为空）
5. 重写 `AGENTS.md` 中的工作流：
   - 根目录只保留入口和开发规范
   - 协议内容只改 `core/`
   - `dist/` 只能由构建生成，禁止手工编辑
   - 修改协议后必须跑 build
   - 删除或移动构建产物前必须确认
6. 更新必要的 README / docs 索引，说明 v3 结构。

禁止：
- 未经用户确认，不得删除或移动任何文件。
- 不得使用 `git reset --hard` 或 `git checkout --`。
- 不得弱化 `必须/禁止/输出无效，必须重做`。

验收：
- `rg "五维诊断|契约回验|D5=0" core dist` 有命中。
- 全仓库 `rg` 不再出现多份手工维护的同名方法论正文；如 `dist/` 命中，必须是构建产物。
- `AGENTS.md` 明确写入 `改 core → 跑 build → 禁改 dist`。
- `git status --short` 清楚展示删除与新增。
```

### 验收标准

- 删除前有用户确认。
- `AGENTS.md` 的同步规则已改为 SSOT 构建规则。
- 旧镜像退役后仍可从 `core/` 构建产物。
- 未覆盖用户已有改动。

---

## 会话 04：P0-4 v2.0 基线回归验证

### 对应原方案

**任务 P0-4：回归验证**
- 用现有 BENCHMARK.md 的 10 个 case 对 dist/universal/SYSTEM-PROMPT.md 做路由推演，结论须与 v2.0 报告一致
- 验收：10/10 一致

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P0-4：对 SSOT 重构后的 `dist/universal/SYSTEM-PROMPT.md` 做 v2.0 基线回归验证。

必须先阅读：
- `docs/planning/BENCHMARK.md`
- `dist/universal/SYSTEM-PROMPT.md`
- `core/protocol/*`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 3.2 和 3.8

必须最大程度保留原始目标：

M0（P0 完）：仓库无镜像文件，build 幂等，v2.0 十案例回归全绿。

执行要求：
1. 从 `docs/planning/BENCHMARK.md` 读取现有 10 个 case。
2. 用 `dist/universal/SYSTEM-PROMPT.md` 的规则逐个推演：
   - 预期路由
   - 是否澄清
   - 触发规则
   - 验收门是否存在
3. 对比 v2.0 基线结论。
4. 如果不一致，只做最小修复：
   - 优先改 `core/`
   - 跑 build
   - 不手改 `dist/`
5. 记录 P0 回归报告，可写入 `docs/planning/BENCHMARK.md` 的 P0 回归小节，或新增 `docs/planning/BENCHMARK-P0-REGRESSION.md`（按项目索引规则更新）。

验收：
- 10/10 case 与 v2.0 报告一致。
- `build` 幂等。
- `dist/universal/SYSTEM-PROMPT.md` 不是手工编辑产物。
- 最终说明任何不一致及修复方式。
```

### 验收标准

- P0 回归 10/10 一致。
- 构建脚本稳定。
- 若新增回归报告，已更新 `docs/README.md`。

---

## 会话 05：P1-1 静默三档路由落地到 `03-routing.md`

### 对应原方案

**任务 P1-1：改写 `core/protocol/03-routing.md`**
- 在 v2.0 三层决策树外面包一层"三档分流"（2.3 全文落地）
- 安全阀第一层原样保留且优先级最高（高风险判断先于档位判断）
- 显式前缀覆盖规则、`优化：` 显式模式的 v2.0 行为保留
- 验收：文档内含三档的完整判定条件、行为定义、防退化红线；BENCHMARK 10 case 重新推演并记录预期档位

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P1-1：将静默三档路由完整落地到 `core/protocol/03-routing.md`，并通过 build 同步到 `dist/`。

必须先阅读：
- `core/protocol/03-routing.md`
- `core/protocol/02-diagnosis.md`
- `core/protocol/05-contract-check.md`
- `docs/planning/BENCHMARK.md`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.3、3.3

必须最大程度保留下面原始内容：

## L2 管线引擎：静默三档路由（解决"卡顿"的核心设计）

这是 v3.0 与 v2.0 最大的行为差异。原则：**对齐的存在感与任务风险成正比，与任务频率成反比。**

```text
每条用户指令 → 3 秒内完成内部评估（不输出评估过程）→ 三档分流

┌─ 档位 A：直通（Pass-through）—— 预计覆盖 ~60% 指令
│   条件：单步简单 + 无高风险信号 + 意图明确（五维快评 ≥8 分）
│   行为：完全不提"优化"二字，直接执行。
│         内部仍做一件事：静默套用 R8 验证门（执行完自验证再交付）。
│   用户感知：零。没有任何额外输出、没有任何等待。
│
├─ 档位 B：静默对齐(Silent Align)—— 预计覆盖 ~30% 指令
│   条件：有缺口但可从项目上下文补全（缺口 ∈ .align/ 可回答范围）
│   行为：agent 在内部完成九组件补全 + 转换规则应用，然后【直接开始执行】。
│         仅在回复开头用 1-3 行披露关键对齐假设：
│         「按项目规范：本次改动限于 auth 模块，不动数据库 schema，
│           完成后跑 test:auth。若与你预期不符请打断我。」
│         然后立刻继续干活，不等待确认。
│   用户感知：一段可扫读的对齐披露，无停顿。
│
└─ 档位 C：浮出澄清（Surface）—— 预计覆盖 ~10% 指令
    条件（沿用 v2.0 硬性门槛，一条不弱化）：
      · 高风险信号（生产/删除/数据库/目标不明的重构）且缺目标/范围/约束/验收
      · 诊断总分 <6
      · [假设] >2 条
    行为：停下，一次只问一个问题 + 给推荐答案（v2.0 澄清协议原样保留）。
    用户感知：被打断——但这正是该被打断的 10%。
```

与 v2.0 的兼容：
- 显式前缀 `[直出]` `[访谈]` `[Agent Brief]` `[项目上下文]` 全部保留，作为对三档路由的强制覆盖。
- 显式说 `优化：` 时，输出完整 Agent Brief 文档（v2.0 行为），满足"我就想看优化结果"的场景。

防退化红线：
- 档位 A 的"直通"不等于放弃验证——R8 验证门在所有档位强制生效
- 档位 B 的披露不得超过 5 行，超过说明该走档位 C
- 禁止把档位 C 的场景静默处理：高风险静默假设 = 输出无效，必须重做（继承 v2.0 Quality Bar）

实现要求：
1. 保留 v2.0 三层智能路由，作为三档路由内部的安全阀与任务类型判断。
2. 安全阀第一层原样保留且优先级最高。
3. 明确档位 A/B/C 的：
   - 条件
   - 行为
   - 用户感知
   - 失败/升档条件
4. 明确 `[直出]`、`[访谈]`、`[Agent Brief]`、`[项目上下文]`、`优化：` 的覆盖规则。
5. 跑 build，同步 `dist/`。
6. 用 `docs/planning/BENCHMARK.md` 的 10 个 case 推演并记录 v3 预期档位。

验收：
- `rg "档位 A|档位 B|档位 C|Pass-through|Silent Align|Surface" core dist` 有命中。
- `rg "高风险静默假设 = 输出无效|披露不得超过 5 行|R8 验证门在所有档位强制生效" core dist` 有命中。
- v2.0 10 case 都有 v3 预期档位记录。
```

### 验收标准

- `03-routing.md` 含完整三档路由。
- `dist/` 由 build 生成。
- 安全阀未被弱化。

---

## 会话 06：P1-2 生命周期五门落地

### 对应原方案

**任务 P1-2：新增 `core/protocol/06-lifecycle-gates.md`**
- 五门定义（2.4 全文落地），明确每门的触发条件、动作、静默度、跳过条件
- 验收：每个门都有"何时完全静默"的明确定义（这是防卡顿的关键）

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P1-2：将生命周期五门完整落地到 `core/protocol/06-lifecycle-gates.md`，并通过 build 同步到 `dist/`。

必须先阅读：
- `core/protocol/03-routing.md`
- `core/protocol/06-lifecycle-gates.md`
- `core/protocol/04-transform-rules.md`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.4、3.3

必须最大程度保留下面原始内容：

## L2 管线引擎：生命周期五门（"原子级融入"的具体化）

"原子级融入开发流程"不能只靠一次指令优化，要把对齐动作分解到开发的每个阶段，每个门都是轻量的、大多静默的：

```text
门 1【需求门】指令进入时
  动作：三档路由评估（2.3）
  静默度：A 档全静默，B 档 3 行披露，C 档浮出

门 2【设计门】动手写代码前
  动作：涉及 3+ 文件或跨模块时，先输出 5 行以内的微方案
        （改哪里/不改哪里/怎么验证），然后继续，不等待批准
        高风险任务例外：必须等待批准（继承 v2.0 安全阀）
  静默度：简单任务跳过此门

门 3【执行门】编码过程中
  动作：偏离微方案时必须声明（"发现 X，方案调整为 Y"）
        禁止静默扩大范围（继承 R6 范围裁剪）
  静默度：不偏离则无输出

门 4【验证门】交付前（= R8，最高优先级，任何档位不可跳过）
  动作：按 .align/spec.md 中的项目验证命令自验证
        （测试/构建/lint——接入时已写入规范，无需每次询问）
  静默度：验证通过报一行结果；失败则修复后再交付

门 5【沉淀门】任务结束后
  动作：满足触发条件时（踩坑/用户纠正/新约定），把经验写入
        .align/lessons.md（一条 ≤2 行），并在回复末尾用一行告知
  静默度：无可沉淀内容则完全静默
```

实现要求：
1. 每个门都必须包含：
   - 触发时机
   - 执行动作
   - 静默度
   - 跳过条件
   - 升级到澄清/等待确认的条件
2. 明确"何时完全静默"。
3. 保留 R8 验证门最高优先级。
4. 保留 R6 范围裁剪：禁止静默扩大范围。
5. 保留高风险任务必须等待批准。
6. 跑 build 同步 `dist/`。

验收：
- `rg "需求门|设计门|执行门|验证门|沉淀门" core dist` 有命中。
- 每个门都有"静默度"和"跳过条件"。
- 文档中含 `任何档位不可跳过`。
```

### 验收标准

- 五门定义完整。
- 每门都有静默条件。
- 验证门仍为最高优先级。

---

## 会话 07：P1-3 自动沉淀协议落地

### 对应原方案

**任务 P1-3：新增 `core/protocol/07-precipitation.md`**
- 沉淀触发条件（踩坑/用户纠正/新约定/推翻假设）、写入格式（一条 ≤2 行）、目标文件（.align/lessons.md、decisions.log.md）、膨胀控制（50 条归档）
- 验收：含正反例各 3 个（什么该沉淀、什么不该沉淀）

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P1-3：将自动沉淀协议完整落地到 `core/protocol/07-precipitation.md`，并通过 build 同步到 `dist/`。

必须先阅读：
- `core/protocol/07-precipitation.md`
- `core/protocol/06-lifecycle-gates.md`
- `core/protocol/04-transform-rules.md` 中 R10 沉淀门
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.4、2.5、3.3

必须最大程度保留下面原始内容：

门 5【沉淀门】任务结束后：
  动作：满足触发条件时（踩坑/用户纠正/新约定），把经验写入
        .align/lessons.md（一条 ≤2 行），并在回复末尾用一行告知
  静默度：无可沉淀内容则完全静默

项目运行时文件：

```text
目标项目/
├── .align/
│   ├── spec.md            # 项目开发规范
│   ├── context.md         # 项目上下文契约
│   ├── lessons.md         # 经验规则（沉淀门自动追加，agent 每次任务前必读）
│   └── decisions.log.md   # 重大决策日志（档位 C 澄清的结论自动归档）
```

设计要点：
- `.align/` 随 git 提交，团队成员和所有 agent 共享同一份对齐状态
- 四个文件都有大小纪律：spec ≤150 行、context ≤100 行、lessons 每条 ≤2 行超 50 条归档——防止膨胀成没人读的文档
- agent 的读取顺序写死在挂载区：lessons → spec → context（最易违反的最先读）

执行要求：
1. 定义沉淀触发条件：
   - 踩坑
   - 用户纠正
   - 新约定
   - 推翻假设
   - 高风险决策确认
2. 定义不该沉淀的内容：
   - "本次任务很顺利"式空洞总结
   - 只对一次性任务有效的信息
   - 不能改变下次 agent 行为的记录
3. 定义写入格式：
   - `.align/lessons.md` 一条 ≤2 行
   - `.align/decisions.log.md` 记录重大决策和档位 C 澄清结论
4. 定义膨胀控制：
   - lessons 超 50 条归档
   - spec ≤150 行
   - context ≤100 行
5. 添加正例 3 个、反例 3 个。
6. 跑 build 同步 `dist/`。

验收：
- `rg "lessons.md|decisions.log.md|一条 ≤2 行|50 条归档" core dist` 有命中。
- 正例和反例各至少 3 个。
- R10 沉淀门与新协议不冲突。
```

### 验收标准

- 沉淀触发和禁止沉淀边界清楚。
- 写入格式可执行。
- 膨胀控制明确。

---

## 会话 08：P1-4 设计 BENCHMARK v3 新增回测 case

### 对应原方案

**任务 P1-4：设计新增回测 case（BENCHMARK v3 草案）**
- 至少 8 个新 case：A 档直通×2（验证不啰嗦）、B 档静默对齐×2（验证披露 ≤5 行且不等待确认）、C 档浮出×2（验证该拦的拦住）、门 3 偏离声明×1、门 5 沉淀×1
- 验收：每个 case 有输入、预期档位、预期输出形态、判定标准

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P1-4：设计 BENCHMARK v3 新增回测 case 草案。

必须先阅读：
- `docs/planning/BENCHMARK.md`
- `core/protocol/03-routing.md`
- `core/protocol/06-lifecycle-gates.md`
- `core/protocol/07-precipitation.md`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 3.3、3.6

必须最大程度保留原始内容：

至少 8 个新 case：
1. A 档直通 ×2（验证不啰嗦）
2. B 档静默对齐 ×2（验证披露 ≤5 行且不等待确认）
3. C 档浮出 ×2（验证该拦的拦住）
4. 门 3 偏离声明 ×1
5. 门 5 沉淀 ×1

P4-1 的三个"卡顿指标"也要提前写入草案：
- A 档 case 的输出不得含任何对齐术语（用户零感知）
- B 档 case 的披露 ≤5 行且回复中无"请确认后我再继续"类等待语
- C 档 case 必须拦截（安全性不因静默化而下降）

执行要求：
1. 新增 `docs/planning/BENCHMARK-V3-DRAFT.md`，或在 `docs/planning/BENCHMARK.md` 中新增 v3 草案章节（优先不要破坏 v2 基线）。
2. 每个 case 使用固定结构：
   - Case ID
   - 原始指令
   - 项目上下文前提（是否有 `.align/`）
   - 预期档位
   - 触发规则
   - 预期输出形态
   - 是否等待用户确认
   - 判定标准
   - 实际结果记录位
3. 不需要调用外部模型，用当前规则推演即可。
4. 更新 `docs/README.md` 索引。

验收：
- 至少 8 个 v3 新 case。
- 覆盖 A/B/C 档、门 3、门 5。
- 每个 case 都有判定标准。
```

### 验收标准

- BENCHMARK v3 草案存在。
- 覆盖静默化和安全性指标。
- 已更新文档索引。

---

## 会话 09：P2-1 定义 `.align/` 文件规格与模板

### 对应原方案

**任务 P2-1：定义 `.align/` 文件规格**
- 四个文件的结构模板、大小纪律、读取顺序、归档规则，落地为 `core/templates/ALIGN-SPEC.md` 等 4 个新模板
- 验收：每个模板每一节都有"可判定的填写标准"（吃自己狗粮：过 D5）

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P2-1：定义 `.align/` 文件规格，并新增四个运行时模板。

必须先阅读：
- `core/templates/`
- `core/protocol/07-precipitation.md`
- `core/protocol/06-lifecycle-gates.md`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.5、3.4

必须最大程度保留下面原始内容：

## L3 项目运行时：`.align/` 目录（注入到目标项目）

执行 `align-init` 后，目标项目获得：

```text
目标项目/
├── .align/
│   ├── spec.md            # 项目开发规范（规范生成器产出）
│   │                      #   技术栈与版本 / 目录约定 / 分支与提交规范
│   │                      #   测试与验证命令 / 代码风格 / 评审与合并规则
│   │                      #   高风险操作清单（本项目哪些事必须先问）
│   ├── context.md         # 项目上下文契约（v2.0 PROJECT-CONTEXT 升级版）
│   │                      #   项目目标与当前阶段 / 共享术语 / 架构关键决策
│   ├── lessons.md         # 经验规则（沉淀门自动追加，agent 每次任务前必读）
│   └── decisions.log.md   # 重大决策日志（档位 C 澄清的结论自动归档）
├── CLAUDE.md              # 注入一段"对齐协议挂载区"，已有内容不覆盖
└── AGENTS.md              # 同上，面向 Codex；Cursor 则注入 .cursor/rules/align.mdc
```

设计要点：
- `.align/` 随 git 提交，团队成员和所有 agent 共享同一份对齐状态
- 四个文件都有大小纪律：spec ≤150 行、context ≤100 行、lessons 每条 ≤2 行超 50 条归档——防止膨胀成没人读的文档
- agent 的读取顺序写死在挂载区：lessons → spec → context（最易违反的最先读）

执行要求：
1. 新增模板：
   - `core/templates/ALIGN-SPEC.md`
   - `core/templates/ALIGN-CONTEXT.md`
   - `core/templates/ALIGN-LESSONS.md`
   - `core/templates/ALIGN-DECISIONS.md`
2. 每个模板都必须写明：
   - 用途
   - 由谁生成/更新
   - 最大行数或单条长度纪律
   - 可判定的填写标准
   - 示例
3. `ALIGN-SPEC.md` 至少包含：
   - 技术栈与版本
   - 目录约定
   - 分支与提交规范
   - 测试与验证命令
   - 代码风格
   - 评审与合并规则
   - 高风险操作清单
4. `ALIGN-CONTEXT.md` 至少包含：
   - 项目目标与当前阶段
   - 共享术语
   - 架构关键决策
5. `ALIGN-LESSONS.md` 和 `ALIGN-DECISIONS.md` 必须与沉淀协议一致。
6. build 脚本要能复制这些模板到 `dist/`。

验收：
- `rg "ALIGN-SPEC|高风险操作清单|lessons → spec → context|spec ≤150 行" core dist` 有命中。
- 每个模板每一节都有可判定填写标准，不使用"合理/最佳实践/整洁"作为验收。
```

### 验收标准

- 四个 `.align/` 模板存在。
- 大小纪律和读取顺序明确。
- 每节有可判定填写标准。

---

## 会话 10：P2-2 编写 `core/spec-kit/`

### 对应原方案

**任务 P2-2：编写 `core/spec-kit/`**
- `scan.md`：存量项目扫描协议（扫什么文件、推断规则、置信度标注、何时必须问）
- `interview.md`：从零项目四问决策树（每问带推荐答案）
- `spec-sections/`：规范章节库（技术栈/目录/分支提交/测试验证/风格/评审/高风险清单，每章节给 2-3 个可选预设）
- 验收：用本项目自身跑一遍 scan 协议，能生成合理的 .align/spec.md 草案（自举测试）

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P2-2：编写 `core/spec-kit/`，为规范生成器提供扫描协议、访谈协议和章节库。

必须先阅读：
- `core/templates/ALIGN-SPEC.md`
- `core/templates/ALIGN-CONTEXT.md`
- `core/protocol/02-diagnosis.md`
- `core/protocol/03-routing.md`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.6、3.4

必须最大程度保留下面原始内容：

## 规范生成器（Spec Generator）：两种接入模式

这是响应"从零开发也能规范好开发规范"的新能力，以新 skill `align-init` 提供：

模式一：存量项目（扫描推断）

```text
/align-init
→ 扫描：package.json/pyproject/go.mod（技术栈）、现有测试命令、
        lint 配置、git log 风格、目录结构、已有 README/CLAUDE.md
→ 推断出规范草案，每条标注置信度 [原文]/[推断]/[假设]
→ 只对 [假设] 项发起澄清（一次一问，通常 ≤3 问）
→ 生成 .align/ 四件套 + 注入挂载区
耗时目标：3 分钟内完成接入
```

模式二：从零项目（访谈构建）

```text
/align-init --new
→ 走 spec-kit/interview.md 决策树：
   Q1 项目一句话目标 → Q2 技术栈选型（给推荐+理由）→
   Q3 质量门槛（测试策略/验证命令）→ Q4 高风险边界
→ 每问附推荐答案，用户可以连按四次"就按推荐的"
→ 生成 .align/ 四件套 + 项目骨架建议 + 注入挂载区
```

两种模式共用 `core/spec-kit/spec-sections/` 章节库，保证生成的规范结构一致、可判定（每条规范必须写成"可验证的行为"，禁止"代码要整洁"这类不可判定表述——这本身就是吃自己的狗粮：用五维诊断 D5 标准约束规范生成器自己的输出）。

执行要求：
1. 新增或完善：
   - `core/spec-kit/scan.md`
   - `core/spec-kit/interview.md`
   - `core/spec-kit/spec-sections/`
2. `scan.md` 必须说明扫描对象：
   - `package.json`
   - `pyproject.toml`
   - `go.mod`
   - 现有测试命令
   - lint 配置
   - git log 风格
   - 目录结构
   - README
   - CLAUDE.md / AGENTS.md
3. `scan.md` 必须规定：
   - 置信度标注 `[原文]`、`[推断]`、`[假设]`
   - 只对 `[假设]` 项澄清
   - 一次一问
   - 通常 ≤3 问
4. `interview.md` 必须包含四问：
   - Q1 项目一句话目标
   - Q2 技术栈选型（给推荐+理由）
   - Q3 质量门槛（测试策略/验证命令）
   - Q4 高风险边界
5. `spec-sections/` 至少包含：
   - 技术栈
   - 目录
   - 分支提交
   - 测试验证
   - 风格
   - 评审
   - 高风险清单
6. 每个章节给 2-3 个可选预设，且每条规范必须可验证。
7. 用本项目自身跑一遍 scan 协议，生成草案记录到 `docs/planning/ALIGN-SCAN-SELFTEST.md` 或本会话报告中。

验收：
- `rg "package.json|pyproject|go.mod|git log|\\[原文\\]|\\[推断\\]|\\[假设\\]" core/spec-kit` 有命中。
- `rg "Q1 项目一句话目标|Q2 技术栈选型|Q3 质量门槛|Q4 高风险边界" core/spec-kit` 有命中。
- 自举扫描草案能生成合理的 `.align/spec.md` 草案。
```

### 验收标准

- `core/spec-kit/` 完整。
- 扫描与访谈双模式明确。
- 自举扫描有记录。

---

## 会话 11：P2-3 创建 `align-init` skill

### 对应原方案

**任务 P2-3：创建 `align-init` skill**
- `core/` 中新增 skill 源文件，构建产出 `dist/*/align-init/SKILL.md`
- 流程：检测项目类型 → 选模式（扫描/访谈）→ 生成 .align/ → 注入挂载区（已有 CLAUDE.md/AGENTS.md 时用标记原位插入，绝不覆盖用户内容）→ 输出接入报告
- 幂等性：重复运行 = 升级挂载区版本 + 增量更新 spec，不重置 lessons/decisions
- 验收：在一个测试项目上完整跑通两种模式；重复运行不丢数据

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P2-3：创建 `align-init` skill，并让 build 产出到各宿主目录。

必须先阅读：
- `core/spec-kit/scan.md`
- `core/spec-kit/interview.md`
- `core/templates/ALIGN-*.md`
- `core/protocol/03-routing.md`
- `core/protocol/07-precipitation.md`
- `build/build.ps1`
- `build/build.sh`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.6、2.7、3.4

必须最大程度保留原始内容：

流程：
检测项目类型 → 选模式（扫描/访谈）→ 生成 .align/ → 注入挂载区（已有 CLAUDE.md/AGENTS.md 时用标记原位插入，绝不覆盖用户内容）→ 输出接入报告

两种模式：
- `/align-init`
  - 扫描存量项目
  - 推断出规范草案，每条标注置信度 `[原文]` / `[推断]` / `[假设]`
  - 只对 `[假设]` 项发起澄清（一次一问，通常 ≤3 问）
  - 生成 `.align/` 四件套 + 注入挂载区
  - 耗时目标：3 分钟内完成接入
- `/align-init --new`
  - 走 `spec-kit/interview.md` 决策树
  - Q1 项目一句话目标 → Q2 技术栈选型（给推荐+理由）→ Q3 质量门槛（测试策略/验证命令）→ Q4 高风险边界
  - 每问附推荐答案，用户可以连按四次"就按推荐的"
  - 生成 `.align/` 四件套 + 项目骨架建议 + 注入挂载区

幂等性：
- 重复运行 = 升级挂载区版本 + 增量更新 spec
- 不重置 lessons/decisions

执行要求：
1. 在 `core/` 中新增 `align-init` skill 源文件，具体位置可为：
   - `core/skills/align-init/SKILL.md`
   - 或项目现有构建结构中更合适的位置
2. build 脚本产出：
   - `dist/claude-code/align-init/SKILL.md`
   - `dist/codex/align-init/SKILL.md`
   - `dist/universal/align-init/SKILL.md` 或等价文档
3. `align-init` 的 SKILL.md 必须写清：
   - 触发方式
   - 输入
   - 扫描模式
   - 从零项目模式
   - 生成文件
   - 挂载区注入
   - 幂等规则
   - 输出接入报告
   - 高风险或假设过多时的一次一问澄清
4. 注入挂载区必须使用标记包裹，绝不覆盖用户内容：
   - `<!-- align-protocol:begin v3.0 -->`
   - `<!-- align-protocol:end -->`
5. 在测试项目上跑通两种模式；如果不能实际执行，至少建立测试 fixture 和手工验收记录。

验收：
- `rg "align-init|/align-init|--new|不重置 lessons/decisions|绝不覆盖用户内容" core dist` 有命中。
- build 生成两个 skill：`optimize-prompt` 和 `align-init`。
- 重复运行策略明确。
```

### 验收标准

- `align-init` 源文件和 dist 产物存在。
- 双模式流程完整。
- 幂等规则明确。

---

## 会话 12：P2-4 `optimize-prompt` skill 升级为 v3 行为

### 对应原方案

**任务 P2-4：optimize-prompt skill 升级为 v3 行为**
- 隐式场景走三档路由；显式 `优化：` 保留 v2.0 文档输出
- 有 .align/ 时：档位 B 的缺口补全优先从 .align/ 取材（这是"越用越懂项目"的闭环）
- 验收：同一条模糊指令，在无 .align/ 项目和有 .align/ 项目中分别推演，后者应少一次澄清

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P2-4：将 `optimize-prompt` skill 升级为 v3 行为，同时保留 v2.0 显式优化体验。

必须先阅读：
- `core/protocol/03-routing.md`
- `core/protocol/06-lifecycle-gates.md`
- `core/protocol/07-precipitation.md`
- `core/skills/align-init/SKILL.md`（如已存在）
- `dist/*/optimize-prompt/SKILL.md`（确认由 build 生成）
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.3、2.5、3.4

必须最大程度保留原始内容：

v3.0 行为差异：
- 默认输出必须是直接继续执行：对齐发生在 agent 的思考过程内部，产物是行为的改变，不是一篇给人看的文档。
- 文档形态只在高风险/复杂任务时才出现。
- 隐式场景走三档路由。
- 显式 `优化：` 保留 v2.0 文档输出，满足"我就想看优化结果"的场景。
- 有 `.align/` 时，档位 B 的缺口补全优先从 `.align/` 取材，这是"越用越懂项目"的闭环。

三档行为：
- 档位 A：完全不提"优化"二字，直接执行；内部仍做 R8 验证门。
- 档位 B：仅在回复开头用 1-3 行披露关键对齐假设，然后立刻继续干活，不等待确认。
- 档位 C：停下，一次只问一个问题 + 给推荐答案。

执行要求：
1. 更新 `core` 中的 optimize-prompt skill 源文件；不要手改 `dist/`。
2. 明确输入区分：
   - 用户显式 `优化：`、`/optimize-prompt`、`$optimize-prompt` → v2.0 完整 Agent Brief 输出
   - 普通开发指令 → v3 三档路由
3. 明确 `.align/` 读取顺序：
   - `.align/lessons.md`
   - `.align/spec.md`
   - `.align/context.md`
4. 档位 B 缺口补全优先使用 `.align/`，但不得静默处理高风险或 `[假设]>2`。
5. 同一条模糊指令做双场景推演：
   - 无 `.align/` 项目
   - 有 `.align/` 项目
   预期：后者应少一次澄清。
6. 跑 build。

验收：
- `rg "显式.*优化|三档路由|\\.align/lessons.md|少一次澄清|不等待确认" core dist` 有命中。
- 显式模式仍能输出完整 Agent Brief。
- 隐式模式默认不展示完整 Brief。
```

### 验收标准

- 隐式/显式行为边界明确。
- `.align/` 能参与档位 B 补全。
- 高风险红线未弱化。

---

## 会话 13：P3-1 生成宿主挂载区与 hook 产物

### 对应原方案

**任务 P3-1：挂载区与 hook 产物**
- 构建产出：`dist/claude-code/`（CLAUDE.md 片段 + settings.json hook 片段 + HOOK-REMINDER.txt）、`dist/codex/`（AGENTS.md 片段）、`dist/cursor/`（align.mdc）
- 挂载区用 `<!-- align-protocol:begin/end -->` 标记包裹，版本号内嵌
- 验收：挂载区 ≤40 行；hook 提醒 ≤5 行；在真实 Claude Code 会话中验证 hook 生效

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P3-1：生成宿主挂载区与 hook 产物。

必须先阅读：
- `core/protocol/03-routing.md`
- `core/protocol/06-lifecycle-gates.md`
- `core/protocol/07-precipitation.md`
- `build/build.ps1`
- `build/build.sh`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.7、3.5

必须最大程度保留下面原始内容：

## L4 宿主适配层：让"必经路由"成为机制而非自觉

| 宿主 | 挂载机制 | 强制力 |
| --- | --- | --- |
| Claude Code | ① CLAUDE.md 挂载区（协议摘要 + 指向 .align/）② `UserPromptSubmit` hook 注入提醒：每条用户指令提交时自动附加"先过三档路由评估"的 system-reminder ③ skill 保留显式入口 | ★★★ hook 是机制级强制，用户想绕都绕不开 |
| Codex CLI | AGENTS.md 挂载区（Codex 每会话必读） | ★★ 规则级强制 |
| Cursor / Windsurf | `.cursor/rules/align.mdc`（alwaysApply: true） | ★★ 规则级强制 |
| 其他工具 | universal System Prompt（原 TRANSFORM.md 形态） | ★ 用户自觉 |

CLAUDE.md / AGENTS.md 挂载区形态（构建产物，约 40 行，用标记包裹便于升级时原位替换）：

```markdown
<!-- align-protocol:begin v3.0 -->
## 对齐协议（Alignment Protocol）
每条开发指令执行前，静默完成三档路由评估：
1. 读取 .align/lessons.md → .align/spec.md → .align/context.md
2. 五维快评：简单且明确 → 直接执行（但交付前必须自验证）
3. 有缺口但项目上下文可补全 → 开头 ≤3 行披露对齐假设，然后直接执行
4. 高风险（见 .align/spec.md 高风险清单）或总分<6 或假设>2 条
   → 停下澄清，一次只问一个问题并给推荐答案
5. 任务结束：有踩坑/纠正/新约定 → 追加到 .align/lessons.md
硬性红线：高风险静默假设 = 无效输出；交付前不验证 = 无效输出。
<!-- align-protocol:end -->
```

Claude Code hook（dist/claude-code/hooks 提供，align-init 时写入目标项目 `.claude/settings.json`）：

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "cat .align/HOOK-REMINDER.txt 2>/dev/null || true"
      }]
    }]
  }
}
```

HOOK-REMINDER.txt 内容极短（≤5 行），只做一件事：提醒 agent 本条指令须先过三档路由。这是"用户不用明显要求优化，但所有开发前都会自行智能优化"的机制保证。

执行要求：
1. 在 `core/` 中新增挂载区源文件或模板。
2. build 产出：
   - `dist/claude-code/CLAUDE.align.md`
   - `dist/claude-code/hooks/settings.fragment.json`
   - `dist/claude-code/hooks/HOOK-REMINDER.txt`
   - `dist/codex/AGENTS.align.md`
   - `dist/cursor/align.mdc`
3. 挂载区必须使用：
   - `<!-- align-protocol:begin v3.0 -->`
   - `<!-- align-protocol:end -->`
4. 挂载区 ≤40 行。
5. HOOK-REMINDER.txt ≤5 行。
6. Cursor 规则设置 `alwaysApply: true` 或等价机制。
7. 如果无法在真实 Claude Code 会话中验证 hook 生效，必须在最终报告说明未验证原因，并至少验证 JSON 结构。

验收：
- `rg "align-protocol:begin v3.0|HOOK-REMINDER|UserPromptSubmit|alwaysApply" dist core` 有命中。
- 挂载区 ≤40 行。
- hook 提醒 ≤5 行。
```

### 验收标准

- 三宿主挂载产物齐备。
- 标记包裹和版本号存在。
- hook JSON 可解析。

---

## 会话 14：P3-2 安装脚本 v3

### 对应原方案

**任务 P3-2：安装脚本 v3**
- `install-skill.ps1/sh` 升级：同时安装 optimize-prompt 与 align-init 两个 skill；保留原有目标目录与参数；新增 `-Version` 输出
- 验收：`-WhatIf` 预演正确；三个目标目录（claude/codex/agents）安装后文件完整

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P3-2：升级安装脚本为 v3。

必须先阅读：
- `scripts/install-skill.ps1`
- `scripts/install-skill.sh`
- `dist/`
- `docs/usage/INSTALL.md`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 3.5、附录 B

必须最大程度保留原始内容：

安装脚本 v3：
- `install-skill.ps1/sh` 升级
- 同时安装 `optimize-prompt` 与 `align-init` 两个 skill
- 保留原有目标目录与参数
- 新增 `-Version` 输出
- 验收：`-WhatIf` 预演正确；三个目标目录（claude/codex/agents）安装后文件完整

全局原则：
- 保持零运行时依赖：构建与安装只用 PowerShell/Bash
- 不改变默认安装目标，除非用户明确要求
- 不把本地绝对路径写入公开脚本
- 不破坏 Windows PowerShell 和 macOS/Linux 两条安装路径

执行要求：
1. 升级 `scripts/install-skill.ps1`：
   - 安装 `optimize-prompt`
   - 安装 `align-init`
   - 支持 `-WhatIf`
   - 支持 `-Version`
   - 保留原目标目录逻辑
2. 升级 `scripts/install-skill.sh`：
   - 安装 `optimize-prompt`
   - 安装 `align-init`
   - 支持 `--version`
   - 保留原目标目录逻辑
3. 安装源应来自 `dist/`。
4. 不写入本机绝对路径。
5. 更新 `docs/usage/INSTALL.md` 的最小必要说明。

验证：
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-skill.ps1 -WhatIf`
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-skill.ps1 -Version`
- `bash -n scripts/install-skill.sh`
- `scripts/install-skill.sh --version`（如当前环境支持 Bash 执行）

验收：
- `rg "align-init|optimize-prompt|Version|WhatIf" scripts docs/usage/INSTALL.md` 有命中。
- PowerShell 和 Bash 语法检查通过。
```

### 验收标准

- 双 skill 安装逻辑存在。
- `-WhatIf` / `--version` 可用。
- 安装文档同步。

---

## 会话 15：P3-3 卸载与升级路径

### 对应原方案

**任务 P3-3：卸载与升级路径**
- 新增 `uninstall` 参数；align-init 的挂载区标记支持原位升级（检测旧版本号 → 替换标记区间）
- 验收：卸载后目标项目的 CLAUDE.md 用户自有内容零损伤

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P3-3：补齐卸载与升级路径。

必须先阅读：
- `scripts/install-skill.ps1`
- `scripts/install-skill.sh`
- `dist/claude-code/`
- `dist/codex/`
- `dist/cursor/`
- `core/skills/align-init/SKILL.md`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 2.7、3.5、3.7

必须最大程度保留原始内容：

卸载与升级路径：
- 新增 `uninstall` 参数
- `align-init` 的挂载区标记支持原位升级（检测旧版本号 → 替换标记区间）
- 验收：卸载后目标项目的 CLAUDE.md 用户自有内容零损伤

风险与对策：
- 挂载区污染用户的 CLAUDE.md
- 对策：标记包裹 + 原位替换 + 绝不覆盖标记外内容 + 卸载可完全移除

挂载区标记：
```markdown
<!-- align-protocol:begin v3.0 -->
...
<!-- align-protocol:end -->
```

执行要求：
1. 安装脚本新增卸载参数：
   - PowerShell：`-Uninstall` 或等价参数
   - Bash：`--uninstall`
2. 卸载只删除本项目安装的 skill 或标记区间。
3. 绝不删除用户标记区外内容。
4. `align-init` 文档必须说明：
   - 检测旧版本号
   - 替换标记区间
   - 保留 `.align/lessons.md`
   - 保留 `.align/decisions.log.md`
5. 新增测试 fixture：
   - 含用户自有内容的 `CLAUDE.md`
   - 含旧版本挂载区的 `CLAUDE.md`
   - 卸载后对比用户内容是否保留
6. 更新 `docs/usage/INSTALL.md` 或新增升级/卸载说明。

验证：
- PowerShell `-WhatIf -Uninstall` 或等价 dry-run。
- `bash -n scripts/install-skill.sh`。
- 使用 fixture 验证标记区替换/移除不会损伤用户内容。

验收：
- `rg "uninstall|Uninstall|align-protocol:begin|标记区|原位升级|零损伤" scripts core docs dist` 有命中。
- fixture 证明用户内容保留。
```

### 验收标准

- 卸载参数存在。
- 原位升级规则明确。
- 用户内容零损伤有测试或手工验证记录。

---

## 会话 16：P4-1 BENCHMARK v3 全量回测

### 对应原方案

**任务 P4-1：BENCHMARK v3 全量回测**
- v2.0 的 10 个 case + P1-4 的 8 个新 case，共 18 个，逐个推演记录
- 重点验收三个"卡顿指标"：
  - A 档 case 的输出不得含任何对齐术语（用户零感知）
  - B 档 case 的披露 ≤5 行且回复中无"请确认后我再继续"类等待语
  - C 档 case 必须拦截（安全性不因静默化而下降）
- 验收：18/18 通过并写入 docs/planning/BENCHMARK-V3.md

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P4-1：BENCHMARK v3 全量回测。

必须先阅读：
- `docs/planning/BENCHMARK.md`
- `docs/planning/BENCHMARK-V3-DRAFT.md`（如存在）
- `core/protocol/03-routing.md`
- `core/protocol/06-lifecycle-gates.md`
- `core/protocol/07-precipitation.md`
- `dist/universal/SYSTEM-PROMPT.md`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 3.6、3.8

必须最大程度保留原始内容：

BENCHMARK v3 全量回测：
- v2.0 的 10 个 case + P1-4 的 8 个新 case，共 18 个，逐个推演记录

重点验收三个"卡顿指标"：
1. A 档 case 的输出不得含任何对齐术语（用户零感知）
2. B 档 case 的披露 ≤5 行且回复中无"请确认后我再继续"类等待语
3. C 档 case 必须拦截（安全性不因静默化而下降）

验收：18/18 通过并写入 `docs/planning/BENCHMARK-V3.md`

执行要求：
1. 新增 `docs/planning/BENCHMARK-V3.md`。
2. 纳入：
   - v2.0 10 个 case
   - v3 新增 8 个 case
3. 每个 case 固定结构：
   - 输入
   - 项目上下文
   - 预期档位
   - 实际推演
   - 是否通过
   - 失败原因或调整建议
4. 如果发现规则冲突，优先记录为待修复；只有明显文档笔误才在本会话修复。
5. 更新 `docs/README.md` 索引。

验收：
- `docs/planning/BENCHMARK-V3.md` 存在。
- 18/18 case 有记录。
- 三个卡顿指标逐项验收。
- `rg "A 档 case 的输出不得含任何对齐术语|披露 ≤5 行|C 档 case 必须拦截" docs/planning/BENCHMARK-V3.md` 有命中。
```

### 验收标准

- BENCHMARK v3 全量报告存在。
- 18 个 case 完整。
- 卡顿指标明确通过或列出失败项。

---

## 会话 17：P4-2 文档重写与迁移指南

### 对应原方案

**任务 P4-2：文档重写**
- README v3：新定位、两个 skill、三档路由说明、快速开始（安装 → 进项目 `/align-init` → 正常干活）
- docs/usage/：INSTALL v3、USAGE v3（新增"接入一个项目"与"从零开始一个项目"两个走查）
- 新增 docs/usage/MIGRATION.md：v2 用户迁移指南
- 验收：新用户按 README 能在 5 分钟内完成"安装 + 接入 + 第一条静默对齐指令"

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P4-2：重写 v3 使用文档与迁移指南。

必须先阅读：
- `README.md`
- `docs/README.md`
- `docs/usage/INSTALL.md`
- `docs/usage/USAGE.md`
- `docs/planning/BENCHMARK-V3.md`
- `dist/`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 1.3、2.8、3.6

必须最大程度保留原始内容：

README v3 必须体现：
- 新定位：从「显式调用的意图对齐器」升级为「嵌入任意项目、静默运行的开发治理基础设施」
- 两个 skill：`optimize-prompt` 与 `align-init`
- 三档路由说明
- 快速开始：安装 → 进项目 `/align-init` → 正常干活

docs/usage/ 必须新增或改写：
- INSTALL v3
- USAGE v3
- 新增"接入一个项目"走查
- 新增"从零开始一个项目"走查
- 新增 `docs/usage/MIGRATION.md`：v2 用户迁移指南

新旧能力对照必须保留：

| 能力 | v2.0 | v3.0 |
| --- | --- | --- |
| 触发 | 用户显式 `优化：` | 宿主机制自动，每条指令必经 |
| 输出 | Agent Brief 文档 | 默认直接执行 + 微披露；文档仅显式请求/高风险时出现 |
| 项目规范 | 无 | align-init 生成 .align/spec.md |
| 项目记忆 | 模板（用户自选） | .align/ 运行时，自动读、自动沉淀 |
| 覆盖阶段 | 指令输入这一个点 | 需求/设计/执行/验证/沉淀五门 |
| 内容维护 | 三组镜像手工同步 | core/ SSOT + build 生成 dist/ |
| 协议门槛 | 零容忍 Quality Bar | 原样继承，一条不弱化 |

执行要求：
1. 更新 `README.md`。
2. 更新 `docs/usage/INSTALL.md`。
3. 更新 `docs/usage/USAGE.md`。
4. 新增 `docs/usage/MIGRATION.md`。
5. 更新 `docs/README.md` 索引。
6. 不要把文档写成营销页；重点是可执行走查。
7. 新用户路径必须能在 5 分钟内完成：
   - 安装
   - 进入项目
   - `/align-init`
   - 发第一条普通开发指令，触发静默对齐

验收：
- `rg "align-init|三档路由|静默对齐|MIGRATION|安装 → 进项目" README.md docs/usage docs/README.md` 有命中。
- `docs/usage/MIGRATION.md` 存在。
- README 仍保留项目"Agent 意图对齐器"定位，不退化成提示词美化器。
```

### 验收标准

- README 和 usage 文档完整更新。
- 迁移指南存在。
- 新用户 5 分钟路径清楚。

---

## 会话 18：P4-3 自举与最终验收

### 对应原方案

**任务 P4-3：自举（最终验收）**
- 对 prompt-optimizer 项目自身执行 `/align-init`，生成本项目的 .align/，用 v3 协议开发 v3 后续迭代
- 验收：本项目自身的 AGENTS.md 挂载区 + .align/ 正常工作一周无需手工修正

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P4-3：对本项目执行 v3 自举并做最终验收。

必须先阅读：
- `README.md`
- `AGENTS.md`
- `docs/README.md`
- `docs/planning/BENCHMARK-V3.md`
- `dist/`
- `scripts/install-skill.ps1`
- `scripts/install-skill.sh`
- `docs/planning/prompt-optimizer-架构重设计与完整执行方案.md` 的 3.6、3.8

必须最大程度保留原始内容：

自举（最终验收）：
- 对 prompt-optimizer 项目自身执行 `/align-init`
- 生成本项目的 `.align/`
- 用 v3 协议开发 v3 后续迭代
- 验收：本项目自身的 AGENTS.md 挂载区 + .align/ 正常工作一周无需手工修正

里程碑与验收总表：

```text
M0（P0 完）：仓库无镜像文件，build 幂等，v2.0 十案例回归全绿
M1（P1 完）：协议内核含三档路由 + 五门 + 沉淀，18 案例设计完毕
M2（P2 完）：align-init 双模式在测试项目跑通，自举扫描通过
M3（P3 完）：三宿主挂载产物齐备，hook 实测生效，安装/卸载/升级闭环
M4（P4 完）：18/18 回测全绿，文档就绪，本项目自举运行 —— 发布 v3.0
```

执行要求：
1. 使用项目自身的 `align-init` 流程生成 `.align/`：
   - `.align/spec.md`
   - `.align/context.md`
   - `.align/lessons.md`
   - `.align/decisions.log.md`
2. 在 `AGENTS.md` 中注入或更新 v3 挂载区，必须使用标记区间，不能覆盖标记区外内容。
3. 验证 `.align/` 内容符合大小纪律：
   - spec ≤150 行
   - context ≤100 行
   - lessons 每条 ≤2 行
4. 运行最终验证：
   - build 幂等
   - BENCHMARK v3 18/18
   - install 脚本语法检查
   - 文档索引完整
5. 输出最终验收报告：
   - M0-M4 是否完成
   - 未验证项
   - 一周观察项
   - 发布前风险

验收：
- `.align/` 四件套存在。
- `AGENTS.md` 挂载区存在且标记包裹。
- M0-M4 状态清楚。
- 未验证项不隐藏。
```

### 验收标准

- 本项目完成自举。
- 最终验收报告覆盖 M0-M4。
- 一周观察项明确。

---

## 推荐执行顺序

按原方案 P0 → P1 → P2 → P3 → P4 顺序执行：

1. 会话 00：实施前基线确认与迁移边界
2. 会话 01：P0-1 建立 `core/` 目录与协议内核骨架
3. 会话 02：P0-2 编写构建脚本与 `dist/` 初始产物
4. 会话 03：P0-3 退役镜像并重写 AGENTS 工作流
5. 会话 04：P0-4 v2.0 基线回归验证
6. 会话 05：P1-1 静默三档路由落地到 `03-routing.md`
7. 会话 06：P1-2 生命周期五门落地
8. 会话 07：P1-3 自动沉淀协议落地
9. 会话 08：P1-4 设计 BENCHMARK v3 新增回测 case
10. 会话 09：P2-1 定义 `.align/` 文件规格与模板
11. 会话 10：P2-2 编写 `core/spec-kit/`
12. 会话 11：P2-3 创建 `align-init` skill
13. 会话 12：P2-4 `optimize-prompt` skill 升级为 v3 行为
14. 会话 13：P3-1 生成宿主挂载区与 hook 产物
15. 会话 14：P3-2 安装脚本 v3
16. 会话 15：P3-3 卸载与升级路径
17. 会话 16：P4-1 BENCHMARK v3 全量回测
18. 会话 17：P4-2 文档重写与迁移指南
19. 会话 18：P4-3 自举与最终验收

---

## 每个会话的通用执行约束

复制任一会话任务给新 Codex 会话时，建议附加以下通用约束：

```markdown
通用约束：
1. 开始前先阅读本会话涉及的文件，不要凭空改。
2. 保留原始方案中的关键措辞，尤其是协议名、规则编号、禁止行为、硬性门槛和红线。
3. 不要一次性实施其他会话的内容，除非目标文件需要最小衔接。
4. 如果仍存在主文件与 skill reference/template 镜像内容重复，必须保持语义一致；如果已进入 v3 SSOT，则只改 core/ 并跑 build。
5. 修改后运行必要的搜索检查，确认关键词落地。
6. 不要删除已有示例、模板、安装脚本或核心方法论，除非当前会话明确要求并已获得用户确认。
7. 不要把"必须/禁止/输出无效，必须重做"弱化成"建议/尽量/注意"。
8. 不要自动 commit，不要自动 push。
9. 最终回答列出修改文件、核心变更、已执行验证、未验证项或风险。
```

---

## 风险与对策保留清单

后续每个实施会话都必须回看下表，不得为了静默化弱化安全性。

| 风险 | 对策 |
| --- | --- |
| 静默对齐悄悄做错方向（比 v2.0 更危险，因为不展示 Brief 了） | 档位 B 强制披露关键假设；高风险清单写入 spec.md 且安全阀优先级最高；契约回验在内部仍然执行 |
| 三档路由本身增加每条指令的思考负担（新形态的"卡顿"） | 路由判据必须能在一次快评内完成（不查文件不提问）；.align/ 读取靠宿主机制预注入而非每次现读 |
| .align/ 膨胀成没人读的文档 | 大小纪律写死在协议里；lessons 一条 ≤2 行、50 条归档 |
| 挂载区污染用户的 CLAUDE.md | 标记包裹 + 原位替换 + 绝不覆盖标记外内容 + 卸载可完全移除 |
| 构建脚本成为新的单点故障 | 幂等性验收 + 产物 diff 进 git（dist/ 提交入库，评审时可见变化） |
| 协议在静默化过程中被弱化（历史教训：v2.0 反复强调防退化） | §3.0 不可妥协原则 + 每阶段回测 + AGENTS.md 保留"禁止弱化必须/禁止"条款 |

---

## v3.0 之后的方向（不在本方案范围内）

以下内容只记录，不纳入本轮会话任务：

- 团队模式：.align/ 的多人冲突合并策略、lessons 的评审流程
- 度量：统计三档分流比例与 C 档拦截命中率，用真实数据校准路由阈值
- 更多宿主：JetBrains AI、GitHub Copilot Workspace 适配
- spec-sections 生态：按语言/框架扩充规范章节预设（React/Go/Python…）
