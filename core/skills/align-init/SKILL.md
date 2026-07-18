---
name: align-init
description: Initialize or upgrade the Alignment Protocol runtime for a project. Scans existing projects or interviews for new ones, generates .align/ runtime files, and injects the mount area into CLAUDE.md/AGENTS.md. Use when setting up prompt-optimizer in a new or existing project.
generated_from: Generated from core/
notice: Do not edit dist/ manually
---

# Align Init

Generated from core/. Do not edit dist/ manually.

This skill initializes the Alignment Protocol runtime for a project. It generates the `.align/` directory and injects the mount area into the host tool's rules file.

> **收敛说明**：`align-init` 已收敛为 `/align setup` 的内部 **setup profile**。触发名称在兼容期内保持不变，但建议使用 `/align setup` 作为统一入口。本 skill 的全部行为与 `/align setup` 完全一致。

## 触发方式

- `/align-init`：扫描当前项目，生成 `.align/` 运行时 + 注入挂载区 + 机械层接线。
- `$align-init`：同上（支持 `$` 前缀的工具）。
- `/align-init --new`：从零项目模式，走访谈决策树。
- `/align-init --zero`：零问模式，全部采用推荐默认值，一个问题都不问，装完即用（适合无开发基础的用户）。
- `/align-init --upgrade`：升级已有挂载区版本，增量更新 spec，不重置 lessons/decisions。

## 零问模式（--zero）

面向无开发基础的用户或希望零打扰接入的场景：

1. 执行扫描协议，但**所有 `[假设]` 一律采用推荐默认值，不发起任何澄清**。
2. 未能识别的项按最保守值填写（如验证命令留空并在 spec.md 标注"待补"）。
3. 全部 `[假设]` 在 spec.md 中保留标注，用户以后随时可改。
4. 接入报告末尾提示："以下 N 条为默认假设，运行中如发现不符，直接告诉我即可修正。"

零问模式不弱化安全红线：运行期高风险指令仍必须经过安全路由；信息不足时 `clarify`，授权/政策/baseline 阻断时 `block`，契约与授权完整时 `enrich`。

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
4. 生成 `.align/` 分类上下文 + legacy 兼容投影 + 项目骨架建议 + 注入挂载区。

## 生成文件

在目标项目根目录生成：

```text
目标项目/
├── .align/
│   ├── spec.md            # 项目开发规范（从 ALIGN-SPEC.md 模板生成）
│   ├── facts.md           # 稳定项目事实（每项带 source ref）
│   ├── glossary.md        # 项目特有术语，不含实现细节
│   ├── state.md           # 临时阶段摘要（updatedAt + invalidWhen）
│   ├── context.md         # 由分类 SSOT 生成的 legacy 兼容投影，禁止直接编辑
│   ├── lessons.md         # 经验规则（初始为空）
│   ├── decisions.log.md   # 重大决策日志（初始为空）
│   ├── HOOK-REMINDER.txt  # hook 提醒文本（路由器不可用时的降级注入）
│   ├── align-route.sh     # 信号评分路由器（从 skill 目录的 hooks/ 复制）
│   ├── align-check.sh     # 一键交付验证 + 债务台账（同上）
│   └── check-commands.txt # 项目验证命令清单（扫描结果生成，每行一条）
├── .claude/settings.json  # 项目级硬拦截（deny 危险操作；已有文件则提示手动合并）
├── CLAUDE.md              # 注入挂载区（已有内容不覆盖）
└── AGENTS.md              # 同上（面向 Codex）
```

### check-commands.txt 生成规则

从扫描结果中提取可执行验证命令写入，每行一条：

- 识别到 `package.json` → 写入 `npm test`（存在 test script 时）、`npm run lint`（存在 lint script 时）
- 识别到 `pyproject.toml`/`pytest.ini` → 写入 `pytest -q`
- 识别到 `go.mod` → 写入 `go build ./...` 和 `go test ./...`
- 识别到 shell 脚本项目 → 写入 `bash -n <主要脚本>`
- 无法识别 → 留空文件并加注释 `# 待补：项目验证命令`，同时在 spec.md 标注

