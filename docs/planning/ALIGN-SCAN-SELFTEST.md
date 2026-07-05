# ALIGN-SCAN 自举测试报告

> P2-2 自举测试：对 `prompt-optimizer` 项目自身执行 `scan.md` 扫描协议，验证扫描协议能生成合理的 `.align/spec.md` 草案。
> 本报告不创建实际 `.align/` 目录（P4-3 自举任务才做），只验证扫描协议的可用性。

---

## 扫描结果

### 1. 技术栈识别

| 扫描对象 | 结果 | 置信度 |
| --- | --- | --- |
| `package.json` | 不存在 | — |
| `pyproject.toml` | 不存在 | — |
| `go.mod` | 不存在 | — |
| `Cargo.toml` | 不存在 | — |
| 文件扩展名 | `.md`、`.sh`、`.ps1`、`.yaml` | `[推断]` |
| `.gitignore` | 只有 `.codex/` | `[推断]` |

**推断结果**：本项目是文档/Skill 项目，零运行时依赖，使用 Bash/PowerShell 构建脚本。

**置信度**：`[假设]`（无标准包管理文件，需确认）

**澄清问题**：本项目的技术栈是什么？
**推荐答案**：文档/Skill 项目，零运行时依赖，构建只用 PowerShell/Bash。

### 2. 测试命令识别

| 扫描对象 | 结果 | 置信度 |
| --- | --- | --- |
| `package.json scripts.test` | 不存在 | — |
| `Makefile` | 不存在 | — |
| `.github/workflows/` | 不存在 | — |
| 目录中存在 `test/` | 不存在 | — |

**推断结果**：无测试框架。验证方式为脚本语法检查 + 构建幂等验证。

**置信度**：`[假设]`（无测试配置，需确认验证命令）

**澄清问题**：本项目的验证命令是什么？
**推荐答案**：`bash -n build/build.sh` + `bash -n scripts/install-skill.sh` + `bash build/build.sh`（幂等验证）。

### 3. Lint 配置识别

| 扫描对象 | 结果 | 置信度 |
| --- | --- | --- |
| `.eslintrc.*` | 不存在 | — |
| `.prettierrc` | 不存在 | — |
| `.pylintrc` | 不存在 | — |

**推断结果**：无 lint 配置。

**置信度**：`[原文]`（配置文件不存在是事实）

**spec.md 标注**：无 lint 配置。

### 4. Git 提交风格识别

扫描最近 5 条 git log：

```text
05b55ce Upgrade prompt optimizer alignment protocol
7a60992 feat: add intelligent mode routing
da7f027 docs: simplify skill installation and usage
3473192 feat: package optimize prompt as universal agent skill
4e76da0 docs: add installation and usage guides
```

**推断结果**：部分使用 Conventional Commits（5 条中 4 条符合 `type: description` 格式，1 条不符合）。

**置信度**：`[推断]`（从 git log 合理推断）

**推荐规范**：Conventional Commits（`type: description`），type 必须：feat | fix | docs | refactor | chore。

### 5. 目录结构识别

```text
build/    # 构建脚本
core/     # SSOT 唯一事实来源（protocol/ + templates/ + spec-kit/）
dist/     # 构建产物（禁止手改）
docs/     # 文档（usage/ + reference/ + planning/）
examples/ # 示例
scripts/  # 安装脚本
```

**推断结果**：SSOT 架构，core/ 是唯一内容来源，dist/ 由 build/ 生成。

**置信度**：`[推断]`（从目录结构合理推断）

### 6. 现有规则文件识别

| 扫描对象 | 结果 | 置信度 |
| --- | --- | --- |
| `AGENTS.md` | 存在，含完整 SSOT 开发规范 | `[原文]` |
| `README.md` | 存在，含项目结构和快速开始 | `[原文]` |
| `CLAUDE.md` | 不存在 | — |
| `CONTRIBUTING.md` | 不存在 | — |
| `.cursorrules` | 不存在 | — |

