# Legacy Context Projection

> 目标文件：`.align/context.md`。本文件只用于兼容旧 consumer，由 `align-init` 或 `align-cli context-project` 生成，禁止手动修改。
> 权威来源：`.align/facts.md`、`.align/glossary.md`、`.align/state.md`。架构决策只进入符合门槛的 ADR。

## 生成约束

- 三个分类文件齐全后才能生成投影。
- 文件头必须包含 `context-source-sha256` 和 `context-content-sha256`。
- source digest 未变化时重复生成必须逐字节一致。
- content digest 与正文不匹配时判定为 divergent projection，禁止自动覆盖。
- 三个分类文件未齐全时，新 loader 必须同时读取 legacy；全部缺失时只读 legacy。
- minor 回滚必须保留本文件。只有 major 版本且迁移工具、弃用提示和 old-only 回归齐全时才能移除。

## 生成格式

```markdown
<!-- Generated compatibility projection. Do not edit.
context-source-sha256:<digest of facts/glossary/state>
context-content-sha256:<digest of generated body>
-->

# Legacy Context Projection

## Project Facts

<generated from facts.md>

## Glossary

<generated from glossary.md>

## Temporary State

<generated from state.md>
```

禁止在投影中手工新增规则、术语、状态或决策。应修改对应分类 SSOT，再重新生成投影。
