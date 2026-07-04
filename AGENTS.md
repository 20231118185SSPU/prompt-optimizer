# AI Development Rules for Prompt Optimizer

本文件是本项目的强制开发规范。所有参与 `prompt-optimizer` 项目开发、修改、审查、整理文档或生成任务拆解的 AI agent，都必须先阅读并遵守本文件。

## 0. 项目定位

本项目不是普通的 prompt 润色工具，而是 **Agent 意图对齐器**。

核心目标：

- 把用户的粗糙想法转换成 AI agent 可执行、可验证、可沉淀的任务契约。
- 优先降低三类偏差：意图偏差、范围偏差、验收偏差。
- 补结构，不替用户做方向决策。
- 没有验收标准，不交付优化结果。

任何改动都必须服务这个定位。不得把项目退化成"提示词美化器"、"文案润色器"或泛泛的 prompt 模板集合。

## 1. 开始前必须阅读

任何开发任务开始前，至少阅读：

1. `README.md`：理解项目目标、使用方式和项目结构。
2. `docs/core/METHODOLOGY.md`：理解核心方法论、诊断模型、路由和转换规则。
3. `docs/core/TRANSFORM.md`：理解可复制 System Prompt 的实际执行流程。
4. `agent-skills/optimize-prompt/SKILL.md`：理解 skill 入口、路由和质量门槛。
5. 与本次任务直接相关的 `templates/`、`examples/`、`agent-skills/optimize-prompt/references/` 文件。

如果任务来自 `docs/planning/prompt-optimizer-深度优化方案.md` 或 `docs/planning/prompt-optimizer-深度优化方案-会话任务拆解.md`，必须先阅读对应任务片段，再动手。

## 2. 强制工作流程

每次修改必须按以下流程执行：

1. **先定位**：用 `rg`、`Get-ChildItem` 或等价工具确认相关文件和重复内容位置。
2. **先读后改**：不得在未阅读目标文件上下文的情况下直接覆盖或重写。
3. **小步修改**：只实现当前任务要求，不顺手重构无关内容。
4. **同步镜像**：如果修改了主方法论、模板或 skill reference，必须检查并同步对应镜像文件。
5. **验证关键词**：修改后用搜索命令验证关键规则、标题、引用和新增文件是否落地。
6. **报告结果**：最终说明修改了哪些文件、完成了哪些验收、还有什么风险或未验证项。

## 3. 文件同步规则

本项目存在多份语义镜像。修改其中一类文件时，必须检查另一类是否需要同步。

### 文档分类

根目录只保留项目入口和开发规范：

- `README.md`
- `AGENTS.md`

开发文档必须放入 `docs/`，按类型分类：

- `docs/core/`：核心方法论和可复制 System Prompt。
- `docs/usage/`：安装、使用、接入说明。
- `docs/reference/`：参考来源、取舍说明、背景材料。
- `docs/planning/`：优化方案、路线图、会话任务拆解、开发计划。

禁止在根目录新增零散开发文档。新增文档前必须判断归属目录，并同步 `docs/README.md` 和必要的 `README.md` 链接。

### 核心方法论

- `docs/core/METHODOLOGY.md`
- `agent-skills/optimize-prompt/references/methodology.md`

如果改动五维诊断、智能路由、转换规则、反模式、自检清单，通常两处都要同步。

### System Prompt 与 Skill 入口

- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`

如果改动执行流程、路由、输出格式、Quality Bar、硬性门槛，必须检查两处是否一致。

### 模板与 Skill References

下列文件通常成对维护：

- `templates/AGENT-BRIEF.md` ↔ `agent-skills/optimize-prompt/references/agent-brief.md`
- `templates/CLARIFY.md` ↔ `agent-skills/optimize-prompt/references/clarify.md`
- `templates/CODE.md` ↔ `agent-skills/optimize-prompt/references/code.md`
- `templates/ANALYZE.md` ↔ `agent-skills/optimize-prompt/references/analyze.md`
- `templates/WRITE.md` ↔ `agent-skills/optimize-prompt/references/write.md`
- `templates/META.md` ↔ `agent-skills/optimize-prompt/references/meta.md`
- `templates/PROJECT-CONTEXT.md` ↔ `agent-skills/optimize-prompt/references/project-context.md`
- `templates/ANTI-PATTERNS-REFERENCE.md` ↔ `agent-skills/optimize-prompt/references/anti-patterns-reference.md`

新增模板时，也要检查是否需要新增对应 reference，并更新 `SKILL.md` 的 References。

### 示例与文档索引

新增或重命名示例、模板、安装方式时，必须检查：

- `README.md`
- `docs/usage/USAGE.md`
- `docs/usage/INSTALL.md`
- `examples/`

不要让 README 的项目结构和实际文件结构脱节。

## 4. 内容保真规则

本项目高度依赖方法论措辞。修改时必须保留关键概念、规则编号和质量门槛。

必须保留或谨慎同步的术语：

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

如果来自深度优化方案，还必须保留：

- 意图探查
- 零容忍评分
- 三层智能路由
- 零妥协转换
- 共识快照
- 契约回验
- 置信度标注
- `[原文]`、`[推断]`、`[假设]`
- `D5=0`、`总分<6`、`[假设]>2条` 等硬性门槛

禁止把强规则弱化为"建议"、"可以"、"尽量"。如果原文是"必须"、"禁止"、"输出无效，必须重做"，改写后仍必须保持同等强度。

## 5. 设计原则

所有功能、文档、模板和示例必须遵守：

1. **先对齐，再执行**：复杂、高风险或目标不清的任务必须先澄清。
2. **补结构，不补方向**：可以补格式、验收、流程；不得擅自替用户选技术方案、定产品目标或改优先级。
3. **一问一答澄清**：需要追问时，一次只问一个最高价值问题，并给推荐答案。
4. **最小必要补全**：只补足能降低执行偏差的信息，不堆砌空泛规则。
5. **验收可判定**：验收标准必须能用命令、数字、清单或明确人工条件判断。
6. **简单任务不过度结构化**：低风险、信息完整、用户 `[直出]` 时允许轻量输出。
7. **长期任务要沉淀**：代码库、团队规则、重复任务必须输出可复用的术语、规则、踩坑和模板。

## 6. 禁止行为

AI agent 不得：

- 未读上下文就直接重写大文件。
- 删除已有模板、示例、安装脚本或核心方法论，除非用户明确要求。
- 把严格规则改成泛泛建议。
- 把"澄清"改成一次问多个问题。
- 让 AI 自行决定高风险操作是否需要确认。
- 使用"视情况而定"、"合理选择"替代明确执行策略。
- 用"符合最佳实践"、"更好用"、"更优雅"作为不可检查的验收标准。
- 擅自引入新依赖、改变安装路径或修改对外触发方式。
- 修改与当前任务无关的文件格式、换行、标题风格或大段措辞。
- 覆盖或回滚用户已有改动。

## 7. Markdown 写作规范

- 默认使用中文，保留必要英文术语。
- 标题层级必须清晰，不跳级。
- 表格用于对比、诊断、映射；不要用表格承载长段落。
- 规则类内容优先使用短句和清单。
- 示例必须完整，不能只写抽象说明。
- 代码块必须标注语言或使用 `text` / `markdown`。
- 文件路径使用反引号包裹。
- 保持 UTF-8 编码。

## 8. 修改类型规范

### 修改方法论

必须检查：

- 是否影响 `docs/core/TRANSFORM.md` 的执行流程。
- 是否影响 `SKILL.md` 的 Process 或 Quality Bar。
- 是否需要同步 `agent-skills/optimize-prompt/references/methodology.md`。
- 是否需要新增或更新示例。

### 修改模板

必须检查：

- 模板是否仍包含目标、背景、范围、交付物、约束、执行策略、验收。
- 对应 skill reference 是否同步。
- `README.md` / `docs/usage/USAGE.md` 是否列出该模板。

### 修改 Skill

必须检查：

- `SKILL.md` description 是否仍能准确触发本 skill。
- References 是否覆盖新增参考文件。
- Process 是否与 `docs/core/METHODOLOGY.md` 和 `docs/core/TRANSFORM.md` 一致。
- Quality Bar 是否保留验收门、信息不足处理、长期沉淀要求。

### 修改安装脚本

必须检查：

- 不破坏 Windows PowerShell 和 macOS/Linux 两条安装路径。
- 不改变默认安装目标，除非用户明确要求。
- 不把本地绝对路径写入公开脚本。
- 语法检查通过：PowerShell 脚本至少能被 PowerShell 解析，Shell 脚本至少通过 `bash -n`。

### 修改示例

必须检查：

- 示例是否体现"原始指令 → 诊断/路由 → 优化结果/澄清 → 验收/改动记录"。
- 示例不应输出空泛结论。
- 新示例不能与核心规则矛盾。

## 9. 验证要求

每次修改后必须做与改动匹配的验证。

通用验证：

```powershell
git status --short
rg "关键术语或新增标题" .
```

文档/模板修改建议验证：

```powershell
rg "Agent Brief|验收|澄清|路由|Quality Bar" .
```

新增文件后验证：

```powershell
Get-ChildItem -Recurse -File | Select-Object FullName,Length
```

脚本修改后验证：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-skill.ps1 -WhatIf
bash -n scripts/install-skill.sh
```

如果某条验证命令因环境缺失无法运行，最终回答必须说明未运行原因。

## 10. Git 与交付

- 不要自动 commit，除非用户明确要求。
- 不要自动 push。
- 不要使用 `git reset --hard`、`git checkout --` 等会丢弃用户改动的命令。
- 如果工作区已有无关改动，忽略它们，不要回滚。
- 最终回答必须列出：
  - 修改文件
  - 核心变更
  - 已执行验证
  - 未验证项或风险

## 11. 最终自检

提交回答前，AI agent 必须自检：

- [ ] 我是否阅读了相关上下文？
- [ ] 我是否只改了当前任务需要的文件？
- [ ] 我是否同步了镜像文件或明确说明无需同步？
- [ ] 我是否保留了项目"意图对齐器"定位？
- [ ] 我是否没有弱化"必须/禁止/重做条件"？
- [ ] 我是否给出了可执行验收或验证结果？
- [ ] 我是否没有覆盖用户已有改动？


