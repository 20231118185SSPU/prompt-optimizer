# Context Taxonomy v1

## 分类职责

| 类别 | 唯一职责 | 目标位置 | 大小纪律 |
| --- | --- | --- | --- |
| Facts | 稳定、可复用、当前可接受为真的项目属性 | `.align/facts.md` | ≤100 行；每项必须有 source ref |
| Glossary | 项目特有的规范术语、定义和禁用叫法 | `.align/glossary.md` | ≤50 个术语；每项≤2句 |
| Rules | 可执行的“必须/禁止/命中 X 就做 Y”约束 | `.align/spec.md` | ≤150 行；事实和理由移出 |
| Lessons | 能改变下次行为的踩坑或纠正规则 | `.align/lessons.md` | 每项≤2行；超50条归档 |
| Decisions | 已接受选择、理由、影响和状态 | `.align/decisions.log.md` | 每项≤5行；超100条归档 |
| ADR | 难逆、非显然且经过真实取舍的架构决策 | `docs/adr/NNNN-*.md` | 一项一文件；证据外链 |
| Temporary state | 当前里程碑、blocker、迁移阶段 | `.align/state.md` | ≤40行；含 updatedAt 和失效条件 |
| Completion evidence | 执行后验收结果 | 本地 evidence store | 每次摘要≤20行；原始日志只引用 |

## 边界规则

- 项目 facts 是可复用知识；请求级 facts 只进入该次 Alignment Decision 快照。
- glossary 只定义术语，不保存实现选择、阶段或行为规则。
- decision 解释“为什么选”；由 decision 派生的强制行为必须进入 spec 并引用 decision/ADR。
- lesson 是经验候选；提升为团队规则后必须迁入 spec，禁止两处长期重复。
- 项目 state 可以持久化；请求的 `runId/revision/phase` 属于 lifecycle 内部状态，终态后清理。
- acceptance criteria 是执行前契约；completion evidence 是执行后结果，禁止复用字段。
- `.align/state.md` 只有无敏感摘要可提交；completion evidence 默认本地、不提交。

## 迁移与兼容

1. 先在 legacy `context.md` 中逻辑分区，再迁移到分类文件。
2. 无法可靠分类的条目原样保留并进入待确认清单，禁止静默猜测。
3. 新 loader 优先读取分类文件；三个分类文件未齐全时同时读取 legacy `context.md`，全部缺失时只读 legacy。
4. 新 writer 只写分类 SSOT，再生成带 digest 的 `context.md` 兼容投影。
5. 检测到旧 agent 修改兼容投影时必须报警并进入显式合并，禁止覆盖。
6. 兼容投影至少保留一个 minor，只允许在 major 移除。
7. 必测 old-only、new-only、both-consistent、both-divergent、重复升级、回滚和内容零损伤。
