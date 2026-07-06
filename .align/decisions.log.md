# 重大决策日志

> 由 align-init 自举生成。初始为空。
> 大小纪律：每条 ≤5 行，超 100 条归档。

<!-- 沉淀门（门 5）自动追加重大决策到此处 -->

- [缺陷确认] align-init 原设计只生成 .align/ 四件套和挂载区，未做 hook 接线（settings.json 合并 + HOOK-REMINDER.txt 生成），导致"无强制手段"
  影响：align-init SKILL.md 已补 Hook 接线章节（core/ 侧修改并 build）；后续接入项目必须完成三件套接线
  依据：踩坑验证（用户反馈"没效果"，实地检查确认三处链路全断）
  日期：2026-07-06

- [架构决策] 强制力下沉到机械层（L1）：确定性路由 hook + PreToolUse 硬拦截 + align-check 验证脚本
  影响：路由/拦截/验证不再依赖模型自觉，弱模型同样被兜底；灰区仲裁用用户默认模型（不假设有小模型），超时降级 VAGUE
  依据：用户确认（弱模型支持需求 + "hook 需要强大"反馈 + "一个模型用到底"约束）
  日期：2026-07-06

- [产品决策] 新增 optimize-prompt-lite 轻协议（105 行 IF-THEN，7 规则 3 红线）作为第三个 skill
  影响：弱模型/无 hooks 宿主用 lite 替代 1800 行完整协议；build 三 adapter 产出；安装器默认三 skill 同装
  依据：用户确认（"许多性能较弱的模型也要能做好" + 蓝图批准）
  日期：2026-07-06

- [缺陷修复] hook 接线断口：安装器漏装 hooks/ + SKILL.md 示范 CWD 相对路径 + 简化版 align-route.sh 流入生产
  影响：接入项目后对齐静默失效，用户"没变化"；v3.1 修复三处：安装器补 hooks/ 复制、SKILL.md 改 $CLAUDE_PROJECT_DIR 锚定、降级报错
  依据：踩坑验证（PPT Hell 实测：64 行简化版 vs 180 行完整版，三件套全齐但 script 不读 stdin）
  日期：2026-07-06

- [产品决策] VAGUE 分类器扩展氛围编程创建类动词 + 人话输出 + R8 具体化 + BLOCK_ON_HIGH 机械拦截
  影响：氛围编程者最常见指令（做个/加个/写个）不再误判 CLEAR 绕过对齐；输出从 verdict=X 改为 [对齐] 人话；R8 读 check-commands.txt 实际命令；BLOCK_ON_HIGH=on 时 exit 2 阻断
  依据：用户确认（"氛围编程者定位" + "两者都修分阶段" + 达成度评估 40%→显著提升）
  日期：2026-07-06
