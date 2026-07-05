---
name: align-init
description: Initialize or upgrade the Alignment Protocol runtime for a project. Scans existing projects or interviews for new ones, generates .align/ runtime files, and injects the mount area into CLAUDE.md/AGENTS.md. Use when setting up prompt-optimizer in a new or existing project.
---

# Align Init

Generated from core/. Do not edit dist/ manually.

This skill initializes the Alignment Protocol runtime for a project. It generates the `.align/` directory and injects the mount area into the host tool's rules file.

## 触发方式

- `/align-init`：扫描当前项目，生成 `.align/` 四件套 + 注入挂载区。
- `$align-init`：同上（支持 `$` 前缀的工具）。
- `/align-init --new`：从零项目模式，走访谈决策树。
- `/align-init --upgrade`：升级已有挂载区版本，增量更新 spec，不重置 lessons/decisions。

## 输入

- 项目路径：默认为当前工作目录。
- `--new`：从零项目模式，走 `references/interview.md` 四问决策树。
- `--upgrade`：升级模式，检测旧版本号 → 替换标记区间 → 保留 lessons/decisions。
- 无参数：默认扫描模式，走 `references/scan.md` 扫描协议。

## 扫描模式（默认）

执行 `references/scan.md` 中的扫描协议：

1. 扫描 `package.json`/`pyproject.toml`/`go.mod` 等文件识别技术栈。
2. 扫描测试命令、lint 配置、git log 风格、目录结构、已有规则文件。
3. 推断规范草案，每条标注置信度 `[原文]`/`[推断]`/`[假设]`。
4. 只对 `[假设]` 项发起澄清（一次一问，通常 ≤3 问）。
5. 生成 `.align/` 四件套 + 注入挂载区。

耗时目标：3 分钟内完成接入。

## 从零项目模式（--new）

执行 `references/interview.md` 中的四问决策树：

1. Q1 项目一句话目标 → Q2 技术栈选型（给推荐+理由）→ Q3 质量门槛（测试策略/验证命令）→ Q4 高风险边界
2. 每问附推荐答案，用户可以连按四次"就按推荐的"。
3. 从 `references/spec-sections/` 选择匹配的预设，填入用户回答。
4. 生成 `.align/` 四件套 + 项目骨架建议 + 注入挂载区。

## 生成文件

在目标项目根目录生成：

```text
目标项目/
├── .align/
│   ├── spec.md            # 项目开发规范（从 ALIGN-SPEC.md 模板生成）
│   ├── context.md         # 项目上下文契约（从 ALIGN-CONTEXT.md 模板生成）
│   ├── lessons.md         # 经验规则（初始为空）
│   └── decisions.log.md   # 重大决策日志（初始为空）
├── CLAUDE.md              # 注入挂载区（已有内容不覆盖）
└── AGENTS.md              # 同上（面向 Codex）
```

## 挂载区注入

挂载区使用标记包裹，绝不覆盖用户内容：

```markdown
<!-- align-protocol:begin v3.0 -->
## 对齐协议（Alignment Protocol）
每条开发指令执行前，静默完成三档路由评估：
1. 读取 .align/lessons.md → .align/spec.md → .align/context.md
2. 五维快评：简单且明确 → 直接执行（但交付前必须自验证）
3. 有缺口但项目上下文可补全 → 开头 ≤3 行披露对齐假设，然后直接执行
4. 高风险（见 .align/spec.md 高风险清单）或总分<6 或假设>2 条
   → 停下澄清，一次只问一个问题并给推荐答案
5. 任务结束：有踩坑/纠正/新约定 → 追加到 .align/lessons.md
硬性红线：高风险静默假设 = 无效输出；交付前不验证 = 无效输出。
<!-- align-protocol:end -->
```

### 注入规则

- 目标文件（CLAUDE.md/AGENTS.md）不存在时：创建文件，写入挂载区。
- 目标文件已存在但无标记：在文件末尾追加挂载区。
- 目标文件已存在且有旧版本标记：替换标记区间内容（原位升级）。
- 目标文件已存在且有当前版本标记：无操作（已是最新）。
- **绝不覆盖标记区外的用户内容。**

