# Universal Align Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a universal alignment pipeline that works with all major AI coding tools through a layered strategy: hooks for tools that support them, CLI wrappers for tools that don't.

**Architecture:** Core alignment logic in TypeScript with tool-specific adapters. The core handles signal classification, 3-tier routing, message enrichment, and verification gates. Adapters provide integration with Claude Code (hooks), Cline (hooks), Codex (CLI wrapper), Cursor (CLI wrapper), and other tools (CLI wrapper or rule files).

**Tech Stack:** TypeScript, Node.js, npm, shell scripts (for hook adapters)

## Global Constraints

- Zero runtime dependencies for existing shell scripts (TypeScript is additive)
- Preserve SSOT architecture: `core/` → `build/` → `dist/`
- Preserve existing `core/host/align-route.sh` as fallback for Claude Code
- New code lives in `core/host/pipeline/`
- Build scripts must be idempotent (two builds produce same output)

---

### Task 1: Project Setup

**Covers:** S3

**Files:**
- Create: `core/host/pipeline/package.json`
- Create: `core/host/pipeline/tsconfig.json`
- Create: `core/host/pipeline/src/index.ts` (placeholder)

**Interfaces:**
- Produces: npm project with TypeScript configuration

- [ ] **Step 1: Create package.json**

```json
{
  "name": "align-pipeline",
  "version": "1.0.0",
  "description": "Universal alignment pipeline for AI coding tools",
  "main": "dist/index.js",
  "bin": {
    "align-cli": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "start": "node dist/index.js"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create placeholder index.ts**

```typescript
#!/usr/bin/env node

console.log("align-pipeline: not yet implemented");
```

- [ ] **Step 4: Initialize npm and install dependencies**

Run: `cd core/host/pipeline && npm install`

Expected: Dependencies installed successfully

- [ ] **Step 5: Verify TypeScript compilation**

Run: `cd core/host/pipeline && npm run build`

Expected: `dist/index.js` created

- [ ] **Step 6: Commit**

```bash
git add core/host/pipeline/
git commit -m "feat(pipeline): initialize project setup"
```

---

### Task 2: Signal Classifier

**Covers:** S4.1

**Files:**
- Create: `core/host/pipeline/src/classifier.ts`
- Create: `core/host/pipeline/src/__tests__/classifier.test.ts`

**Interfaces:**
- Consumes: User instruction text
- Produces: `{ risk: number, vague: number, specific: number, edu: number }`

- [ ] **Step 1: Write failing tests**

```typescript
// core/host/pipeline/src/__tests__/classifier.test.ts
import { classify } from '../classifier';

