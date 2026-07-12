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
exports.getVerificationCommands = getVerificationCommands;
exports.runVerification = runVerification;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
function getVerificationCommands(projectDir) {
    const commandsFile = path.join(projectDir, '.align', 'check-commands.txt');
    if (!fs.existsSync(commandsFile)) {
        return [];
    }
    try {
        const content = fs.readFileSync(commandsFile, 'utf-8');
        const lines = content.split('\n');
        // Filter comments and empty lines
        const commands = lines
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
        return commands;
    }
    catch {
        return [];
    }
}
function runVerification(projectDir) {
    const commands = getVerificationCommands(projectDir);
    const results = [];
    for (const command of commands) {
        try {
            const output = (0, child_process_1.execSync)(command, {
                cwd: projectDir,
                encoding: 'utf-8',
                timeout: 60000, // 1 minute timeout
                stdio: ['pipe', 'pipe', 'pipe']
            });
            results.push({
                command,
                success: true,
                output: output.trim()
            });
        }
        catch (error) {
            results.push({
                command,
                success: false,
                output: error.message || 'Command failed'
            });
        }
    }
    return { commands, results };
}
//# sourceMappingURL=verifier.js.map
