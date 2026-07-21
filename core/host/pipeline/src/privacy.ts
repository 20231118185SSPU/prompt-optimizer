export interface RedactionResult {
  text: string;
  redacted: boolean;
}

export function redactSensitiveText(input: string): RedactionResult {
  let text = input;
  text = text.replace(
    /((?:\.env\b[^\n,;]{0,80}?\bvalue\s*(?:is|[:=])\s*))(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    '$1[REDACTED]'
  );
  text = text.replace(
    /((?:\.env\b[^\n，。;；]{0,80}?(?:值|内容)\s*(?:是|为|[:：=])\s*))[^\s,，;；]+/gi,
    '$1[REDACTED]'
  );
  text = text.replace(
    /\b([A-Za-z_][A-Za-z0-9_]*\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)(?=\s+(?:from|in)\s+\.env(?:\.[A-Za-z0-9_-]+)?\b)/gi,
    '$1[REDACTED]'
  );
  text = text.replace(
    /(\b[a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s/]+(@)/gi,
    '$1[REDACTED]$2'
  );
  text = text.replace(
    /\b((?:password|passwd|passphrase|passcode|secret|token|api\s*key|private\s*key|credential)\s+(?:is|was|[:=])\s*)(?!(?:required|unchanged|missing|unknown|not|provided)\b)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    '$1[REDACTED]'
  );
  text = text.replace(
    /\b((?:[A-Z0-9_]*(?:TOKEN|PASSWORD|PASSWD|SECRET|API_KEY|PRIVATE_KEY|ACCESS_KEY|DATABASE_URL|CONNECTION_STRING|CREDENTIAL|DSN)[A-Z0-9_]*)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    '$1[REDACTED]'
  );
  text = text.replace(/\b(?:sk-(?:proj-)?|gh[pousr]_)[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_TOKEN]');
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~-]{10,}\b/gi, 'Bearer [REDACTED_TOKEN]');
  text = text.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_TOKEN]');
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]');
  text = text.replace(/\b(?:\+?\d[\d -]{8,}\d)\b/g, '[REDACTED_PHONE]');
  text = text.replace(/\b[A-Za-z]:\\Users\\[^\\\s]+/gi, '<user-home>');
  text = text.replace(/\/(?:Users|home)\/[^/\s]+/g, '<user-home>');
  text = text.replace(/((?:密码|口令|密钥)\s*(?:是|为|[:：])\s*)[^\s,，;；]+/g, '$1[REDACTED]');
  return { text, redacted: text !== input };
}
