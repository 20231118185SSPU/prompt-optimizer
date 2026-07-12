# 项目上下文契约

> 由 align-init 自举生成。基于 prompt-optimizer 项目自身扫描结果。
> 大小纪律：≤100 行。

## 项目目标与当前阶段

- 项目目标：为 AI agent 提供可注入任意项目的对齐运行时，解决 agent 误解用户意图的问题 [原文]
- 当前阶段：v3.2.0-rc.1 候选版，G0-G6 Alignment Decision runtime 改进计划已完成 [原文]
- 下一个里程碑：清偿 `.align/debt.md` 中的稳定版前证据债务并发布 v3.2.0 稳定版 [原文]

## 共享术语

- 意图对齐：把用户的粗糙想法转换成 AI agent 可执行、可验证、可沉淀的任务契约 [原文]
- Agent Brief：面向 agent 的最终输出，包含目标、背景、范围、交付物、约束、执行策略、验收 [原文]
- 五维诊断：精确性、约束性、结构性、上下文、验证性 [原文]
- 三档路由：A 档直通 / B 档静默对齐 / C 档浮出澄清 [原文]
- Alignment Decision：对单条请求给出的稳定、可机器检查的对齐决定；机器 route 固定使用 `pass` / `enrich` / `clarify` / `block` [原文]
- 展示档位：面向用户表达对齐强度的 A/B/C 映射，不作为机器 API 的 route 值 [原文]
- Clarify：契约信息不足，无法形成可执行或可阻断决定；一次只问一个最高价值问题并给推荐答案，期间禁止执行 [原文]
- Block：契约信息已足够，但授权、政策或 baseline 条件禁止执行；next action 只能是 `wait_confirmation` 或 `stop` [原文]
- 知识声明：进入 Alignment Decision 或项目态的规范化陈述，知识类型必须是 `fact`、`inference` 或 `assumption` [原文]
- 来源引用：知识声明的独立溯源轴，包含 `user`、`project`、`runtime`、`decision` 或 `default` 及可定位 `ref` [原文]
- 临时状态：带更新时间和失效条件的当前阶段信息；只有无敏感信息的摘要可提交仓库 [原文]
- Completion Evidence：执行后证明验收项实际检查结果的证据；默认本地保存，不等同于执行前 acceptance criteria [原文]
- 兼容投影：由分类后的 `.align/` SSOT 生成、供旧 consumer 读取的 `context.md`；兼容期内禁止作为可编辑事实来源 [原文]
- .align/：项目运行时目录，含 spec.md + context.md + lessons.md + decisions.log.md [原文]
- SSOT：Single Source of Truth，core/ 是唯一事实来源，dist/ 由 build 生成 [原文]

## 架构关键决策

- SSOT 架构：core/ → build/ → dist/
  原因：消灭镜像手工同步，所有内容只改 core/，跑 build 生成 dist/ [原文]
  影响：禁止手改 dist/，修改协议后必须跑 build [原文]

- 可选 Node runtime + shell fallback：Node 提供完整结构化决策与生命周期能力，shell 保留无 Node 环境的基础能力
  原因：机器契约和生命周期状态需要可靠的结构化实现，同时不能破坏轻量接入路径 [原文]
  影响：Node 不得成为基础安装的强制前提；两条路径必须保持最小 Alignment Decision 投影一致 [原文]

- 三档路由：A/B/C 档静默化
  原因：解决 v2.0"触发是拉不是推"和"输出是展示不是执行"的局限 [原文]
  影响：默认静默执行，不展示完整 Agent Brief [原文]

- Clarify / Block 分工：高风险且契约信息不足时先 clarify；信息完整后再判断是否 block
  原因：契约缺口与禁止执行是两种不同状态，不能用同一路由混淆 [原文]
  影响：block 解除后必须重新分析，禁止沿用旧决定直接执行 [原文]

- .align/ 运行时：项目规范+上下文+经验+决策
  原因：解决 v2.0"无项目态每次冷启动"的局限 [原文]
  影响：接入项目后自动读取，执行后自动沉淀 [原文]

- .align/ 上下文分类：目标结构物理拆分为 facts、glossary、spec、lessons、decisions、state 与 ADR
  原因：稳定知识、临时状态、术语和决策具有不同生命周期，混放会形成重复 SSOT [原文]
  影响：先逻辑分区再迁移；legacy `context.md` 至少保留一个 minor 兼容期，并由新 SSOT 生成 [原文]

- 知识声明双轴模型：知识类型与来源引用分别建模，禁止用来源标签代替事实性判断
  原因：`[原文]` 只能证明内容被直接表达，不能证明内容真实、有效或仍然适用 [原文]
  影响：`[原文]`、`[推断]`、`[假设]` 仅作兼容展示；机器契约必须使用结构化双轴字段 [原文]

- 状态与证据持久化：无敏感信息的 `.align/state.md` 可提交；completion evidence 默认仅本地保存
  原因：共享阶段摘要有协作价值，原始命令输出、路径和运行数据存在泄露风险 [原文]
  影响：state 必须包含更新时间和失效条件；仓库中的证据只能是脱敏摘要或外部引用 [原文]

- Legacy context 移除门：`context.md` 兼容投影只能在 major 版本移除
  原因：旧 consumer 和已接入项目可能仍只读取 legacy 文件，minor 移除会造成静默上下文丢失 [原文]
  影响：移除前必须提供迁移工具、弃用提示和 old-only 升级回归测试 [原文]
