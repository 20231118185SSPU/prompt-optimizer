import { readFileSync } from 'node:fs';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { alignInstruction } from '../alignment-interface';

const contractRoot = path.resolve(__dirname, '../../../../contracts');
const schema = JSON.parse(
  readFileSync(path.join(contractRoot, 'alignment-brief.schema.json'), 'utf8')
) as Record<string, unknown>;
const taskRouteSchema = JSON.parse(
  readFileSync(path.join(contractRoot, 'task-route.schema.json'), 'utf8')
) as Record<string, unknown>;
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(taskRouteSchema);
const validate = ajv.compile(schema);

describe('Phase 1 Alignment Brief contract', () => {
  test('accepts the canonical degraded minimum contract', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-brief-schema-'));
    try {
      const result = alignInstruction(
        '只修改 src/parser.ts 的错误文本，不改 public API；完成后运行 npm test -- parser。',
        projectDir,
        { model: { status: 'unavailable' } }
      );

      expect(validate(result.brief)).toBe(true);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test.each([
    ['missing executable acceptance', (brief: Record<string, unknown>) => ({ ...brief, acceptance: [] })],
    ['unknown property', (brief: Record<string, unknown>) => ({ ...brief, hiddenPrompt: 'internal' })]
  ])('rejects %s', (_name, mutate) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-brief-schema-invalid-'));
    try {
      const result = alignInstruction(
        '只修改 src/parser.ts 的错误文本，不改 public API；完成后运行 npm test -- parser。',
        projectDir,
        { model: { status: 'unavailable' } }
      );
      const invalid = mutate(result.brief as unknown as Record<string, unknown>);
      expect(validate(invalid)).toBe(false);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
