# Prompt Optimizer 深度优化方案：多会话任务拆解

> 本文件将 `C:/Users/FUTIAN/Desktop/prompt-optimizer-深度优化方案.md` 拆解为可逐个交给新 Codex 会话执行的任务。  
> 拆解原则：**最大程度保留原始内容**，只补充每个会话的执行边界、交付物、验收方式和衔接说明。

---

## 全局目标与不可变原则

### 核心目标

将项目从"提示词优化器"升级为"意图对齐引擎" — 不仅转换语言，更要挖掘用户真实意图，建立前置共识，输出零妥协的任务契约。

### 升级目标

```text
v1.0（现状）：自然语言 → 结构化Prompt
v2.0（目标）：原始想法 → 意图挖掘 → 共识确认 → 严格契约 → 执行验证
```

### 三个不可妥协的支柱

1. **先探意图，再谈优化** — 用户的第一句话是线索，不是需求
2. **补结构不补方向** — 缺的格式可以补，缺的决策必须问
3. **无验收，不交付** — 每份契约必须自带"怎么算做对了"

### 平衡提醒

严格性有代价：**过度澄清会让简单任务变得烦人**。设计上已通过以下方式对冲，实施时请保持：

1. 意图探查有明确的**跳过条件**（信息完整/低风险/[直出]）
2. 澄清永远**一次一问 + 推荐答案**，用户回"按推荐来"即可继续
3. 简单任务走基础优化，不套重型结构
4. [假设]≤2条时允许"先输出+标注待确认"，不强制中断

判断标准：**澄清的成本 < 猜错的返工成本时才澄清**。这条应作为总原则写入 `docs/core/METHODOLOGY.md` 开头。

---

## 会话 00：实施前基线确认与文件定位

### 适合单独开新会话的原因

这是只读准备任务，用来确认当前仓库实际文件结构、重复文件关系和后续改造顺序，避免后续会话改错文件。

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请先做只读基线确认，不要修改任何文件。

目标：
确认下面这份优化方案涉及的目标文件在当前仓库中的实际位置，并输出后续会话的文件改造映射。

原始方案中的具体文件改造清单：

### 1. `agent-skills/optimize-prompt/SKILL.md` 改造

在 `### 0. Intelligent Routing` 之前插入新的第0步：

```markdown
### -1. Intent Probing（意图探查）

Before routing, detect intent-expression gaps:

1. **XY Problem check**: If the user requests a specific unusual method,
   identify the likely underlying goal. Offer both paths, let the user choose.
2. **Symptom vs. root cause**: If the request patches a symptom
   (hide error, add loading spinner), note the possible root cause in CONTEXT
   and require the future agent to diagnose before patching.
3. **High-abstraction verbs** (优化/改进/提升/处理) with no measurable target:
   ask ONE question from the intent decision tree:
   "这个任务最终要解决什么问题？A.修故障 B.提升指标 C.学习理解 D.为后续改动铺路 E.满足外部要求"

Skip probing when: the request already contains goal + constraint + acceptance,
or the user used [直出].
```

在 `## Quality Bar` 中追加回验四问：

```markdown
- Does the optimized prompt still solve the user's ORIGINAL problem? (intent fidelity)
- Did you make any product/technical decisions on the user's behalf? (must be zero)
- Are all [假设] items converted to verify-first instructions?
- Is every acceptance criterion checkable by command, number, or checklist?
```

### 2. `docs/core/TRANSFORM.md` System Prompt 改造

- Step 1 之前增加 "Step 0：意图探查"（内容同上）
- Step 5 组装模板中，"目标"下增加一行：`### 意图溯源\n[表面需求] → [确认的真实意图]`
- Step 6 输出中增加"契约回验"块和置信度标注的改动记录格式
- 输出原则增加两条：
  - "9. **区分补全与决策**：结构可以补，方向不能替用户定。"
  - "10. **标注置信度**：让用户一眼看出哪些是原话、哪些是推断、哪些是必须确认的假设。"

### 3. `docs/core/METHODOLOGY.md` 改造

- 第2节五维诊断替换为"零容忍评分标准"（本文阶段1）
- 新增第4.5节"意图-表达偏差"（XY问题/症状根因/局部全局）
- 第7节智能路由替换为三层决策树
- 第9节自检清单增加回验四问

### 4. 新增文件

| 文件 | 用途 |
| --- | --- |
| `templates/INTENT-PROBE.md` | 意图探查决策树模板 |
| `templates/ACCEPTANCE-CHECKLIST.md` | 分类型可复制验收清单库（代码/调研/写作/重构/部署） |
| `examples/intent-gap-cases.md` | 10个"用户说X其实要Y"的真实案例 |
| `agent-skills/optimize-prompt/references/intent-probe.md` | skill版意图探查参考 |
| `agent-skills/optimize-prompt/references/acceptance-checklist.md` | skill版验收清单库 |

### 5. `examples/transformations.md` 增补

新增两个示例类型：
- **示例13：XY问题案例** — 用户要求"用正则解析HTML提取价格"，优化器识别真实目标是"稳定提取商品价格"，输出带方案确认的澄清
- **示例14：置信度标注案例** — 展示 [原文]/[推断]/[假设] 三级标注的完整输出

交付物：
1. 当前仓库文件映射表：原始方案路径 → 实际存在路径 → 是否需要同步到镜像/引用文件。
2. 后续会话建议执行顺序。
3. 不要修改文件。
```

### 验收标准

- 输出覆盖 `SKILL.md`、`docs/core/TRANSFORM.md`、`docs/core/METHODOLOGY.md`、`templates/`、`examples/`、`agent-skills/optimize-prompt/references/`。
- 明确哪些文件是主文件，哪些文件是 skill references 或模板镜像。
- 没有产生任何 git diff。

---

## 会话 01：P0-1 五维诊断替换为零容忍评分标准

### 对应原路线图

P0 — 核心严格性（先做，改动最小收益最大）

1. 五维诊断替换为零容忍评分标准（`docs/core/METHODOLOGY.md` + `docs/core/TRANSFORM.md` + `SKILL.md`）

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P0-1：将五维诊断替换为"零容忍评分标准"。

必须改造的文件：
- `docs/core/METHODOLOGY.md`
- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`
- 如仓库中存在与上述文件内容重复的 skill reference 或模板镜像，请同步更新对应引用文件，保持一致。

必须最大程度保留下面原始方案内容，不要压缩成泛泛描述：

## 阶段1：五维诊断（增强版）

**升级点1：诊断标准更严格**

当前问题：评分过于主观，AI容易给高分。

```markdown
## 严格诊断标准（Zero-Tolerance Scoring）

### D1 精确性（Precision）
- 2分：动词精确（实现/重构/审查）+ 对象具体（文件路径/函数名）+ 目标可量化
- 1分：动词或对象有一项模糊
- 0分：存在"帮我/看看/处理/优化"等高抽象动词

### D2 约束性（Constraint）
- 2分：明确3项以上（范围/数量/权限/禁止项/兼容性）
- 1分：明确1-2项
- 0分：无任何约束说明

### D3 结构性（Structure）
- 2分：指定交付物格式 + 输出结构 + 篇幅限制
- 1分：仅指定格式或结构
- 0分：未说明任何输出要求

### D4 上下文（Context）
- 2分：包含技术栈/当前状态/用途/受众4项
- 1分：包含1-2项
- 0分：无背景信息

### D5 验证性（Verification）
- 2分：有可执行的验收标准（测试命令/量化指标/检查清单）
- 1分：有验收概念但不可执行（"要好用"）
- 0分：无验收标准

**零容忍规则**：
- 总分<6分 → 禁止直接优化，必须先澄清或探查
- 任一维度0分 → 该维度必须补全到至少1分
- D5=0 → 强制补全验收标准，无论用户是否提及
```

