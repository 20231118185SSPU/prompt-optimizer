# 项目开发规范

> 由 align-init 自举生成。基于 prompt-optimizer 项目自身扫描结果。
> 大小纪律：≤150 行。

## 技术栈与版本

- 项目类型：文档/Skill + 可选 TypeScript runtime [原文]
- 运行时依赖：Node.js 可选；完整结构化 runtime 使用 Node.js，无 Node 环境必须保留 shell fallback [原文]
- 构建工具：Bash（build/build.sh）+ PowerShell（build/build.ps1） [原文]
- 契约测试工具：Ajv 8，仅作为 TypeScript 包 devDependency 验证 JSON Schema，不进入 runtime 或 shell fallback [原文]
- 能力边界：shell fallback 必须与 Node runtime 保持最小 Alignment Decision 投影一致，能力降级必须显式披露 [原文]

## 目录约定

- `core/`：SSOT 唯一事实来源，只在这里改内容 [推断]
- `core/protocol/`：协议内核 00-07 [推断]
- `core/templates/`：17 个模板（含 7 个 ALIGN 模板） [原文]
- `core/spec-kit/`：规范生成器素材库 [推断]
- `core/skills/`：optimize-prompt、align-init、optimize-prompt-lite 三个 skill 的源文件 [原文]
- `core/host/`：TypeScript runtime、CLI、hook、router 和宿主 adapter 源文件 [原文]
- `build/`：构建脚本 [推断]
- `dist/`：构建产物，禁止手改 [原文]
- `docs/`：文档（usage/ + reference/ + planning/） [推断]
- `examples/`：示例 [推断]
- `scripts/`：安装脚本 [推断]
- `tests/`：卸载零损伤测试 fixture [推断]

## 分支与提交规范

- 提交格式：type: description [推断]
- type 必须：feat | fix | docs | refactor | chore [推断]
- 禁止自动 commit 和 push [原文]
- 禁止使用 git reset --hard 或 git checkout -- [原文]

## 测试与验证命令

- 一键验证：`bash .align/align-check.sh`（跑 .align/check-commands.txt 全部命令 + 债务扫描） [原文]
- 脚本语法检查：`bash -n build/build.sh` [原文]（2026-07-06 实测通过，假设升级）
- 安装脚本语法检查：`bash -n scripts/install-skill.sh` [原文]（2026-07-06 实测通过，假设升级）
- 构建幂等验证：`bash build/build.sh`（连续两次无 diff） [原文]（2026-07-06 实测通过，假设升级）
- 卸载零损伤测试：`bash tests/verify-uninstall.sh` [原文]
- 路由语料回归：`bash tests/verify-router.sh` [原文]
- 安装器接线测试：`bash tests/verify-installer-wiring.sh` [原文]

## 代码风格

- 无 lint 配置 [原文]
- Markdown 写作规范见 AGENTS.md §7 [原文]
- 默认使用中文，保留必要英文术语 [原文]

## 评审与合并规则

- 禁止直接 push 到 main [原文]
- 修改前必须阅读 AGENTS.md [原文]
- 不要自动 commit，除非用户明确要求 [原文]

## 高风险操作清单

- 手工编辑 dist/ 下任何文件 [原文]
- 删除 core/ 下的协议文件或模板 [原文]
- 弱化"必须/禁止/输出无效，必须重做"为"建议/尽量" [原文]
- 新增 Node.js 以外的运行时依赖，或取消 shell fallback [原文]
- 修改 build 脚本但不验证幂等性 [原文]
- 跳过 hooks（--no-verify） [原文]
