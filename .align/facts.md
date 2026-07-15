# 项目事实

> 稳定、可复用、当前可接受为真的项目属性。每项包含可定位来源。

## Facts

- 产品定位：Prompt Optimizer 是 Agent 意图对齐器，把自然语言请求转换为可执行、可验证、可追溯的 Alignment Decision；不是 prompt 文案润色器。
  source: README.md#Prompt-Optimizer--Agent-意图对齐器
- 当前发布版本：`v3.2.0-rc.1`。
  source: README.md#项目介绍
- Skill 入口：`optimize-prompt`、`align-init`、`optimize-prompt-lite` 三个 skill。
  source: README.md#项目介绍
- Runtime：Node.js `>=18` 是可选结构化运行时；无 Node 环境保留 shell fallback。
  source: core/host/pipeline/package.json#engines; README.md#项目介绍
- 构建链：`core/` 是内容 SSOT，`build/` 生成 `dist/`，安装器从 `dist/` 分发宿主产物。
  source: README.md#工作方式
- 构建入口：Bash 使用 `build/build.sh`，Windows PowerShell 使用 `build/build.ps1`。
  source: AGENTS.md#目录职责
- 机器路由：Alignment Decision 的 route 固定为 `pass`、`enrich`、`clarify`、`block`；A/B/C 只用于展示。
  source: README.md#三档路由v3-核心设计
- 项目上下文：`.align/` 将 facts、glossary、rules、lessons、decisions 和 state 按生命周期分开。
  source: README.md#项目介绍
- 许可证：MIT。
  source: LICENSE