**升级点2：诊断输出必须可执行**

```markdown
## 诊断输出（增强版）

| 维度 | 得分 | 缺失项 | 强制补全动作 |
| --- | --- | --- | --- |
| D1 精确性 | 0/2 | 动词模糊、对象不明 | → 追问：具体是哪个文件的哪个函数？ |
| D2 约束性 | 0/2 | 无范围、权限、禁止项 | → 补全：允许breaking change吗？修改范围？ |
| D3 结构性 | 1/2 | 未指定篇幅限制 | → 补全：输出长度预期（简要/详细/完整） |
| D4 上下文 | 1/2 | 缺少用途和受众 | → 追问：这个结果给谁用？用于什么场景？ |
| D5 验证性 | 0/2 | 无验收标准 | → 强制：怎么判断做对了？测试？指标？ |
| **总分** | **2/10** | **严重不足** | **禁止直接优化，进入澄清访谈** |

**执行决策**：
- 得分<6 且 D5=0 → 澄清访谈模式
- 得分<6 且包含高风险信号 → 意图探查模式
- 得分6-7 → Agent Brief模式（强制补全所有0分项）
- 得分8-10 → 基础优化模式
```

实现要求：
1. `docs/core/METHODOLOGY.md` 第2节替换为上述零容忍评分标准，并保留总分解释与执行决策。
2. `docs/core/TRANSFORM.md` 中对应诊断步骤同步采用零容忍评分标准。
3. `agent-skills/optimize-prompt/SKILL.md` 中 `### 2. Diagnose` 同步采用零容忍评分标准和执行决策。
4. 不要引入后续阶段的意图探查、契约回验、置信度标注内容，除非目标文件当前结构要求做最小衔接。

验收：
- 搜索旧的宽松评分描述，确认核心执行路径不再只写"0 分缺失 / 1 分隐含 / 2 分明确"而没有零容忍细则。
- 三个核心文件都包含 D1-D5 的 0/1/2 明确定义。
- 三个核心文件都包含：
  - `总分<6分 → 禁止直接优化`
  - `任一维度0分 → 该维度必须补全到至少1分`
  - `D5=0 → 强制补全验收标准`
```

---

## 会话 02：P0-2 四条硬性门槛写入 Quality Bar

### 对应原路线图

P0 — 核心严格性

2. 四条硬性门槛写入 Quality Bar

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P0-2：把"严格性保障：防退化机制"中的硬性门槛写入 `SKILL.md` 和 `docs/core/TRANSFORM.md` 的 Quality Bar，并在 `docs/core/METHODOLOGY.md` 中形成方法论约束。

必须最大程度保留下面原始方案内容：

## ⚖️ 严格性保障：防退化机制

优化器本身是AI执行的，AI天然倾向于"顺着用户说、快速给结果"。以下机制防止优化器自己退化：

### 1. 禁止性规则前置
所有"禁止行为"（❌条目）在System Prompt中必须出现在对应"执行规则"之前——AI对靠前的约束遵守率更高。

### 2. 强制输出证据
- 诊断表不允许出现无"问题"描述的低分（打0分必须说出缺了什么）
- 改动记录每条必须引用规则编号（R1-R10）并说明降低了哪类偏差
- 路由决策必须输出日志（走了哪条分支、为什么）

### 3. 硬性门槛不可协商
```text
D5=0 且未补全验收 → 输出无效，必须重做
[假设]>2条 且未转澄清 → 输出无效，必须重做
总分<6 且直接输出了优化结果 → 输出无效，必须重做
高风险信号 且未探查意图 → 输出无效，必须重做
```
这四条写入SKILL.md和docs/core/TRANSFORM.md的Quality Bar，作为"重做条件"而非"注意事项"。

### 4. 反奉承约束
```markdown
写入输出原则：
- 用户的原始指令得分低不是冒犯，如实打分。
- 不要为了显得高效而跳过澄清。一次正确的澄清比三轮返工便宜。
- 用户坚持一个可能错误的方案时，执行前必须留一句风险记录在Agent Brief中。
```

必须改造的文件：
- `agent-skills/optimize-prompt/SKILL.md`
- `docs/core/TRANSFORM.md`
- `docs/core/METHODOLOGY.md`
- 如存在 skill reference 或模板镜像，请同步。

实现要求：
1. 在 `SKILL.md` 的 `## Quality Bar` 中加入四条"输出无效，必须重做"硬性门槛。
2. 在 `docs/core/TRANSFORM.md` 的最终自检或 Quality Bar 中加入同样硬性门槛。
3. 在 `docs/core/METHODOLOGY.md` 中新增或增强"严格性保障 / 防退化机制"小节，保留禁止性规则前置、强制输出证据、硬性门槛、反奉承约束。
4. 不要把硬性门槛写成"建议"或"注意事项"，必须表达为重做条件。

验收：
- `rg "输出无效，必须重做|must redo|重做条件" .` 能命中 `SKILL.md`、`docs/core/TRANSFORM.md`、`docs/core/METHODOLOGY.md`。
- `SKILL.md` 和 `docs/core/TRANSFORM.md` 中完整出现四条硬性门槛。
- `docs/core/METHODOLOGY.md` 中保留"用户的原始指令得分低不是冒犯，如实打分"。
```

---

## 会话 03：P0-3 R8 验证门升级与验收清单库

### 对应原路线图

P0 — 核心严格性

3. R8验证门升级：新建 `ACCEPTANCE-CHECKLIST.md` 并在所有模板引用

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P0-3：升级 R8 验证门，新增验收清单库，并在相关模板/引用文件中接入。

必须新增文件：
- `templates/ACCEPTANCE-CHECKLIST.md`
- `agent-skills/optimize-prompt/references/acceptance-checklist.md`

必须检查并按需更新：
- `docs/core/METHODOLOGY.md`
- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`
- `templates/AGENT-BRIEF.md`
- `templates/CODE.md`
- `templates/ANALYZE.md`
- `templates/WRITE.md`
- `agent-skills/optimize-prompt/references/agent-brief.md`
- `agent-skills/optimize-prompt/references/code.md`
- `agent-skills/optimize-prompt/references/analyze.md`
- `agent-skills/optimize-prompt/references/write.md`

必须最大程度保留下面原始方案内容：

### R8 验证门（强制执行，最高优先级）
**触发**：D5=0 或 无明确验收标准

**执行规则**：
按任务类型强制补充可执行的验收标准

**代码类**：
```markdown
完成后自检：
- [ ] 执行测试命令：`npm test` 是否全部通过？
- [ ] 类型检查：`tsc --noEmit` 是否无错误？
- [ ] 代码质量：圈复杂度是否<10？（工具：`eslint`）
- [ ] 是否引入新依赖？如是，说明理由
- [ ] 是否修改public API？如是，标记breaking change
```

