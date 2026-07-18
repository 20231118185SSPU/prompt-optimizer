# W7 状态总结

> 日期: 2026-07-18
> 基线: fdebec6 (feat: implement W6 unified /align router and setup experience)
> 当前 HEAD: 1316c4d (feat: add W7 fresh blind corpus and execution evidence)

## 已完成任务

### ✅ W7-01: Fresh blind corpus
- 40条自然请求，6个类别
- 冻结 hash 和 manifest
- 文件: `tests/eval/w7-fresh-blind-corpus.jsonl`, `tests/eval/w7-fresh-manifest.json`

### ✅ W7-02: 执行验证脚本
- 自动化路由器执行和证据生成
- 文件: `tests/eval/verify-w7-fresh-corpus.js`

### ✅ W7-03: 首次执行证据
- 路由器执行结果
- 文件: `docs/planning/evidence/w7/w7-fresh-execution.json`

### ✅ W7-04: 执行分析
- 详细分析假阴性和假阳性
- 路由器改进建议
- 文件: `docs/planning/evidence/w7/w7-analysis.md`

## 待完成任务

### ⏳ W7-05: 路由器修复
根据分析结果修复路由器:
1. 扩展 `RISK_RE` 模式（添加权限、密钥、禁用等安全敏感词）
2. 添加 `XY_RE` 模式检测 XY Problem
3. 调整 GRAY 判定逻辑

**状态**: 已提出修复方案，待实现

### ⏳ W7-06: 回归语料
修复路由器后必须创建新的 fresh corpus:
- 不能复用已 consumed 的 corpus
- 需要新的 40 条请求
- 需要新的 manifest 和验证脚本

**状态**: 待路由器修复后创建

### ⏳ W7-07: Independent blind review
需要人工 reviewer 或模拟:
- 审查 clarify 问题是否命中最高价值缺口
- 审查路由决策是否合理

**状态**: 需要人工介入

### ⏳ W7-08: Real model benchmark
三臂对照实验:
- Control: 原始模型和请求
- Protocol-only: 只注入精简协议
- Runtime: 完整 Decision + enforcement

**状态**: 需要预算，当前无预算

### ⏳ W7-09: 发布门验证
完成所有指标计算:
- 高风险漏放率: 37.5% ❌ (目标 0%)
- 完整请求误拦截率: 25% ❌ (目标 ≤10%)
- 最高价值问题命中率: N/A (需人工 reviewer)
- 验收相关率: 100% ✅ (目标 ≥90%)
- route appropriateness: 部分类别不达标

**状态**: 待路由器修复后重新验证

## 风险与阻塞

1. **高风险漏放率 37.5%**: 远高于 0% 目标，必须修复路由器
2. **XY Problem 检测缺失**: 路由器完全没有 XY Problem 检测
3. **Windows fork 问题**: align-check 脚本在 Windows 上有 fork 问题
4. **无预算进行真实模型对照**: 无法完成 W7-08

## 下一步行动

1. **立即**: 修复路由器（扩展 RISK_RE，添加 XY_RE）
2. **修复后**: 创建新的 fresh corpus 并重新执行验证
3. **验证后**: 计算所有发布门指标
4. **指标达标后**: 进行人工 blind review
5. **所有任务完成后**: 准备 v4 发布

## 提交记录

```
1316c4d feat: add W7 fresh blind corpus and execution evidence
fdebec6 feat: implement W6 unified /align router and setup experience
```

## 文件清单

**新增文件:**
- `tests/eval/w7-fresh-blind-corpus.jsonl` - 40条 fresh blind 语料
- `tests/eval/w7-fresh-manifest.json` - 语料 manifest
- `tests/eval/verify-w7-fresh-corpus.js` - 执行验证脚本
- `docs/planning/evidence/w7/w7-fresh-execution.json` - 执行证据
- `docs/planning/evidence/w7/w7-analysis.md` - 执行分析
- `docs/planning/evidence/w7/w7-status.md` - 本文件

**修改文件:**
- `dist/` - 由 build 脚本重新生成
