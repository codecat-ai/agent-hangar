export type SourceCheckoutEvidenceQualityStatus = 'ready' | 'warning' | 'blocked';
export type SourceCheckoutEvidenceQualitySeverity = 'info' | 'warning' | 'blocking';

export type SourceCheckoutEvidenceQualityIssueCode =
  | 'malformed-surface'
  | 'missing-schema-version'
  | 'unsupported-schema-version'
  | 'missing-markdown'
  | 'source-mode-mismatch'
  | 'package-registry-or-shell-command'
  | 'secret-like-content'
  | 'markdown-count-mismatch'
  | 'markdown-count-missing';

export interface SourceCheckoutEvidenceCountCheck {
  label: string;
  structuredCount: number;
  markdownPattern: RegExp;
}

export interface SourceCheckoutEvidenceSurfaceInput {
  id: string;
  label: string;
  expectedSchemaVersion: string;
  evidence: unknown;
  countChecks?: SourceCheckoutEvidenceCountCheck[];
}

export interface SourceCheckoutEvidenceQualityGateInput {
  surfaces: SourceCheckoutEvidenceSurfaceInput[];
}

export interface SourceCheckoutEvidenceQualityIssue {
  code: SourceCheckoutEvidenceQualityIssueCode;
  severity: SourceCheckoutEvidenceQualitySeverity;
  surfaceId: string;
  surfaceLabel: string;
  message: string;
  detail?: Record<string, string | number>;
}

export interface SourceCheckoutEvidenceQualitySurfacePreview {
  id: string;
  label: string;
  schemaVersion: string;
  sourceMode?: string;
  markdownLineCount: number;
  issueCount: number;
}

export interface SourceCheckoutEvidenceQualityGate {
  schemaVersion: 'agent-hangar.source-checkout-evidence-quality-gate.v1';
  source: {
    mode: 'source-checkout-only';
  };
  summary: {
    status: SourceCheckoutEvidenceQualityStatus;
    checkedSurfaceCount: number;
    issueCount: number;
    statusCounts: Partial<Record<SourceCheckoutEvidenceQualityStatus, number>>;
    severityCounts: Partial<Record<SourceCheckoutEvidenceQualitySeverity, number>>;
  };
  surfaces: SourceCheckoutEvidenceQualitySurfacePreview[];
  issues: SourceCheckoutEvidenceQualityIssue[];
  nextActions: string[];
  markdown: string;
}

const SCHEMA_VERSION = 'agent-hangar.source-checkout-evidence-quality-gate.v1';
const TEXT_LIMIT = 220;

export function buildSourceCheckoutEvidenceQualityGate(
  input: SourceCheckoutEvidenceQualityGateInput,
): SourceCheckoutEvidenceQualityGate {
  const reviewed = input.surfaces.map(reviewSurface).sort((left, right) => left.surface.id.localeCompare(right.surface.id));
  const issues = reviewed.flatMap((entry) => entry.issues).sort(compareIssues);
  const surfaces = reviewed.map((entry): SourceCheckoutEvidenceQualitySurfacePreview => ({
    ...entry.surface,
    issueCount: entry.issues.length,
  }));
  const blockingCount = issues.filter((issue) => issue.severity === 'blocking').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const status: SourceCheckoutEvidenceQualityStatus = blockingCount > 0 ? 'blocked' : warningCount > 0 ? 'warning' : 'ready';
  const preview: Omit<SourceCheckoutEvidenceQualityGate, 'markdown'> = {
    schemaVersion: SCHEMA_VERSION,
    source: {
      mode: 'source-checkout-only',
    },
    summary: {
      status,
      checkedSurfaceCount: surfaces.length,
      issueCount: issues.length,
      statusCounts: countSurfaceStatuses(surfaces),
      severityCounts: countBy(issues, ['info', 'warning', 'blocking'], (issue) => issue.severity),
    },
    surfaces,
    issues,
    nextActions: buildNextActions(issues),
  };
  const sanitized = deepSanitize(preview) as Omit<SourceCheckoutEvidenceQualityGate, 'markdown'>;

  return {
    ...sanitized,
    markdown: redactSecretLikeMarkdown(renderMarkdown(sanitized)),
  };
}

