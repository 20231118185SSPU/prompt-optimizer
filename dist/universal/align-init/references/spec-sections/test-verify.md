<!--
Generated from core/spec-kit/spec-sections/test-verify.md
Generated from core/
Do not edit dist/ manually
-->

# 测试与验证命令预设

> 规范章节库：测试与验证命令。每个预设提供可验证的规范条目。

## 预设 A：全量验证（推荐）

```text
- 单元测试：`pnpm test`
- 模块测试：`pnpm test -- {模块名}`
- 类型检查：`tsc --noEmit`
- Lint：`pnpm run lint`
- 构建：`pnpm run build`
- E2E：`pnpm run e2e`（如有）
- 提交前必须跑：`pnpm test && tsc --noEmit && pnpm run lint`
- CI 流程：push 时自动跑 lint + test + build
```

判定标准：`pnpm test` 和 `tsc --noEmit` 和 `pnpm run lint` 三个命令都能成功执行。

## 预设 B：最小验证（小项目）

```text
- 测试：`npm test`
- Lint：`npm run lint`（如有配置）
- 提交前必须跑：`npm test`
```

判定标准：`npm test` 能成功执行。

## 预设 C：Python 验证

```text
- 单元测试：`pytest`
- 模块测试：`pytest tests/{模块名}/`
- 类型检查：`mypy src/`
- Lint：`ruff check src/`
- 格式化检查：`black --check src/`
- 提交前必须跑：`pytest && mypy src/ && ruff check src/`
```

判定标准：`pytest` 和 `mypy src/` 和 `ruff check src/` 三个命令都能成功执行。
