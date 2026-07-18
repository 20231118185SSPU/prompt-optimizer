# Prompt Optimizer / Agent 意图对齐器 v4

> 在 coding agent 动手前，判断当前请求是否具备可执行契约；不具备时阻止错误执行，并给出最小、可继续的下一步。

这个项目不是 prompt 文案润色器。它解决的是 AI agent 执行前的契约缺口：目标是否明确、范围是否受控、风险是否获得授权、验收是否可判定。

**v4 关键改进**：
- 路由器准确率大幅提升：高风险漏放率 0%，完整请求误拦截率 0%
- XY Problem 检测率 100%
- 新增数据泄露检测、方向性描述识别、eval/动态执行检测
- 所有核心指标通过 fresh corpus v2 验证

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

默认安装到 Claude Code、Codex 和 `~/.agents` 三个 skills 目录，并自动接线 Claude Code hook。

### 2. 接入项目

进入你的项目目录，运行：

```text
/align-init
```

接入后检查接线状态：

```bash
bash "$HOME/.prompt-optimizer/bin/align-doctor" --json "$PWD"
```

`doctor` 会报告 runtime、hook、项目 router 和 verification chain 是否就绪。

### 3. 正常干活

接入后直接开发。对齐在后台静默发生，你不需要说"优化："：

- 简单指令（如"改个变量名"）→ **直接执行**，零感知
- 有缺口的指令（如"加个搜索功能"）→ **最多 3 行补全回执后直接执行**
- 高风险且信息不足（如只说"清空数据库"）→ **停下问一个问题**

想看完整优化结果时：`优化：帮我做一个用户登录功能`

详见 [INSTALL.md](docs/usage/INSTALL.md) 和 [USAGE.md](docs/usage/USAGE.md)。

## 产品定位

Prompt Optimizer v4 只专精一个问题：

> 在 coding agent 动手前，判断当前请求是否具备可执行契约；不具备时阻止错误执行，并给出最小、可继续的下一步。

完整行为只有四种：

| 行为 | 条件 | 用户感知 |
| --- | --- | --- |
| `pass` | 目标明确、低风险、可验证 | 零感知，直接执行 |
| `enrich` | 缺口可由可信项目上下文补全 | 展示补全回执后执行 |
| `clarify` | 目标、范围或验收缺失 | 停下，一次只问一个问题 |
| `block` | 契约完整但授权/政策禁止执行 | 停下，说明阻断原因 |

### v4 路由器能力

- **高风险检测**：识别数据泄露、权限滥用、生产环境操作等高风险请求
- **XY Problem 检测**：识别用户提出错误解决方案的场景
- **模糊请求识别**：检测"优化"、"重构"、"更安全"等模糊描述
- **完整请求保护**：确保有具体文件、值和变更的请求不被误拦截
- **方向性描述检测**：识别"更安全"、"更稳定"等方向性描述需要澄清

### 适用场景

#### 场景一：模糊请求 → 澄清访谈

**用户说**："帮我优化这个系统"

**路由器判断**：`clarify`（方向性描述，需要澄清）

**AI 行为**：停下，问一个最高价值问题：
> "优化目标是什么？性能、代码质量、还是架构？"

#### 场景二：高风险请求 → 阻断确认

**用户说**："清空生产环境的数据库"

**路由器判断**：`block`（高风险操作，需要授权）

**AI 行为**：停下，说明阻断原因：
> "这是生产环境的数据删除操作，需要明确授权。请确认：1) 是否有备份？2) 是否有回滚计划？"

#### 场景三：完整请求 → 直接执行

**用户说**："把 README.md 里的版本号从 3.1.0 改成 3.2.0"

**路由器判断**：`pass`（目标明确、低风险、可验证）

**AI 行为**：直接执行，零感知

#### 场景四：可丰富请求 → 补全后执行

**用户说**："给这个项目加个 CI 配置"

