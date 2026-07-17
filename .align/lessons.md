# 经验规则

> 由 align-init 自举生成。初始为空。
> 大小纪律：每条 ≤2 行，超 50 条归档。
> 读取顺序：第一位（lessons → spec → context）。

<!-- 沉淀门（门 5）自动追加经验规则到此处 -->

- [Windows/Git Bash 路由回归] 规则：`verify-router.sh` 的两份 router 共 84 次 shell 调用可能耗时数分钟，不应误判为死锁或重跑模型 → 下次执行：保留单次运行并分段观察至完成

- [安装验收] 规则：接入后强制链路三件套必须齐全（settings.json 含 UserPromptSubmit hook、.align/HOOK-REMINDER.txt、CLAUDE.md 挂载区）→ 下次执行：安装/接入后逐项验证，缺任一条即"没有强制手段"
- [settings.json 修改] 规则：~/.claude/settings.json 是用户全局配置 → 下次执行：修改前先备份 settings.json.bak-{date}，只增不删既有字段
- [hook 生效范围] 规则：settings.json 的 hook 只在新会话生效 → 下次执行：验证 hook 效果必须换新会话测，当前会话测不出来
- [hook 内调模型] 规则：hook 里调 claude -p 必须防递归+超时降级 → 下次执行：设 ALIGN_ROUTE_INNER 环境变量哨兵，仲裁失败按 VAGUE 保守处理
- [路由规则修改] 规则：改 align-route.sh 信号词必须过语料回归 → 下次执行：跑 bash tests/verify-router.sh，41 条×2 副本（core/host + .align）全过才能合
- [交付验证] 规则：本项目 R8 验证门已机械化 → 下次执行：交付前跑 bash .align/align-check.sh，FAIL 不得交付
- [安装器修改] 规则：改 install-skill.* 的接线逻辑必须过沙箱测试 → 下次执行：跑 bash tests/verify-installer-wiring.sh（假 HOME 全流程：装→幂等→升级→卸载）
- [双安装器同步] 规则：install-skill.sh 与 .ps1 必须行为一致 → 下次执行：改任一侧时同步另一侧（SKILLS 列表、hook 命令、卸载逻辑）
- [全局 hook 路径] 规则：~/.claude 全局 hook 执行脚本必须锚定 $CLAUDE_PROJECT_DIR，绝不用 CWD 相对路径（否则进恶意仓库=静默 RCE）→ 下次执行：hook 命令写 "$CLAUDE_PROJECT_DIR/.align/..."，脚本内 ALIGN_DIR 也从项目根/脚本自身目录解析
- [route.conf 解析] 规则：仓库内配置文件绝不 source（=任意代码执行）→ 下次执行：只白名单解析已知键（ALIGN_ARBITER/ARBITER_TIMEOUT），改 hook 命令时同步升级安装器的 upgrade/uninstall 匹配集
- [跨平台 sed] 规则：sed 的 `I`(大小写)标志是 GNU 专有，macOS/BSD sed 会直接报错→整条管道为空 → 下次执行：英文关键词用显式大小写变体 `[Dd]o [Nn]ot` 代替 `I` 标志
- [PowerShell 5.1] 规则：`-AsHashtable` 是 PS6+ 才有；Win10/11 默认 PS5.1 → 下次执行：用自定义 ConvertTo-OrderedHashtable 递归转换 PSCustomObject，写 JSON 用 UTF8Encoding($false) 无 BOM
- [grep 字符类] 规则：`[^\r]` 在 POSIX 里匹配「除 \ 和 r 外」而非回车 → 下次执行：用 `.*` + `tr -d '\r'` 做 CR 清理
- [仲裁阻塞] 规则：hook 路径上的同步 LLM 调用必须有硬超时兜底 → 下次执行：检测 timeout/gtimeout，都没有则直接保守降级，绝不无上限阻塞
- [JSON prompt 解析] 规则：sed 贪婪 `\(.*\)"` 会捕获后续字段；空 prompt 不能拿整段 JSON 去分类 → 下次执行：优先 python3/jq，sed 用 `\([^"]*\)"`，JSON 形输入不做整体兜底
- [安装器 hooks 复制] 规则：install-skill 必须复制 dist/claude-code/hooks/ 到 ~/.claude/hooks/ 和 ~/.agents/hooks/ → 下次执行：改安装器时验证 hooks/ 复制存在，缺则 align-init 找不到源
- [align-init 降级] 规则：找不到源 hooks/ 时必须报错而非静默生成简化版 → 下次执行：align-init 找不到 align-route.sh 源时输出错误并指向安装文档
- [hook 命令一致性] 规则：SKILL.md 示范的 hook 命令必须与 settings.fragment.json 逐字节一致 → 下次执行：改任一侧时 grep 另一侧同步
- [VAGUE 分类器] 规则：氛围编程"创建类"动词（做个/加个/写个/搞个/弄个）必须入 VAGUE_RE → 下次执行：扩信号词时优先加创建类，修改类（改/调/修）靠 SPEC 兜底
- [价值可见性] 规则：verdict 输出用人话非机器标签 → 下次执行：改输出格式时 grep "verdict=" 确认无机器标签残留
- [R8 具体化] 规则：验证提醒读 check-commands.txt 实际命令 → 下次执行：改 CLEAR 输出时验证 check-commands 读取链路
- [自举同步] 规则：core/host/ 升级 route/check 脚本后 .align/ 副本不自动同步 → 下次执行：改 core/host/align-route.sh 后重跑 align-init 或 cp 同步 .align/，否则本项目自身路由跑旧版
- [PS 脚本编码] 规则：含非 ASCII（中文注释/box-drawing）的 .ps1 源文件必须存为 UTF-8 BOM → 下次执行：PS 5.1 把无 BOM 文件按 ANSI 解析致 parse error；仅 settings.json 等 JSON 产物保持无 BOM（见上条）
- [高成本评测] 规则：禁止无意义轮询、重复真实模型调用或无边界追加子代理 → 下次执行：优先一次性本地验证，付费实测只在用户明确批准的范围内运行
- [runtime 证据哈希] 规则：只哈希入口文件无法感知被导入模块变化 → 下次执行：评测证据按稳定排序哈希整个 runtime JS bundle
- [consumed corpus] 规则：修复后可复用已消费语料做 regression，但不得重标为 held-out 或 fresh blind evidence → 下次执行：保留旧 gate 并单独命名 remediation
- [hook 空 prompt] 规则：metadata-only 或畸形 JSON 的空 prompt 不应注入路由或 lessons → 下次执行：hook 解析为空时静默退出，并跑 verify-router-input.sh
- [handoff 请求定位] 规则：公共 decision 的 claims 顺序不构成契约 → 下次执行：按 `user + request:text` source ref 找原始请求，再回退到首个 fact
- [英文关键词路由] 规则：裸子串会把 `preview` 误判为 `review` → 下次执行：英文技能关键词使用词边界，并添加包含关系反例
- [生成产物提交] 规则：本地 build 通过不代表新增 `dist/` 文件可被 Git 收录 → 下次执行：分发 gate 检查 ignored 未跟踪产物，提交前核对 `git status --ignored dist`
- [风险能力口径] 规则：风险信号必须经过安全路由但不等于永久阻断 → 下次更新介绍时区分信息不足的 `clarify`、授权阻断的 `block` 与授权完整的 `enrich`
- [PowerShell runtime 沙箱] 规则：`tests/verify-runtime-installer.ps1` 可能触碰真实 `~/.claude/settings.json` → 下次执行后立即核对并恢复 `UserPromptSubmit` hook
- [W5 doctor 能力口径] 规则：Claude L3 ingress/block 不等于 completion ready → 下次执行：Stop hook 缺失时 doctor 报 `completion=unavailable`，并单独报告 `completionChain=missing`
- [W5 completion 命令执行] 规则：`.align/check-commands.txt` 命令即使来自项目也不能过 shell 展开 → 下次执行：completion verifier 用 `shell=false` argv 执行，拒绝 shell operator、解释器 eval flag 和路径穿越
- [W5 Stop deadline] 规则：Stop hook 不得把多个 completion command 的累计时长暴露给宿主 → 下次执行：adapter 保留 watchdog，verifier 以同一总 deadline 记录 `verification_failed`。
- [W5 installer rollback] 规则：全局 settings 或 runtime 的预检失败必须发生在删除 skills 前 → 下次执行：先解析 settings、校验 ownership，再以同目录临时文件原子替换。
- [W5 Windows hook watchdog] 规则：TERM-resistant 子进程不得直接继承 hook stdout，否则会延长 command substitution → 下次执行：仅缓冲正常输出，timeout 时销毁 streams 并在受限 escalation budget 内降级。
- [Windows/Git Bash 构建 Gate] 规则：`verify-build-idempotence.sh` 双构建可能超过 120 秒，外层超时后子进程仍会继续 → 下次执行：预留至少 6 分钟并确认残留进程结束后再重跑。
- [Lifecycle artifact consumer] 规则：生产校验必须覆盖冻结 schema 的唯一性、长度和条件分支 → 下次执行：先用 schema-invalid 篡改 artifact 证明 consumer fail closed。
- [真实 Claude E4] 规则：`claude -p` 必须从临时项目 cwd 加载可观察 hook；模型有响应但无 lifecycle artifact 时不得计作 E4 → 下次执行：先用零模型阻断哨兵确认 UserPromptSubmit/Stop 接线，再付费调用。
- [G5 remediation] 规则：verifier 失败或 gate summary 的 runtime hash 过期时不得沿用旧 summary 宣称通过 → 下次执行：修复后重新冻结代码并按授权重新生成一次 consumed evidence。
- [项目验收 provenance] 规则：`.align/check-commands.txt` 只能补 effective d5，不能提升 observed d5 或把 `enrich` 伪装成 `pass` → 下次执行：通过 `alignInstruction` seam 同时断言 observed/effective 分数。
- [隔离 E4 provider] 规则：隔离 `CLAUDE_CONFIG_DIR` 还需提供 provider 所需认证环境变量，模型有响应但无公共 lifecycle artifact 不计 E4 → 下次执行：先保存真实 settings hash，再把凭据仅注入临时子进程并清理。
- [runtime hash 冻结] 规则：core 源码修改并 rebuild 后 runtime bundle hash 会变 → 下次执行：E4 证据的 runtime hash 必须在 dist 构建完成后立即记录，不得沿用旧 hash。
- [PS5.1 UTF-8 BOM] 规则：PS 5.1 的 `ConvertFrom-Json` 无法正确解析无 BOM UTF-8 中的非 ASCII 字符 → 下次执行：`Write-SettingsJson` 使用 `UTF8Encoding($true)` 带 BOM 写出 settings.json。
- [hook 直接调用 E4] 规则：直接调用 hook adapter 产生完整 lifecycle 链可证明机制正确，但不等价于交互式 Claude Code 会话 → 下次执行：E4 证据标注 `invocationMethod`，区分 hook-simulated 与 interactive session。
