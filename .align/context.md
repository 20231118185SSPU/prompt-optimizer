# 项目上下文契约

> 由 align-init 自举生成。基于 prompt-optimizer 项目自身扫描结果。
> 大小纪律：≤100 行。

## 项目目标与当前阶段

- 项目目标：为 AI agent 提供可注入任意项目的对齐运行时，解决 agent 误解用户意图的问题 [原文]
- 当前阶段：v3.1 已发布（hook 接线修复 + VAGUE 扩展 + 人话输出 + 轻协议 optimize-prompt-lite） [原文]
- 下一个里程碑：v3.2 规划（待定） [假设]

## 共享术语

- 意图对齐：把用户的粗糙想法转换成 AI agent 可执行、可验证、可沉淀的任务契约 [原文]
- Agent Brief：面向 agent 的最终输出，包含目标、背景、范围、交付物、约束、执行策略、验收 [原文]
- 五维诊断：精确性、约束性、结构性、上下文、验证性 [原文]
- 三档路由：A 档直通 / B 档静默对齐 / C 档浮出澄清 [原文]
- .align/：项目运行时目录，含 spec.md + context.md + lessons.md + decisions.log.md [原文]
- SSOT：Single Source of Truth，core/ 是唯一事实来源，dist/ 由 build 生成 [原文]

## 架构关键决策

- SSOT 架构：core/ → build/ → dist/
  原因：消灭镜像手工同步，所有内容只改 core/，跑 build 生成 dist/ [原文]
  影响：禁止手改 dist/，修改协议后必须跑 build [原文]

- 零运行时依赖：构建与安装只用 PowerShell/Bash
  原因：保持项目零依赖特性 [原文]
  影响：不引入 Node/Python 等运行时 [原文]

- 三档路由：A/B/C 档静默化
  原因：解决 v2.0"触发是拉不是推"和"输出是展示不是执行"的局限 [原文]
  影响：默认静默执行，不展示完整 Agent Brief [原文]

- .align/ 运行时：项目规范+上下文+经验+决策
  原因：解决 v2.0"无项目态每次冷启动"的局限 [原文]
  影响：接入项目后自动读取，执行后自动沉淀 [原文]