**调研类**：
```markdown
完成后自检：
- [ ] 是否覆盖所有要求的对比维度？
- [ ] 每个结论是否有数据来源？
- [ ] 是否给出明确推荐（非"各有优劣"）？
- [ ] 推荐理由是否与用户场景匹配？
```

**写作类**：
```markdown
完成后自检：
- [ ] 篇幅：实际___字，要求___字
- [ ] 语气：是否符合受众（技术/商务/学术）？
- [ ] 结构：是否包含要求的所有章节？
- [ ] 术语：是否准确无歧义？
```

**禁止行为**：
- ❌ 不得使用抽象验收标准（"要好用""要稳定"）
- ❌ 不得省略验收标准（即使用户未提及）
- ❌ 不得使用不可执行的标准（"符合最佳实践"）

新增文件用途：

| 文件 | 用途 |
| --- | --- |
| `templates/ACCEPTANCE-CHECKLIST.md` | 分类型可复制验收清单库（代码/调研/写作/重构/部署） |
| `agent-skills/optimize-prompt/references/acceptance-checklist.md` | skill版验收清单库 |

实现要求：
1. 新增两个验收清单库文件，至少覆盖：代码、调研、写作、重构、部署。
2. `docs/core/METHODOLOGY.md` 的 R8 保留"强制执行，最高优先级"和禁止行为。
3. `SKILL.md` References 中加入 `references/acceptance-checklist.md`，说明需要生成验收标准时加载。
4. `docs/core/TRANSFORM.md` 中 R8 或输出模板引用验收清单库。
5. 相关模板中的 ACCEPTANCE 区域要提示从清单库选择可执行验收项，不要只写抽象验收。

验收：
- 两个新增文件存在，且内容一致或语义一致。
- `rg "ACCEPTANCE-CHECKLIST|acceptance-checklist|验收清单库" .` 能看到核心文件引用。
- `rg "不得使用抽象验收标准|不得省略验收标准|不得使用不可执行的标准" .` 能命中方法论或核心 prompt 文件。
```

---

## 会话 04：P1-1 意图探查协议写入核心文件

### 对应原路线图

P1 — 意图挖掘（本项目的差异化灵魂）

4. 意图探查协议（Step 0）写入三个核心文件

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P1-1：把"阶段0：意图探查（Intent Probing）"写入核心文件，作为路由和五维诊断前的前置协议。

必须改造的文件：
- `agent-skills/optimize-prompt/SKILL.md`
- `docs/core/TRANSFORM.md`
- `docs/core/METHODOLOGY.md`
- 如存在 `agent-skills/optimize-prompt/references/methodology.md` 等镜像文件，请同步。

必须最大程度保留下面原始方案内容：

## 阶段0：意图探查（Intent Probing）— 新增

**问题**：用户表达的需求往往是表层症状，不是根本目标。

**案例**：
- 用户说："帮我优化这个函数的性能"
- 真实意图可能是：
  - A. 这个函数在生产环境卡顿，需要降低延迟
  - B. 代码审查要求圈复杂度<10，需要重构
  - C. 想学习性能优化技巧，需要教学式解释
  - D. 看到网上说某种写法更快，想验证

**解决方案**：在五维诊断之前增加**意图探查层**

```markdown
## 意图探查协议（Intent Probing Protocol）

### 触发条件
当用户指令包含以下信号时，必须先进行意图探查：

1. **高抽象动词**：优化、改进、提升、完善、处理、搞定
2. **模糊目标**：让它更好、更快、更稳定、更优雅
3. **缺少WHY**：只说做什么，不说为什么要做
4. **隐含假设**：用户预设了解决方案但没说明原始问题

### 探查框架
向用户展示一个"意图决策树"，通过2-3个问题定位真实意图：

**第1问：目标层**
"你希望这个任务最终解决什么问题？"
- A. 解决当前遇到的具体故障/bug
- B. 提升某个可量化的指标（性能/安全/可读性）
- C. 学习/理解某个概念或最佳实践
- D. 为后续更大的改动做准备
- E. 满足外部要求（代码审查/合规/团队规范）

**第2问：约束层**（根据第1问答案动态生成）
如果选A（故障）→ "这个问题在什么场景下出现？影响范围多大？"
如果选B（指标）→ "当前值是多少？目标值是多少？为什么是这个目标？"
如果选C（学习）→ "你希望最终获得可执行代码，还是带详细解释的方案？"

**第3问：验收层**
"怎样算是真正解决了这个问题？"
→ 逼迫用户说出可验证的成功标准

### 探查输出
```text
## 意图探查结果

**表面需求**：[用户原话]
**真实意图**：[从决策树提取的根本目标]
**核心约束**：[用户未明说但影响方案的限制]
**验收标准**：[用户确认的成功定义]

**意图确认**：[向用户复述] 
"根据你的回答，你真正需要的是【真实意图】，
而不是单纯的【表面需求】。对吗？"

→ 用户确认后，才进入下一阶段
```
```

还必须在 `agent-skills/optimize-prompt/SKILL.md` 的 `### 0. Intelligent Routing` 之前插入：

```markdown
### -1. Intent Probing（意图探查）

Before routing, detect intent-expression gaps:

1. **XY Problem check**: If the user requests a specific unusual method,
   identify the likely underlying goal. Offer both paths, let the user choose.
2. **Symptom vs. root cause**: If the request patches a symptom
   (hide error, add loading spinner), note the possible root cause in CONTEXT
   and require the future agent to diagnose before patching.
3. **High-abstraction verbs** (优化/改进/提升/处理) with no measurable target:
   ask ONE question from the intent decision tree:
   "这个任务最终要解决什么问题？A.修故障 B.提升指标 C.学习理解 D.为后续改动铺路 E.满足外部要求"

Skip probing when: the request already contains goal + constraint + acceptance,
or the user used [直出].
```

实现要求：
1. `docs/core/TRANSFORM.md` 的 Step 1 之前增加 "Step 0：意图探查"。
2. `docs/core/METHODOLOGY.md` 在五维诊断前增加阶段0或独立小节。
3. `SKILL.md` 在智能路由前增加 `### -1. Intent Probing（意图探查）`。
4. 保留跳过条件：信息完整、低风险、用户使用 `[直出]`。
5. 不要让意图探查无条件阻塞所有简单任务。

验收：
- `rg "Intent Probing|意图探查|意图决策树|表面需求|真实意图" .` 能命中三个核心文件。
- `SKILL.md` 中意图探查位于 `### 0. Intelligent Routing` 之前。
- `docs/core/TRANSFORM.md` 中意图探查位于 Step 1 或诊断前。
```

---

## 会话 05：P1-2 意图-表达偏差检测器写入方法论和 System Prompt

### 对应原路线图

P1 — 意图挖掘

5. 偏差检测器（XY/症状/局部）写入方法论和System Prompt

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P1-2：新增"意图-表达偏差检测器（Intent-Expression Gap Detector）"，并把 XY Problem、症状 vs 根因、局部视角遮蔽全局目标写入方法论和 System Prompt。

必须改造的文件：
- `docs/core/METHODOLOGY.md`
- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`
- 如有 `agent-skills/optimize-prompt/references/methodology.md`，请同步。

