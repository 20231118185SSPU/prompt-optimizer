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

- [架构决策] SSOT 架构：core/ 为唯一事实来源，dist/ 由 build/ 脚本生成
  影响：消灭镜像手工同步，所有内容只改 core/，跑 build 生成 dist/；禁止手改 dist/
  依据：用户确认（v3.0 架构重设计方案批准）
  日期：2026-07-06

- [架构决策] 三档路由（A 直通/B 静默对齐/C 浮出澄清）替代 v2.0 显式触发
  影响：对齐从"拉"变"推"，默认静默执行，不展示完整 Agent Brief；高风险才打断
  依据：用户确认（解决 v2.0"触发是拉不是推"和"输出是展示不是执行"局限）
  日期：2026-07-06

- [架构决策] .align/ 运行时目录（spec+context+lessons+decisions）作为项目态
  影响：接入项目后自动读取，执行后自动沉淀；解决 v2.0"无项目态每次冷启动"
  依据：用户确认（v3.0 架构重设计方案批准）
  日期：2026-07-06

- [公共契约] Alignment Decision 的机器 route 使用 pass/enrich/clarify/block，展示层继续映射 A/B/C
  影响：schema、reason registry、runtime 和 adapter 必须消费机器 route；A/B/C 只用于人类可见披露
  依据：用户确认（G1 Contract Freeze 第 1 个产品决策）
  日期：2026-07-11

- [公共契约] clarify 仅表示契约信息缺失；block 仅表示授权、政策或 baseline 条件禁止执行
  影响：高风险且信息不足时先 clarify；block 只允许 wait_confirmation/stop，解除后必须重新分析，禁止直接执行
  依据：用户确认（G1 Contract Freeze 第 2 个产品决策）
  日期：2026-07-11

- [上下文契约] `.align/` 采用物理分类拆分，并为 legacy `context.md` 保留至少一个 minor 兼容期
  影响：先逻辑分区再迁移；新 writer 只写分类 SSOT，`context.md` 仅作生成的兼容投影或索引
  依据：用户确认（G1 Contract Freeze 第 3 个产品决策）
  日期：2026-07-11

- [公共契约] 知识声明采用“fact/inference/assumption + source kind/ref”双轴模型
  影响：`[原文]/[推断]/[假设]` 仅作兼容展示；用户决策使用 decision source/ref，不复制成项目事实
  依据：用户接受推荐方案（G1 Contract Freeze 第 4 个产品决策）
  日期：2026-07-11

- [持久化契约] 无敏感信息的 temporary state 可提交仓库，completion evidence 默认仅本地保存
  影响：state 必须带更新时间和失效条件；仓库只允许脱敏证据摘要或外部引用，禁止提交原始运行证据
  依据：用户确认（G1 Contract Freeze 第 5 个产品决策）
  日期：2026-07-11

- [兼容契约] legacy `.align/context.md` 兼容投影只允许在 major 版本移除
  影响：minor 必须继续兼容读取；major 移除前必须提供迁移工具、弃用提示和 old-only 升级回归测试
  依据：用户确认（G1 Contract Freeze 第 6 个产品决策）
  日期：2026-07-11

- [运行时契约] 以“Node.js 可选 runtime + shell fallback”替代完全零运行时依赖承诺
  影响：Node 承载完整结构化能力但不得成为基础安装前提；shell 必须保持最小决策投影一致并披露降级
  依据：用户确认（G1 Contract Freeze 第 7 个产品决策）
  日期：2026-07-11

- [开发依赖] 批准 Ajv 8 作为 TypeScript 包 devDependency，用于严格执行 JSON Schema 契约测试
  影响：Ajv 不进入 runtime 或 shell fallback；新增其他依赖仍须按项目规则单独确认
  依据：用户明确批准（G1 Contract Freeze 契约测试工具）
  日期：2026-07-11

- [契约冻结] Alignment Contract v1 通过 G1，schemaVersion 固定为 1.0.0
  影响：G2 runtime 与 shell fallback 必须消费冻结 schema/policy/reason/lifecycle；禁止 adapter 自行改写语义
  依据：G1 六项验收通过、132 项测试通过、Standards/Spec 双轴评审问题已修复
  日期：2026-07-11

- [RC 评测策略] `v3.2.0-rc.1` 使用一次性小型 held-out + 一次独立盲评，不运行完整三臂重复
  影响：只有冻结门槛通过或用户明确接受实测偏差后才能关闭 G5；完整 E5、真实成功率和返工数据延后到稳定版前积累，支持口径继续降级披露
  依据：用户确认精简评测方案
  日期：2026-07-12
