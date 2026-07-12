#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function redactString(value) {
  return value
    .split(os.homedir()).join('[USER_HOME]')
    .replace(/[A-Za-z]:\\Users\\[^\\\s"']+/gi, '[USER_HOME]')
    .replace(/\/(?:home|Users)\/[^/\s"']+/g, '[USER_HOME]')
    .replace(/sk-[A-Za-z0-9_*.-]+/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
}

function redactObject(value) {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactObject);
  if (!value || typeof value !== 'object') return value;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'session_id' || key === 'uuid') value[key] = '[REDACTED]';
    else value[key] = redactObject(child);
  }
  return value;
}

for (const input of process.argv.slice(2)) {
  const file = path.resolve(input);
  const records = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record.rawResponse) continue;
    try { record.rawResponse = JSON.stringify(redactObject(JSON.parse(record.rawResponse))); } catch {}
    records[index] = redactObject(record);
  }
  fs.writeFileSync(file, `${records.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf8');
  console.log(`sanitized ${file}`);
}
