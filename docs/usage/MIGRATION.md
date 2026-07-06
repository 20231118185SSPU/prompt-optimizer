# v2 → v3 迁移指南

> 如果你已经在使用 v2.0 的 Prompt Optimizer，本指南帮你迁移到 v3.0。

## 新旧能力对照

| 能力 | v2.0 | v3.0 |
| --- | --- | --- |
| 触发 | 用户显式 `优化：` | 宿主机制自动，每条指令必经 |
| 输出 | Agent Brief 文档 | 默认直接执行 + 微披露；文档仅显式请求/高风险时出现 |
| 项目规范 | 无 | `align-init` 生成 `.align/spec.md` |
| 项目记忆 | 模板（用户自选） | `.align/` 运行时，自动读、自动沉淀 |
| 覆盖阶段 | 指令输入这一个点 | 需求/设计/执行/验证/沉淀五门 |
| 内容维护 | 三组镜像手工同步 | `core/` SSOT + build 生成 `dist/` |
| 协议门槛 | 零容忍 Quality Bar | 原样继承，一条不弱化 |

## 什么变了

### 1. 触发方式：从"拉"到"推"

- **v2**：你必须说 `优化：` 才会触发对齐。最需要对齐的场景（随口一句"帮我改一下"）恰恰不会触发。
- **v3**：安装 skill + `/align-init` 接入项目后，每条开发指令自动经过三档路由。不需要说"优化："。

### 2. 输出方式：从"展示"到"执行"

- **v2**：输出一份完整 Agent Brief 文档，你看完还要再发给 agent 执行——这是"卡顿"的来源。
- **v3**：默认直接执行。简单任务零感知，有缺口时 1-3 行披露后直接干活，高风险时才停下问问题。完整文档只在显式请求或高风险时出现。

### 3. 项目状态：从"冷启动"到"持久化"

- **v2**：每次都是冷启动，没有项目规范和经验积累。
- **v3**：`/align-init` 生成 `.align/` 运行时（spec.md + context.md + lessons.md + decisions.log.md），随 git 提交，团队和所有 agent 共享。越用越懂项目。

### 4. 内容维护：从"手工同步"到"SSOT 构建"

- **v2**：METHODOLOGY.md、TRANSFORM.md、SKILL.md、templates/、references/ 多份镜像，全靠手工同步。
- **v3**：只改 `core/`，跑 `build/`，`dist/` 自动生成。禁止手改 `dist/`。

## 什么没变

- **零容忍门槛**：`D5=0 必补验收`、`总分<6 禁直出`、`[假设]>2 转澄清`、`高风险必探查`——原样继承，一条不弱化。
- **五维诊断**：D1-D5 评分标准和硬性门槛不变。
- **意图探查**：触发条件（高抽象动词/模糊目标/缺 WHY/隐含假设）和跳过条件不变。
- **三类偏差检测**：XY Problem、症状伪装成原因、局部视角遮蔽全局——不变。
- **转换规则 R1-R10**：不变。
- **契约回验四问**：不变。
- **显式前缀**：`[直出]`/`[访谈]`/`[Agent Brief]`/`[项目上下文]`/`优化：`——全部保留，作为对三档路由的强制覆盖。

## 迁移步骤

### 步骤 1：重新安装 skill

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.sh | bash

# Windows PowerShell
iwr https://raw.githubusercontent.com/20231118185SSPU/prompt-optimizer/main/scripts/install-skill.ps1 -UseB | iex
```

v3 安装三个 skill：`optimize-prompt`（升级版）、`align-init`（新增）和 `optimize-prompt-lite`（轻量协议，面向弱指令遵循模型）。

### 步骤 2：接入项目

进入每个使用本项目的项目目录，运行：

```text
/align-init
```

`align-init` 会扫描项目生成 `.align/` 运行时，并注入挂载区到 CLAUDE.md/AGENTS.md。

如果已有 CLAUDE.md/AGENTS.md，挂载区会追加到末尾，**不覆盖已有内容**。

### 步骤 3：习惯静默对齐

接入后直接开发即可。你会发现：

- 简单指令不再需要说"优化："——直接执行
- 模糊指令不再输出完整文档——1-3 行披露后直接执行
- 高风险指令仍然会拦截——这是设计如此

想看完整优化结果时，仍然可以使用：

```text
优化：你的原始想法
```

这会输出完整 Agent Brief 文档（v2.0 兼容行为）。

### 步骤 4：卸载旧版（可选）

如果你之前手动复制了 v2 的 `agent-skills/` 或 `templates/` 目录，可以删除它们——v3 的所有内容都在 `dist/` 中由 build 生成。

```bash
# 卸载 skill
bash scripts/install-skill.sh --uninstall

# 清除项目中的挂载区（手动删除 CLAUDE.md 中标记区间）
# 清除 .align/ 目录（如不需要保留项目规范）
rm -rf .align/
```

## 常见问题

### Q: v3 会弱化安全性吗？

不会。v3 的 C 档（浮出澄清）完整保留了 v2 的所有硬性门槛。高风险静默假设 = 输出无效，必须重做。18 case 全量回测 18/18 通过，安全性不因静默化而下降。见 [BENCHMARK-V3.md](../planning/BENCHMARK-V3.md)。

### Q: 不说"优化："还会对齐吗？

会。v3 的核心设计就是对齐在后台静默发生。安装 skill + `/align-init` 接入后，每条指令自动经过三档路由。A 档零感知，B 档微披露，C 档拦截。

### Q: .align/ 会膨胀吗？

不会。`.align/` 有严格的大小纪律：spec ≤150 行、context ≤100 行、lessons 每条 ≤2 行超 50 条归档、decisions 超 100 条归档。见 [core/protocol/07-precipitation.md](../../core/protocol/07-precipitation.md)。

### Q: v2 的模板还能用吗？

能。v2 的 10 个模板（AGENT-BRIEF、CLARIFY、CODE 等）全部保留在 `core/templates/`，由 build 复制到 `dist/*/references/`。显式模式仍输出完整 Agent Brief。