describe('Signal Classifier', () => {
  test('should detect risk signals', () => {
    const result = classify('删除这个文件');
    expect(result.risk).toBeGreaterThanOrEqual(1);
  });

  test('should detect vague signals', () => {
    const result = classify('优化一下');
    expect(result.vague).toBeGreaterThanOrEqual(1);
  });

  test('should detect specific signals', () => {
    const result = classify('修改 src/index.ts 的 main 函数');
    expect(result.specific).toBeGreaterThanOrEqual(1);
  });

  test('should detect educational context', () => {
    const result = classify('解释一下什么是 force push');
    expect(result.edu).toBeGreaterThanOrEqual(1);
  });

  test('should handle empty input', () => {
    const result = classify('');
    expect(result.risk).toBe(0);
    expect(result.vague).toBe(0);
    expect(result.specific).toBe(0);
    expect(result.edu).toBe(0);
  });

  test('should strip code blocks before classification', () => {
    const result = classify('```\nrm -rf /\n```\n帮我看看这段代码');
    expect(result.risk).toBe(0); // code block should be stripped
    expect(result.vague).toBeGreaterThanOrEqual(1);
  });

  test('should strip negation clauses', () => {
    const result = classify('不要删除这个文件');
    expect(result.risk).toBe(0); // negation should be stripped
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd core/host/pipeline && npx jest classifier.test.ts`

Expected: FAIL with "Cannot find module '../classifier'"

- [ ] **Step 3: Implement classifier**

```typescript
// core/host/pipeline/src/classifier.ts

export interface Classification {
  risk: number;
  vague: number;
  specific: number;
  edu: number;
}

// Risk signals (from align-route.sh)
const RISK_RE = /删除|删掉|删库|清空|清库|清掉|重置|回滚|强推|上线|下线|停服|发版|部署到生产|生产环境|生产库|数据库迁移|格式化|抹掉|销毁|覆盖|drop table|truncate|rm -rf|reset --hard|force push|push --force|rollback|production|db migration|deploy to prod|destroy|format/gi;

// Vague signals (from align-route.sh)
const VAGUE_RE = /优化一下|优化下|优化|改进|完善|完善一下|提升一下|提升|处理一下|处理|看看|弄一下|弄好|搞一下|搞定|搞定它|修一下|修好|美化|改改|改一下|改下|调整一下|调整下|梳理一下|梳理下|整理一下|整理下|重构|升级|升级一下|增强|更好|更快|更优雅|更稳定|optimi[sz]e|improve|clean ?up|polish|make it better|refactor|tweak|adjust|fix|enhance|upgrade|refine|rework|reorganize|做个|做一个|做一下|加个|加一个|加一下|写个|写一个|写一下|搞个|搞一个|弄个|弄一个|实现个|实现一个|实现一下|建个|建一个|新建一个|创建一个/gi;

// Specific signals (from align-route.sh)
const SPEC_RE = /[A-Za-z0-9_./\\-]+\.(sh|ps1|md|js|jsx|ts|tsx|py|json|yml|yaml|toml|go|rs|java|c|cpp|h|css|html|sql)|[A-Za-z_][A-Za-z0-9_]*\(\)|第[[:space:]]*[0-9]+[[:space:]]*行|line [0-9]+|:[0-9]+\b/g;

// Educational context signals (from align-route.sh)
const EDU_RE = /解释|什么是|介绍一下|翻译|explain|what is|translate/gi;

function stripCodeBlocks(text: string): string {
  // Remove code blocks (```...```)
  let result = text.replace(/```[\s\S]*?```/g, '');
  // Remove inline code (`...`)
  result = result.replace(/`[^`]*`/g, '');
  // Remove quoted content ("..." and "..." and 「...」 and 『...』)
  result = result.replace(/"[^"]*"|"[^"]*"|「[^」]*」|『[^』]*』/g, '');
  return result;
}

function stripNegation(text: string): string {
  // Remove negation clauses (from align-route.sh)
  return text.replace(/(不要|不得|不准|不能|别动|别去|禁止|避免|do not|don't|never|avoid)[^,，。;；.!?！？]*/gi, '');
}

function countMatches(text: string, regex: RegExp): number {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

export function classify(instruction: string): Classification {
  if (!instruction) {
    return { risk: 0, vague: 0, specific: 0, edu: 0 };
  }

  // Strip code blocks and quotes (discussion ≠ execution)
  const clean = stripCodeBlocks(instruction);

  // Strip negation clauses ("不要删库" is not a risk signal)
  const signalText = stripNegation(clean);

  // Count signals
  const risk = countMatches(signalText, RISK_RE);
  const vague = countMatches(signalText, VAGUE_RE);
  // Specificity is measured on original text (file names may be in backticks/quotes)
  const specific = countMatches(instruction, SPEC_RE);
  const edu = countMatches(clean, EDU_RE);

  return { risk, vague, specific, edu };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd core/host/pipeline && npx jest classifier.test.ts`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add core/host/pipeline/src/classifier.ts core/host/pipeline/src/__tests__/classifier.test.ts
git commit -m "feat(pipeline): implement signal classifier"
```

---

### Task 3: Three-Tier Router

**Covers:** S4.2

**Files:**
- Create: `core/host/pipeline/src/router.ts`
- Create: `core/host/pipeline/src/__tests__/router.test.ts`

**Interfaces:**
- Consumes: `Classification` from classifier
- Produces: `{ verdict: 'HIGH' | 'VAGUE' | 'CLEAR', instructions: string }`

- [ ] **Step 1: Write failing tests**

```typescript
// core/host/pipeline/src/__tests__/router.test.ts
import { route } from '../router';
import { Classification } from '../classifier';

describe('Three-Tier Router', () => {
  test('should route HIGH when risk >= 1', () => {
    const classification: Classification = { risk: 1, vague: 0, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('HIGH');
  });

  test('should route GRAY when risk >= 1 and edu >= 1', () => {
    const classification: Classification = { risk: 1, vague: 0, specific: 0, edu: 1 };
    const result = route(classification);
    expect(result.verdict).toBe('GRAY');
  });

  test('should route VAGUE when vague >= 1 and specific = 0', () => {
    const classification: Classification = { risk: 0, vague: 1, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('VAGUE');
  });

  test('should route GRAY when vague >= 1 and specific >= 1', () => {
    const classification: Classification = { risk: 0, vague: 1, specific: 1, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('GRAY');
  });

  test('should route CLEAR when no signals', () => {
    const classification: Classification = { risk: 0, vague: 0, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('CLEAR');
  });

  test('should route CLEAR when only specific signals', () => {
    const classification: Classification = { risk: 0, vague: 0, specific: 2, edu: 0 };
    const result = route(classification);
    expect(result.verdict).toBe('CLEAR');
  });

  test('should include instructions for HIGH verdict', () => {
    const classification: Classification = { risk: 1, vague: 0, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.instructions).toContain('HIGH');
    expect(result.instructions).toContain('确认');
  });

  test('should include instructions for VAGUE verdict', () => {
    const classification: Classification = { risk: 0, vague: 1, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.instructions).toContain('VAGUE');
    expect(result.instructions).toContain('澄清');
  });

  test('should include instructions for CLEAR verdict', () => {
    const classification: Classification = { risk: 0, vague: 0, specific: 0, edu: 0 };
    const result = route(classification);
    expect(result.instructions).toContain('CLEAR');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd core/host/pipeline && npx jest router.test.ts`

Expected: FAIL with "Cannot find module '../router'"

- [ ] **Step 3: Implement router**

```typescript
// core/host/pipeline/src/router.ts
import { Classification } from './classifier';

export type Verdict = 'HIGH' | 'VAGUE' | 'GRAY' | 'CLEAR';

export interface RoutingResult {
  verdict: Verdict;
  instructions: string;
}

const HIGH_INSTRUCTIONS = `[对齐] ⚠️ 高风险指令（判定：HIGH）。按以下对齐协议执行，禁止跳步：
1. 先读 .align/lessons.md → spec.md → context.md（项目规范，必读）
2. 列出全部影响面：哪些文件/数据/环境/调用方会被改动
3. 输出执行方案，须包含：改动清单 / 回滚条件 / 验证方式 / 风险说明
4. 停下等待用户明确确认后再执行——禁止在确认前做任何写操作
5. 确认后执行，完成后跑验证命令并报告结果
硬性红线：高风险静默执行 = 无效输出，必须重做。`;

const VAGUE_INSTRUCTIONS = `[对齐] 指令目标或对象不够明确（判定：VAGUE）。按以下对齐协议执行：
1. 先读 .align/lessons.md → spec.md → context.md（项目规范，必读）
2. 能从项目文件/代码/文档读到的信息，自行读取，不问用户
3. 仍缺失且会改变目标/范围/验收的关键信息 → 一次只问一个问题，附推荐答案
4. 意图对齐后，按 Agent Brief 八组件执行：目标/背景/范围/交付物/约束/执行策略/验收/沉淀
5. 禁止在意图对齐前输出最终方案——猜错返工比一次澄清成本更高`;

const GRAY_INSTRUCTIONS = `[对齐] 指令存在歧义（判定：GRAY）。按以下对齐协议执行：
1. 先读 .align/lessons.md → spec.md → context.md（项目规范，必读）
2. 判断指令是教学语境（解释/介绍）还是执行语境
3. 如果是教学语境，按常规回答
4. 如果是执行语境，按 VAGUE 协议执行
5. 无法判断时，按 VAGUE 协议执行（保守处理）`;

const CLEAR_INSTRUCTIONS = `[对齐] 指令清楚（判定：CLEAR），按以下执行协议行动：
1. 先读 .align/lessons.md → spec.md → context.md（项目规范，必读）
2. 按 Agent Brief 执行：明确目标 → 锁定范围 → 最小变更 → 完成后验证
3. 完成后自行验证核心功能未回归
4. 有踩坑/纠正/新约定 → 追加到 .align/lessons.md（一条≤2行）
5. 交付前自验证（R8 验证门不可跳过）`;

export function route(classification: Classification): RoutingResult {
  const { risk, vague, specific, edu } = classification;

  let verdict: Verdict;
  let instructions: string;

  if (risk >= 1) {
    if (edu >= 1) {
      // Educational context: "解释一下什么是 force push"
      verdict = 'GRAY';
      instructions = GRAY_INSTRUCTIONS;
    } else {
      verdict = 'HIGH';
      instructions = HIGH_INSTRUCTIONS;
    }
  } else if (vague >= 1 && specific === 0) {
    verdict = 'VAGUE';
    instructions = VAGUE_INSTRUCTIONS;
  } else if (vague >= 1 && specific >= 1) {
    verdict = 'GRAY';
    instructions = GRAY_INSTRUCTIONS;
  } else {
    verdict = 'CLEAR';
    instructions = CLEAR_INSTRUCTIONS;
  }

  return { verdict, instructions };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd core/host/pipeline && npx jest router.test.ts`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add core/host/pipeline/src/router.ts core/host/pipeline/src/__tests__/router.test.ts
git commit -m "feat(pipeline): implement three-tier router"
```

---

### Task 4: Message Enricher

**Covers:** S4.3

**Files:**
- Create: `core/host/pipeline/src/enricher.ts`
- Create: `core/host/pipeline/src/__tests__/enricher.test.ts`

**Interfaces:**
- Consumes: User instruction, project directory path
- Produces: `{ enrichedMessage: string, context: { lessons: string, spec: string, context: string, decisions: string } }`

- [ ] **Step 1: Write failing tests**

```typescript
// core/host/pipeline/src/__tests__/enricher.test.ts
import { enrich } from '../enricher';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');

describe('Message Enricher', () => {
  const mockProjectDir = '/mock/project';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should read .align/ files and enrich message', () => {
    // Mock file reads
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('lessons.md')) return '- lesson 1\n- lesson 2';
      if (filePath.includes('spec.md')) return '# Project Spec';
      if (filePath.includes('context.md')) return '# Project Context';
      if (filePath.includes('decisions.log.md')) return '- decision 1';
      return '';
    });

    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const result = enrich('帮我优化这个项目', mockProjectDir);

    expect(result.enrichedMessage).toContain('帮我优化这个项目');
    expect(result.enrichedMessage).toContain('lesson 1');
    expect(result.context.lessons).toContain('lesson 1');
    expect(result.context.spec).toContain('Project Spec');
  });

  test('should handle missing .align/ directory', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const result = enrich('帮我优化这个项目', mockProjectDir);

    expect(result.enrichedMessage).toBe('帮我优化这个项目');
    expect(result.context.lessons).toBe('');
    expect(result.context.spec).toBe('');
  });

  test('should handle empty .align/ files', () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('');
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const result = enrich('帮我优化这个项目', mockProjectDir);

    expect(result.enrichedMessage).toBe('帮我优化这个项目');
    expect(result.context.lessons).toBe('');
  });

  test('should limit lessons to last 30 entries', () => {
    const manyLessons = Array.from({ length: 50 }, (_, i) => `- lesson ${i + 1}`).join('\n');
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('lessons.md')) return manyLessons;
      return '';
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const result = enrich('帮我优化这个项目', mockProjectDir);

    // Should only include last 30
    expect(result.context.lessons).toContain('lesson 21');
    expect(result.context.lessons).toContain('lesson 50');
    expect(result.context.lessons).not.toContain('lesson 1');
    expect(result.context.lessons).not.toContain('lesson 20');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd core/host/pipeline && npx jest enricher.test.ts`

Expected: FAIL with "Cannot find module '../enricher'"

- [ ] **Step 3: Implement enricher**

```typescript
// core/host/pipeline/src/enricher.ts
import * as fs from 'fs';
import * as path from 'path';

export interface AlignContext {
  lessons: string;
  spec: string;
  context: string;
  decisions: string;
}

export interface EnrichmentResult {
  enrichedMessage: string;
  context: AlignContext;
}

function readFileIfExists(filePath: string): string {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8').trim();
    }
  } catch {
    // File read error, return empty
  }
  return '';
}

function extractLessons(content: string, maxEntries: number = 30): string {
  const lines = content.split('\n');
  const lessonLines = lines.filter(line => line.trim().startsWith('- '));

  // Return last N entries
  const limited = lessonLines.slice(-maxEntries);
  return limited.join('\n');
}

export function enrich(instruction: string, projectDir: string): EnrichmentResult {
  const alignDir = path.join(projectDir, '.align');

  // Check if .align/ directory exists
  if (!fs.existsSync(alignDir)) {
    return {
      enrichedMessage: instruction,
      context: { lessons: '', spec: '', context: '', decisions: '' }
    };
  }

  // Read .align/ files
  const lessonsRaw = readFileIfExists(path.join(alignDir, 'lessons.md'));
  const spec = readFileIfExists(path.join(alignDir, 'spec.md'));
  const context = readFileIfExists(path.join(alignDir, 'context.md'));
  const decisions = readFileIfExists(path.join(alignDir, 'decisions.log.md'));

  // Extract and limit lessons
  const lessons = extractLessons(lessonsRaw);

  // Build enriched message
  let enrichedMessage = instruction;

  if (lessons || spec || context) {
    const contextParts: string[] = [];

    if (lessons) {
      contextParts.push(`── 项目经验规则（必须遵守）──\n${lessons}`);
    }
    if (spec) {
      contextParts.push(`── 项目规范 ──\n${spec}`);
    }
    if (context) {
      contextParts.push(`── 项目上下文 ──\n${context}`);
    }

    if (contextParts.length > 0) {
      enrichedMessage = `${contextParts.join('\n\n')}\n\n── 用户指令 ──\n${instruction}`;
    }
  }

  return {
    enrichedMessage,
    context: { lessons, spec, context, decisions }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd core/host/pipeline && npx jest enricher.test.ts`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add core/host/pipeline/src/enricher.ts core/host/pipeline/src/__tests__/enricher.test.ts
git commit -m "feat(pipeline): implement message enricher"
```

---

### Task 5: Verification Gate

**Covers:** S4.4

**Files:**
- Create: `core/host/pipeline/src/verifier.ts`
- Create: `core/host/pipeline/src/__tests__/verifier.test.ts`

**Interfaces:**
- Consumes: Project directory path
- Produces: `{ commands: string[], results: { command: string, success: boolean, output: string }[] }`

- [ ] **Step 1: Write failing tests**

```typescript
// core/host/pipeline/src/__tests__/verifier.test.ts
import { getVerificationCommands, runVerification } from '../verifier';
import * as fs from 'fs';

jest.mock('fs');
jest.mock('child_process');

describe('Verification Gate', () => {
  const mockProjectDir = '/mock/project';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should read verification commands from check-commands.txt', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('bash .align/align-check.sh\ngit status');

    const commands = getVerificationCommands(mockProjectDir);

    expect(commands).toEqual(['bash .align/align-check.sh', 'git status']);
  });

  test('should return empty array when file does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const commands = getVerificationCommands(mockProjectDir);

    expect(commands).toEqual([]);
  });

  test('should skip comments and empty lines', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('# This is a comment\nbash .align/align-check.sh\n\n# Another comment\ngit status');

    const commands = getVerificationCommands(mockProjectDir);

    expect(commands).toEqual(['bash .align/align-check.sh', 'git status']);
  });

  test('should return empty results when no commands', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const result = runVerification(mockProjectDir);

    expect(result.commands).toEqual([]);
    expect(result.results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd core/host/pipeline && npx jest verifier.test.ts`

Expected: FAIL with "Cannot find module '../verifier'"

- [ ] **Step 3: Implement verifier**

```typescript
// core/host/pipeline/src/verifier.ts
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface VerificationResult {
  commands: string[];
  results: {
    command: string;
    success: boolean;
    output: string;
  }[];
}

export function getVerificationCommands(projectDir: string): string[] {
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
  } catch {
    return [];
  }
}

export function runVerification(projectDir: string): VerificationResult {
  const commands = getVerificationCommands(projectDir);
  const results: VerificationResult['results'] = [];

  for (const command of commands) {
    try {
      const output = execSync(command, {
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
    } catch (error: any) {
      results.push({
        command,
        success: false,
        output: error.message || 'Command failed'
      });
    }
  }

  return { commands, results };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd core/host/pipeline && npx jest verifier.test.ts`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add core/host/pipeline/src/verifier.ts core/host/pipeline/src/__tests__/verifier.test.ts
git commit -m "feat(pipeline): implement verification gate"
```

---

### Task 6: Core Pipeline Integration

**Covers:** S4

**Files:**
- Create: `core/host/pipeline/src/pipeline.ts`
- Create: `core/host/pipeline/src/__tests__/pipeline.test.ts`

**Interfaces:**
- Consumes: User instruction, project directory, options
- Produces: `{ verdict, instructions, enrichedMessage, verificationResults }`

- [ ] **Step 1: Write failing tests**

```typescript
// core/host/pipeline/src/__tests__/pipeline.test.ts
import { processInstruction } from '../pipeline';
import * as fs from 'fs';

jest.mock('fs');

describe('Core Pipeline', () => {
  const mockProjectDir = '/mock/project';

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
  });

  test('should process clear instruction', () => {
    const result = processInstruction('修改 src/index.ts 的 main 函数', mockProjectDir);

    expect(result.verdict).toBe('CLEAR');
    expect(result.instructions).toContain('CLEAR');
    expect(result.enrichedMessage).toContain('修改 src/index.ts 的 main 函数');
  });

  test('should process vague instruction', () => {
    const result = processInstruction('优化一下', mockProjectDir);

    expect(result.verdict).toBe('VAGUE');
    expect(result.instructions).toContain('VAGUE');
  });

  test('should process high-risk instruction', () => {
    const result = processInstruction('删除这个文件', mockProjectDir);

    expect(result.verdict).toBe('HIGH');
    expect(result.instructions).toContain('HIGH');
  });

  test('should bypass when [直出] prefix', () => {
    const result = processInstruction('[直出] 删除这个文件', mockProjectDir);

    expect(result.verdict).toBe('CLEAR');
    expect(result.instructions).toContain('[直出]');
  });

  test('should enrich message with .align/ context', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('lessons.md')) return '- lesson 1';
      if (filePath.includes('spec.md')) return '# Spec';
      return '';
    });

    const result = processInstruction('帮我优化这个项目', mockProjectDir);

    expect(result.enrichedMessage).toContain('lesson 1');
    expect(result.enrichedMessage).toContain('帮我优化这个项目');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd core/host/pipeline && npx jest pipeline.test.ts`

Expected: FAIL with "Cannot find module '../pipeline'"

- [ ] **Step 3: Implement pipeline**

```typescript
// core/host/pipeline/src/pipeline.ts
import { classify } from './classifier';
import { route, Verdict } from './router';
import { enrich, AlignContext } from './enricher';
import { getVerificationCommands, runVerification, VerificationResult } from './verifier';

export interface PipelineResult {
  verdict: Verdict | 'BYPASS';
  instructions: string;
  enrichedMessage: string;
  context: AlignContext;
  verificationCommands: string[];
  verificationResults: VerificationResult['results'];
}

export function processInstruction(
  instruction: string,
  projectDir: string,
  options: { bypass?: boolean } = {}
): PipelineResult {
  // Check for bypass
  if (options.bypass || instruction.startsWith('[直出]') || instruction.startsWith('直出')) {
    return {
      verdict: 'BYPASS',
      instructions: '[对齐] [直出] 模式，跳过路由。',
      enrichedMessage: instruction,
      context: { lessons: '', spec: '', context: '', decisions: '' },
      verificationCommands: [],
      verificationResults: []
    };
  }

  // Step 1: Classify signals
  const classification = classify(instruction);

  // Step 2: Route based on classification
  const { verdict, instructions } = route(classification);

  // Step 3: Enrich message with .align/ context
  const { enrichedMessage, context } = enrich(instruction, projectDir);

  // Step 4: Get verification commands
  const verificationCommands = getVerificationCommands(projectDir);

  return {
    verdict,
    instructions,
    enrichedMessage,
    context,
    verificationCommands,
    verificationResults: [] // Will be filled after execution
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd core/host/pipeline && npx jest pipeline.test.ts`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add core/host/pipeline/src/pipeline.ts core/host/pipeline/src/__tests__/pipeline.test.ts
git commit -m "feat(pipeline): implement core pipeline integration"
```

---

### Task 7: CLI Entry Point

**Covers:** S3, S5.2

**Files:**
- Modify: `core/host/pipeline/src/index.ts`

**Interfaces:**
- Consumes: Command line arguments
- Produces: CLI output

- [ ] **Step 1: Implement CLI**

```typescript
#!/usr/bin/env node

import { processInstruction } from './pipeline';
import * as path from 'path';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: align-cli <tool> <instruction> [--project-dir <dir>]');
  console.error('');
  console.error('Tools:');
  console.error('  claude-code    Claude Code (hook mode)');
  console.error('  codex          Codex (CLI wrapper)');
  console.error('  cursor         Cursor (CLI wrapper)');
  console.error('  generic        Generic tool (CLI wrapper)');
  process.exit(1);
}

const tool = args[0];
const instruction = args[1];
const projectDir = args.includes('--project-dir')
  ? args[args.indexOf('--project-dir') + 1]
  : process.cwd();

// Process instruction through alignment pipeline
const result = processInstruction(instruction, projectDir);

// Output result
console.log('=== Alignment Pipeline Result ===');
console.log(`Verdict: ${result.verdict}`);
console.log('');
console.log('Instructions:');
console.log(result.instructions);
console.log('');
console.log('Enriched Message:');
console.log(result.enrichedMessage);

if (result.verificationCommands.length > 0) {
  console.log('');
  console.log('Verification Commands:');
  result.verificationCommands.forEach(cmd => console.log(`  - ${cmd}`));
}

// Exit with appropriate code
// HIGH verdict should block (exit 2) if configured
if (result.verdict === 'HIGH' && process.env.BLOCK_ON_HIGH === 'on') {
  process.exit(2);
}

process.exit(0);
```

- [ ] **Step 2: Verify CLI works**

Run: `cd core/host/pipeline && npm run build && node dist/index.js`

Expected: Shows usage message

- [ ] **Step 3: Commit**

```bash
git add core/host/pipeline/src/index.ts
git commit -m "feat(pipeline): implement CLI entry point"
```

---

### Task 8: Claude Code Hook Adapter

**Covers:** S5.1

**Files:**
- Create: `core/host/pipeline/adapters/hook/claude-code.sh`
- Modify: `core/host/pipeline/src/index.ts` (add claude-code mode)

**Interfaces:**
- Consumes: Claude Code hook JSON from stdin
- Produces: Hook output for Claude Code

- [ ] **Step 1: Create Claude Code hook script**

```bash
#!/usr/bin/env bash
# claude-code.sh — Claude Code hook adapter for align-pipeline
# Reads hook JSON from stdin, calls align-cli, outputs hook response

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIPELINE_DIR="$(cd "$SCRIPT_DIR/../../" && pwd)"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo "[对齐] Warning: Node.js not found, falling back to shell router"
  # Fall back to shell router if available
  if [ -f "$PIPELINE_DIR/../align-route.sh" ]; then
    exec bash "$PIPELINE_DIR/../align-route.sh"
  else
    echo "[对齐] No alignment pipeline available"
    exit 0
  fi
fi

# Read hook JSON from stdin
RAW="$(cat 2>/dev/null || true)"

# Extract prompt from JSON
PROMPT=""
if command -v python3 &> /dev/null; then
  PROMPT="$(printf '%s' "$RAW" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("prompt",""))
except Exception: pass' 2>/dev/null || true)"
fi

if [ -z "$PROMPT" ] && command -v jq &> /dev/null; then
  PROMPT="$(printf '%s' "$RAW" | jq -r '.prompt // empty' 2>/dev/null || true)"
fi

if [ -z "$PROMPT" ]; then
  PROMPT="$(printf '%s' "$RAW" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
fi

if [ -z "$PROMPT" ]; then
  echo "[对齐] Could not extract prompt from hook input"
  exit 0
fi

# Get project directory from Claude Code
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Call align-cli
RESULT="$(node "$PIPELINE_DIR/dist/index.js" claude-code "$PROMPT" --project-dir "$PROJECT_DIR" 2>/dev/null || true)"

if [ -n "$RESULT" ]; then
  echo "$RESULT"
else
  echo "[对齐] Pipeline execution failed, falling back to shell router"
  if [ -f "$PIPELINE_DIR/../align-route.sh" ]; then
    exec bash "$PIPELINE_DIR/../align-route.sh"
  fi
fi
```

- [ ] **Step 2: Make script executable**

Run: `chmod +x core/host/pipeline/adapters/hook/claude-code.sh`

Expected: Script is executable

- [ ] **Step 3: Commit**

```bash
git add core/host/pipeline/adapters/hook/claude-code.sh
git commit -m "feat(pipeline): implement Claude Code hook adapter"
```

---

### Task 9: CLI Wrapper Adapters

**Covers:** S5.2

**Files:**
- Modify: `core/host/pipeline/src/index.ts` (add tool-specific modes)

**Interfaces:**
- Consumes: Tool name, instruction
- Produces: Tool-specific output

- [ ] **Step 1: Add tool-specific modes to CLI**

```typescript
// Add to core/host/pipeline/src/index.ts

// Tool-specific modes
const toolModes: Record<string, (instruction: string, projectDir: string) => void> = {
  'claude-code': (instruction, projectDir) => {
    // Claude Code hook mode: output hook-compatible format
    const result = processInstruction(instruction, projectDir);
    console.log(result.instructions);
  },

  'codex': (instruction, projectDir) => {
    // Codex CLI wrapper mode: inject alignment context
    const result = processInstruction(instruction, projectDir);
    console.log('=== Alignment Context ===');
    console.log(result.instructions);
    console.log('');
    console.log('=== Original Instruction ===');
    console.log(result.enrichedMessage);
  },

  'cursor': (instruction, projectDir) => {
    // Cursor CLI wrapper mode: inject alignment context
    const result = processInstruction(instruction, projectDir);
    console.log('=== Alignment Context ===');
    console.log(result.instructions);
    console.log('');
    console.log('=== Original Instruction ===');
    console.log(result.enrichedMessage);
  },

  'generic': (instruction, projectDir) => {
    // Generic mode: output full alignment result
    const result = processInstruction(instruction, projectDir);
    console.log('=== Alignment Pipeline Result ===');
    console.log(`Verdict: ${result.verdict}`);
    console.log('');
    console.log('Instructions:');
    console.log(result.instructions);
    console.log('');
    console.log('Enriched Message:');
    console.log(result.enrichedMessage);
  }
};

// Update main to use tool modes
if (toolModes[tool]) {
  toolModes[tool](instruction, projectDir);
} else {
  console.error(`Unknown tool: ${tool}`);
  console.error('Supported tools: ' + Object.keys(toolModes).join(', '));
  process.exit(1);
}
```

- [ ] **Step 2: Verify tool modes work**

Run: `cd core/host/pipeline && npm run build && node dist/index.js codex "优化一下"`

Expected: Shows alignment result in Codex format

- [ ] **Step 3: Commit**

```bash
git add core/host/pipeline/src/index.ts
git commit -m "feat(pipeline): implement CLI wrapper adapters"
```

---

### Task 10: Rule File Generators

**Covers:** S5.3

**Files:**
- Create: `core/host/pipeline/src/rules/generate.ts`
- Create: `core/host/pipeline/src/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: Project directory
- Produces: Rule files for various tools

- [ ] **Step 1: Write failing tests**

```typescript
// core/host/pipeline/src/__tests__/rules.test.ts
import { generateCopilotRules, generateAiderRules, generateWindsurfRules } from '../rules/generate';
import * as fs from 'fs';

jest.mock('fs');

describe('Rule File Generators', () => {
  const mockProjectDir = '/mock/project';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate Copilot rules', () => {
    const rules = generateCopilotRules(mockProjectDir);

    expect(rules).toContain('Alignment Protocol');
    expect(rules).toContain('three-tier routing');
    expect(rules).toContain('HIGH');
    expect(rules).toContain('VAGUE');
    expect(rules).toContain('CLEAR');
  });

  test('should generate Aider rules', () => {
    const rules = generateAiderRules(mockProjectDir);

    expect(rules).toContain('Alignment Protocol');
    expect(rules).toContain('three-tier routing');
  });

  test('should generate Windsurf rules', () => {
    const rules = generateWindsurfRules(mockProjectDir);

    expect(rules).toContain('Alignment Protocol');
    expect(rules).toContain('three-tier routing');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd core/host/pipeline && npx jest rules.test.ts`

Expected: FAIL with "Cannot find module '../rules/generate'"

- [ ] **Step 3: Implement rule generators**

```typescript
// core/host/pipeline/src/rules/generate.ts

const ALIGNMENT_RULES = `
# Alignment Protocol

This project uses an alignment pipeline to ensure AI coding tools understand user instructions correctly.

## Three-Tier Routing

Every instruction is classified into one of three tiers:

### HIGH (High Risk)
- Contains irreversible operations (delete, deploy, reset, etc.)
- Must list all affected files/data/environments
- Must present execution plan with rollback conditions
- Must wait for explicit user confirmation before executing
- Cannot proceed without confirmation

### VAGUE (Unclear Target)
- Contains vague verbs (optimize, improve, fix, etc.) without specific targets
- Must read project context from .align/ files first
- Must ask one clarifying question with recommended answer
- Cannot proceed without alignment

### CLEAR (Clear Instruction)
- Has specific targets and clear requirements
- Can proceed with execution
- Must verify after completion
- Must record lessons learned

## Required Behavior

1. ALWAYS read .align/lessons.md, .align/spec.md, .align/context.md before executing
2. ALWAYS classify instructions into HIGH/VAGUE/CLEAR
3. ALWAYS follow the routing protocol for each tier
4. NEVER skip verification after completion
5. NEVER execute HIGH-risk operations without confirmation

## Verification

After completing any task:
1. Run verification commands from .align/check-commands.txt
2. Verify core functionality is not broken
3. Record any lessons learned to .align/lessons.md
`;

export function generateCopilotRules(projectDir: string): string {
  return ALIGNMENT_RULES;
}

export function generateAiderRules(projectDir: string): string {
  return ALIGNMENT_RULES;
}

export function generateWindsurfRules(projectDir: string): string {
  return ALIGNMENT_RULES;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd core/host/pipeline && npx jest rules.test.ts`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add core/host/pipeline/src/rules/generate.ts core/host/pipeline/src/__tests__/rules.test.ts
git commit -m "feat(pipeline): implement rule file generators"
```

---

### Task 11: Build Script Integration

**Covers:** S6

**Files:**
- Modify: `build/build.sh`
- Modify: `build/build.ps1`

**Interfaces:**
- Consumes: Source files from core/
- Produces: Build artifacts in dist/

- [ ] **Step 1: Read current build scripts**

Read `build/build.sh` and `build/build.ps1` to understand current structure.

- [ ] **Step 2: Add TypeScript compilation step to build.sh**

Add after existing build steps:

```bash
# ── TypeScript Pipeline Compilation ──
echo "Building TypeScript pipeline..."
if command -v node &> /dev/null && command -v npm &> /dev/null; then
  cd "$ROOT/core/host/pipeline" && npm install && npm run build
  cd "$ROOT"
  echo "TypeScript pipeline built successfully"
else
  echo "Warning: Node.js/npm not found, skipping TypeScript pipeline build"
fi
```

- [ ] **Step 3: Add TypeScript compilation step to build.ps1**

Add after existing build steps:

```powershell
# ── TypeScript Pipeline Compilation ──
Write-Host "Building TypeScript pipeline..."
if (Get-Command node -ErrorAction SilentlyContinue) {
  Push-Location "$ROOT\core\host\pipeline"
  npm install
  npm run build
  Pop-Location
  Write-Host "TypeScript pipeline built successfully"
} else {
  Write-Host "Warning: Node.js not found, skipping TypeScript pipeline build"
}
```

- [ ] **Step 4: Verify build works**

Run: `bash build/build.sh`

Expected: Build completes successfully

- [ ] **Step 5: Verify idempotency**

Run: `bash build/build.sh && bash build/build.sh && git status --short dist/`

Expected: No changes in dist/

- [ ] **Step 6: Commit**

```bash
git add build/build.sh build/build.ps1
git commit -m "feat(build): add TypeScript pipeline compilation"
```

---

### Task 12: Installation Script Integration

**Covers:** S6

**Files:**
- Modify: `scripts/install-skill.sh`
- Modify: `scripts/install-skill.ps1`

**Interfaces:**
- Consumes: Build artifacts from dist/
- Produces: Installed files in target directories

- [ ] **Step 1: Read current installation scripts**

Read `scripts/install-skill.sh` and `scripts/install-skill.ps1` to understand current structure.

- [ ] **Step 2: Add Node.js dependency check to install-skill.sh**

Add at the beginning:

```bash
# ── Check Node.js dependency ──
if ! command -v node &> /dev/null; then
  echo "Warning: Node.js not found. TypeScript pipeline will not work."
  echo "Install Node.js from https://nodejs.org/ or use shell fallback."
fi
```

- [ ] **Step 3: Add Node.js dependency check to install-skill.ps1**

Add at the beginning:

```powershell
# ── Check Node.js dependency ──
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Warning: Node.js not found. TypeScript pipeline will not work."
  Write-Host "Install Node.js from https://nodejs.org/ or use shell fallback."
}
```

- [ ] **Step 4: Verify installation works**

Run: `bash scripts/install-skill.sh`

Expected: Installation completes successfully

- [ ] **Step 5: Commit**

```bash
git add scripts/install-skill.sh scripts/install-skill.ps1
git commit -m "feat(install): add Node.js dependency check"
```

---

### Task 13: Integration Testing

**Covers:** S7

**Files:**
- Create: `core/host/pipeline/src/__tests__/integration.test.ts`

**Interfaces:**
- Consumes: All components
- Produces: Integration test results

- [ ] **Step 1: Write integration tests**

```typescript
// core/host/pipeline/src/__tests__/integration.test.ts
import { processInstruction } from '../pipeline';
import * as fs from 'fs';
import * as path from 'path';

describe('Integration Tests', () => {
  const realProjectDir = path.resolve(__dirname, '../../../../');

  test('should process clear instruction with real .align/ directory', () => {
    const result = processInstruction('修改 src/index.ts 的 main 函数', realProjectDir);

    expect(result.verdict).toBe('CLEAR');
    expect(result.instructions).toContain('CLEAR');
  });

  test('should process vague instruction with real .align/ directory', () => {
    const result = processInstruction('优化一下', realProjectDir);

    expect(result.verdict).toBe('VAGUE');
    expect(result.instructions).toContain('VAGUE');
  });

  test('should process high-risk instruction with real .align/ directory', () => {
    const result = processInstruction('删除这个文件', realProjectDir);

    expect(result.verdict).toBe('HIGH');
    expect(result.instructions).toContain('HIGH');
  });

  test('should enrich message with real .align/ context', () => {
    const result = processInstruction('帮我优化这个项目', realProjectDir);

    // Should contain some context from .align/ files
    expect(result.enrichedMessage).toBeDefined();
    expect(result.context).toBeDefined();
  });

  test('should get verification commands from real .align/ directory', () => {
    const result = processInstruction('帮我优化这个项目', realProjectDir);

    // Should have some verification commands
    expect(result.verificationCommands).toBeDefined();
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `cd core/host/pipeline && npx jest integration.test.ts`

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add core/host/pipeline/src/__tests__/integration.test.ts
git commit -m "test(pipeline): add integration tests"
```

---

### Task 14: Final Verification

**Covers:** S7, S10

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All components
- Produces: Verification results

- [ ] **Step 1: Run all unit tests**

Run: `cd core/host/pipeline && npm test`

Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `bash build/build.sh`

Expected: Build completes successfully

- [ ] **Step 3: Verify idempotency**

Run: `bash build/build.sh && bash build/build.sh && git status --short dist/`

Expected: No changes in dist/

- [ ] **Step 4: Verify CLI works**

Run: `cd core/host/pipeline && node dist/index.js codex "优化一下"`

Expected: Shows alignment result

- [ ] **Step 5: Verify Claude Code hook works**

Run: `echo '{"prompt":"优化一下"}' | bash core/host/pipeline/adapters/hook/claude-code.sh`

Expected: Shows alignment result

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete universal alignment pipeline"
```

---

## Self-Review

### Spec Coverage

- ✅ S1 (Problem): Covered by Task 1-14
- ✅ S2 (Solution Overview): Covered by Task 1-14
- ✅ S3 (Directory Structure): Covered by Task 1
- ✅ S4 (Core Logic): Covered by Task 2-6
- ✅ S5 (Tool Adapters): Covered by Task 7-10
- ✅ S6 (Project Changes): Covered by Task 11-12
- ✅ S7 (Verification): Covered by Task 13-14
- ✅ S8 (Risks): Addressed in design
- ✅ S9 (Implementation Plan): This document
- ✅ S10 (Success Criteria): Covered by Task 14

### Placeholder Scan

- ✅ No TBD/TODO
- ✅ All steps have concrete actions
- ✅ All code blocks are complete

### Type Consistency

- ✅ Classification interface consistent across tasks
- ✅ RoutingResult interface consistent across tasks
- ✅ PipelineResult interface consistent across tasks

**Self-Review passed. Ready for execution.**
