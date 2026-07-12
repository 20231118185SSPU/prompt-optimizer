import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface ProjectionResult {
  status: 'created' | 'updated' | 'unchanged';
  sourceDigest: string;
  path: string;
}

const SOURCE_MARKER = 'context-source-sha256:';
const CONTENT_MARKER = 'context-content-sha256:';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function readRequired(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Classified context is incomplete: missing ${path.basename(filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').trim();
}

function projectionBody(facts: string, glossary: string, state: string): string {
  return `# Legacy Context Projection\n\n## Project Facts\n\n${facts}\n\n## Glossary\n\n${glossary}\n\n## Temporary State\n\n${state}\n`;
}

function marker(content: string, name: string): string | undefined {
  return content.match(new RegExp(`${name}([a-f0-9]{64})`))?.[1];
}

export function writeContextProjection(projectDir: string, force = false): ProjectionResult {
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
    if (current === output) return { status: 'unchanged', sourceDigest, path: outputPath };

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
