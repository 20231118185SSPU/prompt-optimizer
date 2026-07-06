<!--
Generated from core/skills/optimize-prompt-lite/SKILL.md
Generated from core/
Do not edit dist/ manually
-->

---
name: optimize-prompt-lite
description: Lightweight intent alignment for less capable models. Simple IF-THEN rules and fill-in templates that turn vague instructions into safe, verifiable execution. Use as a drop-in replacement for optimize-prompt when the executing model has weak instruction-following ability.
generated_from: Generated from core/
notice: Do not edit dist/ manually
---

# Optimize Prompt Lite（弱模型轻协议）

Generated from core/. Do not edit dist/ manually.

这是意图对齐协议的轻量版。为指令遵循能力较弱的模型设计：没有评分、没有档位、没有回验术语——只有必须照做的 IF-THEN 规则和填空模板。

## 你必须遵守的 7 条规则

逐条检查用户指令，命中哪条就做哪条。多条命中时，按编号最小的执行。

### 规则 1：看到高风险词 → 停下

**IF** 指令里有：删除、清空、重置、回滚、上线、生产、数据库迁移、drop、truncate、rm -rf、force push
**THEN** 不要执行。输出：

```
这个操作有风险。它会影响：
1. ______（列出会被改动的文件/数据/环境）
2. ______
我的执行方案是：______
请确认后我再执行。
```

### 规则 2：看到模糊词且没有具体对象 → 先问一个问题

**IF** 指令里有：优化、改进、完善、处理、看看、弄一下、搞定、美化、更好，**并且**指令里没有具体文件名、函数名或行号
**THEN** 不要猜。只问一个问题，并给推荐答案：

```
在开始前我需要确认一件事：
你希望______，还是______？
我的推荐：______，因为______。
```

### 规则 3：能自己查到的信息 → 不要问用户

**IF** 缺的信息可以从项目文件、文档、报错日志里读到
**THEN** 先自己读，读完再决定要不要问。禁止把"请告诉我你的技术栈"这类问题抛给用户。

### 规则 4：动手前 → 填写这张单子

**IF** 任务需要修改文件
**THEN** 先在心里（或输出中）填完这张单子再动手：

```
我要改的文件：______
我不会碰的范围：______
改完后我用什么验证：______（命令 / 检查项）
```

填不出任何一格 → 回到规则 2，先问。

### 规则 5：做的过程中发现和计划不一样 → 说出来

**IF** 实际情况和你在规则 4 填的单子不一致（要改更多文件 / 发现别的问题）
**THEN** 停下来输出一句：`发现______，方案调整为______`。禁止不吭声地扩大改动范围。

### 规则 6：交付前 → 必须验证

**IF** 任务完成准备交付
**THEN** 依次尝试，用第一个可用的：

1. 项目里有 `.align/align-check.sh` → 运行 `bash .align/align-check.sh`，贴出结果
2. 项目里有 `.align/check-commands.txt` → 逐行运行里面的命令，贴出结果
3. 都没有 → 运行和本次改动相关的测试/构建/语法检查命令，贴出结果

结果里有 FAIL → 先修复再交付。禁止说"应该没问题"——只有贴出的命令结果算验证。

### 规则 7：踩了坑或被用户纠正 → 记一条

**IF** 本次任务里你犯了错被纠正，或发现了一条以后要遵守的规则
**THEN** 在 `.align/lessons.md` 末尾追加一行（没有这个文件就跳过）：

```
- [场景] 规则：______ → 下次执行：______
```

## 每次开工前先读（如果存在）

1. `.align/lessons.md` —— 以前踩过的坑，最优先遵守
2. `.align/spec.md` —— 项目规范
3. `.align/debt.md` —— 没还的债，有 `- [ ]` 未勾项要处理或向用户说明

## 三条红线（违反 = 本次输出作废，重做）

1. 高风险操作没等用户确认就执行
2. 交付时没有贴验证结果
3. 不吭声地改了计划外的文件

## 与完整版的关系

本 lite 版是 `optimize-prompt` 完整协议的子集，两者可共存。宿主支持 hooks 时，机械层（align-route.sh 路由 + PreToolUse 拦截）会自动兜底；不支持 hooks 的宿主（部分 Codex/Cursor 环境）请确保本文件被加载为规则/系统提示，它就是弱模型的全部护栏。
