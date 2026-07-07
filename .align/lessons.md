# 经验规则

> 由 align-init 自举生成。初始为空。
> 大小纪律：每条 ≤2 行，超 50 条归档。
> 读取顺序：第一位（lessons → spec → context）。

<!-- 沉淀门（门 5）自动追加经验规则到此处 -->

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
