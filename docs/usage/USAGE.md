# 使用说明

> v3.2.0-rc.1 候选版使用说明。安装后两个核心动作：`/align-init` 接入项目，然后正常干活。

宿主能力边界：Claude Code 是 L3 Native Hook；Codex 是 L2 CLI wrapper / instruction-backed，不具备 native hook 强制阻断 parity。运行 `bash ~/.prompt-optimizer/bin/align-doctor` 可检查实际状态。

## 1. 接入一个项目（3 分钟）

### 步骤 1：安装 skill

见 [INSTALL.md](INSTALL.md)。

### 步骤 2：进入项目目录

```bash
cd your-project
```

### 步骤 3：运行 align-init

```text
/align-init
```

`align-init` 会：

1. 扫描 `package.json`/`pyproject.toml`/`go.mod` 等文件识别技术栈
2. 扫描测试命令、lint 配置、git log 风格、目录结构
3. 推断规范草案，每条标注置信度 `[原文]`/`[推断]`/`[假设]`
4. 只对 `[假设]` 项发起澄清（一次一问，通常 ≤3 问）
5. 生成 `.align/` 分类上下文、legacy 兼容投影并注入挂载区到 CLAUDE.md/AGENTS.md

完成后输出接入报告，告诉你生成了什么、澄清了什么。

### 步骤 4：正常干活

接入后直接开发。对齐在后台静默发生，你不需要说"优化："。

## 2. 从零开始一个项目

### 步骤 1：安装 skill

见 [INSTALL.md](INSTALL.md)。

### 步骤 2：创建项目目录

```bash
mkdir my-project && cd my-project
```

### 步骤 3：运行 align-init --new

```text
/align-init --new
```

`align-init --new` 会走四问访谈决策树：

1. **Q1 项目一句话目标** → 给推荐格式
2. **Q2 技术栈选型** → 给推荐+理由（如 React+TS+Vite）
3. **Q3 质量门槛** → 给推荐测试策略和验证命令
4. **Q4 高风险边界** → 给推荐高风险清单

每问都可以直接采纳推荐答案。完成后生成 `.align/` 分类上下文 + 项目骨架建议。

### 步骤 4：按骨架创建项目

```text
my-project/
├── .align/
│   ├── spec.md
│   ├── facts.md
│   ├── glossary.md
│   ├── state.md
│   ├── context.md       # legacy 兼容投影
│   ├── lessons.md
│   └── decisions.log.md
├── CLAUDE.md          # 含挂载区
└── src/
```

### 步骤 5：正常干活

同"接入一个项目"步骤 4。

## 3. 日常使用：三档路由

接入后，每条开发指令自动经过三档路由。你不需要做任何事情。

### A 档：直通（~60% 指令）

简单+低风险+意图明确的指令直接执行，零感知。

```text
把 config.js 里的 API_URL 改成 https://api.example.com
```

- 直接执行修改
- 静默跑验证门（测试/lint）
- 验证通过后交付
- 不输出诊断、路由日志

### B 档：静默对齐（~30% 指令）

有缺口但可从 `.align/` 补全的指令，开头 1-3 行披露后直接执行。

```text
给用户列表加一个搜索功能
```

- 开头披露："按项目规范：限于 users 模块，不改数据库 schema，完成后跑 npm test -- users"
- 然后直接执行
- 不等待确认

### C 档：浮出澄清（~10% 指令）

高风险且信息不足、总分<6 或假设>2 的指令，停下问一个问题；授权缺失时 `block`；范围、恢复、授权和验收完整时 `enrich` 后执行。

```text
把生产数据库的用户表清空
```

- 停下，不执行
- 一次只问一个问题 + 推荐答案
- 用户确认后才继续

## 4. 显式模式（v2 兼容）

想看完整优化结果时，使用显式前缀：

```text
优化：帮我做一个用户登录功能
```

输出完整 Agent Brief 文档（目标、背景、范围、交付物、约束、执行策略、验收 + 路由日志 + 诊断 + 契约回验 + 改动记录）。

其他显式前缀：

| 前缀 | 行为 |
| --- | --- |
| `优化：` / `/optimize-prompt` | 完整 Agent Brief 文档 |
| `[直出]` | 只输出优化后的 Prompt，不输出诊断 |
| `[访谈]` | 强制进入澄清访谈 |
| `[Agent Brief]` | 直接输出完整任务简报 |
| `[项目上下文]` | 输出项目上下文/记忆文件草案 |

显式前缀不跳过安全阀：即使用 `[直出]`，高风险+缺信息仍会拦截。

