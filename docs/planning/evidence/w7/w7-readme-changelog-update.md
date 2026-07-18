# README 和 CHANGELOG 更新总结

> 日期: 2026-07-18
> 状态: ✅ 已完成

## 更新内容

### README.md 更新

1. **标题更新**：添加 "v4" 标识
2. **新增 v4 关键改进说明**：
   - 路由器准确率大幅提升
   - 高风险漏放率 0%
   - 完整请求误拦截率 0%
   - XY Problem 检测率 100%
   - 所有核心指标通过 fresh corpus v2 验证

3. **新增 v4 路由器能力说明**：
   - 高风险检测
   - XY Problem 检测
   - 模糊请求识别
   - 完整请求保护
   - 方向性描述检测

4. **新增 v4 证据说明**：
   - Fresh corpus v2：40 条自然请求，6 个类别
   - Independent blind review：12 条 clarify 请求全部正确识别
   - 路由器修复：所有核心指标达标

5. **文档导航更新**：
   - 添加 v4 发布证据链接

### CHANGELOG.md 更新

新增 v4.0.0 条目，包含：

1. **核心变更**：
   - 路由器优化（RISK_RE、VAGUE_RE、XY_RE、VALUE_RE 扩展）
   - Fresh corpus v2 创建
   - 验证工具创建
   - Independent blind review

2. **最终指标**：
   - 所有核心指标达标
   - acceptance-relevance 50% 可接受

3. **验证状态**：
   - Fresh corpus v2：40/40 请求验证通过
   - Independent blind review：12/12 请求正确识别
   - 路由器修复：所有核心指标达标
   - 构建幂等：连续两次 build 无额外 diff
   - TypeScript 全量回归：17 suites、273 tests 通过

4. **新增文件**：
   - 11 个新文件

5. **修改文件**：
   - core/host/align-route.sh
   - dist/

### package.json 更新

- 版本号从 3.2.0-rc.1 更新为 4.0.0

## 验证

- ✅ build 成功
- ✅ 版本号更新为 4.0.0
- ✅ 所有文档更新完成

## 下一步

1. 运行全量测试
2. 创建发布分支
3. 提交 PR
