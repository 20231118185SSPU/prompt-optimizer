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
exports.activateClaudeSession = activateClaudeSession;
exports.readClaudeSessionActivation = readClaudeSessionActivation;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const SESSION_REF = /^[a-f0-9]{24}$/;
const TTL_MS = 8 * 60 * 60 * 1000;
const MAX_RECORD_BYTES = 4096;
function sha256(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function defaultStateHome() {
    if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
        return path.join(process.env.LOCALAPPDATA, 'prompt-optimizer');
    }
    if (process.platform !== 'win32' && process.env.XDG_STATE_HOME) {
        return path.join(process.env.XDG_STATE_HOME, 'prompt-optimizer');
    }
    return path.join(os.homedir(), '.prompt-optimizer', 'state');
}
function configuredStateHome(options) {
    return options.stateHome ?? defaultStateHome();
}
function activationFile(projectDir, sessionRef, stateHome) {
    const projectPath = fs.realpathSync(projectDir);
    return path.join(stateHome, `activation-${sha256(projectPath)}-${sha256(sessionRef)}.json`);
}
function isSafeStateHome(stateHome) {
    try {
        const stat = fs.lstatSync(stateHome);
        return stat.isDirectory() && !stat.isSymbolicLink();
    }
    catch {
        return false;
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isValidRecord(value) {
    if (!isRecord(value))
        return false;
    const keys = Object.keys(value).sort();
    if (keys.length !== 4 || keys.join(',') !== 'activatedAtMs,expiresAtMs,kind,schemaVersion')
        return false;
    if (value.kind !== 'alignment.claude-session-activation' || value.schemaVersion !== '1.0.0')
        return false;
    const activatedAtMs = value.activatedAtMs;
    const expiresAtMs = value.expiresAtMs;
    if (typeof activatedAtMs !== 'number' || typeof expiresAtMs !== 'number' ||
        !Number.isSafeInteger(activatedAtMs) || !Number.isSafeInteger(expiresAtMs))
        return false;
    return activatedAtMs >= 0 && expiresAtMs === activatedAtMs + TTL_MS;
}
function nowMs(options) {
    return options.now ?? Date.now();
}
function inactive(reason) {
    return reason ? { status: 'inactive', reason } : { status: 'inactive' };
}
function activateClaudeSession(projectDir, sessionRef, options = {}) {
    if (!SESSION_REF.test(sessionRef))
        return inactive('invalid_session_ref');
    const activatedAtMs = nowMs(options);
    if (!Number.isSafeInteger(activatedAtMs) || activatedAtMs < 0)
        return inactive('storage_unavailable');
    const expiresAtMs = activatedAtMs + TTL_MS;
    if (!Number.isSafeInteger(expiresAtMs))
        return inactive('storage_unavailable');
    const record = {
        kind: 'alignment.claude-session-activation',
        schemaVersion: '1.0.0',
        activatedAtMs,
        expiresAtMs
    };
    let file;
    try {
        const stateHome = configuredStateHome(options);
        fs.mkdirSync(stateHome, { recursive: true, mode: 0o700 });
        if (!isSafeStateHome(stateHome))
            return inactive('storage_unavailable');
        try {
            fs.chmodSync(stateHome, 0o700);
        }
        catch { /* Windows does not expose Unix modes. */ }
        file = activationFile(projectDir, sessionRef, stateHome);
        const directory = path.dirname(file);
        try {
            if (fs.lstatSync(file).isSymbolicLink())
                return inactive('storage_unavailable');
        }
        catch (error) {
            if (!(isRecord(error) && error.code === 'ENOENT'))
                return inactive('storage_unavailable');
        }
        const temporary = path.join(directory, `.${path.basename(file)}.${crypto.randomBytes(12).toString('hex')}.tmp`);
        try {
            fs.writeFileSync(temporary, JSON.stringify(record), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
            try {
                fs.chmodSync(temporary, 0o600);
            }
            catch { /* Windows does not expose Unix modes. */ }
            fs.renameSync(temporary, file);
        }
        finally {
            try {
                fs.rmSync(temporary, { force: true });
            }
            catch { /* Best-effort temporary cleanup. */ }
        }
        return { status: 'active', expiresAtMs: record.expiresAtMs };
    }
    catch {
        return inactive('storage_unavailable');
    }
}
function readClaudeSessionActivation(projectDir, sessionRef, options = {}) {
    if (!SESSION_REF.test(sessionRef))
        return inactive('invalid_session_ref');
    try {
        const stateHome = configuredStateHome(options);
        if (!isSafeStateHome(stateHome))
            return inactive();
        const file = activationFile(projectDir, sessionRef, stateHome);
        let stat;
        try {
            stat = fs.lstatSync(file);
        }
        catch (error) {
            return isRecord(error) && error.code === 'ENOENT' ? inactive() : inactive('storage_unavailable');
        }
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_RECORD_BYTES)
            return inactive();
        const value = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!isValidRecord(value) || value.expiresAtMs <= nowMs(options))
            return inactive();
        return { status: 'active', expiresAtMs: value.expiresAtMs };
    }
    catch {
        return inactive();
    }
}
//# sourceMappingURL=session-activation.js.map