**路由器判断**：`enrich`（缺口可从项目上下文补全）

**AI 行为**：展示补全回执后执行：
> "检测到项目使用 GitHub Actions，已自动生成 CI 配置。"

#### 场景五：XY Problem → 澄清真实需求

**用户说**："我想用 eval 来动态执行用户输入的代码"

**路由器判断**：`clarify`（XY Problem，用户提出错误方案）

**AI 行为**：停下，澄清真实需求：
> "您需要的是配置系统还是插件系统？eval 有安全风险，我们可以用更安全的方式实现。"

### 更多使用案例

| 你的原始想法 | 本项目输出 |
| --- | --- |
| "帮我优化这个项目" | 明确目标、范围、约束、验收标准和执行阶段的 Agent Brief |
| "帮我做个功能" | 带上下文读取、方案选择、最小变更、测试门的开发任务 |
| "我还没想清楚" | 一次只问一个关键问题的澄清访谈 |
| "以后让 AI 都按这个项目规则来" | 可持久化的项目上下文和规则文件 |
| "AI 老是理解偏" | 显性化用户意图、隐性约束、反面约束和成功标准 |
| "把错误日志发送到外网服务器" | 阻断：数据泄露风险，需要明确授权 |
| "我想把所有的错误都吞掉不报错" | 澄清：为什么需要隐藏错误？真实问题是什么？ |
| "帮我加个认证功能" | 澄清：认证方式？JWT/OAuth/Session？ |
| "把 src/config.ts 里的超时时间从 3000 改成 5000" | 直接执行：目标明确，低风险 |

### 参考宿主

