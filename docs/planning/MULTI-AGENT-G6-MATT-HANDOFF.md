# G6 Matt Pocock Skills handoff 报告

> 状态：已关闭。实现、回归、构建和两轴审查均通过。
> 日期：2026-07-12。
> 范围：波次 6 只实现一个生态 handoff；本轮选择 Matt Pocock Skills。

## 冻结决策

- `Alignment Decision v1` 保持不变；新增独立 `alignment.ecosystem-handoff` envelope。
- 公共纯函数为 `buildMattHandoff()`；显式 CLI 为 `align-cli matt`。
- 普通 pipeline 与 `align-cli json` 保持原输出，不隐式附加 handoff。
- handoff 只引用 skill 名和 invocation，不复制 skill 正文，不自动调用；`automatic` 固定为 `false`。
- `clarify` / `block` 固定返回 `deferred`，禁止通过下游 skill 绕过原 route。
- 一次只实现 Matt handoff，不引入 OpenSpec、Superpowers 或 ECC adapter。

## Envelope 与状态

公共 schema：`core/contracts/ecosystem-handoff.schema.json`。

| 状态 | 判定 |
| --- | --- |
| `ready` | 所选 skill 的 `SKILL.md` 已发现，项目 setup 三文件齐全 |
| `setup_required` | 所选 skill 已发现，但 `docs/agents/issue-tracker.md`、`triage-labels.md`、`domain.md` 未齐全 |
| `unavailable` | 所选 skill 的 `SKILL.md` 未发现 |
| `deferred` | source route 为 `clarify` 或 `block` |

环境发现检查项目与用户的 `.agents/skills`、`.claude/skills`、`.codex/skills`，以及默认 `CODEX_HOME/skills`。只检查已知 skill 目录下是否存在 `SKILL.md`；发现路径不会进入 envelope。

## 确定性映射

按优先级选择第一个匹配项：

1. `code-review`
2. `diagnosing-bugs`
3. `prototype`
4. `to-tickets`
5. `to-spec`
6. `tdd`
7. `grill-with-docs`
8. `implement`
9. `ask-matt` fallback

映射只负责建议调用入口。skill 自身继续拥有 grilling、prototype、spec、tickets、TDD、实现或审查流程。

## CLI 契约

```text
align-cli matt "<instruction>" --project-dir "<dir>"
```

- stdout：仅一行 handoff JSON。
- stderr：仅 route/status 简短披露。
- `ready`、`setup_required`、`unavailable`、`deferred` 均返回结构化 envelope；CLI 不启动交互式 setup。

本仓库当前已发现所选 Matt skills，但未发现 `docs/agents/` setup 三文件。本地实测因此为：

```text
[alignment] route=pass status=setup_required
```

这不是运行时故障，也不能擅自修复为“已 setup”；是否运行 `/setup-matt-pocock-skills` 保留给用户决定。

## 变更范围

- Runtime：`matt-handoff.ts`、pipeline 可选参数、`index.ts` 导出和 CLI mode。
- 契约：独立 ecosystem handoff schema 与 Ajv 正反例。
- 测试：环境发现、九类映射、四状态、route 防绕过、CLI 通道分离和旧 `json` 回归。
- 文档：核心 skill、契约说明、README、USAGE、INSTALL、生态边界和本报告。
- 分发：只通过 `build/` 从 `core/` 生成 runtime 与 skill 产物，未手改 `dist/`。

## Gate

| Gate | 状态 | 证据 |
| --- | --- | --- |
| 聚焦 runtime/CLI 测试 | 通过 | 3 suites、33 tests |
| 独立 schema 正反例 | 通过 | 1 suite、8 tests；含 skill/invocation registry 一致性 |
| TypeScript build | 通过 | `npm run build` |
| TypeScript 全量测试 | 通过 | 17 suites、273 tests |
| 双构建幂等与跨平台 parity | 通过 | `verify-build-idempotence.sh`、`verify-cross-platform-parity.sh` |
| G5 consumed-corpus regression | 通过 | 16/16 route/conformance；问题 5/5、验收 11/11、方向安全 16/16；bundle `87ddc0a80d1d1ca354c8f05e52bf278d85425f0f4aa90d9d3b85d8eb2b2073e3` |
| `.align/align-check.sh` | 通过 | 全部项目验证命令通过；债务台账仍有 5 项既有稳定版债务 |
| Standards / Spec 两轴审查 | 通过 | 本地审查；修复 claims 顺序和 `preview` 误匹配，不追加外部模型调用 |

## 风险与非目标

- 当前映射是可测试的关键词优先级，不是模型编排器；未命中时回退 `ask-matt`。
- 本项目不分发 Matt Pocock Skills，也不保证目标宿主已安装这些 skills。
- 本轮不执行被推荐的 skill，因此不声称下游工程任务已经完成。
- 本轮不创建 issue tracker 配置，不 commit、不 push、不发布 release。
