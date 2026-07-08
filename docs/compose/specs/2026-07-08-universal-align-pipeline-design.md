# [S1] 问题

当前对齐管线只支持 Claude Code（通过 shell 脚本 hook），无法覆盖其他主流 AI 编程工具。用户希望所有编程工具都能使用对齐管线，实现真正的"通用性"。

## 当前限制

- Claude Code：有 hook 系统，已支持
- Codex：无 hook，只能通过 AGENTS.md 注入
- Cursor：无 hook，只能通过 .cursorrules 注入
- Cline：有 hook 系统，未支持
- 其他工具：无 hook，只能通过规则文件注入

## 用户需求

1. 对于有 hook 的工具：优先使用 hook 进行动态拦截
2. 对于无 hook 的工具：使用 CLI 包装器进行强制智能路由拦截
3. 保持向后兼容，不破坏现有功能

---

# [S2] 解决方案概览

采用分层策略：

| 工具类型 | 对齐方式 | 强制程度 |
|---|---|---|
| 有 hook（Claude Code、Cline） | hook 拦截 | 强制 |
| 无 hook（Codex、Cursor、Aider、Windsurf、通用） | CLI 包装器 | 强制 |

架构概览：

```
用户指令 → 适配层 → 核心对齐逻辑 → 适配层 → Agent
```

- **核心对齐逻辑**（TypeScript）：五维诊断、三档路由、消息补全、验证门
- **适配层**：hook 适配（动态拦截）、CLI 适配（强制拦截）、规则适配（软强制）

---

# [S3] 目录结构

```
core/host/pipeline/
├── src/
│   ├── index.ts          # CLI 入口
│   ├── classifier.ts     # 信号分类器
│   ├── router.ts         # 三档路由器
│   ├── enricher.ts       # 消息补全器
│   ├── verifier.ts       # 验证门
│   └── adapters/
│       ├── hook/
│       │   ├── claude-code.sh    # Claude Code hook 调用脚本
│       │   └── cline.ts          # Cline 插件
│       ├── cli/
│       │   ├── codex.ts          # Codex CLI 适配
│       │   ├── cursor.ts         # Cursor CLI 适配
│       │   └── generic.ts        # 通用 CLI 适配
│       └── rules/
│           ├── copilot.md        # Copilot 规则文件
│           ├── aider.md          # Aider 规则文件
│           └── windsurf.md       # Windsurf 规则文件
├── tsconfig.json
└── package.json
```

---

# [S4] 核心对齐逻辑

## 4.1 信号分类器

从现有 `core/host/align-route.sh` 移植：

- **风险信号**：删除、清空、重置、回滚、强推、上线、部署到生产等
- **模糊信号**：优化、改进、完善、提升、处理、看看、弄一下等
- **具体信号**：文件路径、函数名、行号等

## 4.2 三档路由

- **HIGH**：风险信号 ≥ 1 → 高风险，必须停下确认
- **VAGUE**：模糊信号 ≥ 1 且具体信号 = 0 → 模糊，需要澄清
- **CLEAR**：其他 → 清楚，直接执行

## 4.3 消息补全

读取 `.align/` 上下文：
- `lessons.md`：项目经验规则
- `spec.md`：项目规范
- `context.md`：项目上下文
- `decisions.log.md`：决策日志

注入到消息中，供 Agent 使用。

## 4.4 验证门

读取 `.align/check-commands.txt`，执行验证命令，检查结果。

---

# [S5] 工具适配方式

## 5.1 有 hook 的工具

### Claude Code

- 使用 `UserPromptSubmit` hook
- hook 脚本调用 TypeScript CLI
- 注入对齐指令到消息中

### Cline

- 使用 `before_agent_start` hook
- 插件调用 TypeScript CLI
- 注入对齐指令到消息中

## 5.2 无 hook 的工具

### Codex

- CLI 包装器：`align-cli codex "指令"`
- 包装器调用 `codex` CLI
- 注入对齐指令到消息中

### Cursor

- CLI 包装器：`align-cli cursor "指令"`
- 包装器调用 Cursor CLI
- 注入对齐指令到消息中

### 其他工具

- CLI 包装器：`align-cli generic "指令"`
- 包装器调用工具 CLI
- 注入对齐指令到消息中

## 5.3 规则文件（软强制）

对于 Copilot、Aider、Windsurf 等工具：

- 生成规则文件（`.github/copilot-instructions.md`、`CONVENTIONS.md`、`.windsurfrules`）
- 规则文件包含对齐指令
- 用户手动配置工具加载规则文件

---

# [S6] 对现有项目的改动

## 新增文件

- `core/host/pipeline/` 目录及所有文件

## 修改文件

- `build/build.sh`：新增 TypeScript 编译步骤
- `build/build.ps1`：新增 TypeScript 编译步骤
- `scripts/install-skill.sh`：新增 Node.js 依赖检查
- `scripts/install-skill.ps1`：新增 Node.js 依赖检查

## 保留文件

- `core/host/align-route.sh`：保留，作为 Claude Code 的降级路径
- `core/host/align-check.sh`：保留，继续使用
- 其他 `core/host/` 文件：保留，继续使用

---

# [S7] 验证方式

## 编译验证

```bash
cd core/host/pipeline && npm run build
```

## 单元测试

```bash
cd core/host/pipeline && npm test
```

## 集成测试

```bash
# 测试 Claude Code hook
align-cli claude-code "帮我优化这个项目"

# 测试 Codex CLI 包装器
align-cli codex "帮我优化这个项目"

# 测试 Cursor CLI 包装器
align-cli cursor "帮我优化这个项目"
```

## 幂等性验证

```bash
bash build/build.sh
bash build/build.sh
git status --short dist/
```

---

# [S8] 风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| Node.js 依赖 | 需要安装 Node.js | 提供 shell 降级路径 |
| 构建流程改动 | 可能破坏现有构建 | 保留现有构建步骤，新增步骤在最后 |
| 安装脚本改动 | 可能破坏现有安装 | 保留现有安装步骤，新增步骤在最后 |
| CLI 包装器兼容性 | 可能与工具 CLI 冲突 | 测试各工具 CLI 兼容性 |

---

# [S9] 实现计划

## 阶段 1：核心对齐逻辑

- 实现信号分类器
- 实现三档路由器
- 实现消息补全器
- 实现验证门

## 阶段 2：工具适配层

- 实现 Claude Code hook 适配
- 实现 Cline 插件适配
- 实现 CLI 包装器适配
- 实现规则文件生成

## 阶段 3：构建和安装

- 修改 build 脚本
- 修改安装脚本
- 测试构建和安装

## 阶段 4：集成测试

- 测试各工具的对齐效果
- 测试向后兼容性
- 测试幂等性

---

# [S10] 成功标准

1. 核心对齐逻辑实现完成，通过单元测试
2. 工具适配层实现完成，通过集成测试
3. 构建流程修改完成，通过幂等性验证
4. 安装脚本修改完成，通过安装测试
5. 现有功能不破坏，通过回归测试