Claude Code 是 v4 的 reference host，具备完整的 ingress、enforcement 和 evidence 闭环。Codex 作为第二个薄 Adapter 消费同一 Alignment Decision。详见 [支持矩阵](#支持矩阵)。

## 项目结构

`core/` 是协议、模板、契约和宿主适配的唯一事实来源。`build/` 将其生成到 `dist/`，安装器再按宿主安装 skills、runtime、doctor 和 adapter；`dist/` 禁止手工编辑。

```text
prompt-optimizer/
├── core/                          # ★ 唯一事实来源（SSOT）
│   ├── protocol/                  # 协议内核 00-07
│   ├── contracts/                 # 公共机器契约、reason registry 与 golden corpus
│   ├── templates/                 # 17 个模板（含 7 个 ALIGN 模板）
│   ├── skills/                    # 三个 skill 的源文件
│   ├── host/                      # TypeScript runtime、doctor 与宿主 adapter
│   ├── distribution/              # runtime 安装计划与所有权标记
│   └── spec-kit/                  # 规范生成器素材库
├── build/                         # 构建脚本（build.sh + build.ps1）
├── dist/                          # 构建产物（禁止手改）
├── docs/                          # 文档（usage/reference/planning）
├── scripts/                       # 安装脚本
├── tests/                         # 契约、路由、分发、安装与评测回归
└── examples/
```

## 支持矩阵

| 宿主 | prompt ingress | 机械阻断 | completion | 显式调用 | 证据等级 |
| --- | --- | --- | --- | --- | --- |
| Claude Code | enforced | enforced | self_reported | supported | E3（沙箱集成） |
| Codex CLI | advisory | advisory | unavailable | supported | E3（沙箱集成） |
| Cursor | project-rule | unavailable | unavailable | supported | E2（确定性 corpus） |
| Universal System Prompt | copy-paste | unavailable | unavailable | supported | E2（确定性 corpus） |
| 其他宿主 | 取决于宿主 | 取决于宿主 | 取决于宿主 | supported | 无宿主专属证据 |

**证据等级说明**：
- **E2**：确定性 corpus（构建、内容门、跨平台 parity）
- **E3**：沙箱集成（安装/卸载沙箱、synthetic adapter integration）
- **E4**：真实宿主端到端（真实 Claude Code 会话）
- **E5**：真实模型对照 benchmark

**v4 证据**：
- Fresh corpus v2：40 条自然请求，6 个类别，所有核心指标达标
- Independent blind review：12 条 clarify 请求全部正确识别，命中率 100%
- 路由器修复：高风险漏放率 0%，完整请求误拦截率 0%，XY Problem 检测 100%

**能力说明**：
- **prompt ingress**：宿主是否支持拦截用户请求并注入 alignment context
- **机械阻断**：宿主是否支持在执行前强制阻断（如 hook exit code）
- **completion**：宿主是否支持在执行完成后回报结果
- **显式调用**：不依赖 hook 的显式 skill 调用路径（所有宿主均支持）

### 兼容性说明

- **/align**：统一 router，所有请求消费同一个 Decision Kernel。`/align setup` 为首次接入入口。
- **optimize-prompt**：已收敛为 `/align` 的内部 full alignment profile。触发名称在兼容期内保持不变。
- **align-init**：已收敛为 `/align setup` 的内部 setup profile。触发名称在兼容期内保持不变。
- **optimize-prompt-lite**：已收敛为 `/align` 的内部 fallback profile。触发名称在兼容期内保持不变。

四个 skill 的触发名称在兼容期内保持不变。安装器和卸载器同时识别新旧名称。

## 深度参考

以下内容面向需要理解协议机制、路由决策和工程实现的用户：

- **核心方法**：五维诊断（精确性、约束性、结构性、上下文、验证性）+ Agent 对齐协议 + 自主思维循环，见 [core/protocol/](core/protocol/)（协议内核 00-07）
- **三档路由机制**：A 档直通（`pass`）、B 档静默对齐（`enrich`）、C 档浮出（`clarify`/`block`），对齐的存在感与任务风险成正比
- **v3 候选版能力详情**：机器契约、运行时路由、上下文治理、按需协议加载、可选生态 handoff、证据与分发，见 [USAGE.md](docs/usage/USAGE.md)
- **评测与证据边界**：56 条确定性行为集、runner 集成矩阵、构建幂等、安装/卸载沙箱，见 [G5 评测报告](docs/planning/MULTI-AGENT-G5-EVALUATION-REPORT.md)

## 文档导航

全部开发、使用、参考和规划文档集中在 [docs/](docs/README.md)：

- [使用文档](docs/README.md#使用文档)：安装与日常使用
- [参考文档](docs/README.md#参考文档)：外部参考取舍
- [规划文档](docs/README.md#规划文档)：深度优化方案和会话任务拆解
- [v4 专精化执行方案](docs/planning/V4-FOCUS-IMPROVEMENT-PLAN.md)：执行前契约门定位、核心不变量、架构收敛、W0-W7 波次和量化 Gate
- [v4 发布证据](docs/planning/evidence/w7/)：fresh corpus v2、blind review、路由器修复证据
- [v3.2 稳定版执行方案](docs/planning/V3.2-STABLE-IMPROVEMENT-PLAN.md)：单一路由、评测可靠性、远程 evidence 和发布 Gate
- [G0-G6 改进规划](docs/planning/MULTI-AGENT-IMPROVEMENT-PLAN.md)：本次 Alignment Decision runtime 大更新的分波次执行契约
- [G5 评测报告](docs/planning/MULTI-AGENT-G5-EVALUATION-REPORT.md)：确定性语料、盲评、修复回归与证据边界
- [G6 handoff 报告](docs/planning/MULTI-AGENT-G6-MATT-HANDOFF.md)：Matt Pocock Skills envelope、映射与关闭证据

## 参考内容取舍

本项目参考了 AI 自主思维模型、AI 编程开发规则手册和 `mattpocock/skills`。具体吸收了什么、没有照搬什么、为什么这样取舍，见 [REFERENCE-DIGEST.md](docs/reference/REFERENCE-DIGEST.md)。与 OpenSpec、Superpowers、ECC、Matt Pocock Skills 的定位和机制对比见 [ECOSYSTEM-COMPARISON.md](docs/reference/ECOSYSTEM-COMPARISON.md)。

## 设计原则

1. **先对齐，再执行**：复杂任务先确认理解和边界，不急着输出。
2. **把隐含意图显性化**：用户没说出口但影响结果的信息，要被挖出来。
3. **一问一答澄清**：需要追问时一次只问一个最高价值问题。
4. **最小必要补全**：补齐缺口，不替用户改目标。
5. **任务即契约**：优化后的 prompt 必须包含交付物、范围、约束和验收。
6. **反思和沉淀**：复杂任务结束后，要求 agent 记录项目模式、风险和复用规则。

## 常见问题

### Q: 这个项目和普通的 prompt 优化有什么区别？

A: 普通的 prompt 优化是"文案润色"，本项目是"意图对齐"。它不是让你的 prompt 写得更好看，而是确保 AI agent 在执行前理解你的真实意图，并且具备可执行的契约。

### Q: 路由器会误判吗？

A: 路由器经过严格测试，所有核心指标达标：
- 高风险漏放率 0%（不会漏掉危险操作）
- 完整请求误拦截率 0%（不会误拦你的明确指令）
- XY Problem 检测 100%（能识别你提出错误方案的场景）

### Q: 我需要每次都手动触发吗？

A: 不需要。接入项目后，对齐在后台静默发生。简单指令直接执行，有缺口的指令自动补全，只有高风险或模糊请求才会停下问你。

### Q: 支持哪些 AI 工具？

A: 目前支持：
- **Claude Code**（完整支持，包括 hook 拦截）
- **Codex CLI**（建议模式）
- **Cursor**（项目规则模式）
- **其他工具**（通过复制 System Prompt）

### Q: 如何查看路由器的判断结果？

A: 运行以下命令查看：
```bash
bash "$HOME/.prompt-optimizer/bin/align-doctor" --json "$PWD"
```

### Q: 路由器会收集我的数据吗？

A: 不会。路由器完全在本地运行，不收集任何用户数据。所有判断都在你的机器上完成。

## 贡献指南

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与项目开发。

### 开发环境

1. 克隆仓库
2. 安装依赖：`cd core/host/pipeline && npm install`
3. 运行测试：`npm test`
4. 构建项目：`powershell -File build/build.ps1`（Windows）或 `bash build/build.sh`（macOS/Linux）

### 提交规范

- 使用中文提交信息
- 格式：`类型: 描述`
- 类型：feat/fix/docs/chore/test/refactor

## 项目统计

### v4.0.0 核心指标

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 高风险漏放率 | 0% | 0% | ✅ |
| 完整请求误拦截率 | ≤10% | 0% | ✅ |
| 最高价值问题命中率 | ≥80% | 100% | ✅ |
| XY Problem 检测 | ≥90% | 100% | ✅ |
| enrichable-context | ≥90% | 100% | ✅ |
| complete-low-risk | ≥90% | 100% | ✅ |
| direction-missing | ≥90% | 100% | ✅ |
| high-risk-authorization | ≥90% | 100% | ✅ |

### 测试覆盖

- **TypeScript 测试**：26 suites, 371 tests
- **Fresh corpus v2**：40 条自然请求
- **Independent blind review**：12 条 clarify 请求
- **Frozen behavior cases**：56 条确定性行为

### 代码统计

- **协议内核**：8 个文件（00-07）
- **模板**：17 个（含 7 个 ALIGN 模板）
- **Skill**：3 个（optimize-prompt、align-init、optimize-prompt-lite）
- **宿主适配**：4 个（Claude Code、Codex、Cursor、Universal）

## License

[MIT](LICENSE)。安全问题请按 [SECURITY.md](SECURITY.md) 私密报告。
