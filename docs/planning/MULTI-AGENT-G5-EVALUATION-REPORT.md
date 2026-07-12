# G5 真实评测与发布准备报告

> 状态：已按“先修复再进入 G6”路径关闭。
> 日期：2026-07-12。
> 关闭口径：保留 frozen held-out 的原始失败证据，以独立盲评发现作为修复目标，再用已消费语料做确定性回归。该回归不是新的 held-out，也不是新的独立盲评。

## 证据口径

- **tuned 确定性行为评测（E2）**：56 条本地 analyzer + decision engine conformance set；参与过规则收敛，不是泛化证据。
- **一次性 held-out（E2 held-out）**：首次执行前冻结，执行后立即标记 consumed；后续不得复用为 held-out。
- **独立盲评**：评审者只看请求、fixture 和 runtime 行为，不看 expected route、oracle、实现或 benchmark arm。
- **修复后确定性回归**：复用 consumed corpus 检查已知失败是否修复；必须明确标记为 regression，不能冒充新 held-out。
- **真实模型 pilot（E5 pilot）**：Control、Protocol-only、Runtime 三臂单次小样本；只验证测量链路，不代表完整 benchmark。

## 评测历程

| 轮次 | 语料 | 关键结果 | 结论 |
| --- | --- | --- | --- |
| 初始 held-out | 20 条，SHA-256 `a7d7…1c2` | 高风险漏拦截 0%；不必要澄清 20%；独立问题命中 0/14；验收 2/6 | 失败并冻结证据 |
| R2 retest | 16 条，SHA-256 `cac5…1cb` | 高风险漏拦截 25%；不必要澄清 0% | 失败并冻结证据 |
| R3 final | 16 条，SHA-256 `82fe…f0e` | 高风险漏拦截 0%；不必要澄清 0%；独立 route 13/16；问题命中 0/8 | 失败并冻结证据 |
| 修复后 regression | 同一 R3 consumed corpus | 独立发现 conformance 16/16；问题 5/5；验收 11/11；方向安全 16/16 | 修复验收通过，不是新 held-out |

R3 原始 gate 继续保存在 `docs/planning/evidence/g5/held-out-final-gate-summary.json`，其 `releaseGatePassed` 仍为 `false`，禁止改写历史。

G5 关闭时的 runtime 使用整个 JS bundle 哈希，而非只哈希入口文件：

```text
runtimeHashKind: runtime-js-bundle-v1
runtimeSha256: 3eacde436d7db21bf6cd42024bf3876d27c91d638ac389b7cb12bbc5e5d854d2
```

G6 新增 handoff 后，复用同一 consumed corpus 做了一次新的确定性 regression（不是 fresh held-out），当前 bundle hash 为 `87ddc0a80d1d1ca354c8f05e52bf278d85425f0f4aa90d9d3b85d8eb2b2073e3`；route/conformance 仍为 16/16，问题 5/5，验收 11/11，方向安全 16/16。原始 blind input/review 与 R3 frozen gate 均未改写。

修复后回归仍按旧 frozen oracle 记录 `13/16`。其中 `R3Q01`、`R3Q03`、`R3Q04` 是有意偏离：独立盲评认为用户已明确授权在可接受方案中代选，或已经明确真实目标，不应继续阻塞。修复验收因此以独立评审意见为准，不篡改 consumed corpus 的旧 oracle。

## 修复内容

- 性能上下文不再被“数据库”字样误升为生产数据风险；p95 阈值和 benchmark 次数进入验收契约。
- 明确限定为本地的 CHANGELOG / release notes 准备不再索要 push、tag 或 publish 授权。
- 区分“用户尚未决定方向”和“用户明确接受列出的方案并授权代选”；后者在低风险、上下文可补全时执行。
- 收窄解释、总结和翻译的只读识别，防止执行请求因包含“翻译”等名词而误放行。
- 高风险澄清按类型命中发布渠道、地址映射、准确账号和密钥吊销，不再退化为通用范围或验收问题。
- “不得改”被识别为强反面约束；反引号中的验证命令不会再从 D5 证据中丢失。

对应机械证据：

- `docs/planning/evidence/g5/held-out-final-remediation-runtime-routes.jsonl`
- `docs/planning/evidence/g5/held-out-final-remediation-runtime-summary.json`
- `docs/planning/evidence/g5/held-out-final-remediation-gate-summary.json`
- `tests/eval/verify-g5-remediation.js`

## 确定性 Runtime Conformance

56 条 tuned corpus 继续由 `behavior-corpus.test.ts` 覆盖。修复后 TypeScript 全量测试为 15 suites、245 tests 全部通过，高风险语料没有被新规则放行。

该结果只证明确定性 runtime 行为和回归约束，不证明模型宿主会稳定遵循决定。

## 真实模型 Pilot

Claude Code CLI 三臂 pilot 已完成，每组 6 条、每条单次运行。Control / Protocol-only / Runtime 动作正确率分别为 83.33% / 100% / 100%，高风险漏拦截均为 0%。

限制保持不变：

- 样本小且未重复，不能估计稳定率或 Wilson 上界。
- 一问一答、验收完整和方向安全字段由被测模型自报，不作为 release gate 证据。
- 模型别名 `sonnet` 与 provider 实际模型标识 `mimo-v2.5-pro[1M]` 不一致，必须并列披露。
- Codex CLI 凭据失效，未产生可评分 Codex E5 结果。
- 完整三臂重复、真实执行成功率和返工轮数延后到稳定版债务。

## G5 Gate 状态

| Gate | 状态 | 证据/说明 |
| --- | --- | --- |
| benchmark 原始记录可复现 | 通过 | manifest、corpus/runtime/input hash、raw、review 和 summary 齐全 |
| 规则推演与真实模型分开 | 通过 | `evidenceKind` 和报告章节分离 |
| 高风险漏拦截为 0 | 通过 | R3 final 与修复后 regression 均为 0% |
| 不必要澄清率 ≤10% | 通过 | R3 final 与修复后 regression 均为 0% |
| 已知盲评失败已修复 | 通过 | remediation conformance：route 16/16，问题 5/5，验收 11/11，方向 16/16 |
| 旧 frozen gate 未被伪造 | 通过 | 原 gate 保持 `releaseGatePassed=false` |
| fresh post-fix 独立盲评 | 稳定版债务 | 本轮不再消耗额外外部评审余额；见 G5-D11 |
| LICENSE / SECURITY / 版本 / 支持口径 | 通过 | 候选版文档与 E2-E5 支持矩阵一致 |
| 全量 `.align/align-check.sh` | 通过 | 构建幂等、跨平台 parity、安装沙箱、证据隐私与 245 个 runtime 测试全部通过 |

## 结论

用户明确要求“先修复再进入”。本轮没有接受旧指标偏差，而是修复了独立盲评指出的行为问题，并用不可冒充 held-out 的 consumed-corpus regression 锁定结果。G5 可以在该证据偏差说明下关闭；fresh post-fix 独立盲评保留为稳定版前债务。

G6 只解锁生态 handoff 的选择与实现，不授权 commit、push、publish 或 release。
