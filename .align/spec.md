# 项目开发规范

> 由 align-init 自举生成。基于 prompt-optimizer 项目自身扫描结果。
> 大小纪律：≤150 行。

## 技术栈与版本

- 项目类型：文档/Skill 项目 [原文]（2026-07-06 实测确认：无语言运行时，纯 markdown+shell）
- 运行时依赖：零依赖 [原文]（2026-07-06 实测确认：构建与安装只用 bash/PowerShell；python3 仅安装器 JSON 合并用，缺失时降级为手动提示）
- 构建工具：Bash（build/build.sh）+ PowerShell（build/build.ps1） [原文]
- 无传统语言/框架

## 目录约定

- `core/`：SSOT 唯一事实来源，只在这里改内容 [推断]
- `core/protocol/`：协议内核 00-07 [推断]
- `core/templates/`：14 个模板（含 4 个 ALIGN 模板） [推断]
- `core/spec-kit/`：规范生成器素材库 [推断]
- `core/skills/align-init/`：align-init skill 源文件 [推断]
- `core/host/`：宿主适配源文件（挂载区/hook/reminder） [推断]
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
- 引入新运行时依赖 [原文]
- 修改 build 脚本但不验证幂等性 [原文]
- 跳过 hooks（--no-verify） [原文]
