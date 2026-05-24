const secretPatterns = [
  /\bBearer\s+[A-Za-z0-9._-]{6,}\b/gi,
  /\b(?:sk|sk-ant|sk-proj|AIza)[A-Za-z0-9._-]{6,}\b/g,
  /\blocal-demo:v1:[a-f0-9]+\b/gi,
  /\bfake:[A-Za-z0-9._-]+\b/g,
];

const customerLikePatterns = [
  /\bACME\b/g,
  /\b[A-Z][A-Z0-9&.-]{2,}\s+(?:customer|workspace|account|tenant|project)\b/g,
];

export function redactOperatorText(value: string | undefined, fallback = 'Local demo state requires operator review.'): string {
  let redacted = String(value ?? '').trim();

  for (const pattern of secretPatterns) {
    redacted = redacted.replace(pattern, '[redacted]');
  }

  for (const pattern of customerLikePatterns) {
    redacted = redacted.replace(pattern, '[redacted]');
  }

  redacted = redacted.replace(/\s+/g, ' ').trim();
  return redacted || fallback;
}
