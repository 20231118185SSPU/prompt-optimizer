# ALIGN-SPEC.md：项目开发规范模板

> 本文件是 `.align/spec.md` 的模板。由 `align-init` skill 生成，由沉淀门（门 5）和用户手动更新。
> 最大行数：≤150 行。超限时精简或拆分到 `context.md`。

## 用途

定义项目的开发规范，让所有 agent 在执行任务时有统一的行为准则。agent 每次任务前在读取顺序中第二位读取（lessons → **spec** → context）。

## 由谁生成/更新

- **生成**：`align-init` skill 扫描项目或访谈后生成。
- **更新**：沉淀门（门 5）在出现新约定时追加；用户手动修改。
- **不在 spec.md 中写入的内容**：一次性任务信息、具体 bug 描述、个人偏好。

## 填写标准

每条规范必须写成"可验证的行为"，不得使用"合理"、"最佳实践"、"整洁"、"优雅"等不可判定表述。

---

## 技术栈与版本

填写标准：列出项目使用的语言、框架、运行时及其版本号。版本号必须具体到主版本号。

```text
- 语言：TypeScript 5.x
- 框架：React 18.x
- 运行时：Node.js 20.x
- 包管理：pnpm 8.x
- 数据库：PostgreSQL 16.x
```

判定标准：agent 读到这一节后，能确定使用哪个语法版本、API 版本和工具链。

## 目录约定

填写标准：列出关键目录的职责，每个目录一句话说明放什么、不放什么。

```text
- src/features/：功能模块，每个模块自包含（组件+hooks+类型+测试）
- src/shared/：跨模块共享的工具和类型
- src/config/：配置文件，不放业务逻辑
- tests/：集成测试，单元测试放在各模块内
```

判定标准：agent 读到后能确定新文件该放哪个目录，不会放错位置。

## 分支与提交规范

填写标准：列出分支命名规则和提交消息格式，必须可检查。

```text
- 分支命名：feature/{ticket-id}-{简述}、fix/{ticket-id}-{简述}、hotfix/{简述}
- 提交格式：type(scope): description
- type 必须：feat | fix | docs | refactor | test | chore
- scope 可选，但涉及 auth/payments/core 时必须写
- 提交前必须跑 `npm run lint` 和 `npm test`
```

判定标准：agent 能根据规范生成合规的分支名和提交消息，能通过 `npm run lint` 检查。

## 测试与验证命令

填写标准：列出项目所有验证命令，必须可复制执行。

```text
- 单元测试：`npm test`
- 模块测试：`npm test -- {模块名}`
- 类型检查：`tsc --noEmit`
- Lint：`npm run lint`
- 构建：`npm run build`
- E2E：`npm run e2e`
```

判定标准：agent 能直接复制命令执行，不需要猜测命令名或参数。

## 代码风格

填写标准：列出代码风格规则，每条必须能通过 lint 或人工检查判定。

```text
- 缩进：2 空格（.prettierrc 已配置）
- 引号：单引号（.prettierrc 已配置）
- 命名：变量 camelCase，类型/接口 PascalCase，常量 UPPER_SNAKE_CASE
- 导入：按 alpha 排序（eslint-plugin-sort 已配置）
- 禁止 any：必须显式标注类型（eslint 已配置 no-explicit-any）
```

判定标准：`npm run lint` 能检查所有规则；agent 能根据规则生成合规代码。

## 评审与合并规则

填写标准：列出 PR/评审的具体规则，必须可执行。

```text
- PR 必须至少 1 人评审通过
- PR 必须跑通 CI（lint + test + build）
- PR 标题必须符合提交格式
- 禁止直接 push 到 main/master
- 合并方式：Squash and merge
- PR 描述必须包含：改了什么、为什么改、怎么测试的
```

判定标准：agent 能根据规则创建合规的 PR；CI 能自动检查部分规则。

## 高风险操作清单

填写标准：列出本项目哪些操作必须先问用户确认，每条必须包含触发条件和确认要求。

```text
- 数据库 schema 变更：必须先在 staging 验证，必须有回滚脚本
- 生产环境部署：必须先确认版本号和变更清单
- 删除文件/目录：必须先确认是否有引用，必须 git commit 后再删
- 修改 public API：必须同步更新类型定义和调用方
- 引入新依赖：必须确认包体积、维护状态和许可证
- 修改认证/权限逻辑：必须跑完整 auth 测试 + 人工评审
```

判定标准：agent 读到后能判断当前任务是否命中高风险，并按唯一机器决定执行：信息不足时 `clarify`，授权/政策/baseline 阻断时 `block`，范围、恢复、授权和验收完整时 `enrich`。

---

## 模板使用说明

`align-init` 生成 `.align/spec.md` 时，从本模板复制结构，填入项目实际内容。每节都必须填写；无内容的节写"无"或删除该节。

沉淀门（门 5）更新时，新约定追加到对应章节末尾，不新建章节（除非有全新的规范类别）。

spec.md 超 150 行时，精简或拆分：将背景性信息移到 `context.md`，将旧决策移到 `decisions.log.md`。
