# 技术栈预设

> 规范章节库：技术栈与版本。每个预设提供可验证的规范条目。
> `align-init` 根据扫描或访谈结果选择最接近的预设，填入实际版本号。

## 预设 A：React + TypeScript（Web 应用）

```text
- 语言：TypeScript 5.x
- 框架：React 18.x
- 构建：Vite 5.x
- 包管理：pnpm 8.x
- 测试：Vitest 1.x
- Lint：ESLint 8.x + @typescript-eslint
- 格式化：Prettier 3.x
```

判定标准：`package.json` 的 `dependencies` 和 `devDependencies` 包含上述包及版本号。

## 预设 B：Node.js + TypeScript（API 服务）

```text
- 语言：TypeScript 5.x
- 运行时：Node.js 20.x
- 框架：Fastify 4.x
- 包管理：pnpm 8.x
- 测试：Vitest 1.x
- Lint：ESLint 8.x + @typescript-eslint
- 格式化：Prettier 3.x
- 数据库：PostgreSQL 16.x + Drizzle ORM
```

判定标准：`package.json` 包含上述依赖；`tsconfig.json` 的 `target` 为 `ES2022` 或更高。

## 预设 C：Python（数据分析/CLI）

```text
- 语言：Python 3.11+
- 包管理：poetry 1.x
- 测试：pytest 7.x
- Lint：ruff 0.1.x
- 格式化：black 23.x
- 类型检查：mypy 1.x
```

判定标准：`pyproject.toml` 的 `[tool.poetry.dependencies]` 包含上述包及版本号。
