# 文档索引

本目录集中存放项目文档。根目录只保留 `README.md` 和 `AGENTS.md` 作为入口与开发规范。

协议内核和模板已移至 `core/`（SSOT），构建产物在 `dist/`（由 `build/` 生成，禁止手改）。

## 核心来源

- [`core/protocol/`](../core/protocol/)：协议内核 00-07（定位、意图探查、诊断、路由、转换规则、契约回验、生命周期门、沉淀）。
- [`core/templates/`](../core/templates/)：14 个模板（含 4 个 ALIGN 模板，唯一来源）。
- [`dist/universal/SYSTEM-PROMPT.md`](../dist/universal/SYSTEM-PROMPT.md)：可复制到其他 AI 工具中的 System Prompt（构建产物）。

## 使用文档

- [INSTALL.md](usage/INSTALL.md)：安装方式、预览、版本、卸载和升级。
- [USAGE.md](usage/USAGE.md)：v3.0 日常使用——接入项目、三档路由、显式模式、.align/ 运行时、五门。
- [MIGRATION.md](usage/MIGRATION.md)：v2 用户迁移指南——新旧能力对照、迁移步骤、常见问题。

## 参考文档

- [REFERENCE-DIGEST.md](reference/REFERENCE-DIGEST.md)：外部参考内容的吸收、取舍和后续改进方向。

## 规划文档

- [BENCHMARK.md](planning/BENCHMARK.md)：P3 回测基准，记录 10 个真实指令的路由、澄清和验收推演。含 P0 SSOT 重构后回归验证报告（10/10 一致）。
- [BENCHMARK-V3.md](planning/BENCHMARK-V3.md)：v3.0 全量回测报告，18 case（10 v2 + 8 v3）逐个推演，三个卡顿指标逐项验收，18/18 通过。
- [BENCHMARK-V3-DRAFT.md](planning/BENCHMARK-V3-DRAFT.md)：历史草案，仅保留 P1-4 的 8 个新增 case 设计背景；完成态以 `BENCHMARK-V3.md` 为准。
- [ALIGN-SCAN-SELFTEST.md](planning/ALIGN-SCAN-SELFTEST.md)：P2-2 自举测试报告，对 prompt-optimizer 项目自身执行扫描协议，验证 spec-kit 可用性。
- [prompt-optimizer-深度优化方案.md](planning/prompt-optimizer-深度优化方案.md)：深度升级方案原文。
- [prompt-optimizer-深度优化方案-会话任务拆解.md](planning/prompt-optimizer-深度优化方案-会话任务拆解.md)：按多会话执行拆解后的任务清单。
- [prompt-optimizer-架构重设计与完整执行方案.md](planning/prompt-optimizer-架构重设计与完整执行方案.md)：v3.0 架构重设计、Alignment Runtime 和完整执行方案。
- [prompt-optimizer-架构重设计与完整执行方案-会话任务拆解.md](planning/prompt-optimizer-架构重设计与完整执行方案-会话任务拆解.md)：v3.0 架构方案按多会话执行拆解后的任务清单。

## 维护规则

- 新增开发文档必须放入 `docs/` 下对应分类目录。
- 协议内容只在 `core/` 修改，修改后跑 `build/` 重新生成 `dist/`，禁止手改 `dist/`。
- 新增模板后，在 `build/` 脚本的 `TemplateMap` 中注册映射，再跑 build。
- 不要在根目录新增零散 Markdown 文档，除非它是项目入口或 AI 开发规范。
