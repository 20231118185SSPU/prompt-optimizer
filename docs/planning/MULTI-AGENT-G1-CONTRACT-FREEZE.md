# G1 Contract Freeze 报告

> 日期：2026-07-11
> 波次：G1 公共契约冻结
> Gate 结论：**PASS（契约范围）**
> 仓库健康：**FAIL（既知 P0 route 副本漂移，转入 G2 首项修复）**

## 冻结结论

- 机器 route 固定为 `pass / enrich / clarify / block`；A/B/C 仅为展示档位。
- `clarify` 只表示契约信息缺失；`block` 只表示授权、政策或 baseline 条件禁止执行。
- `[直出]` 只改变 presentation，并与 `override.explicit_direct_output` 双向绑定，禁止 bypass 安全阀。
- 只有 `pass/enrich` 能生成 execution handoff；clarify/block 的 lifecycle plan 禁止 baseline/completion。
- baseline observation、ExecutionHandoff、execution receipt、completion report、precipitation receipt 使用独立 envelope。
- facts/inferences/assumptions 与 source kind/ref 使用双轴模型。
- `.align/` 目标为物理分类拆分；legacy `context.md` 至少兼容一个 minor，只允许在 major 移除。
- Node runtime 可选，shell fallback 必须保留最小决策投影；Ajv 8 仅为 schema 测试 devDependency。

## 契约 SSOT

- `core/contracts/alignment-decision.schema.json`
- `core/contracts/decision-policy.json`
- `core/contracts/decision-policy.schema.json`
- `core/contracts/reason-registry.json`
- `core/contracts/lifecycle-event.schema.json`
- `core/contracts/lifecycle.md`
- `core/contracts/context-taxonomy.md`
- `core/contracts/golden/alignment-cases.jsonl`

硬门槛数值、route 优先级和组合规则的唯一机器定义是 `decision-policy.json`。`core/protocol/02`、`03`、`05`、`06` 保留中文执行投影，并显式指向该 SSOT。

## G1 验收

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 每个硬门槛只有一个规范定义 | PASS | policy schema + 四份 protocol SSOT 指针 |
| 每个 route 有进入、退出和 next action | PASS | policy first-match evaluator + decision schema route 分支 |
| 每个 reason code 有唯一含义 | PASS | reason registry 唯一 code 测试 + phase/route 校验 |
| schema 有正例、反例和版本策略 | PASS | 29 项 contract tests + JSONL golden + contracts README |
| 无上下文 consumer 可按文档实现 | PASS | 封闭 policy grammar、未知操作符 fail closed、完整 lifecycle envelope |
| 用户决策与项目事实分离 | PASS | `.align/decisions.log.md` + 双轴 claim/source 模型 |

## 评审修复

Standards/Spec 双轴评审发现并修复：

- route 与 lifecycle plan 未绑定。
- `[直出]` 与 audit reason 未双向约束。
- reason 组合优先级没有机器定义。
- baseline/completion reason 无对应 lifecycle 字段或 phase 校验。
- 完整 6–7 分请求没有合法 route。
- ExecutionHandoff 缺少公共机器契约。
- policy DSL 没有 schema、求值语义和冲突测试。
- Ajv 新依赖缺少用户授权；现已明确批准并记录为 dev-only。

## 验证结果

- `npm test -- --runInBand`：8 suites、132 tests 全部通过。
- `npm run build`：TypeScript 编译通过。
- `bash -n build/build.sh`：通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File build/build.ps1 -WhatIf`：通过。
- `bash build/build.sh` 连续两次：通过；构建产物已同步。
- `bash tests/verify-uninstall.sh`：通过（由 align-check 执行）。
- `bash tests/verify-router.sh`：通过（由 align-check 执行）。
- `bash tests/verify-installer-wiring.sh`：通过（由 align-check 执行）。
- `git diff --check`：通过。

## 剩余风险

`bash .align/align-check.sh` 仍为 FAIL，唯一失败项是：

```text
diff .align/align-route.sh core/host/align-route.sh
```

该漂移已在波次 0 基线登记，不属于 G1 契约文件。G2 必须先恢复 runtime 副本一致性，再修复 `[直出]` bypass、入站误跑 completion verification 与 hook 吞阻断退出码。未经这些修复，不得声明 runtime 已符合冻结契约。