function reviewSurface(input: SourceCheckoutEvidenceSurfaceInput): {
  surface: Omit<SourceCheckoutEvidenceQualitySurfacePreview, 'issueCount'>;
  issues: SourceCheckoutEvidenceQualityIssue[];
} {
  const surfaceId = safeIdentifier(input.id);
  const surfaceLabel = safeText(input.label);
  const expectedSchemaVersion = safeText(input.expectedSchemaVersion);

  if (!isRecord(input.evidence)) {
    return {
      surface: {
        id: surfaceId,
        label: surfaceLabel,
        schemaVersion: 'missing',
        markdownLineCount: 0,
      },
      issues: [
        issue('malformed-surface', 'blocking', surfaceId, surfaceLabel, `${surfaceLabel} evidence must be an object.`),
      ],
    };
  }

  const evidence = input.evidence;
  const rawSchemaVersion = typeof evidence.schemaVersion === 'string' ? evidence.schemaVersion.trim() : '';
  const markdown = typeof evidence.markdown === 'string' ? evidence.markdown : '';
  const rawSourceMode = readSourceMode(evidence);
  const issues: SourceCheckoutEvidenceQualityIssue[] = [];

  if (!rawSchemaVersion) {
    issues.push(issue('missing-schema-version', 'blocking', surfaceId, surfaceLabel, `${surfaceLabel} is missing a schema version.`));
  } else if (rawSchemaVersion !== input.expectedSchemaVersion) {
    issues.push(issue('unsupported-schema-version', 'blocking', surfaceId, surfaceLabel, `${surfaceLabel} uses an unsupported schema version.`, {
      expected: expectedSchemaVersion,
      actual: safeText(rawSchemaVersion),
    }));
  }

  if (rawSourceMode !== undefined && rawSourceMode !== 'source-checkout-only') {
    issues.push(issue('source-mode-mismatch', 'blocking', surfaceId, surfaceLabel, `${surfaceLabel} source mode must stay source-checkout-only.`, {
      actual: safeText(rawSourceMode),
    }));
  }

  if (!markdown.trim()) {
    issues.push(issue('missing-markdown', 'blocking', surfaceId, surfaceLabel, `${surfaceLabel} must include copied Markdown evidence.`));
  } else {
    if (containsInstallCommand(markdown)) {
      issues.push(issue('package-registry-or-shell-command', 'blocking', surfaceId, surfaceLabel, `${surfaceLabel} Markdown contains package-registry or shell install command text.`));
    }
    issues.push(...reviewCountChecks(input.countChecks ?? [], markdown, surfaceId, surfaceLabel));
  }

  if (containsSecretLikeValue(evidence)) {
    issues.push(issue('secret-like-content', 'blocking', surfaceId, surfaceLabel, `${surfaceLabel} contains secret-like or customer-like text.`));
  }

  return {
    surface: {
      id: surfaceId,
      label: surfaceLabel,
      schemaVersion: rawSchemaVersion ? safeText(rawSchemaVersion) : 'missing',
      ...(rawSourceMode ? { sourceMode: safeText(rawSourceMode) } : {}),
      markdownLineCount: markdown.trim() ? markdown.trim().split(/\r?\n/).length : 0,
    },
    issues,
  };
}

function reviewCountChecks(
  checks: SourceCheckoutEvidenceCountCheck[],
  markdown: string,
  surfaceId: string,
  surfaceLabel: string,
): SourceCheckoutEvidenceQualityIssue[] {
  return checks.flatMap((check) => {
    const match = markdown.match(check.markdownPattern);
    if (!match?.[1]) {
      return [issue('markdown-count-missing', 'warning', surfaceId, surfaceLabel, `${surfaceLabel} Markdown is missing the ${safeText(check.label)} count.`)];
    }
    const markdownCount = Number.parseInt(match[1], 10);
    if (Number.isNaN(markdownCount) || markdownCount !== check.structuredCount) {
      return [issue('markdown-count-mismatch', 'blocking', surfaceId, surfaceLabel, `${surfaceLabel} structured ${safeText(check.label)} count does not match copied Markdown.`, {
        label: safeText(check.label),
        structuredCount: check.structuredCount,
        markdownCount: Number.isNaN(markdownCount) ? 'missing' : markdownCount,
      })];
    }
    return [];
  });
}

function readSourceMode(evidence: Record<string, unknown>): string | undefined {
  if (isRecord(evidence.source) && typeof evidence.source.mode === 'string') {
    return evidence.source.mode.trim();
  }
  if (typeof evidence.sourceMode === 'string') {
    return evidence.sourceMode.trim();
  }
  return undefined;
}

