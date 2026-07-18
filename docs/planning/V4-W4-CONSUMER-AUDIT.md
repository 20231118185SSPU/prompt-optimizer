# V4 W4 Consumer Audit

> 本记录对应 W4-01/W4-02/W4-03。命令来源是 `tests/verify-w4-surface.sh`；不把生成的 `dist/` 文件当作独立 consumer。

## 真实 consumer graph

| module | 生产调用者 | 其他仓库 consumer | W4 处置 |
| --- | --- | --- | --- |
| `classifier` | 顶层 deprecated compatibility export | 旧测试、历史 compose 方案 | 保留一个 minor 窗口 |
| `router` | 顶层 deprecated compatibility export | 旧测试、历史 compose 方案 | 保留一个 minor 窗口 |
| `verifier` | `internal.ts`、`lifecycle.ts` | 旧测试、integration 测试 | 从 root 移到 internal |
| `lifecycle` | `internal.ts` | 旧 lifecycle 测试 | 从 root 移到 internal；不宣称 reference-host 闭环 |
| `matt-handoff` | `matt-cli.ts`、`internal.ts`、deprecated pipeline branch | ecosystem schema/行为测试 | CLI 组合；旧 branch 仅兼容窗口 |
| `rules/generate` | `internal.ts` | 旧规则生成测试、历史 compose 方案 | 从 root 移到 internal；无生产 Adapter |

`pipeline.ts` 的普通路径只读取 `acceptance-plan.ts`，不静态加载上述 shallow module；Matt 依赖仅在显式兼容选项或 `matt` CLI 分支 lazy load。

## Public export inventory

构建后的 `dist/runtime/runtime/index.js` 当前公开：

```text
VERSION
alignInstruction
classify              # deprecated compatibility projection
projectAlignmentDecision
route                 # deprecated compatibility projection
writeContextProjection # legacy context-project CLI capability
```

`processInstruction`、`buildAlignmentDecision`、analyzer、verifier、lifecycle、Matt handoff 和规则生成器位于 `dist/runtime/runtime/internal.js` 或其内部模块，不再是 root interface。

## Deletion test

`bash tests/verify-w4-surface.sh` 会在临时 runtime 副本中同时移除 `classifier`、`router`、`verifier`、`lifecycle`、`matt-handoff`、`matt-cli`、`rules/generate` 和 `internal`，然后仅通过 `alignment-interface.js` 的 `alignInstruction()` 运行一个 pass corpus case。当前结果：

```text
PASS: core Decision survives deletion of shallow compatibility modules
```

受保护的 W3 兼容测试仍保留旧 `ecosystem` 分支覆盖；W4 新测试只通过 root `alignInstruction`/host projection seam。
