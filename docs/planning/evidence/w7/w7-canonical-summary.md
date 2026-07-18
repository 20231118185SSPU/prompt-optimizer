# W7 Canonical Release-Gate Summary

> 证据日期：2026-07-18
> 状态：v7 production Gate 与 independent Blind Review 均通过；本文件是 W7 唯一 canonical summary。

本总结只引用冻结的 v7 evidence。它不宣称已经发布；本次工作禁止 push、tag、GitHub Release 和发布任何产物。

## 冻结输入与生产接口

- Corpus：`tests/eval/w7-production-fresh-corpus-v7.jsonl`
- Manifest：`tests/eval/w7-production-fresh-manifest-v7.json`
- Corpus ID：`w7-production-fresh-v7-2026-07-18`
- Corpus SHA-256：`8ea83637d908fc15afd98fd70f487c36fa787b3d810eca174edd24509741eb23`
- 冻结条件：manifest 的 `status=frozen`、`frozenBeforeExecution=true`，40 条 case 首次执行前已提交。
- 生产调用：`bash core/host/align-route.sh --decision "<request>"`
- W7 route/reason/action 断言没有使用 `--classify` 结果证明生产行为。

## W7 指标

证据：`w7-production-v7-production-gate.json`、`w7-production-v7-release-gate.json`。

| Gate | 实际 | 阈值 | 结果 |
| --- | ---: | ---: | --- |
| 高风险漏放率 | 0/8 = 0% | 0% | PASS |
| 完整请求误拦截率 | 0/8 = 0% | ≤10% | PASS |
| complete-low-risk | 8/8 = 100% | ≥90% | PASS |
| enrichable-context | 8/8 = 100% | ≥90% | PASS |
| direction-missing | 8/8 = 100% | ≥90% | PASS |
| high-risk-authorization | 8/8 = 100% | ≥90% | PASS |
| xy-problem | 4/4 = 100% | ≥90% | PASS |
| acceptance-relevance route | 4/4 = 100% | ≥90% | PASS |
| 验收相关率 | 2/2 = 100% | ≥90% | PASS |
| 实际澄清问题生成 | 14/14 = 100% | 100% | PASS |
| exact route/reason/action assertions | 40/40 | 全部通过 | PASS |

## Blind Review

Blind Review 只评审 verifier 实际生成的 `w7-production-v7-blind-input.jsonl`，没有读取 expected route、实现或参考答案：

- 输入：`w7-production-v7-blind-input.jsonl`
- 评审：`w7-production-v7-blind-review.json`
- release Gate：`w7-production-v7-release-gate.json`
- 独立 sub-agent 评审 14/14 条：最高价值问题、单问题、推荐答案均为 true。
- `releaseGatePassed=true`。

## 其他验证

| 验证 | 结果 |
| --- | --- |
| Jest | 26 suites / 382 tests passed |
| `bash tests/verify-build-idempotence.sh` | 两次 build 产物一致 |
| `bash tests/verify-golden-parity.sh` | 11/11 cases，44/44 projections |
| `bash tests/verify-adapter-conformance.sh` | 11/11 cases，55/55 projections |
| `bash tests/verify-cross-platform-parity.sh` | Bash/PowerShell dist 一致 |
| `bash tests/verify-distribution.sh` | runtime distribution 与 Claude/Codex adapter 通过 |
| `bash tests/verify-installer-wiring.sh` | 安装、升级、卸载与 hook 接线通过 |
| `powershell -File tests/verify-runtime-installer.ps1` | PowerShell runtime sandbox 通过 |
| `bash .align/align-check.sh` | core/.align 同步及项目检查通过 |
| `bash tests/verify-router.sh` | core/host 与 .align 各 42/42 |
| `bash tests/verify-router-input.sh` | JSON 隔离与 direct-output 风险通过 |
| `bash tests/verify-hook-exit-code.sh` | hook 退出码透传通过 |
| `bash build/build.sh` + `build/build.ps1` | parity 与语法检查通过 |

## 历史证据边界

v3-v6 的 production corpus 和 v6 的 Blind Review 仍作为 regression/失败尝试保留在本目录；它们不构成当前 release 结论。v6 Blind Review 的 compound-question 检出结果驱动了澄清问题拆分，之后新建并冻结 v7，未把 v6 结果冒充 fresh。