function buildNextActions(issues: SourceCheckoutEvidenceQualityIssue[]): string[] {
  if (issues.length === 0) {
    return ['Source-checkout evidence is ready for local review.'];
  }

  const codes = new Set(issues.map((entry) => entry.code));
  return uniqueOrdered([
    ...(codes.has('missing-schema-version') || codes.has('unsupported-schema-version')
      ? ['Regenerate evidence with supported schema-versioned source-checkout previews.']
      : []),
    ...(codes.has('source-mode-mismatch')
      ? ['Replace evidence from non-source-checkout modes before handoff.']
      : []),
    ...(codes.has('missing-markdown')
      ? ['Regenerate copied Markdown for every reviewed source-checkout surface.']
      : []),
    ...(codes.has('package-registry-or-shell-command')
      ? ['Remove package-registry or shell command text from copied source-checkout evidence.']
      : []),
    ...(codes.has('secret-like-content')
      ? ['Remove or regenerate evidence that contains secret-like content.']
      : []),
    ...(codes.has('markdown-count-mismatch') || codes.has('markdown-count-missing')
      ? ['Regenerate copied Markdown so structured counts and Markdown summaries agree.']
      : []),
    ...(codes.has('malformed-surface')
      ? ['Replace malformed evidence with object-shaped source-checkout previews.']
      : []),
  ]);
}

function renderMarkdown(preview: Omit<SourceCheckoutEvidenceQualityGate, 'markdown'>): string {
  const issues = preview.issues.length > 0
    ? preview.issues.map((entry) => `- ${entry.severity} | ${entry.surfaceId} | ${entry.code} | ${escapeMarkdown(entry.message)}`).join('\n')
    : '- None';
  const nextActions = preview.nextActions.map((action) => `- ${escapeMarkdown(action)}`).join('\n');
  const surfaces = preview.surfaces
    .map((surface) => `| ${escapeMarkdown(surface.id)} | ${escapeMarkdown(surface.label)} | ${escapeMarkdown(surface.schemaVersion)} | ${escapeMarkdown(surface.sourceMode ?? 'not declared')} | ${surface.markdownLineCount} | ${surface.issueCount} |`)
    .join('\n');

  return `# Source Checkout Evidence Quality Gate

schemaVersion: ${preview.schemaVersion}
sourceMode: ${preview.source.mode}

## Summary
- Status: ${preview.summary.status}
- Checked surfaces: ${preview.summary.checkedSurfaceCount}
- Issues: ${preview.summary.issueCount}
- Provider, network, shell, package registry, and Tauri calls: not used

## Surfaces
| Surface | Label | Schema Version | Source Mode | Markdown Lines | Issues |
| --- | --- | --- | --- | --- | --- |
${surfaces}

## Issues
${issues}

## Next Actions
${nextActions}
`;
}

function countSurfaceStatuses(
  surfaces: SourceCheckoutEvidenceQualitySurfacePreview[],
): Partial<Record<SourceCheckoutEvidenceQualityStatus, number>> {
  return countBy(
    surfaces.map((surface) => surface.issueCount > 0 ? 'blocked' : 'ready'),
    ['ready', 'warning', 'blocked'],
    (status) => status,
  );
}

function issue(
  code: SourceCheckoutEvidenceQualityIssueCode,
  severity: SourceCheckoutEvidenceQualitySeverity,
  surfaceId: string,
  surfaceLabel: string,
  message: string,
  detail?: Record<string, string | number>,
): SourceCheckoutEvidenceQualityIssue {
  return {
    code,
    severity,
    surfaceId,
    surfaceLabel,
    message: safeText(message, TEXT_LIMIT * 2),
    ...(detail ? { detail: deepSanitize(detail) as Record<string, string | number> } : {}),
  };
}

function containsInstallCommand(value: string): boolean {
  return /(?:^|\s)(?:npm\s+(?:install|i|ci|exec|run)|npx\s+\S+|pnpm\s+(?:add|install|dlx|exec)|yarn\s+(?:add|install|dlx)|bun\s+(?:add|install|x)|pipx?\s+install|cargo\s+install|curl\s+(?:-fsSL\s+)?https?:\/\/|wget\s+https?:\/\/|bash\s+-c|sh\s+-c)\b/i.test(value);
}

