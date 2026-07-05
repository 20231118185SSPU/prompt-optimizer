<!--
Generated from core/templates/ALIGN-CONTEXT.md
Generated from core/
Do not edit dist/ manually
-->

# ALIGN-CONTEXT.md：项目上下文契约模板

> 本文件是 `.align/context.md` 的模板。由 `align-init` skill 生成，由用户手动更新。
> 最大行数：≤100 行。超限时精简或归档旧决策到 `decisions.log.md`。

## 用途

定义项目的上下文契约，让 agent 理解项目的来龙去脉。agent 每次任务前在读取顺序中第三位读取（lessons → spec → **context**）。

## 由谁生成/更新

- **生成**：`align-init` skill 扫描项目或访谈后生成。
- **更新**：用户手动修改；架构决策变更时同步。
- **不在 context.md 中写入的内容**：具体规范（放 spec.md）、经验规则（放 lessons.md）、一次性任务信息。

## 填写标准

每条上下文必须帮助 agent 理解"为什么这样做"，不得使用"合理"、"最佳实践"等不可判定表述。

---

## 项目目标与当前阶段

填写标准：用 1-3 句话说明项目最终要解决什么问题，以及当前处于哪个阶段。

```text
- 项目目标：为 SaaS 后台管理系统提供用户管理、权限控制和审计日志功能
- 当前阶段：v1.2 开发中，核心用户管理已完成，正在开发权限控制
- 下一个里程碑：v1.2 发布（预计 2026-08），包含 RBAC 和操作审计
```

判定标准：agent 读到后能判断当前任务的优先级是否符合项目阶段。

## 共享术语

填写标准：列出项目中容易产生歧义的术语及其在本项目中的含义，每个术语一句话定义。

```text
- "用户"：指 SaaS 租户的终端用户，非系统管理员
- "角色"：RBAC 中的角色，不是 TypeScript 的 type
- "审计日志"：记录用户操作的系统日志，不是调试日志
- "租户"：使用 SaaS 平台的组织，一个租户有多个用户
```

判定标准：agent 读到后能正确理解项目文档和指令中的术语，不会混淆。

## 架构关键决策

填写标准：列出影响后续开发的架构决策，每条包含决策内容、原因和影响。

```text
- 认证方案：JWT + httpOnly cookie
  原因：安全性高于 localStorage 存储；httpOnly 防 XSS
  影响：所有 auth 相关任务必须考虑 cookie 跨域配置

- 状态管理：Zustand（非 Redux）
  原因：API 更简单，bundle 更小
  影响：新功能的状态管理用 Zustand，不引入 Redux

- 数据库访问：Drizzle ORM（非 Prisma）
  原因：类型推导更好，SQL 控制力更强
  影响：数据库相关任务用 Drizzle schema 和查询语法
```

判定标准：agent 读到后能理解为什么选择某个技术方案，不会在执行中偏离架构决策。

---

## 模板使用说明

`align-init` 生成 `.align/context.md` 时，从本模板复制结构，填入项目实际内容。每节都必须填写；无内容的节写"无"或删除该节。

context.md 超 100 行时，精简或归档：将旧架构决策移到 `decisions.log.md`，将过时的项目阶段描述删除。

context.md 不重复 spec.md 的规范内容；context.md 回答"为什么"，spec.md 回答"怎么做"。