必须最大程度保留下面原始方案内容：

## 机制1：意图-表达偏差检测器（Intent-Expression Gap Detector）

**核心洞察**：用户的自然语言经常存在三类系统性偏差，优化器应主动检测。

```markdown
## 偏差检测规则

### 偏差A：解决方案伪装成需求（XY Problem）
**信号**：用户直接要求一个具体做法，但做法本身很反常
- "帮我用正则解析这个HTML" → 真实问题可能是"提取网页数据"，正则是错误路径
- "帮我把这个全局变量改成单例" → 真实问题可能是"状态管理混乱"

**处理**：不直接拒绝用户的方案，而是输出：
"我可以按你说的做【X】。不过如果你的最终目的是【推测的Y】，
【Z方案】通常更合适。请确认：A. 就按X做 B. 改用Z做"

### 偏差B：症状伪装成原因
**信号**：用户描述的是表象，把表象当成了要修复的对象
- "这个页面加载慢，帮我加个loading动画" → 真实问题可能是接口性能
- "帮我把这个报错信息隐藏掉" → 真实问题是错误本身

**处理**：在Agent Brief的"背景"中同时记录症状和可能的根因，
在"工作方式"中要求agent先诊断根因再决定修复层次。

### 偏差C：局部视角遮蔽全局目标
**信号**：用户盯着一个细节，但该细节的修改会影响更大范围
- "把这个函数的参数改成对象" → 会影响所有调用方
- "把这个配置改成环境变量" → 会影响部署流程

**处理**：在Agent Brief的"范围"中强制加入影响面分析：
"执行前先列出此修改的所有影响点，超出【范围】的影响需要先报告"
```

实现要求：
1. 在 `docs/core/METHODOLOGY.md` 新增第4.5节"意图-表达偏差"，包含三类偏差、信号、处理方式和示例。
2. 在 `docs/core/TRANSFORM.md` 的意图探查或转换规则中加入偏差检测器。
3. 在 `SKILL.md` 的 Intent Probing 或 Process 中加入偏差检测器要求。
4. 保持处理方式：不直接拒绝用户方案，而是给 A/B 确认路径。
5. 不要把"推测的Y"当作已确认事实，必须明确是推测或需确认。

验收：
- `rg "XY Problem|解决方案伪装成需求|症状伪装成原因|局部视角遮蔽全局目标" .` 能命中核心文件。
- Agent Brief 相关指令中包含"先诊断根因再决定修复层次"或等义表述。
- 范围相关指令中包含"影响面分析"。
```

---

## 会话 06：P1-3 新增意图探查模板与意图偏差案例库

### 对应原路线图

P1 — 意图挖掘

6. 新增 `INTENT-PROBE.md` 模板和 `intent-gap-cases.md` 案例

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P1-3：新增意图探查模板和意图偏差案例库。

必须新增文件：
- `templates/INTENT-PROBE.md`
- `agent-skills/optimize-prompt/references/intent-probe.md`
- `examples/intent-gap-cases.md`

必须按需更新：
- `agent-skills/optimize-prompt/SKILL.md` References
- `README.md` 或 `docs/usage/USAGE.md` 中的模板/示例索引（如项目已有类似索引）

必须最大程度保留下面原始方案内容：

新增文件用途：

| 文件 | 用途 |
| --- | --- |
| `templates/INTENT-PROBE.md` | 意图探查决策树模板 |
| `examples/intent-gap-cases.md` | 10个"用户说X其实要Y"的真实案例 |
| `agent-skills/optimize-prompt/references/intent-probe.md` | skill版意图探查参考 |

意图探查模板必须包含：

```markdown
## 意图探查协议（Intent Probing Protocol）

### 触发条件
当用户指令包含以下信号时，必须先进行意图探查：

1. **高抽象动词**：优化、改进、提升、完善、处理、搞定
2. **模糊目标**：让它更好、更快、更稳定、更优雅
3. **缺少WHY**：只说做什么，不说为什么要做
4. **隐含假设**：用户预设了解决方案但没说明原始问题

### 探查框架
向用户展示一个"意图决策树"，通过2-3个问题定位真实意图：

**第1问：目标层**
"你希望这个任务最终解决什么问题？"
- A. 解决当前遇到的具体故障/bug
- B. 提升某个可量化的指标（性能/安全/可读性）
- C. 学习/理解某个概念或最佳实践
- D. 为后续更大的改动做准备
- E. 满足外部要求（代码审查/合规/团队规范）

**第2问：约束层**（根据第1问答案动态生成）
如果选A（故障）→ "这个问题在什么场景下出现？影响范围多大？"
如果选B（指标）→ "当前值是多少？目标值是多少？为什么是这个目标？"
如果选C（学习）→ "你希望最终获得可执行代码，还是带详细解释的方案？"

**第3问：验收层**
"怎样算是真正解决了这个问题？"
→ 逼迫用户说出可验证的成功标准
```

案例库必须覆盖三类偏差：

### 偏差A：解决方案伪装成需求（XY Problem）
- "帮我用正则解析这个HTML" → 真实问题可能是"提取网页数据"，正则是错误路径
- "帮我把这个全局变量改成单例" → 真实问题可能是"状态管理混乱"

### 偏差B：症状伪装成原因
- "这个页面加载慢，帮我加个loading动画" → 真实问题可能是接口性能
- "帮我把这个报错信息隐藏掉" → 真实问题是错误本身

### 偏差C：局部视角遮蔽全局目标
- "把这个函数的参数改成对象" → 会影响所有调用方
- "把这个配置改成环境变量" → 会影响部署流程

实现要求：
1. `examples/intent-gap-cases.md` 必须包含 10 个案例。
2. 每个案例尽量使用固定结构：用户原话、偏差类型、可能真实意图、推荐处理、应写入 Agent Brief 的约束。
3. `SKILL.md` References 中加入 `references/intent-probe.md`，说明触发意图探查时加载。
4. 模板版和 skill reference 版内容保持一致或语义一致。

验收：
- 三个新增文件存在。
- `examples/intent-gap-cases.md` 有 10 个案例，且覆盖 XY Problem、症状 vs 根因、局部 vs 全局。
- `SKILL.md` References 能看到 `intent-probe.md`。
```

---

## 会话 07：P2-1 共识快照协议写入 CLARIFY 流程

### 对应原路线图

P2 — 共识与回验（完整闭环）

7. 共识快照协议写入CLARIFY流程

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P2-1：将"共识快照（Consensus Snapshot）"写入澄清流程，确保澄清访谈结论被固化，不在多轮对话后漂移。

必须改造的文件：
- `templates/CLARIFY.md`
- `agent-skills/optimize-prompt/references/clarify.md`
- `docs/core/METHODOLOGY.md`
- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`

必须最大程度保留下面原始方案内容：

## 机制2：共识快照（Consensus Snapshot）

**核心洞察**：澄清访谈的结论如果不固化，多轮对话后就会漂移。

```markdown
## 共识快照协议

每完成一轮澄清（无论是意图探查还是单点澄清），输出一个快照块：