function containsSecretLikeValue(value: unknown, keyPath: string[] = []): boolean {
  if (typeof value === 'string') {
    return containsSecretLikeText(value) || keyPath.some((key) => /apiKey|encryptedApiKey|encryptedKeyMaterial|token|secret/i.test(key));
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsSecretLikeValue(entry, keyPath));
  }
  if (isRecord(value)) {
    return Object.entries(value).some(([key, entry]) => (
      /apiKey|encryptedApiKey|encryptedKeyMaterial/i.test(key)
      || containsSecretLikeValue(entry, [...keyPath, key])
    ));
  }
  return false;
}

function containsSecretLikeText(value: string): boolean {
  return /\bapiKey(?:\s*=\s*\S+)?\b/i.test(value)
    || /\bencryptedApiKey(?:\s*=\s*\S+)?\b/i.test(value)
    || /\bencryptedKeyMaterial(?:\s*=\s*\S+)?\b/i.test(value)
    || /\bBearer\s+\S+/i.test(value)
    || /\b(?:sk|sk-ant|sk-proj|AIza)[A-Za-z0-9._-]{6,}\b/.test(value)
    || /\bAPI\s+token\s+\S+/i.test(value)
    || /\bsecret\s*[:=]\s*\S+/i.test(value)
    || /\b-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(value)
    || /\b[A-Z][A-Z0-9&.-]{2,}\s+(?:customer|workspace|account|tenant|project)\b/.test(value)
    || /\bACME\b/i.test(value)
    || /\bexample\s+customer\b/i.test(value)
    || /\bcustomer[A-Za-z0-9_-]*/i.test(value);
}

function redactSecretLikeText(value: string): string {
  return value
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedApiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, '[redacted]')
    .replace(/\b(?:sk|sk-ant|sk-proj|AIza)[A-Za-z0-9._-]{6,}\b/g, '[redacted]')
    .replace(/\bAPI\s+token\s+\S+/gi, '[redacted]')
    .replace(/\bsecret\s*[:=]\s*\S+/gi, '[redacted]')
    .replace(/\b-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, '[redacted]')
    .replace(/\b[A-Z][A-Z0-9&.-]{2,}\s+(?:customer|workspace|account|tenant|project)\b/g, '[redacted]')
    .replace(/\bACME\b/gi, '[redacted]')
    .replace(/\bexample\s+customer\b/gi, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]');
}

function deepSanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/^(apiKey|encryptedApiKey|encryptedKeyMaterial)$/i.test(key))
        .map(([key, entry]) => [safeKey(key), deepSanitize(entry)]),
    );
  }
  if (typeof value === 'string') {
    return safeText(value, Number.POSITIVE_INFINITY);
  }
  return value;
}

function safeText(value: unknown, limit = TEXT_LIMIT): string {
  const normalized = redactSecretLikeText(String(value ?? '')).replace(/\s+/g, ' ').trim();
  const fallback = normalized || 'Local source-checkout evidence';
  return truncate(fallback, limit);
}

function safeIdentifier(value: unknown): string {
  return safeText(value, 96).replace(/[^a-z0-9_.:-]+/gi, '-').replace(/^-+|-+$/g, '') || 'surface';
}

function safeKey(value: string): string {
  return /apiKey|encryptedApiKey|encryptedKeyMaterial/i.test(value) ? '[redacted]' : value;
}

function redactSecretLikeMarkdown(value: string): string {
  return redactSecretLikeText(value);
}

function compareIssues(left: SourceCheckoutEvidenceQualityIssue, right: SourceCheckoutEvidenceQualityIssue): number {
  const severityOrder: SourceCheckoutEvidenceQualitySeverity[] = ['blocking', 'warning', 'info'];
  return left.surfaceId.localeCompare(right.surfaceId)
    || severityOrder.indexOf(left.severity) - severityOrder.indexOf(right.severity)
    || left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message);
}

function countBy<T extends string, Item>(
  items: Item[],
  order: T[],
  select: (item: Item) => T,
): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const item of items) {
    const key = select(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(order.filter((key) => counts[key]).map((key) => [key, counts[key]])) as Partial<Record<T, number>>;
}

function escapeMarkdown(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/`/g, '\\`');
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

function uniqueOrdered(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