## 5. .align/ 运行时

接入后项目获得 `.align/` 目录：

| 文件 | 用途 | 谁更新 |
| --- | --- | --- |
| `spec.md` | 项目开发规范（技术栈/目录/分支/测试/风格/评审/高风险） | align-init 生成 + 沉淀门追加 |
| `facts.md` | 稳定项目事实，每项带 source ref | align-init + 用户确认 |
| `glossary.md` | 项目特有术语，不含实现细节 | align-init + 用户维护 |
| `state.md` | 临时阶段摘要，含 updatedAt/invalidWhen | align-init + 沉淀门 |
| `context.md` | 由分类 SSOT 生成的 legacy 兼容投影 | align-init 生成，禁止直接编辑 |
| `lessons.md` | 经验规则（每条 ≤2 行） | 沉淀门自动追加 |
| `decisions.log.md` | 重大决策日志 | 沉淀门自动追加 |

agent 每次任务前读取顺序：`lessons.md` → `spec.md` → `facts.md` / `glossary.md` / `state.md`；三个分类文件未齐全时同时读取 `context.md`，全部缺失时只读 legacy。

## 6. 生命周期五门

每条指令经过五个门：

| 门 | 触发 | 何时静默 |
| --- | --- | --- |
| 门 1 需求门 | 每条指令 | A 档全静默 |
| 门 2 设计门 | 3+文件或跨模块 | 简单任务跳过 |
| 门 3 执行门 | 编码过程中 | 不偏离则无输出 |
| 门 4 验证门 | 交付前 | 验证通过报一行 |
| 门 5 沉淀门 | 任务结束后 | 无可沉淀则完全静默 |

## 7. 判断输出好坏

好的 v3 行为：

- 简单任务零感知，直接执行
- 有缺口时 1-3 行披露后直接执行，不等待
- 高风险任务必须经过安全路由：信息不足时一次一问，授权阻断时等待确认，契约与授权完整时披露后执行
- 交付前必须自验证（R8 验证门不可跳过）
- 踩坑/纠正/新约定自动沉淀到 lessons.md

不好的 v3 行为：

- 简单任务输出大量诊断和对齐术语（A 档不该啰嗦）
- B 档披露超过 5 行或含"请确认后我再继续"（该升档 C）
- 高风险信息不足或授权受阻时静默执行（`clarify` / `block` 必须停止）
- 交付前不验证（R8 不可跳过）
- 空洞沉淀（"本次任务很顺利"不该写入 lessons.md）

## 8. 可选 Matt Pocock Skills handoff

此入口只在你显式调用时生成下游建议，不改变普通 pipeline，也不改变 `align-cli json` 的 Alignment Decision 输出。

macOS / Linux / Git Bash：

```bash
bash "$HOME/.prompt-optimizer/bin/align-cli" matt "只修改 parser 并运行 parser tests" --project-dir "$PWD"
```

Windows PowerShell：

```powershell
node "$HOME\.prompt-optimizer\runtime\index.js" matt "只修改 parser 并运行 parser tests" --project-dir (Get-Location)
```

输出通道固定为：

- stdout：一行可解析的 `alignment.ecosystem-handoff` JSON。
- stderr：`[alignment] route=<route> status=<status>` 简短披露。

状态含义：

| 状态 | 含义 | 后续动作 |
| --- | --- | --- |
| `ready` | 所选 skill 已发现，项目 setup 齐全 | 用户或宿主显式调用 `invocation` |
| `setup_required` | 所选 skill 已发现，但 `docs/agents/issue-tracker.md`、`triage-labels.md`、`domain.md` 未齐全 | 用户决定是否调用 `/setup-matt-pocock-skills` |
| `unavailable` | 所选 skill 的 `SKILL.md` 未发现 | 先安装对应 skill；不会错误建议 setup 可解决缺失安装 |
| `deferred` | 原 Alignment Decision 为 `clarify` 或 `block` | 先完成原 route，重新分析后再生成 handoff |

硬边界：

- `automatic` 永远为 `false`，`ready` 不等于已调用。
- envelope 只引用 skill 名和 invocation，不复制 skill 正文。
- 发现逻辑只检查项目或用户 skill 根目录中的 `SKILL.md`，不会把绝对路径写入输出。
- 当前映射按优先级覆盖 `code-review`、`diagnosing-bugs`、`prototype`、`to-tickets`、`to-spec`、`tdd`、`grill-with-docs`、`implement`，其余工程流程回退到 `ask-matt`。

## 9. 卸载与升级

见 [INSTALL.md](INSTALL.md#卸载与升级)。
