<!--
Generated from core/spec-kit/spec-sections/branch-commit.md
Generated from core/
Do not edit dist/ manually
-->

# 分支与提交规范预设

> 规范章节库：分支与提交规范。每个预设提供可验证的规范条目。

## 预设 A：Conventional Commits（推荐）

```text
- 分支命名：feature/{ticket-id}-{简述}、fix/{ticket-id}-{简述}、hotfix/{简述}
- 提交格式：type(scope): description
- type 必须：feat | fix | docs | refactor | test | chore
- scope 可选，但涉及 auth/payments/core 时必须写
- 提交前必须跑 `pnpm run lint` 和 `pnpm test`
- 禁止直接 push 到 main/master
```

判定标准：`git log --oneline -20` 的提交消息匹配 `^(feat|fix|docs|refactor|test|chore)(\(.+\))?: .+`。

## 预设 B：简化提交（小项目）

```text
- 分支命名：{简述}
- 提交格式：type: description
- type 必须：feat | fix | docs | chore
- 提交前必须跑 `npm test`
- 禁止直接 push 到 main
```

判定标准：`git log --oneline -20` 的提交消息匹配 `^(feat|fix|docs|chore): .+`。

## 预设 C：GitHub Flow（开源项目）

```text
- 分支命名：feature/{简述}、fix/{简述}
- 提交格式：自由格式，但必须包含动宾结构（如"Add user search"）
- 所有变更通过 PR 合并
- PR 必须关联 issue
- 禁止直接 push 到 main
- 合并方式：Squash and merge
```

判定标准：所有提交通过 PR 合并；PR 描述关联 issue 编号。
