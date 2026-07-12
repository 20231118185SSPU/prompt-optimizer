// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrich = enrich;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function readFileIfExists(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8').trim();
        }
    }
    catch {
        // File read error, return empty
    }
    return '';
}
function fileExists(filePath) {
    try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    }
    catch {
        return false;
    }
}
function extractLessons(content, maxEntries = 30) {
    const lines = content.split('\n');
    const lessonLines = lines.filter(line => line.trim().startsWith('- '));
    // Return last N entries
    const limited = lessonLines.slice(-maxEntries);
    return limited.join('\n');
}
function enrich(instruction, projectDir) {
    const alignDir = path.join(projectDir, '.align');
    // Check if .align/ directory exists
    if (!fs.existsSync(alignDir)) {
        return {
            enrichedMessage: instruction,
            context: { lessons: '', spec: '', facts: '', glossary: '', state: '', context: '', decisions: '' }
        };
    }
    // Read .align/ files
    const lessonsRaw = readFileIfExists(path.join(alignDir, 'lessons.md'));
    const spec = readFileIfExists(path.join(alignDir, 'spec.md'));
    const classifiedPaths = ['facts.md', 'glossary.md', 'state.md'].map(file => path.join(alignDir, file));
    const facts = readFileIfExists(classifiedPaths[0]);
    const glossary = readFileIfExists(classifiedPaths[1]);
    const state = readFileIfExists(classifiedPaths[2]);
    const hasCompleteClassifiedContext = classifiedPaths.every(fileExists);
    const context = hasCompleteClassifiedContext ? '' : readFileIfExists(path.join(alignDir, 'context.md'));
    const decisions = readFileIfExists(path.join(alignDir, 'decisions.log.md'));
    // Extract and limit lessons
    const lessons = extractLessons(lessonsRaw);
    // Build enriched message
    let enrichedMessage = instruction;
    if (lessons || spec || facts || glossary || state || context || decisions) {
        const contextParts = [];
        if (lessons) {
            contextParts.push(`── 项目经验规则（必须遵守）──\n${lessons}`);
        }
        if (spec) {
            contextParts.push(`── 项目规范 ──\n${spec}`);
        }
        if (facts) {
            contextParts.push(`── 项目事实 ──\n${facts}`);
        }
        if (glossary) {
            contextParts.push(`── 项目术语 ──\n${glossary}`);
        }
        if (state) {
            contextParts.push(`── 临时状态 ──\n${state}`);
        }
        if (context) {
            contextParts.push(`── 项目上下文 ──\n${context}`);
        }
        if (decisions) {
            contextParts.push(`── 决策日志 ──\n${decisions}`);
        }
        if (contextParts.length > 0) {
            enrichedMessage = `${contextParts.join('\n\n')}\n\n── 用户指令 ──\n${instruction}`;
        }
    }
    return {
        enrichedMessage,
        context: { lessons, spec, facts, glossary, state, context, decisions }
    };
}
//# sourceMappingURL=enricher.js.map
