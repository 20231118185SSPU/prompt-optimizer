// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
/**
 * Shared task-type classification used by both the analyzer and contract-builder.
 * Single source of truth for documentation / code / shell / performance detection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDocumentationTask = isDocumentationTask;
exports.isCodeTask = isCodeTask;
exports.isShellTask = isShellTask;
exports.isPerformanceTask = isPerformanceTask;
function isDocumentationTask(text) {
    return /README|docs?[\\/]|文档|错别字|拼写|标题|链接|markdown|CHANGELOG|release\s+notes|发布说明/i.test(text);
}
function isCodeTask(text) {
    return !isDocumentationTask(text) &&
        /(?:src[\\/]|core[\\/]|component|组件|函数|接口|parser|解析器|代码|bug|修复|修改|实现|增加|新增|搜索|按钮|界面|交互|tsx?|jsx?|py|API|测试|回归)/i.test(text);
}
function isShellTask(text) {
    return /(?:\.sh\b|bash|shell|脚本|build|安装器|hook)/i.test(text);
}
function isPerformanceTask(text) {
    return /(?:性能|延迟|耗时|响应时间|p95|benchmark|吞吐|重复.*读取|响应.*时间)/i.test(text);
}
//# sourceMappingURL=task-classification.js.map
