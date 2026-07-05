# 代码风格预设

> 规范章节库：代码风格。每个预设提供可验证的规范条目。

## 预设 A：TypeScript + ESLint + Prettier（推荐）

```text
- 缩进：2 空格（.prettierrc 已配置）
- 引号：单引号（.prettierrc 已配置）
- 分号：无分号（.prettierrc 已配置）
- 命名：变量 camelCase，类型/接口 PascalCase，常量 UPPER_SNAKE_CASE
- 导入：按 alpha 排序（eslint-plugin-sort 已配置）
- 禁止 any：必须显式标注类型（eslint 规则 no-explicit-any）
- 禁止未使用变量（eslint 规则 no-unused-vars）
- 函数最大行数：50 行（eslint 规则 max-lines-per-function）
```

判定标准：`pnpm run lint` 能检查所有规则；`pnpm run format -- --check` 能验证格式。

## 预设 B：Python + Ruff + Black

```text
- 缩进：4 空格（black 已配置）
- 引号：双引号（black 已配置）
- 命名：变量 snake_case，类 PascalCase，常量 UPPER_SNAKE_CASE
- 行宽：88 字符（black 已配置）
- 导入：按 alpha 排序（ruff 规则 I001）
- 禁止未使用导入（ruff 规则 F401）
- 禁止未使用变量（ruff 规则 F841）
```

判定标准：`ruff check src/` 和 `black --check src/` 都能成功执行。

## 预设 C：Go + gofmt + golangci-lint

```text
- 缩进：Tab（gofmt 标准）
- 命名：导出标识符 PascalCase，未导出 camelCase
- 行宽：无硬限制，但建议 ≤100 字符
- 导入：分组（标准库/第三方/内部），组内按 alpha 排序
- 禁止未使用导入（go vet 检查）
- 函数复杂度：圈复杂度 ≤15（golangci-lint 规则 gocyclo）
```

判定标准：`gofmt -l .` 输出为空（无格式问题）；`golangci-lint run` 成功执行。
