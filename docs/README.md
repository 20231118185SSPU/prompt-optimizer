# 文档索引

本目录集中存放项目文档。根目录只保留 `README.md` 和 `AGENTS.md` 作为入口与开发规范。

## 核心文档

- [METHODOLOGY.md](core/METHODOLOGY.md)：Agent 意图对齐方法论、诊断模型、转换规则和自检清单。
- [TRANSFORM.md](core/TRANSFORM.md)：可复制到其他 AI 工具中的 System Prompt。

## 使用文档

- [INSTALL.md](usage/INSTALL.md)：安装方式和不同 AI 工具的接入方式。
- [USAGE.md](usage/USAGE.md)：日常使用方式、路由模式和典型场景。

## 参考文档

- [REFERENCE-DIGEST.md](reference/REFERENCE-DIGEST.md)：外部参考内容的吸收、取舍和后续改进方向。

## 规划文档

- [BENCHMARK.md](planning/BENCHMARK.md)：P3 回测基准，记录 10 个真实指令的路由、澄清和验收推演。
- [prompt-optimizer-深度优化方案.md](planning/prompt-optimizer-深度优化方案.md)：深度升级方案原文。
- [prompt-optimizer-深度优化方案-会话任务拆解.md](planning/prompt-optimizer-深度优化方案-会话任务拆解.md)：按多会话执行拆解后的任务清单。

## 维护规则

- 新增开发文档必须放入 `docs/` 下对应分类目录。
- 新增模板、示例或 skill reference 后，按需更新本索引、根目录 `README.md` 和 `AGENTS.md`。
- 不要在根目录新增零散 Markdown 文档，除非它是项目入口或 AI 开发规范。