### Cursor 适配

Cursor 不使用 CLAUDE.md/AGENTS.md，改为注入 `.cursor/rules/align.mdc`（alwaysApply: true）。

## 幂等规则

重复运行 `/align-init` 时：

- **升级挂载区版本**：检测旧版本号 → 替换标记区间。
- **增量更新 spec**：重新扫描/访谈，只更新有变化的条目，不覆盖用户手动修改的条目。
- **不重置 lessons/decisions**：`.align/lessons.md` 和 `.align/decisions.log.md` 的已有内容保留，只追加新条目。
- **不重复创建已有文件**：`.align/` 四件套已存在时只更新 spec.md 和 context.md。

## 卸载与原位升级

### 原位升级

当目标文件已存在旧版本挂载区时，执行原位升级：

1. **检测旧版本号**：扫描 `<!-- align-protocol:begin v3.0 -->` 标记中的版本号。
2. **替换标记区间**：将 `<!-- align-protocol:begin ... -->` 到 `<!-- align-protocol:end -->` 之间的全部内容替换为新版本挂载区。
3. **保留标记区外内容**：标记区间外的用户内容完全不动。
4. **保留 lessons/decisions**：`.align/lessons.md` 和 `.align/decisions.log.md` 的已有内容保留，只追加新条目。

### 卸载

卸载时移除本项目安装的内容，**零损伤**用户自有内容：

1. **移除挂载区**：从 CLAUDE.md/AGENTS.md 中删除 `<!-- align-protocol:begin ... -->` 到 `<!-- align-protocol:end -->` 之间的全部内容（含标记行）。
2. **保留标记区外内容**：用户在 CLAUDE.md/AGENTS.md 中的自有内容完全不动。
3. **移除 skill 目录**：从 skills 目录中删除 `optimize-prompt/` 和 `align-init/`，不删除其他 skill。
4. **保留 .align/ 目录**：`.align/` 目录中的 spec.md、context.md、lessons.md、decisions.log.md 不删除（用户可能还想保留项目规范和经验）。
5. **可选删除 .align/**：用户可手动 `rm -rf .align/` 完全清除。

### 零损伤保证

- 标记区外的用户内容：**绝不覆盖、绝不删除**。
- `.align/lessons.md` 和 `.align/decisions.log.md`：**升级时不重置、卸载时不删除**。
- 其他 skill：**卸载时不触碰**。

## 输出接入报告

执行完成后，输出接入报告：

```text
## Alignment Protocol 接入报告

- 模式：扫描 / 从零项目 / 升级
- 技术栈：[识别结果]
- 生成的文件：
  - .align/spec.md（X 条规范，Y 条 [假设] 已澄清）
  - .align/context.md（X 条上下文）
  - .align/lessons.md（初始为空）
  - .align/decisions.log.md（初始为空）
- 挂载区注入：CLAUDE.md / AGENTS.md / .cursor/rules/align.mdc
- 澄清问题数：N（≤3 为正常）
- 下一步：正常开发即可，每条指令会自动经过三档路由评估
```

## 澄清协议

当扫描结果中 `[假设]` 项过多（>2）或发现高风险信号时：

- **一次只问一个问题**，给推荐答案。
- 优先问最影响执行结果的 `[假设]` 项。
- 不问 `[原文]` 和 `[推断]` 项。
- 用户可以采纳推荐答案或自行回答。

## References

- `references/scan.md`：存量项目扫描协议。
- `references/interview.md`：从零项目四问访谈决策树。
- `references/spec-sections/`：规范章节库（7 个章节，每章 2-3 个预设）。
- `references/align-spec.md`：spec.md 模板。
- `references/align-context.md`：context.md 模板。
- `references/align-lessons.md`：lessons.md 模板。
- `references/align-decisions.md`：decisions.log.md 模板。
