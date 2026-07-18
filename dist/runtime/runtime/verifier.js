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
exports.getVerificationCommands = void 0;
exports.runVerificationCommands = runVerificationCommands;
exports.runVerification = runVerification;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const acceptance_plan_1 = require("./acceptance-plan");
/** @deprecated Importing the verifier is a compatibility path. The core pipeline only plans acceptance. */
var acceptance_plan_2 = require("./acceptance-plan");
Object.defineProperty(exports, "getVerificationCommands", { enumerable: true, get: function () { return acceptance_plan_2.getVerificationCommands; } });
const SHELL_OPERATOR = /[;&|<>`$()\r\n]/;
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/;
const SHELL_EVALUATION_FLAG = /^(?:-c|\/c|--command|-command|-encodedcommand|\/encodedcommand|-e|--eval)$/i;
function isInsideProject(candidate, projectDir) {
    const relative = path.relative(path.resolve(projectDir), candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
function resolveExecutable(executable, projectDir) {
    const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(entry => path.isAbsolute(entry));
    const extensions = process.platform === 'win32'
        ? ['', ...(process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')]
        : [''];
    for (const entry of pathEntries) {
        for (const extension of extensions) {
            const candidate = path.join(entry, `${executable}${extension}`);
            try {
                if (!fs.statSync(candidate).isFile())
                    continue;
                const resolved = fs.realpathSync(candidate);
                if (!isInsideProject(resolved, projectDir))
                    return resolved;
            }
            catch {
                // Keep looking through trusted absolute PATH entries.
            }
        }
    }
    return undefined;
}
function parseSafeCommand(command, projectDir) {
    if (SHELL_OPERATOR.test(command))
        return undefined;
    const args = [];
    let current = '';
    let quote;
    for (let index = 0; index < command.length; index += 1) {
        const character = command[index];
        if (quote) {
            if (character === quote)
                quote = undefined;
            else
                current += character;
        }
        else if (character === '"' || character === "'") {
            quote = character;
        }
        else if (/\s/.test(character)) {
            if (current) {
                args.push(current);
                current = '';
            }
        }
        else {
            current += character;
        }
    }
    if (quote)
        return undefined;
    if (current)
        args.push(current);
    if (args.length === 0)
        return undefined;
    const executable = args[0];
    if (path.isAbsolute(executable) || /^\//.test(executable) || WINDOWS_ABSOLUTE_PATH.test(executable)) {
        return undefined;
    }
    if (executable.includes('/') || executable.includes('\\'))
        return undefined;
    if (args.some(argument => SHELL_EVALUATION_FLAG.test(argument)))
        return undefined;
    if (args.some(argument => path.isAbsolute(argument) || /^\//.test(argument) || WINDOWS_ABSOLUTE_PATH.test(argument)))
        return undefined;
    if (args.some(argument => /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(argument)))
        return undefined;
    const resolvedExecutable = resolveExecutable(executable, projectDir);
    return resolvedExecutable ? [resolvedExecutable, ...args.slice(1)] : undefined;
}
function runVerificationCommands(projectDir, commands, limits = {}) {
    const results = [];
    const startedAt = Date.now();
    const commandTimeoutMs = limits.commandTimeoutMs ?? 60000;
    for (const command of commands) {
        const elapsedMs = Date.now() - startedAt;
        const remainingMs = limits.totalTimeoutMs === undefined
            ? commandTimeoutMs
            : limits.totalTimeoutMs - elapsedMs;
        if (remainingMs <= 0) {
            results.push({
                command,
                success: false,
                output: 'Verification deadline exceeded before this command could run'
            });
            continue;
        }
        const args = parseSafeCommand(command, projectDir);
        if (!args) {
            results.push({
                command,
                success: false,
                output: 'Verification command rejected: shell operators or unsafe command paths are not allowed'
            });
            continue;
        }
        try {
            const output = (0, child_process_1.execFileSync)(args[0], args.slice(1), {
                cwd: projectDir,
                encoding: 'utf-8',
                timeout: Math.min(commandTimeoutMs, remainingMs),
                shell: false,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            results.push({ command, success: true, output: output.trim() });
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
/** @deprecated Completion verification is only valid after an execution receipt. */
function runVerification(projectDir) {
    const commands = (0, acceptance_plan_1.getVerificationCommands)(projectDir);
    return runVerificationCommands(projectDir, commands);
}
//# sourceMappingURL=verifier.js.map
