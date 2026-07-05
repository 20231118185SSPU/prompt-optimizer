# 评审与合并规则预设

> 规范章节库：评审与合并规则。每个预设提供可验证的规范条目。

## 预设 A：严格评审（团队项目）

```text
- PR 必须至少 1 人评审通过
- PR 必须跑通 CI（lint + test + build）
- PR 标题必须符合提交格式（type(scope): description）
- PR 描述必须包含：改了什么、为什么改、怎么测试的
- 禁止直接 push 到 main/master
- 合并方式：Squash and merge
- 合并后必须删除分支
```

判定标准：`gh pr list --state merged --limit 20` 的 PR 标题匹配提交格式；CI 检查全绿。

## 预设 B：轻量评审（小团队）

```text
- PR 必须跑通 CI（test）
- PR 标题必须描述改动内容
- 禁止直接 push 到 main
- 合并方式：Squash and merge
```

判定标准：`gh pr list --state merged --limit 20` 的 PR 都有 CI 通过记录。

## 预设 C：单人项目

```text
- 所有变更通过 PR 合并（方便回顾）
- PR 必须跑通 CI（test + lint）
- PR 描述必须包含：改了什么、怎么测试的
- 禁止直接 push 到 main
- 合并方式：Squash and merge
```

判定标准：`gh pr list --state merged --limit 20` 的 PR 都有 CI 通过记录和描述。
