# My Project

## User Rules

- Always use TypeScript
- Never commit directly to main
- Code review required for all PRs

<!-- align-protocol:begin v3.0 -->
## 对齐协议（Alignment Protocol）

每条开发指令执行前，静默完成三档路由评估：

1. 读取 .align/lessons.md → .align/spec.md → .align/context.md
2. 五维快评：简单且明确 → 直接执行（但交付前必须自验证）
3. 有缺口但项目上下文可补全 → 开头展示 ≤3 行补全回执（补全内容 + 来源 + `撤销补全 <ID>`），然后直接执行
   收到撤销口令时停止沿用指定项，回到原始请求重新分析；已产生改动则先报告，未经确认不自动回滚
4. 高风险（见 .align/spec.md 高风险清单）或总分<6 或假设>2 条
   → 停下澄清，一次只问一个问题并给推荐答案
5. 任务结束：有踩坑/纠正/新约定 → 追加到 .align/lessons.md

硬性红线：高风险静默假设 = 无效输出；交付前不验证 = 无效输出。
<!-- align-protocol:end -->

## More User Rules

- Tests must pass before merge
- Use conventional commits
- Keep functions under 50 lines

## Custom Instructions

This is my custom content that should never be touched by the alignment protocol.
If this content is modified or deleted, the uninstall/upgrade is broken.
