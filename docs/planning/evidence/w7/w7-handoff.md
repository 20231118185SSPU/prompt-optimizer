# W7 后续会话指令

> 日期: 2026-07-18
> 当前 HEAD: 03c4c31
> 分支: codex/v4-focus-baseline

## 当前状态

W7 路由器优化已完成，所有核心指标达标：

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 高风险漏放率 | 0% | 0% | ✅ PASS |
| 完整请求误拦截率 | ≤10% | 0% | ✅ PASS |
| XY Problem 检测 | ≥90% | 100% | ✅ PASS |
| enrichable-context | ≥90% | 100% | ✅ PASS |
| complete-low-risk | ≥90% | 100% | ✅ PASS |

## 下一步任务

### 1. 创建新 fresh corpus（必须）

当前 corpus 已被标记为 `consumedAfter`，不能再用于 blind 评估。

**操作步骤**：
1. 创建新的 40 条请求（参考 `tests/eval/w7-fresh-blind-corpus.jsonl` 格式）
2. 更新 manifest 文件
3. 运行验证脚本生成新证据
4. 更新分析文档

**文件位置**：
- 语料: `tests/eval/w7-fresh-blind-corpus-v2.jsonl`
- Manifest: `tests/eval/w7-fresh-manifest-v2.json`
- 验证脚本: `tests/eval/verify-w7-fresh-corpus-v2.js`
- 证据: `docs/planning/evidence/w7/w7-fresh-execution-v2.json`

### 2. Independent blind review（需要人工）

审查 clarify 问题是否命中最高价值缺口。

**操作步骤**：
1. 准备 review 材料（clarify 请求和对应问题）
2. 人工 reviewer 审查
3. 记录审查结果
4. 计算最高价值问题命中率

**指标目标**：≥80%

### 3. 发布门验证

完成所有指标计算并验证是否达标。

**检查清单**：
- [ ] 高风险漏放率 0%
- [ ] 完整请求误拦截率 ≤10%
- [ ] 最高价值问题命中率 ≥80%
- [ ] 验收相关率 ≥90%
- [ ] route appropriateness 每类 ≥90%
- [ ] fresh、blind、review、summary、runtime hash 证据齐全
- [ ] README、CHANGELOG、MIGRATION、INSTALL、USAGE 一致

### 4. v4 发布准备

所有指标达标后，准备 v4 发布。

**操作步骤**：
1. 更新 README.md
2. 更新 CHANGELOG.md
3. 更新版本号
4. 创建发布分支
5. 运行全量测试
6. 提交 PR

## 关键文件

**协议内核**：
- `core/protocol/00-positioning.md` 到 `07-precipitation.md`

**路由器**：
- `core/host/align-route.sh`

**构建**：
- `build/build.ps1` (Windows)
- `build/build.sh` (macOS/Linux)

**验证**：
- `tests/eval/verify-w7-fresh-corpus.js`
- `.align/align-check.sh`

**证据**：
- `docs/planning/evidence/w7/`

## 注意事项

1. **不要修改已 consumed 的 corpus**：当前 corpus 已被标记为 `consumedAfter`，不能再用于 blind 评估
2. **不要手工编辑 dist/**：dist/ 是构建产物，只能由 build 脚本生成
3. **不要弱化规则**：保持"必须/禁止/重做条件"的强度
4. **运行 build 后验证**：修改 core/ 后必须运行 build 并验证 dist/ 更新

## 参考文档

- `docs/planning/V4-FOCUS-IMPROVEMENT-PLAN.md` - W7 完整计划
- `docs/planning/evidence/w7/w7-analysis.md` - 执行分析
- `docs/planning/evidence/w7/w7-status.md` - 状态总结
- `AGENTS.md` - 开发规范
