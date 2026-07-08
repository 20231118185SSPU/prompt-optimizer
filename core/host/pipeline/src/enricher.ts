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