**提取结果**：AGENTS.md 已定义完整的 SSOT 工作流、协议内核规范、模板规范、安装脚本规范、Markdown 写作规范。

---

## 置信度汇总

| 规范条目 | 置信度 | 是否需澄清 |
| --- | --- | --- |
| 技术栈：文档/Skill 项目，零运行时依赖 | `[假设]` | 是 |
| 测试命令：`bash -n` + 构建幂等 | `[假设]` | 是 |
| Lint：无配置 | `[原文]` | 否 |
| Git 提交：Conventional Commits | `[推断]` | 否 |
| 目录结构：SSOT 架构 | `[推断]` | 否 |
| 现有规则：AGENTS.md SSOT 工作流 | `[原文]` | 否 |

`[假设]` 项：2 个。需要澄清 2 个问题（≤3 问），符合扫描协议预期。

---

## 生成的 .align/spec.md 草案

以下是根据扫描结果和澄清回答生成的 spec.md 草案：

```markdown
# 项目开发规范

## 技术栈与版本
- 项目类型：文档/Skill 项目 [假设]
- 运行时依赖：零依赖 [假设]
- 构建工具：Bash（build/build.sh）+ PowerShell（build/build.ps1） [原文]
- 无传统语言/框架

## 目录约定
- core/：SSOT 唯一事实来源，只在这里改内容 [推断]
- build/：构建脚本 [推断]
- dist/：构建产物，禁止手改 [原文]
- docs/：文档（usage/ + reference/ + planning/） [推断]
- examples/：示例 [推断]
- scripts/：安装脚本 [推断]

## 分支与提交规范
- 提交格式：type: description [推断]
- type 必须：feat | fix | docs | refactor | chore [推断]
- 禁止自动 commit 和 push [原文]

## 测试与验证命令
- 脚本语法检查：`bash -n build/build.sh` [假设]
- 安装脚本语法检查：`bash -n scripts/install-skill.sh` [假设]
- 构建幂等验证：`bash build/build.sh`（连续两次无 diff） [假设]

## 代码风格
- 无 lint 配置 [原文]
- Markdown 写作规范见 AGENTS.md §7 [原文]

## 评审与合并规则
- 禁止直接 push 到 main [原文]
- 修改前必须阅读 AGENTS.md [原文]

## 高风险操作清单
- 手工编辑 dist/ 下任何文件 [原文]
- 删除 core/ 下的协议文件或模板 [原文]
- 弱化"必须/禁止/输出无效，必须重做"为"建议/尽量" [原文]
- 引入新运行时依赖 [原文]
- 修改 build 脚本但不验证幂等性 [原文]
```

---

## 自举测试结论

**扫描协议可用性**：✅ 通过

1. `scan.md` 的 6 个扫描对象覆盖了项目所有可识别的规范来源。
2. 置信度标注正确：2 个 `[假设]`、3 个 `[推断]`、多个 `[原文]`。
3. 澄清问题数 ≤3（实际 2 个），符合"通常 ≤3 问"的协议要求。
4. 生成的 spec.md 草案结构完整，7 个章节都有内容，每条规范可验证。
5. AGENTS.md 中的现有规则被正确提取为 `[原文]`。

**与 spec-sections/ 的匹配**：
- 技术栈：不匹配任何预设（文档/Skill 项目是特殊类型），使用自定义条目。
- 目录结构：不匹配标准预设，使用 SSOT 架构自定义条目。
- 分支提交：最接近预设 B（简化提交）。
- 测试验证：不匹配标准预设（无标准测试框架），使用语法检查+幂等验证。
- 代码风格：不匹配标准预设（无 lint），使用 AGENTS.md 的 Markdown 规范。
- 评审合并：最接近预设 C（单人项目）。
- 高风险清单：使用自定义条目（来自 AGENTS.md 的禁止行为）。

**结论**：扫描协议能处理非标准项目（文档/Skill 项目），但 `spec-sections/` 的预设主要面向代码项目。对于文档项目，`align-init` 应支持从 AGENTS.md 提取自定义条目，而不是强制选择预设。
