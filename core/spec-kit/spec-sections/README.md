# Spec Sections

> 规范章节库。P2-2 已完成落地。

每个章节提供 2-3 个可选预设，`align-init` 根据扫描或访谈结果选择最接近的预设，填入项目实际值。

## 章节文件

| 文件 | 对应 ALIGN-SPEC.md 章节 | 预设数 |
| --- | --- | --- |
| `tech-stack.md` | 技术栈与版本 | 3（React+TS / Node+TS / Python） |
| `directory.md` | 目录约定 | 3（功能模块化 / 分层 / 扁平） |
| `branch-commit.md` | 分支与提交规范 | 3（Conventional Commits / 简化 / GitHub Flow） |
| `test-verify.md` | 测试与验证命令 | 3（全量 / 最小 / Python） |
| `code-style.md` | 代码风格 | 3（TS+ESLint / Python+Ruff / Go+gofmt） |
| `review-merge.md` | 评审与合并规则 | 3（严格 / 轻量 / 单人） |
| `high-risk.md` | 高风险操作清单 | 3（通用 / 认证支付 / 基础设施） |

## 填写标准

每个预设的每条规范必须满足：

- 写成可验证的行为（能用命令/数字/清单检查）。
- 标注适用场景。
- 不使用"更好""更优雅""符合最佳实践"等不可判定验收。
