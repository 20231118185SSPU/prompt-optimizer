# 存量项目扫描协议

> 本文件是 `align-init` skill 扫描存量项目时的执行协议。
> 目标：3 分钟内完成接入，生成 `.align/` 四件套 + 注入挂载区。

## 扫描流程

```text
/align-init
→ 扫描：package.json/pyproject/go.mod（技术栈）、现有测试命令、
        lint 配置、git log 风格、目录结构、已有 README/CLAUDE.md
→ 推断出规范草案，每条标注置信度 [原文]/[推断]/[假设]
→ 只对 [假设] 项发起澄清（一次一问，通常 ≤3 问）
→ 生成 .align/ 四件套 + 注入挂载区
耗时目标：3 分钟内完成接入
```

---

## 扫描对象

### 1. 技术栈识别

扫描以下文件，识别项目使用的语言、框架、运行时和包管理器：

| 文件 | 识别内容 | 置信度 |
| --- | --- | --- |
| `package.json` | 语言(JS/TS)、框架(React/Vue/Next...)、运行时(Node)、包管理(npm/pnpm/yarn) | `[原文]` |
| `pyproject.toml` | 语言(Python)、框架、包管理(poetry/pip) | `[原文]` |
| `go.mod` | 语言(Go)、模块路径、Go 版本 | `[原文]` |
| `Cargo.toml` | 语言(Rust)、依赖 | `[原文]` |
| `pom.xml` / `build.gradle` | 语言(Java/Kotlin)、构建工具 | `[原文]` |
| `composer.json` | 语言(PHP)、依赖 | `[原文]` |

如果以上文件都不存在：
- 检查文件扩展名（`.py`/`.go`/`.rs`/`.java`/`.php`）→ `[推断]`
- 如果无法确定 → `[假设]`，必须问用户

### 2. 测试命令识别

扫描以下位置，识别项目的测试命令：

| 来源 | 识别内容 | 置信度 |
| --- | --- | --- |
| `package.json` 的 `scripts.test` | 测试命令（如 `npm test`） | `[原文]` |
| `pyproject.toml` 的 `[tool.pytest]` | 测试命令（如 `pytest`） | `[原文]` |
| `Makefile` 的 `test` target | 测试命令（如 `make test`） | `[原文]` |
| `tox.ini` | 测试命令 | `[原文]` |
| `.github/workflows/*.yml` | CI 中的测试步骤 | `[推断]` |
| 目录中存在 `test/` 或 `tests/` 或 `__tests__/` | 有测试但命令未知 | `[假设]` |

如果测试命令无法从配置文件确定 → `[假设]`，必须问用户。

### 3. Lint 配置识别

扫描以下文件：

| 文件 | 识别内容 | 置信度 |
| --- | --- | --- |
| `.eslintrc.*` / `eslint.config.*` | ESLint 规则 | `[原文]` |
| `.prettierrc` / `prettier.config.*` | Prettier 格式化 | `[原文]` |
| `.pylintrc` / `pyproject.toml [tool.ruff]` | Python lint | `[原文]` |
| `.golangci.yml` | Go lint | `[原文]` |
| `package.json` 的 `scripts.lint` | lint 命令 | `[原文]` |

如果无 lint 配置 → spec.md 中标注"无 lint 配置"，不假设。

### 4. Git 提交风格识别

扫描最近 20 条 git log：

| 检查项 | 识别内容 | 置信度 |
| --- | --- | --- |
| 提交消息是否遵循 `type(scope): description` 格式 | 提交规范 | `[推断]` |
| 是否使用 Conventional Commits | 提交类型 | `[推断]` |
| 是否有 `Co-authored-by` 签名 | AI 协作约定 | `[推断]` |

```bash
git log --oneline -20
```

如果 git log 为空或风格不一致 → `[假设]`，推荐 Conventional Commits 并问用户是否采用。

### 5. 目录结构识别

扫描项目根目录和 `src/` 下的目录结构：

| 检查项 | 识别内容 | 置信度 |
| --- | --- | --- |
| `src/features/` 或 `src/modules/` 存在 | 功能模块化结构 | `[推断]` |
| `src/components/` 存在 | 组件化结构 | `[推断]` |
| `src/pages/` 或 `src/views/` 存在 | 页面化结构 | `[推断]` |
| `src/lib/` 或 `src/utils/` 存在 | 工具库结构 | `[推断]` |
| `monorepo` 结构（`packages/` 或 `apps/`） | monorepo | `[推断]` |

如果目录结构不明显 → `[假设]`，必须问用户目录约定。

### 6. 现有规则文件识别

扫描以下文件，提取已有规则：

| 文件 | 识别内容 | 置信度 |
| --- | --- | --- |
| `CLAUDE.md` | 已有的 Claude Code 规则 | `[原文]` |
| `AGENTS.md` | 已有的 Codex 规则 | `[原文]` |
| `.cursorrules` / `.cursor/rules/*` | 已有的 Cursor 规则 | `[原文]` |
| `README.md` | 项目说明和部分规范 | `[推断]` |
| `CONTRIBUTING.md` | 贡献指南 | `[原文]` |
| `.editorconfig` | 编辑器配置 | `[原文]` |

已有规则文件中的内容直接提取，标注 `[原文]`，不修改措辞。

---

## 置信度标注规则

每条推断出的规范条目必须标注置信度：

| 标注 | 含义 | 处理 |
| --- | --- | --- |
| `[原文]` | 从项目文件中直接读取的事实 | 直接写入 spec.md，无需确认 |
| `[推断]` | 从文件内容合理推断的规则 | 写入 spec.md，用户可扫一眼确认 |
| `[假设]` | 无依据的默认值，需要用户确认 | 必须发起澄清，一次一问 |

### 澄清规则

- **只对 `[假设]` 项发起澄清**，不问 `[原文]` 和 `[推断]` 项。
- **一次只问一个问题**，给推荐答案。
- 通常 ≤3 问（`[假设]` 项超过 3 个时，优先问最影响执行结果的）。
- 如果 `[假设]` 项为 0，直接生成 `.align/`，无需澄清。

---

## 何时必须问用户

以下情况必须停下问用户，不得静默假设：

1. 技术栈无法确定（无 `package.json`/`pyproject.toml` 等文件）。
2. 测试命令无法从配置文件确定（有测试目录但无脚本配置）。
3. 发现高风险操作历史（git log 中有数据库变更/生产部署等）且无现有高风险清单。
4. 目录结构无法推断（无明显的模块化/组件化结构）。
5. 已有 `CLAUDE.md`/`AGENTS.md` 与推断结果冲突。

---

## 生成 .align/ 四件套

扫描完成后，生成以下文件：

1. **`.align/spec.md`**：从扫描结果填充 `ALIGN-SPEC.md` 模板的 7 个章节。每条标注置信度。超 150 行时精简。
2. **`.align/context.md`**：从 README 和已有规则文件提取项目目标和架构决策。超 100 行时精简。
3. **`.align/lessons.md`**：初始为空（只有标题和说明）。
4. **`.align/decisions.log.md`**：初始为空（只有标题和说明）。

同时在 `CLAUDE.md`/`AGENTS.md` 中注入挂载区（见 `align-init` skill 的注入协议）。

---

## 自举测试

本协议应能对 `prompt-optimizer` 项目自身执行扫描，生成合理的 `.align/spec.md` 草案。自举测试结果记录在 `docs/planning/ALIGN-SCAN-SELFTEST.md` 或会话报告中。