### 模型能力配置（.align/route.conf）

扫描/访谈时询问（零问模式默认 auto）执行模型的指令遵循能力，写入 `.align/route.conf`：

```text
# 弱模型建议 ARBITER=off（避免仲裁本身不可靠），强模型可保持 auto
ARBITER=auto
# BLOCK_ON_HIGH=on 时，仅 Alignment Decision 的 next.action=wait_confirmation|stop 会 exit 2（HIGH 仅为兼容展示）
# 默认 off：只注入警告文本，由模型自觉停下。弱模型建议 on。
# [直出] / ALIGN_BYPASS 只改变展示，禁止跳过阻断
BLOCK_ON_HIGH=off
```

弱模型场景额外建议：把 `optimize-prompt-lite/SKILL.md` 的内容注入宿主规则文件（不支持 hooks 的宿主必须这样做，它是弱模型的全部护栏）。

## Hook 接线（Claude Code）

`.align/` 生成后，必须完成 hook 接线，否则协议只是被动文档、没有强制推送：

1. **复制机械层脚本**：从 `~/.claude/hooks/`（安装器复制）或 `~/.agents/hooks/` 或仓库 `dist/claude-code/hooks/` 复制 `align-route.sh` 和 `align-check.sh` 到 `.align/`。**找不到源文件时必须报错并指向安装文档，禁止静默生成简化版**——简化版不读 stdin、不分类，会导致对齐失效且接入报告误报"成功"。

2. **生成 `.align/HOOK-REMINDER.txt`**（路由器不可用时的降级注入），内容固定为：

   ```text
   [Alignment Protocol] 本条指令须先过三档路由评估。
   读取 .align/lessons.md → spec.md → facts.md / glossary.md / state.md；三个分类文件未齐全时同时读取 context.md，全部缺失时只读 legacy。
   简单明确→直通；有缺口→补全回执后执行；高风险信息不足/总分<6→澄清，授权/政策/baseline 阻断→停止，契约与授权完整→补全回执后执行。
   交付前必须自验证（R8 验证门不可跳过）。
   ```

3. **合并 hook 进 `~/.claude/settings.json`**（用户全局配置，修改前先备份并向用户展示改动）：

   ```json
   {
     "hooks": {
       "UserPromptSubmit": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "if [ -f \"$HOME/.prompt-optimizer/adapters/claude-code.sh\" ]; then BLOCK_ON_HIGH=on bash \"$HOME/.prompt-optimizer/adapters/claude-code.sh\"; elif [ -f \"$CLAUDE_PROJECT_DIR/.align/align-route.sh\" ]; then bash \"$CLAUDE_PROJECT_DIR/.align/align-route.sh\"; elif [ -f \"$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt\" ]; then cat \"$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt\"; else printf \"%s\\n\" \"[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。\"; fi"
             }
           ]
         }
       ]
     }
   }
   ```

   合并规则：只增不删，保留 `env` 等既有字段；相同命令已存在时无操作（幂等）；存在旧版 `cat .align/HOOK-REMINDER.txt` 命令时原位升级。
   命令自带降级链，未接入 `.align/` 的项目不受影响。

4. **项目级硬拦截**：目标项目无 `.claude/settings.json` 时，写入 skill 附带的 `project-settings.fragment.json`（deny 改 dist、rm -rf、reset --hard、force push）；已有该文件时输出 fragment 内容请用户手动合并，**不自动改写用户的项目配置**。

