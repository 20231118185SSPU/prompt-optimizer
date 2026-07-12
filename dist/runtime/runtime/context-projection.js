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
exports.writeContextProjection = writeContextProjection;
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SOURCE_MARKER = 'context-source-sha256:';
const CONTENT_MARKER = 'context-content-sha256:';
function sha256(value) {
    return (0, crypto_1.createHash)('sha256').update(value, 'utf8').digest('hex');
}
function readRequired(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Classified context is incomplete: missing ${path.basename(filePath)}`);
    }
    return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').trim();
}
function projectionBody(facts, glossary, state) {
    return `# Legacy Context Projection\n\n## Project Facts\n\n${facts}\n\n## Glossary\n\n${glossary}\n\n## Temporary State\n\n${state}\n`;
}
function marker(content, name) {
    return content.match(new RegExp(`${name}([a-f0-9]{64})`))?.[1];
}
function writeContextProjection(projectDir, force = false) {
    const alignDir = path.join(projectDir, '.align');
    const facts = readRequired(path.join(alignDir, 'facts.md'));
    const glossary = readRequired(path.join(alignDir, 'glossary.md'));
    const state = readRequired(path.join(alignDir, 'state.md'));
    const body = projectionBody(facts, glossary, state);
    const sourceDigest = sha256([facts, glossary, state].join('\n\0\n'));
    const contentDigest = sha256(body);
    const output = `<!-- Generated compatibility projection. Do not edit.\n${SOURCE_MARKER}${sourceDigest}\n${CONTENT_MARKER}${contentDigest}\n-->\n\n${body}`;
    const outputPath = path.join(alignDir, 'context.md');
    if (fs.existsSync(outputPath)) {
        const current = fs.readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
        if (current === output)
            return { status: 'unchanged', sourceDigest, path: outputPath };
        const previousContentDigest = marker(current, CONTENT_MARKER);
        const currentBody = current.replace(/^<!--[\s\S]*?-->\n\n/, '');
        if (!force && (!previousContentDigest || sha256(currentBody) !== previousContentDigest)) {
            throw new Error('Divergent legacy context projection; merge explicitly or rerun with --force after review');
        }
    }
    const status = fs.existsSync(outputPath) ? 'updated' : 'created';
    fs.writeFileSync(outputPath, output, 'utf8');
    return { status, sourceDigest, path: outputPath };
}
//# sourceMappingURL=context-projection.js.map
