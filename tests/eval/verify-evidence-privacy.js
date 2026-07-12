#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const evidenceDir = path.resolve(__dirname, '../../docs/planning/evidence/g5');
const files = fs.existsSync(evidenceDir)
  ? fs.readdirSync(evidenceDir).filter(file => /^(?:pilot-|held-out-).*\.(?:jsonl|json)$/.test(file))
  : [];

for (const file of files) {
  const text = fs.readFileSync(path.join(evidenceDir, file), 'utf8');
  const records = file.endsWith('.jsonl')
    ? text.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)
    : [JSON.parse(text)];
  for (const record of records) {
    const serialized = JSON.stringify(record);
    if (/sk-[A-Za-z0-9_*.-]+/.test(serialized) || /Bearer\s+(?!\[REDACTED\])/.test(serialized)) {
      throw new Error(`credential-shaped content in ${file}:${record.caseId}`);
    }
    if (/[A-Za-z]:\\Users\\|\/(?:home|Users)\/[^/\s"']+/.test(serialized)) {
      throw new Error(`absolute user path in ${file}:${record.caseId || 'score'}`);
    }
    const nestedRecords = record.records || [record];
    for (const nested of nestedRecords) {
      if (!nested.rawResponse) continue;
      const raw = JSON.parse(nested.rawResponse);
      for (const field of ['session_id', 'uuid']) {
        if (raw[field] && raw[field] !== '[REDACTED]') throw new Error(`unredacted ${field} in ${file}:${nested.caseId}`);
      }
    }
  }
}
console.log(`PASS: ${files.length} G5 evidence files contain no credentials or absolute user paths`);