5. **验证接线**（必须区分完整版与简化版）：
   - `bash .align/align-route.sh --classify "优化一下"` 输出 `VAGUE`
   - **stdin 解析验证**：`echo '{"prompt":"删库"}' | bash .align/align-route.sh` 输出含"高风险"的差异化文本（简化版只会 cat 静态 HOOK-REMINDER，不输出"高风险"）
   - `bash .align/align-check.sh` 可执行
   - settings.json 可被 JSON 解析且含 `hooks` 段
   - 任一失败 → 接入报告标注"接线失败"并指向修复方式，**不得报告"接入成功"**

## 挂载区注入

挂载区使用标记包裹，绝不覆盖用户内容：

```markdown
<!-- align-protocol:begin v3.0 -->
## 对齐协议（Alignment Protocol）
每条开发指令执行前，静默完成三档路由评估：
1. 读取 .align/lessons.md → .align/spec.md → .align/facts.md / glossary.md / state.md；三个分类文件未齐全时同时读取 context.md，全部缺失时只读 legacy
2. 五维快评：简单且明确 → 直接执行（但交付前必须自验证）
3. 有缺口但项目上下文可补全 → 开头展示 ≤3 行补全回执（补全内容 + 来源 + `撤销补全 <ID>`），然后直接执行
   收到撤销口令时停止沿用指定项，回到原始请求重新分析；已产生改动则先报告，未经确认不自动回滚
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
- **分类 SSOT 优先**：新 writer 只更新 facts/glossary/state，再生成带 digest 的 context.md 兼容投影。
- **检测 divergent projection**：发现旧 agent 修改 context.md 时必须报警并显式合并，禁止覆盖分类 SSOT。
- **不重复创建已有文件**：分类文件已存在时增量更新；old-only 项目无损迁移，无法分类的内容进入待确认清单。
- **原子迁移**：old-only 升级时先生成三个临时分类文件，人工确认无法分类的条目，再一次性落盘 facts/glossary/state；三文件未齐全前 loader 必须继续读取 legacy context。
- **重复升级**：三文件齐全且 projection digest 匹配时禁止重写分类 SSOT；digest 不匹配时停止自动迁移并报告 divergent projection。
- **生成兼容投影**：三文件确认齐全后运行 `align-cli context-project write --project-dir <project>`；首次替换 old-only context 必须人工复核后把 `write` 改为 `--force`，禁止未经确认覆盖。

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
4. **移除 hook**：从 `~/.claude/settings.json` 的 `hooks.UserPromptSubmit` 中删除 `cat .align/HOOK-REMINDER.txt` 命令项，只删本协议安装的条目，其他 hooks 和字段不触碰。
5. **保留 .align/ 目录**：spec、facts、glossary、state、legacy context、lessons 和 decisions 均不删除。
6. **可选删除 .align/**：用户可手动 `rm -rf .align/` 完全清除。

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
  - .align/HOOK-REMINDER.txt（降级提醒文本）
  - .align/align-route.sh + align-check.sh（机械层脚本）
  - .align/check-commands.txt（N 条验证命令 / 待补）
- 挂载区注入：CLAUDE.md / AGENTS.md / .cursor/rules/align.mdc
- Hook 接线：~/.claude/settings.json 已合并 UserPromptSubmit hook / 跳过（原因）
- 硬拦截：.claude/settings.json 已写入 / 已有文件请手动合并（附 fragment）
- 澄清问题数：N（≤3 为正常）
- 下一步：正常开发即可，每条指令会自动经过三档路由评估
- 给氛围编程者：现在直接用大白话告诉 AI 你想做什么就行。指令模糊时 AI 会先问一个关键问题；高风险信息不足时先澄清，授权受阻时等待确认，信息与授权完整时按范围执行。完成后 AI 会提醒你跑验证。
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
- `references/align-facts.md`：facts.md 模板。
- `references/align-glossary.md`：glossary.md 模板。
- `references/align-state.md`：state.md 模板。
- `references/align-lessons.md`：lessons.md 模板。
- `references/align-decisions.md`：decisions.log.md 模板。