```markdown
## 📌 共识快照 #N

**已确认**：
- 真实目标：[用户确认的意图]
- 关键决策：[用户选择的方向]
- 明确排除：[用户说不要的]

**仍待定**：
- [尚未确认的点，标注默认假设]

**基于以上共识继续。如有偏差请随时纠正。**
```

规则：
- 快照编号递增，后续快照只记录增量变化
- 最终的Agent Brief必须与最新快照一致
- 用户纠正快照 → 立即更新，并检查已有转换是否需要回滚
```

实现要求：
1. `CLARIFY.md` 模板中加入共识快照输出块。
2. skill reference `clarify.md` 同步加入共识快照输出块。
3. `docs/core/METHODOLOGY.md` 增加机制2或澄清流程约束。
4. `docs/core/TRANSFORM.md` 的澄清输出流程说明：每完成一轮澄清后输出快照。
5. `SKILL.md` 的 Clarify First 路由或 Clarify 规则中加入：最终 Agent Brief 必须与最新快照一致。

验收：
- `rg "共识快照|Consensus Snapshot|最新快照|快照编号" .` 能命中上述文件。
- `templates/CLARIFY.md` 和 skill reference 的快照结构一致。
- 规则中包含"用户纠正快照 → 立即更新，并检查已有转换是否需要回滚"。
```

---

## 会话 08：P2-2 契约回验四问写入输出流程

### 对应原路线图

P2 — 共识与回验

8. 契约回验四问写入输出流程

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P2-2：新增"契约回验（Contract Verification）"，作为输出前最后一道门。

必须改造的文件：
- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`
- `docs/core/METHODOLOGY.md`
- 相关输出模板或 skill references（如包含最终输出结构）

必须最大程度保留下面原始方案内容：

## 阶段4：契约回验（Contract Verification）— 新增

**问题**：转换完成≠转换正确。优化后的Prompt可能结构完美，但偏离了用户原始意图。

**解决方案**：在输出前增加强制回验环节。

```markdown
## 契约回验协议（输出前最后一道门）

### 回验四问（每次输出前必须自答）

**Q1 意图保真**：优化后的Prompt解决的还是用户的原始问题吗？
- 检查方法：把优化后的"目标"部分与意图探查的"真实意图"对照
- 失败信号：目标被替换成了"更规范但不是用户要的"版本

**Q2 无擅自决策**：转换过程中是否替用户做了产品/技术决策？
- 检查方法：列出所有补全的信息，逐条判断是"结构补全"还是"方向决策"
- 结构补全（允许）：补格式、补验收、补执行策略
- 方向决策（禁止）：选技术方案、定优先级、改目标

**Q3 可独立执行**：一个对上下文一无所知的agent，拿到这份契约能不猜测地执行吗？
- 检查方法：模拟新agent视角，找出所有需要"猜"的点
- 失败信号：存在"视情况而定""合理选择"等甩锅表述

**Q4 验收可判定**：任务完成时，能客观判断做对了还是做错了吗？
- 检查方法：每条验收标准问"这条能用命令/数字/清单检查吗？"
- 失败信号：验收标准里有"良好""合理""优雅"等主观词

### 回验失败处理
- Q1失败 → 回到意图探查，重新确认
- Q2失败 → 把擅自决策的点改写为"澄清问题+推荐答案"
- Q3失败 → 补全模糊点，或在Prompt中写明"遇到X时如何处理"
- Q4失败 → 重写验收标准为可执行形式

### 回验输出（附在诊断之后）
```markdown
## 契约回验

- ✅ Q1 意图保真：目标与用户确认的真实意图一致
- ✅ Q2 无擅自决策：所有补全均为结构性，技术选型已转为澄清问题
- ✅ Q3 可独立执行：无需猜测的点：0
- ✅ Q4 验收可判定：5条验收标准均可用命令或清单检查
```
```

还必须在 `SKILL.md` 的 `## Quality Bar` 中追加回验四问：

```markdown
- Does the optimized prompt still solve the user's ORIGINAL problem? (intent fidelity)
- Did you make any product/technical decisions on the user's behalf? (must be zero)
- Are all [假设] items converted to verify-first instructions?
- Is every acceptance criterion checkable by command, number, or checklist?
```

实现要求：
1. `docs/core/TRANSFORM.md` Step 6 输出中增加"契约回验"块。
2. `SKILL.md` 输出格式中在诊断之后增加"契约回验"块，除非用户使用 `[直出]`。
3. `docs/core/METHODOLOGY.md` 第9节自检清单增加回验四问。
4. 回验失败处理必须写成流程动作，不是提醒。

验收：
- `rg "契约回验|Contract Verification|Q1 意图保真|Q2 无擅自决策|Q3 可独立执行|Q4 验收可判定" .` 能命中核心文件。
- `SKILL.md` Quality Bar 包含四个英文回验问题。
- 输出格式中有 `## 契约回验`。
```

---

## 会话 09：P2-3 置信度三级标注写入输出格式

### 对应原路线图

P2 — 共识与回验

9. 置信度三级标注写入输出格式

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P2-3：新增"置信度三级标注（Confidence Annotation）"，让用户一眼看出哪些是原话、哪些是推断、哪些是必须确认的假设。

必须改造的文件：
- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`
- `docs/core/METHODOLOGY.md`
- 相关输出模板或示例文件（按需）

必须最大程度保留下面原始方案内容：

## 机制3：置信度标注（Confidence Annotation）

**核心洞察**：优化器补全的信息有不同置信度，应该让用户一眼看出哪些是"你说的"、哪些是"我补的"、哪些是"我猜的"。

```markdown
## 置信度三级标注

在优化后的Prompt中（或改动记录里）标注信息来源：

- **[原文]**：用户明确说过的，逐字或等义保留
- **[推断]**：从上下文/惯例合理推断的，用户应扫一眼确认
- **[假设]**：无依据的默认值，用户必须确认，否则agent执行时要先问

示例改动记录：
1. [原文] 目标：重构 parseConfig() 函数
2. [推断] 技术栈：JavaScript（从文件扩展名 .js 推断）
3. [假设] 允许修改内部实现但不允许改函数签名 —— **请确认此假设**

规则：
- [假设] 超过2条 → 不应直接输出优化结果，应转入澄清访谈
- 所有[假设]必须在Agent Brief中转化为"执行时先验证"的指令
```

`docs/core/TRANSFORM.md` 还必须新增输出原则：

- "10. **标注置信度**：让用户一眼看出哪些是原话、哪些是推断、哪些是必须确认的假设。"

实现要求：
1. `docs/core/TRANSFORM.md` Step 6 输出中增加置信度标注的改动记录格式。
2. `SKILL.md` 的输出格式中要求改动记录使用 `[原文]`、`[推断]`、`[假设]`。
3. `docs/core/METHODOLOGY.md` 新增机制3或输出原则。
4. 将 `[假设]>2条 且未转澄清 → 输出无效，必须重做` 与置信度标注规则衔接。
5. 所有 `[假设]` 必须转化为 Agent Brief 中的"执行时先验证"指令。

