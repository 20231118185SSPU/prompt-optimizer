import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { alignInstruction } from '../alignment-interface';

describe('Phase 1 privacy and handoff', () => {
  test('redacts secrets and personal data from Brief, Trace, and optional handoff without writing a file', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-private-handoff-'));
    const tokenValue = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
    const envValue = 'ultra-secret-value-987654';
    const accessKeyValue = 'AKIAIOSFODNN7EXAMPLE';
    const databaseUrlValue = 'mysql://reporter:private-password@db.internal/reports';
    const freeTextEnvValue = 'mysql://reporter:s3cr3t@localhost/reports';
    const trailingEnvValue = 'mysql://reader:another-secret@localhost/audit';
    const prosePassword = 'hunter2-secret';
    const email = 'alice.private@example.com';

    try {
      const before = fs.readdirSync(projectDir);
      const result = alignInstruction(
        '只修改 src/client.ts 的变量引用，不改 public API；完成后运行 npm test -- client。',
        projectDir,
        {
          includeTrace: true,
          includeHandoff: true,
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'change',
                secondary: [],
                rationale: [{ module: 'change', reason: `Owner ${email} requested a variable-only change.` }],
                confidence: 0.98,
                missing: []
              },
              brief: {
                objective: '更新 client 的变量引用。',
                context: [
                  `Use API_TOKEN=${envValue} from .env.`,
                  `Use AWS_ACCESS_KEY_ID=${accessKeyValue} from .env.`,
                  `Use DATABASE_URL=${databaseUrlValue} from .env.`,
                  `The .env database value is ${freeTextEnvValue}`,
                  `Read ${trailingEnvValue} from .env`,
                  `The password is ${prosePassword}`,
                  `Provider token: ${tokenValue}`
                ],
                scope: { include: ['src/client.ts'], exclude: ['public API'] },
                deliverables: ['最小代码补丁。'],
                constraints: [`Do not contact ${email}.`],
                execution: ['只引用 API_TOKEN 变量，不复制实际值。'],
                acceptance: [
                  {
                    criterion: 'client 测试通过。',
                    method: { kind: 'command', value: 'NODE_ENV=test dotenv -e .env.test npm test -- client' }
                  }
                ]
              }
            }
          }
        }
      );

      const serialized = JSON.stringify({ brief: result.brief, trace: result.trace, handoff: result.handoff });
      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('privacy_redaction_required');
      expect(serialized).not.toContain(tokenValue);
      expect(serialized).not.toContain(envValue);
      expect(serialized).not.toContain(accessKeyValue);
      expect(serialized).not.toContain(databaseUrlValue);
      expect(serialized).not.toContain(freeTextEnvValue);
      expect(serialized).not.toContain(trailingEnvValue);
      expect(serialized).not.toContain(prosePassword);
      expect(serialized).not.toContain(email);
      expect(result.brief.markdown).toContain('API_TOKEN=[REDACTED]');
      expect(result.brief.markdown).toContain('AWS_ACCESS_KEY_ID=[REDACTED]');
      expect(result.brief.markdown).toContain('DATABASE_URL=[REDACTED]');
      expect(result.brief.markdown).toContain('NODE_ENV=test dotenv -e .env.test npm test -- client');
      expect(result.handoff).toEqual(expect.objectContaining({
        schemaVersion: '1.0.0',
        kind: 'alignment.brief-handoff',
        executionBrief: result.brief.markdown
      }));
      expect(result.handoff?.summaryHash).toBe(
        `sha256:${createHash('sha256').update(result.brief.markdown).digest('hex')}`
      );
      expect(fs.readdirSync(projectDir)).toEqual(before);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
