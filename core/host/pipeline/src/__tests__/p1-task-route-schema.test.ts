import { readFileSync } from 'node:fs';
import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { alignInstruction } from '../alignment-interface';
import { resolveTaskRoute } from '../task-route';

type JsonObject = Record<string, unknown>;

const contractRoot = path.resolve(__dirname, '../../../../contracts');

function loadJson(name: string): JsonObject {
  return JSON.parse(readFileSync(path.join(contractRoot, name), 'utf8')) as JsonObject;
}

function loadJsonLines(name: string): JsonObject[] {
  return readFileSync(path.join(contractRoot, name), 'utf8')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line) as JsonObject);
}

describe('Phase 1 task route contract', () => {
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(
    loadJson('task-route.schema.json')
  );

  test('freezes two valid semantic fixtures for every task family', () => {
    const fixtures = loadJsonLines('golden/task-route-cases.jsonl');
    const counts = new Map<string, number>();

    expect(fixtures).toHaveLength(10);
    for (const fixture of fixtures) {
      const taskRoute = fixture.taskRoute as JsonObject;
      expect(validate(taskRoute)).toBe(true);
      const primary = String(taskRoute.primary);
      counts.set(primary, (counts.get(primary) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({
      change: 2,
      inspect: 2,
      design: 2,
      produce: 2,
      operate: 2
    });
  });

  test('accepts the canonical degraded task route while model input still fails closed', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-degraded-route-schema-'));
    try {
      const result = alignInstruction(
        '只修改 src/parser.ts 的错误文本，不改 public API；完成后运行 npm test -- parser。',
        projectDir,
        { model: { status: 'unavailable' } }
      );

      expect(result.mode).toBe('degraded');
      expect(validate(result.taskRoute)).toBe(true);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('keeps a schema-valid unknown task in the minimum contract', () => {
    const result = resolveTaskRoute({
      status: 'available',
      output: {
        taskRoute: {
          schemaVersion: '1.0.0',
          primary: 'unknown',
          secondary: [],
          rationale: [],
          confidence: 0,
          missing: ['semantic_task_route']
        }
      }
    });

    expect(result).toEqual({
      mode: 'full',
      degradedReasons: [],
      taskRoute: {
        schemaVersion: '1.0.0',
        primary: 'unknown',
        secondary: [],
        rationale: [],
        confidence: 0,
        missing: ['semantic_task_route']
      }
    });
  });

  test.each([
    ['missing primary', {
      schemaVersion: '1.0.0', secondary: [], rationale: [], confidence: 0.8, missing: []
    }],
    ['unknown module', {
      schemaVersion: '1.0.0', primary: 'deploy', secondary: [],
      rationale: [{ module: 'deploy', reason: 'Deploy it.' }], confidence: 0.8, missing: []
    }],
    ['rationale that omits the primary module', {
      schemaVersion: '1.0.0', primary: 'change', secondary: ['inspect'],
      rationale: [{ module: 'inspect', reason: 'Inspect it.' }], confidence: 0.8, missing: []
    }],
    ['too many secondary modules', {
      schemaVersion: '1.0.0', primary: 'change', secondary: ['inspect', 'design', 'operate'],
      rationale: [
        { module: 'change', reason: 'Change it.' },
        { module: 'inspect', reason: 'Inspect it.' },
        { module: 'design', reason: 'Design it.' },
        { module: 'operate', reason: 'Operate it.' }
      ],
      confidence: 0.8,
      missing: []
    }]
  ])('rejects %s', (_name, taskRoute) => {
    expect(validate(taskRoute)).toBe(false);
  });
});