验收：
- `rg "\\[原文\\]|\\[推断\\]|\\[假设\\]|置信度" .` 能命中核心文件。
- `SKILL.md` 和 `docs/core/TRANSFORM.md` 都明确 `[假设] 超过2条` 的处理。
- 输出格式或改动记录示例包含三类标注。
```

---

## 会话 10：阶段2 智能路由三层决策树重构

### 对应原方案

`docs/core/METHODOLOGY.md` 第7节智能路由替换为三层决策树。

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请重构智能路由为三层决策树，并要求输出路由日志。

必须改造的文件：
- `docs/core/METHODOLOGY.md`
- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`
- 如有相关 references，请同步。

必须最大程度保留下面原始方案内容：

## 阶段2：智能路由（重构版）

**当前问题**：路由规则模糊，AI容易误判。

**解决方案**：决策树式路由 + 强制触发器

```markdown
## 智能路由决策树 v2.0

### 第一层：安全阀判断（强制优先级）
```text
用户指令
  │
  ├─ 包含高风险信号？
  │  ├─ 是 → 强制进入【意图探查】
  │  │  信号：生产环境/数据库/删除/重构/越X越好/提升性能
  │  └─ 否 → 继续
  │
  ├─ 诊断总分<6？
  │  ├─ 是 → 强制进入【澄清访谈】
  │  └─ 否 → 继续
  │
  └─ D5验证性=0？
     ├─ 是 → 强制补全验收标准
     └─ 否 → 继续
```

### 第二层：任务类型判断
```text
通过安全阀
  │
  ├─ 编程类任务？
  │  关键词：实现/重构/调试/部署/测试
  │  → 【Agent Brief - 代码模板】
  │
  ├─ 调研类任务？
  │  关键词：对比/分析/调研/评估/选型
  │  → 【Agent Brief - 调研模板】
  │
  ├─ 写作类任务？
  │  关键词：写/撰写/文档/PRD/报告
  │  → 【Agent Brief - 写作模板】
  │
  ├─ 项目沉淀？
  │  关键词：记住/下次/以后/规则/团队约定
  │  → 【项目上下文模板】
  │
  └─ 其他
     → 【通用Agent Brief】
```

### 第三层：复杂度判断
```text
确定任务类型
  │
  ├─ 单步简单任务？
  │  特征：改一个文件/单一动作/无依赖
  │  → 【基础优化模式】
  │
  ├─ 多步复杂任务？
  │  特征：3+文件/跨模块/需要架构设计
  │  → 【Agent Brief + 分阶段审批门】
  │
  └─ 长期迭代任务？
     特征：会有后续版本/需要上下文沉淀
     → 【Agent Brief + 项目上下文沉淀】
```

### 路由日志（必须输出）
```markdown
## 路由决策日志

**第一层：安全阀** ✅ 通过
- 高风险信号：未检测到
- 诊断总分：8/10（≥6）
- 验证性：2/2（已明确）

**第二层：任务类型** → 编程类任务
- 检测关键词："重构"
- 匹配模板：Agent Brief - 代码模板

**第三层：复杂度** → 单步简单任务
- 影响范围：单文件
- 依赖关系：无跨模块依赖
- 最终模式：基础优化模式

**执行路径**：基础优化模式 + 代码验收清单
```
```

实现要求：
1. `docs/core/METHODOLOGY.md` 第7节智能路由替换为上述三层决策树。
2. `docs/core/TRANSFORM.md` 中路由步骤改为三层决策树。
3. `SKILL.md` 的 `### 0. Intelligent Routing` 改为三层决策树或引用该结构。
4. 输出格式中加入 `## 路由决策日志`，除非用户 `[直出]`。
5. 保持简单任务不被过度结构化：第三层允许单步简单任务走基础优化模式。

验收：
- `rg "智能路由决策树 v2.0|第一层：安全阀|第二层：任务类型|第三层：复杂度|路由决策日志" .` 命中核心文件。
- `SKILL.md` 仍保留 Basic Optimize / Agent Brief / Clarify First / Project Context / Direct Output 的映射或等价映射。
- 输出模板含路由日志。
```

---

## 会话 11：阶段3 转换规则 R1-R10 零妥协版全面升级

### 对应原方案

阶段3：转换执行（零妥协版）

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请全面升级转换规则 R1-R10 为"零妥协版"。

必须改造的文件：
- `docs/core/METHODOLOGY.md`
- `docs/core/TRANSFORM.md`
- `agent-skills/optimize-prompt/SKILL.md`
- `agent-skills/optimize-prompt/references/anti-patterns-reference.md`
- 相关模板 references（按需）

必须最大程度保留下面原始方案内容的结构和规则，不要只写摘要。

## 阶段3：转换执行（零妥协版）

**核心原则**：信息不足时，宁可停下来澄清，也不要猜测和妥协。

```markdown
## 转换规则执行清单（Zero-Compromise Transformation）

### 执行前自检
- [ ] 意图探查已完成（如触发）
- [ ] 五维诊断所有维度≥1分
- [ ] D5验证性≥1分（强制）
- [ ] 高风险信号已处理（如有）
- [ ] 用户已确认真实意图（如有歧义）
```

必须纳入并保留的规则：

### R1 精确性注入（强制执行）

触发：检测到模糊动词（优化/改进/处理/看看/弄一下）

禁止行为：
- ❌ 不得用"可能""也许""建议"等词糊弄
- ❌ 不得自行猜测用户意图
- ❌ 不得用"根据常规做法"作为替代

### R2 边界锁定（强制执行）

触发：缺少范围、权限、排除项

禁止行为：
- ❌ 不得用"尽量不改"替代"禁止修改"
- ❌ 不得用"一般来说"替代明确权限
- ❌ 不得假设用户"应该允许"某些修改

### R3 交付物锁定（强制执行）

触发：未指定输出格式

禁止行为：
- ❌ 不得用"灵活输出"替代明确格式
- ❌ 不得让AI自行决定详细程度

### R4 上下文锚定（强制执行）

触发：缺少背景、受众、用途

禁止行为：
- ❌ 不得假设"用户肯定知道自己的技术栈"
- ❌ 不得省略"显而易见"的背景

### R5 反面约束（强制执行）

触发：无禁止项说明

禁止行为：
- ❌ 不得用"注意"替代"禁止"
- ❌ 不得用"建议"替代"必须"

### R6 范围裁剪（强制执行）

触发：一个指令包含3+独立任务

禁止行为：
- ❌ 不得试图"一次性完成所有任务"
- ❌ 不得擅自决定哪些任务可以合并

### R7 示例嵌入（条件执行）

触发：主观任务、风格任务、复杂格式

禁止行为：
- ❌ 不得用"参考类似风格"替代具体示例

### R8 验证门（强制执行，最高优先级）

触发：D5=0 或 无明确验收标准

禁止行为：
- ❌ 不得使用抽象验收标准（"要好用""要稳定"）
- ❌ 不得省略验收标准（即使用户未提及）
- ❌ 不得使用不可执行的标准（"符合最佳实践"）

### R9 意图路由（强制执行）

触发：所有任务

必须写入每个 Agent Brief：

```markdown
## 执行策略（写入每个Agent Brief）

