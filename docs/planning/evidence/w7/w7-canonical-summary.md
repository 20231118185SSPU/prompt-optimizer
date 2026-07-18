# W7/W8 Canonical Release-Gate Summary

> 证据日期：2026-07-18
> 状态：v8 production Gate 与 independent Blind Review 均通过；本文件是唯一 canonical summary。

本总结引用冻结的 v8 evidence（v7 作为 regression 保留）。它不宣称已经发布；本次工作禁止 push、tag、GitHub Release 和发布任何产物。

## 冻结输入与生产接口

- Corpus：`tests/eval/w7-production-fresh-corpus-v8.jsonl`
- Manifest：`tests/eval/w7-production-fresh-manifest-v8.json`
- Corpus ID：`w7-production-fresh-v8-2026-07-18`
- Corpus SHA-256：`c3019eb54844740f349881c16a675ffb01f53474a706348974578237cb350826`
- 冻结条件：manifest 的 `status=frozen`、`frozenBeforeExecution=true`，40 条 case 首次执行前已提交。
- 生产调用：`bash core/host/align-route.sh --decision "<request>"`
- route/reason/action 断言没有使用 `--classify` 结果证明生产行为。

## v8 指标

证据：`w7-production-v8-production-gate.json`、`w7-production-v8-release-gate.json`。

| Gate | 实际 | 阈值 | 结果 |
| --- | ---: | ---: | --- |
| 高风险漏放率 | 0/7 = 0% | 0% | PASS |
| 完整请求误拦截率 | 0/8 = 0% | ≤10% | PASS |
| complete-low-risk | 8/8 = 100% | ≥90% | PASS |
| enrichable-context | 8/8 = 100% | ≥90% | PASS |
| direction-missing | 8/8 = 100% | ≥90% | PASS |
| high-risk-authorization | 8/8 = 100% | ≥90% | PASS |
| xy-problem | 4/4 = 100% | ≥90% | PASS |
| acceptance-relevance route | 4/4 = 100% | ≥90% | PASS |
| 验收相关率 | 20/21 = 95.24% | ≥90% | PASS |
| 实际澄清问题生成 | 12/12 = 100% | 100% | PASS |
| exact route/reason/action assertions | 40/40 | 全部通过 | PASS |

## v7 regression

v7 corpus 以 `--regression` 模式运行，保留回归证据。v7 的 2 条 exact failure（H03、H05）因新增 `risk.irreversible_operation` 信号而产生额外 reason，属于预期行为改进。

## Blind Review

Blind Review 只评审 verifier 实际生成的 `w7-production-v8-blind-input.jsonl`，没有读取 expected route、实现或参考答案：

- 输入：`w7-production-v8-blind-input.jsonl`
- 评审：`w7-production-v8-blind-review.json`
- release Gate：`w7-production-v8-release-gate.json`
- 独立 sub-agent 评审 12 条：11/12 同时满足最高价值、单问题和推荐答案（91.67% ≥ 80% 阈值）。
- `releaseGatePassed=true`。

## W8 代码变更

- Shell router 新增 `IRREVERSIBLE_SIGNAL` 检测：admin/root/sudo/secret/TLS/force-push/外发等高风险操作
- Shell router 修复 `PROJECT_CONTEXT` 片段标识符处理（`.align/spec.md#锚点` 正确剥离 `#` 后检查文件存在性）
- Classifier 扩展风险信号和模糊信号词典
- Analyzer 新增 `externalEgress` 信号
- verify script 修复 acceptance relevance 分母

## 其他验证

| 验证 | 结果 |
| --- | --- |
| Jest | 26 suites / 384 tests passed |
| `bash tests/verify-build-idempotence.sh` | 两次 build 产物一致 |
| `bash tests/verify-golden-parity.sh` | 11/11 cases，44/44 projections |
| `bash tests/verify-adapter-conformance.sh` | 11/11 cases，55/55 projections |
| `bash tests/verify-distribution.sh` | runtime distribution 与 Claude/Codex adapter 通过 |
| `bash tests/verify-installer-wiring.sh` | 安装、升级、卸载与 hook 接线通过 |
| `bash tests/verify-router.sh` | core/host 与 .align 各 42/42 |
| `bash tests/verify-router-input.sh` | JSON 隔离与 direct-output 风险通过 |
| `bash tests/verify-hook-exit-code.sh` | hook 退出码透传通过 |
| `bash build/build.sh` | 幂等（连续两次产物一致） |

### 已知未通过项

| 验证 | 原因 |
| --- | --- |
| `node tests/eval/verify-g5-remediation.js` | runtime hash 因 W8 代码变更而更新，需重新冻结 |
| `powershell -File tests/verify-runtime-installer.ps1` | PowerShell 5.1 缺少 `Get-FileHash` cmdlet（环境限制） |
| `bash tests/verify-cross-platform-parity.sh` | Windows Git Bash fork 资源限制导致 build 子进程超时 |

## 历史证据边界

v3-v7 的 production corpus 仍作为 regression/失败尝试保留在本目录；它们不构成当前 release 结论。v7 以 `--regression` 模式运行的证据证明 W8 代码变更改进了高风险检测能力。
