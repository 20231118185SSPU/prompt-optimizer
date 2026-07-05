# Spec Kit

> 规范生成器素材库。P2-2 已完成落地。

`core/spec-kit/` 是 `align-init` skill 的规范生成器素材库，目标是把项目规范写成可验证、可执行、可沉淀的规则，而不是泛泛的"最佳实践"。

## 结构

- `scan.md`：存量项目的扫描与推断协议（扫什么文件、置信度标注、何时必须问）。
- `interview.md`：从零项目的四问访谈决策树（每问带推荐答案）。
- `spec-sections/`：规范章节库，覆盖技术栈、目录、分支提交、测试验证、风格、评审和高风险清单。

## 与 .align/ 四件套的关系

- `scan.md` 和 `interview.md` 定义"怎么收集规范"。
- `spec-sections/` 定义"规范长什么样"（可选预设）。
- `core/templates/ALIGN-*.md` 定义".align/ 文件的模板结构"。

三者配合：scan/interview 收集信息 → spec-sections 提供预设 → ALIGN-* 模板定义最终格式。