- 信息足够且低风险 → 直接执行
- 关键信息缺失且会改变目标 → 停下来，只问一个问题，附推荐答案
- 信息可从文件/文档/日志/URL获得 → 自己读取，不问用户
- 高风险操作（删除/生产/不可逆）→ 先输出方案和影响面，等待确认
- 只读分析任务 → 禁止修改任何文件
- 代码修改任务 → 先读上下文，再最小变更
```

禁止行为：
- ❌ 不得省略"信息不足时怎么办"的指引
- ❌ 不得让agent自行决定是否需要确认高风险操作

### R10 沉淀门（条件执行）

触发：长期项目、代码库任务、团队规则、重复性任务

禁止行为：
- ❌ 不得输出"本次任务很顺利"式的空洞沉淀
- ❌ 每条沉淀必须能改变下次agent的行为，否则删掉

实现要求：
1. 对 R1-R10 逐条升级，保留"触发"、"执行规则"、"禁止行为"。
2. 按原方案要求，所有"禁止行为"在 System Prompt 中必须出现在对应"执行规则"之前。
3. 保留 R9 的执行策略并写入 Agent Brief 模板。
4. 保留 R10 的沉淀结构：
   - 术语
   - 规则
   - 踩坑
   - 模板
5. 不要删除已有有价值的示例；如需重排，保持语义完整。

验收：
- `rg "Zero-Compromise|零妥协|执行前自检|R1 精确性注入|R10 沉淀门" .` 命中核心文件。
- R1-R10 都有触发条件。
- R1-R10 的禁止行为没有被压缩删除。
- Agent Brief 模板包含 R9 执行策略。
```

---

## 会话 12：docs/core/TRANSFORM.md 输出模板与原则整合

### 对应原方案

`docs/core/TRANSFORM.md` System Prompt 改造中的输出组装、输出原则、契约回验和置信度标注整合。

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请专门整理 `docs/core/TRANSFORM.md`，确保前面各阶段内容在 System Prompt 的流程、模板和输出原则中一致落地。

必须最大程度保留下面原始方案内容：

## `docs/core/TRANSFORM.md` System Prompt 改造

- Step 1 之前增加 "Step 0：意图探查"（内容同上）
- Step 5 组装模板中，"目标"下增加一行：`### 意图溯源\n[表面需求] → [确认的真实意图]`
- Step 6 输出中增加"契约回验"块和置信度标注的改动记录格式
- 输出原则增加两条：
  - "9. **区分补全与决策**：结构可以补，方向不能替用户定。"
  - "10. **标注置信度**：让用户一眼看出哪些是原话、哪些是推断、哪些是必须确认的假设。"

还必须保留：

## 契约回验

- ✅ Q1 意图保真：目标与用户确认的真实意图一致
- ✅ Q2 无擅自决策：所有补全均为结构性，技术选型已转为澄清问题
- ✅ Q3 可独立执行：无需猜测的点：0
- ✅ Q4 验收可判定：5条验收标准均可用命令或清单检查

置信度三级标注：

- **[原文]**：用户明确说过的，逐字或等义保留
- **[推断]**：从上下文/惯例合理推断的，用户应扫一眼确认
- **[假设]**：无依据的默认值，用户必须确认，否则agent执行时要先问

实现要求：
1. 只聚焦 `docs/core/TRANSFORM.md`，除非发现明显镜像文件必须同步。
2. 检查 Step 编号是否连续、无冲突。
3. 确保 Step 0、诊断、路由、转换、输出、回验、置信度标注顺序合理。
4. 输出原则中保留并编号新增的第9、第10条。
5. 不要因整理而删除 P0/P1/P2 已经写入的硬性门槛。

验收：
- `docs/core/TRANSFORM.md` 包含 `Step 0`、`意图溯源`、`契约回验`、`[原文]`、`[推断]`、`[假设]`。
- 输出原则包含第9和第10条。
- 文档内部没有两个互相冲突的输出格式。
```

---

## 会话 13：examples/transformations.md 增补示例13和示例14

### 对应原方案

`examples/transformations.md` 增补两个示例类型。

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请增补 `examples/transformations.md`，新增示例13和示例14。

必须最大程度保留下面原始方案内容：

## `examples/transformations.md` 增补

新增两个示例类型：
- **示例13：XY问题案例** — 用户要求"用正则解析HTML提取价格"，优化器识别真实目标是"稳定提取商品价格"，输出带方案确认的澄清
- **示例14：置信度标注案例** — 展示 [原文]/[推断]/[假设] 三级标注的完整输出

示例13必须体现：
1. 用户原始指令："帮我用正则解析这个HTML提取价格"
2. 识别为"解决方案伪装成需求（XY Problem）"
3. 输出不能直接拒绝用户方案，而是：
   "我可以按你说的做【X】。不过如果你的最终目的是【推测的Y】，【Z方案】通常更合适。请确认：A. 就按X做 B. 改用Z做"
4. 带方案确认的澄清。

示例14必须体现：
1. [原文]：用户明确说过的，逐字或等义保留
2. [推断]：从上下文/惯例合理推断的，用户应扫一眼确认
3. [假设]：无依据的默认值，用户必须确认，否则agent执行时要先问
4. 示例改动记录：
   - [原文] 目标：重构 parseConfig() 函数
   - [推断] 技术栈：JavaScript（从文件扩展名 .js 推断）
   - [假设] 允许修改内部实现但不允许改函数签名 —— **请确认此假设**

实现要求：
1. 先阅读 `examples/transformations.md` 的现有示例风格，新增示例要保持格式一致。
2. 不要删除已有示例。
3. 示例应完整展示"原始指令 → 路由/诊断 → 优化输出/澄清输出 → 改动记录/回验"中的关键部分。
4. 示例14要展示完整输出，而不是只解释规则。

验收：
- `rg "示例13|示例14|用正则解析.*HTML|置信度标注案例" examples/transformations.md` 有命中。
- 示例13包含 A/B 确认路径。
- 示例14包含 `[原文]`、`[推断]`、`[假设]` 三类标注。
```

---

## 会话 14：P3-1 建立 BENCHMARK.md 并用10个真实指令回测

### 对应原路线图

P3 — 验证与打磨

10. 用10个真实指令跑完整流程，记录进 `BENCHMARK.md`

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P3-1：建立 `BENCHMARK.md`，用10个真实指令跑完整流程并记录结果。

必须最大程度保留下面原始方案内容作为基准：

## P3 — 验证与打磨
10. 用10个真实指令跑完整流程，记录进 BENCHMARK.md
11. 检查skill在Claude Code中的实际触发和输出质量
12. 根据实测结果调整规则的严格度（防止过度澄清骚扰用户）

需要验证的核心能力：

1. 意图探查有明确的**跳过条件**（信息完整/低风险/[直出]）
2. 澄清永远**一次一问 + 推荐答案**，用户回"按推荐来"即可继续
3. 简单任务走基础优化，不套重型结构
4. [假设]≤2条时允许"先输出+标注待确认"，不强制中断
5. 判断标准：**澄清的成本 < 猜错的返工成本时才澄清**

必须覆盖的场景：
1. 高抽象动词：优化、改进、提升、完善、处理、搞定
2. 模糊目标：让它更好、更快、更稳定、更优雅
3. 缺少WHY：只说做什么，不说为什么要做
4. 隐含假设：用户预设了解决方案但没说明原始问题
5. XY Problem
6. 症状伪装成原因
7. 局部视角遮蔽全局目标
8. 简单低风险任务
9. `[直出]` 任务
10. 信息完整且有验收标准的任务

