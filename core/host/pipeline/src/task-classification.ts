/**
 * Shared task-type classification used by both the analyzer and contract-builder.
 * Single source of truth for documentation / code / shell / performance detection.
 */

export function isDocumentationTask(text: string): boolean {
  return /README|docs?[\\/]|文档|指南|错别字|拼写|标题|链接|markdown|CHANGELOG|release\s+notes|发布说明/i.test(text);
}

export function isCodeTask(text: string): boolean {
  return !isDocumentationTask(text) &&
    /(?:src[\\/]|core[\\/]|component|组件|函数|接口|parser|解析器|代码|bug|修复|修改|实现|增加|新增|搜索|按钮|界面|交互|tsx?|jsx?|py|API|测试|回归)/i.test(text);
}

export function isShellTask(text: string): boolean {
  return /(?:\.sh\b|bash|shell|脚本|build|安装器|hook)/i.test(text);
}

export function isPerformanceTask(text: string): boolean {
  return /(?:性能|延迟|耗时|响应时间|p95|benchmark|吞吐|重复.*读取|响应.*时间)/i.test(text);
}
