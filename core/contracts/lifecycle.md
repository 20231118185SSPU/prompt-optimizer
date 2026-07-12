# Alignment Lifecycle Contract v1

## 状态机

```text
received -> analyzed
  -> awaiting_clarification       route=clarify
  -> blocked                      route=block
  -> ready_for_baseline           route=pass|enrich

awaiting_clarification --answer--> analyzed
blocked --confirmation/change--> analyzed
blocked --stop--> aborted

ready_for_baseline --baselineCheck-->
  ready_for_handoff | blocked(lifecycle.baseline_failed)

ready_for_handoff --issueExecutionHandoff--> handoff_issued
handoff_issued --execution receipt--> awaiting_completion_verification
awaiting_completion_verification --completionVerify-->
  verified | verification_failed | verification_inconclusive

terminal --precipitate--> terminal + precipitation receipt
```

澄清答案与 block 解除都必须重新进入 `analyze -> decide`。禁止把 confirmation 当作通行证直接进入执行。

## 公共操作

```text
decide(request, contextSnapshot) -> AlignmentDecision
baselineCheck(decision, runId, expectedRevision) -> BaselineReport
issueExecutionHandoff(baselineReportRef, acceptancePlanRef, scopeFingerprint) -> ExecutionHandoff
reportExecution(handoffId, executionReceipt) -> AwaitingCompletionVerification
completionVerify(executionReceipt, acceptancePlan) -> CompletionReport
precipitate(terminalState, signals) -> PrecipitationReceipt
```

每次 transition 必须校验 `runId + expectedRevision + phase`。revision 不匹配、阶段不匹配或重复调用必须返回结构化 `invalid_transition`，禁止猜测或继续执行。

## 阶段边界

- `decide`：只生成决定和 lifecycle plan；禁止运行 baseline 或 completion checks。
- `baselineCheck`：只检查执行前条件和 before snapshot；禁止产生 acceptance result。
- `issueExecutionHandoff`：只接受通过 baseline 的 `pass/enrich`；clarify/block 永不产生 handoff。
- `reportExecution`：必须引用已签发 handoff；失败或取消不会进入 completion verify。
- `completionVerify`：只接受已登记 execution receipt；输出 `verified / verification_failed / verification_inconclusive`。
- `precipitate`：只处理已确认的可复用信号；失败只能产生 warning，禁止改写 completion 状态。

## Host 能力

宿主必须分别披露 ingress、block、completion 的真实 enforcement。宿主只有 advisory 能力时不得把 `block` 降级为可执行；completion 不可观测时必须返回 `verification_inconclusive`，禁止声称 verified。