实现要求：
1. 新增 `BENCHMARK.md`。
2. 每个 benchmark case 使用固定结构：
   - 原始指令
   - 预期路由
   - 触发规则
   - 预期输出类型
   - 是否应澄清
   - 验收点
   - 实际结果记录位
3. 不需要真的调用外部模型；用当前规则推演输出即可。
4. 如果发现规则会导致过度澄清，在 `BENCHMARK.md` 中记录为待调整项，不要在本会话大改核心规则。

验收：
- `BENCHMARK.md` 存在并包含10个 case。
- 10个 case 覆盖上述10类场景。
- 每个 case 都有"预期路由"和"是否应澄清"。
```

---

## 会话 15：P3-2 检查 skill 实际触发与输出质量

### 对应原路线图

P3 — 验证与打磨

11. 检查skill在Claude Code中的实际触发和输出质量

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P3-2：检查 `agent-skills/optimize-prompt` 的实际触发说明、References、输出质量是否与升级后的方法论一致。

必须检查：
- `agent-skills/optimize-prompt/SKILL.md`
- `agent-skills/optimize-prompt/references/*.md`
- `agent-skills/optimize-prompt/agents/openai.yaml`（如相关）
- `docs/usage/INSTALL.md`
- `docs/usage/USAGE.md`
- `README.md`

必须最大程度保留下面原始方案目标：

11. 检查skill在Claude Code中的实际触发和输出质量

重点检查：
1. `SKILL.md` description 是否仍能准确触发 optimize-prompt 场景。
2. References 是否包含新增：
   - `references/intent-probe.md`
   - `references/acceptance-checklist.md`
3. Process 是否包含：
   - Intent Probing
   - Zero-Tolerance Scoring
   - 三层智能路由
   - Zero-Compromise Transformation
   - Contract Verification
   - Confidence Annotation
4. Quality Bar 是否包含四条硬性门槛和回验四问。
5. 输出格式是否包含：
   - 优化后的 Prompt
   - 诊断
   - 路由决策日志
   - 契约回验
   - 改动记录（[原文]/[推断]/[假设]）

实现要求：
1. 优先修正 skill 内部文件不一致问题。
2. 如 README/USAGE 的说明已经落后，做最小必要更新。
3. 不要在本会话重新设计方法论，只做一致性检查和修补。

验收：
- `SKILL.md` References 中包含新增 reference。
- `SKILL.md` Quality Bar 包含四条硬性门槛和四个英文回验问题。
- skill references 与主模板/方法论没有明显矛盾。
```

---

## 会话 16：P3-3 严格度调参与最终一致性验收

### 对应原路线图

P3 — 验证与打磨

12. 根据实测结果调整规则的严格度（防止过度澄清骚扰用户）

### 任务 Prompt

```markdown
你正在处理 `C:\Users\FUTIAN\Desktop\prompt-optimizer` 项目。

请实现 P3-3：根据 `BENCHMARK.md` 和现有文件做最终一致性验收，必要时微调规则严格度，防止过度澄清骚扰用户。

必须最大程度保留下面原始方案内容：

## ⚠️ 一个重要的平衡提醒

严格性有代价：**过度澄清会让简单任务变得烦人**。设计上已通过以下方式对冲，实施时请保持：

1. 意图探查有明确的**跳过条件**（信息完整/低风险/[直出]）
2. 澄清永远**一次一问 + 推荐答案**，用户回"按推荐来"即可继续
3. 简单任务走基础优化，不套重型结构
4. [假设]≤2条时允许"先输出+标注待确认"，不强制中断

判断标准：**澄清的成本 < 猜错的返工成本时才澄清**。这条应作为总原则写入 `docs/core/METHODOLOGY.md` 开头。

最终总结也必须保持：

这次升级的本质：从"把话说清楚的工具"升级为"确认你真正想要什么的协议"。

三个不可妥协的支柱：
1. **先探意图，再谈优化** — 用户的第一句话是线索，不是需求
2. **补结构不补方向** — 缺的格式可以补，缺的决策必须问
3. **无验收，不交付** — 每份契约必须自带"怎么算做对了"

按 P0 → P1 → P2 → P3 顺序实施，每阶段完成后用真实指令回测，确保严格性提升的同时没有把简单任务变复杂。

执行步骤：
1. 阅读 `BENCHMARK.md`，找出"过度澄清"或"规则冲突"记录。
2. 搜索核心文件，确认跳过条件、一次一问、简单任务基础优化、[假设]≤2条允许继续都存在。
3. 必要时微调措辞，使严格性和低摩擦之间一致。
4. 输出最终验收报告，列出：
   - 已覆盖的 P0/P1/P2/P3 项
   - 仍有风险的项
   - 建议后续观察的 case

验收：
- `docs/core/METHODOLOGY.md` 开头或核心判断区域包含"澄清的成本 < 猜错的返工成本时才澄清"。
- 核心文件都保留 `[直出]` 跳过路径。
- 最终验收报告明确是否存在过度澄清风险。
```

---

## 推荐执行顺序

按原方案路线图顺序执行：

1. 会话 00：实施前基线确认与文件定位
2. 会话 01：P0-1 五维诊断替换为零容忍评分标准
3. 会话 02：P0-2 四条硬性门槛写入 Quality Bar
4. 会话 03：P0-3 R8 验证门升级与验收清单库
5. 会话 04：P1-1 意图探查协议写入核心文件
6. 会话 05：P1-2 意图-表达偏差检测器写入方法论和 System Prompt
7. 会话 06：P1-3 新增意图探查模板与意图偏差案例库
8. 会话 07：P2-1 共识快照协议写入 CLARIFY 流程
9. 会话 08：P2-2 契约回验四问写入输出流程
10. 会话 09：P2-3 置信度三级标注写入输出格式
11. 会话 10：阶段2 智能路由三层决策树重构
12. 会话 11：阶段3 转换规则 R1-R10 零妥协版全面升级
13. 会话 12：docs/core/TRANSFORM.md 输出模板与原则整合
14. 会话 13：examples/transformations.md 增补示例13和示例14
15. 会话 14：P3-1 建立 BENCHMARK.md 并用10个真实指令回测
16. 会话 15：P3-2 检查 skill 实际触发与输出质量
17. 会话 16：P3-3 严格度调参与最终一致性验收

---

## 每个会话的通用执行约束

复制任一会话任务给新 Codex 会话时，建议附加以下通用约束：

```markdown
通用约束：
1. 开始前先阅读本会话涉及的文件，不要凭空改。
2. 保留用户原始方案中的关键措辞，尤其是协议名、规则编号、禁止行为、硬性门槛。
3. 不要一次性实施其他会话的内容，除非目标文件需要最小衔接。
4. 如发现主文件与 skill reference/template 镜像内容重复，保持语义一致。
5. 修改后运行必要的搜索检查，确认关键词落地。
6. 不要删除已有示例、模板或说明，除非它们与新规则直接冲突。
7. 最终回答列出修改文件和验收结果。
```



