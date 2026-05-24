import { type WorkspaceManifestBlocker, type WorkspaceManifestPreview } from './workspaceManifestPreview';

export type WorkspaceImportExportDryRunMode = 'export' | 'import';
export type WorkspaceDryRunStatus = 'ready' | 'blocked';
export type WorkspaceDryRunFileStatus = 'ready' | 'accepted' | 'rejected' | 'missing';
export type WorkspaceDryRunFileKind = 'manifest' | 'scenario' | 'markdown' | 'evidence' | 'bundle-index' | 'note' | 'unknown';

export interface WorkspaceExportBundleCandidate {
  schemaVersion?: unknown;
  workspaceId?: unknown;
  scenarioId?: unknown;
  files?: unknown;
}

export interface WorkspaceImportExportDryRunInput {
  mode?: unknown;
  manifestPreview?: WorkspaceManifestPreview;
  candidateBundle?: unknown;
  existingWorkspaceIds?: string[];
}

export interface WorkspaceImportExportDryRunFile {
  path: string;
  kind: WorkspaceDryRunFileKind;
  status: WorkspaceDryRunFileStatus;
  reason: string;
}

export type WorkspaceImportExportDryRunBlockerCode =
  | WorkspaceManifestBlocker['code']
  | 'malformed-input'
  | 'unsupported-mode'
  | 'missing-manifest-preview'
  | 'unsupported-manifest-preview-schema'
  | 'malformed-bundle'
  | 'unsupported-bundle-schema'
  | 'missing-bundle-manifest'
  | 'missing-bundle-files'
  | 'unsafe-file-path'
  | 'unsupported-file-kind';

export interface WorkspaceImportExportDryRunBlocker {
  code: WorkspaceImportExportDryRunBlockerCode;
  severity: 'blocking';
  source: 'export' | 'import' | 'manifest';
  message: string;
}

export interface WorkspaceImportExportDryRun {
  schemaVersion: 'agent-hangar.workspace-import-export-dry-run.v1';
  mode: WorkspaceImportExportDryRunMode;
  source: {
    mode: 'source-checkout-only';
    workspaceId: string;
    scenarioId?: string;
  };
  summary: {
    status: WorkspaceDryRunStatus;
    providerCount: number;
    configuredProviderCount: number;
    templateCount: number;
    templateIssueCount: number;
    acceptedFileCount: number;
    rejectedFileCount: number;
    missingFileCount: number;
    blockerCount: number;
  };
  execution: {
    graphAvailable: boolean;
    trailAvailable: boolean;
    evidenceAvailable: boolean;
  };
  files: WorkspaceImportExportDryRunFile[];
  blockers: WorkspaceImportExportDryRunBlocker[];
  notes: string[];
  decisionNotes: string[];
  markdown: string;
}

export interface WorkspaceImportExportDryRunValidationIssue {
  code: 'malformed-input' | 'unsupported-mode' | 'missing-manifest-preview' | 'missing-candidate-bundle';
  severity: 'blocking';
  field: string;
  message: string;
}

export interface WorkspaceImportExportDryRunValidationResult {
  schemaVersion: 'agent-hangar.workspace-import-export-dry-run-validation.v1';
  issues: WorkspaceImportExportDryRunValidationIssue[];
}

const DRY_RUN_SCHEMA_VERSION = 'agent-hangar.workspace-import-export-dry-run.v1';
const VALIDATION_SCHEMA_VERSION = 'agent-hangar.workspace-import-export-dry-run-validation.v1';
const MANIFEST_PREVIEW_SCHEMA_VERSION = 'agent-hangar.workspace-manifest-preview.v1';
const BUNDLE_SCHEMA_VERSION = 'agent-hangar.workspace-export-bundle.v1';
const TEXT_LIMIT = 180;
const SUPPORTED_IMPORT_KINDS = new Set(['manifest', 'scenario', 'markdown', 'evidence', 'bundle-index']);

export function validateWorkspaceImportExportDryRunInput(input: unknown): WorkspaceImportExportDryRunValidationResult {
  if (!isRecord(input)) {
    return {
      schemaVersion: VALIDATION_SCHEMA_VERSION,
      issues: [validationIssue('malformed-input', 'input', 'Workspace import/export dry-run input must be an object.')],
    };
  }

  const issues: WorkspaceImportExportDryRunValidationIssue[] = [];
  if (input.mode !== 'export' && input.mode !== 'import') {
    issues.push(validationIssue('unsupported-mode', 'mode', 'Workspace import/export dry-run mode must be export or import.'));
  }
  if (input.mode === 'export' && !isRecord(input.manifestPreview)) {
    issues.push(validationIssue('missing-manifest-preview', 'manifestPreview', 'Export dry run requires a workspace manifest preview object.'));
  }
  if (input.mode === 'import' && input.candidateBundle === undefined) {
    issues.push(validationIssue('missing-candidate-bundle', 'candidateBundle', 'Import dry run requires a candidate bundle object.'));
  }

  return { schemaVersion: VALIDATION_SCHEMA_VERSION, issues };
}

export function buildWorkspaceImportExportDryRun(input: WorkspaceImportExportDryRunInput): WorkspaceImportExportDryRun {
  const mode = input.mode === 'import' ? 'import' : 'export';
  const base = mode === 'export' ? buildExportDryRun(input) : buildImportDryRun(input);
  const sanitized = deepSanitize(base) as Omit<WorkspaceImportExportDryRun, 'markdown'>;

  return {
    ...sanitized,
    markdown: redactSecretLikeMarkdown(renderMarkdown(sanitized)),
  };
}

function buildExportDryRun(input: WorkspaceImportExportDryRunInput): Omit<WorkspaceImportExportDryRun, 'markdown'> {
  const manifestPreview = input.manifestPreview;
  const malformedBlockers: WorkspaceImportExportDryRunBlocker[] = [];
  if (!isRecord(manifestPreview)) {
    malformedBlockers.push(blocker('missing-manifest-preview', 'export', 'Export dry run requires a workspace manifest preview object.'));
  } else if (manifestPreview.schemaVersion !== MANIFEST_PREVIEW_SCHEMA_VERSION) {
    malformedBlockers.push(blocker('unsupported-manifest-preview-schema', 'export', 'Export dry run requires a supported workspace manifest preview schema.'));
  }

  const preview = isRecord(manifestPreview) ? manifestPreview as WorkspaceManifestPreview : undefined;
  const files = buildExportFiles(preview);
  const inheritedBlockers = (preview?.blockers ?? []).map((manifestBlocker): WorkspaceImportExportDryRunBlocker => ({
    code: manifestBlocker.code,
    severity: 'blocking',
    source: 'manifest',
    message: manifestBlocker.message,
  }));
  const blockers = [...malformedBlockers, ...inheritedBlockers].map(sanitizeBlocker).sort(compareBlockers);

  return {
    schemaVersion: DRY_RUN_SCHEMA_VERSION,
    mode: 'export',
    source: {
      mode: 'source-checkout-only',
      workspaceId: safeText(preview?.source?.workspaceId ?? 'workspace-local', TEXT_LIMIT),
      scenarioId: preview?.source?.scenarioId ? safeText(preview.source.scenarioId, TEXT_LIMIT) : undefined,
    },
    summary: {
      status: blockers.length > 0 ? 'blocked' : 'ready',
      providerCount: preview?.providers.total ?? 0,
      configuredProviderCount: preview?.providers.configured ?? 0,
      templateCount: preview?.templates.summary.total ?? 0,
      templateIssueCount: (preview?.templates.summary.blockingIssueCount ?? 0) + (preview?.templates.summary.warningIssueCount ?? 0),
      acceptedFileCount: files.filter((file) => file.status === 'ready').length,
      rejectedFileCount: 0,
      missingFileCount: 0,
      blockerCount: blockers.length,
    },
    execution: {
      graphAvailable: Boolean(preview?.execution.graphAvailable),
      trailAvailable: Boolean(preview?.execution.trailAvailable),
      evidenceAvailable: Boolean(preview?.execution.evidenceAvailable),
    },
    files,
    blockers,
    notes: [
      'Export dry run only: no files were written, no provider calls were made, and no package registry commands are required.',
      'Provider credentials remain represented only as configured or missing status.',
    ],
    decisionNotes: [
      'Source checkout export preview is clone-safe and deterministic.',
      noMutationNote(),
    ],
  };
}

function buildImportDryRun(input: WorkspaceImportExportDryRunInput): Omit<WorkspaceImportExportDryRun, 'markdown'> {
  const candidate = input.candidateBundle;
  const blockers: WorkspaceImportExportDryRunBlocker[] = [];
  const files: WorkspaceImportExportDryRunFile[] = [];
  let workspaceId = 'workspace-import-candidate';
  let scenarioId: string | undefined;

  if (!isRecord(candidate)) {
    blockers.push(blocker('malformed-bundle', 'import', 'Import candidate bundle must be an object.'));
  } else {
    if (candidate.schemaVersion !== BUNDLE_SCHEMA_VERSION) {
      blockers.push(blocker('unsupported-bundle-schema', 'import', 'Import candidate uses an unsupported bundle schema version.'));
    }
    workspaceId = typeof candidate.workspaceId === 'string' && candidate.workspaceId.trim()
      ? candidate.workspaceId
      : workspaceId;
    scenarioId = typeof candidate.scenarioId === 'string' && candidate.scenarioId.trim()
      ? candidate.scenarioId
      : undefined;

    if (!Array.isArray(candidate.files)) {
      blockers.push(blocker('missing-bundle-files', 'import', 'Import candidate must include a files array.'));
    } else {
      files.push(...candidate.files.map(readImportFile).sort(compareFiles));
    }
  }

  if (files.length > 0 && !files.some((file) => file.kind === 'manifest' && file.status === 'accepted')) {
    files.push({
      path: 'agent-hangar.workspace-manifest-preview.json',
      kind: 'manifest',
      status: 'missing',
      reason: 'Import candidate must include a workspace manifest preview file.',
    });
    blockers.push(blocker('missing-bundle-manifest', 'import', 'Import candidate is missing a workspace manifest preview file.'));
  }
  for (const file of files) {
    if (file.status === 'rejected' && file.reason.startsWith('File path')) {
      blockers.push(blocker('unsafe-file-path', 'import', file.reason));
    }
    if (file.status === 'rejected' && file.reason.startsWith('Unsupported file kind')) {
      blockers.push(blocker('unsupported-file-kind', 'import', file.reason));
    }
  }

  const sanitizedFiles = files.map(sanitizeFile).sort(compareFiles);
  const sanitizedBlockers = blockers.map(sanitizeBlocker).sort(compareBlockers);
  const existingIds = new Set(input.existingWorkspaceIds ?? []);
  const replacement = existingIds.has(workspaceId);

  return {
    schemaVersion: DRY_RUN_SCHEMA_VERSION,
    mode: 'import',
    source: {
      mode: 'source-checkout-only',
      workspaceId: safeText(workspaceId, TEXT_LIMIT),
      scenarioId: scenarioId ? safeText(scenarioId, TEXT_LIMIT) : undefined,
    },
    summary: {
      status: sanitizedBlockers.length > 0 ? 'blocked' : 'ready',
      providerCount: 0,
      configuredProviderCount: 0,
      templateCount: 0,
      templateIssueCount: 0,
      acceptedFileCount: sanitizedFiles.filter((file) => file.status === 'accepted').length,
      rejectedFileCount: sanitizedFiles.filter((file) => file.status === 'rejected').length,
      missingFileCount: sanitizedFiles.filter((file) => file.status === 'missing').length,
      blockerCount: sanitizedBlockers.length,
    },
    execution: {
      graphAvailable: sanitizedFiles.some((file) => file.kind === 'scenario' && file.status === 'accepted'),
      trailAvailable: sanitizedFiles.some((file) => file.kind === 'evidence' && file.status === 'accepted'),
      evidenceAvailable: sanitizedFiles.some((file) => file.kind === 'evidence' && file.status === 'accepted'),
    },
    files: sanitizedFiles,
    blockers: sanitizedBlockers,
    notes: [
      'Import dry run only: bundle shape was validated before any local storage mutation.',
      'No provider, shell, network, package registry, or Tauri API calls were made.',
    ],
    decisionNotes: [
      replacement
        ? `Replacement dry run: workspace ${safeText(workspaceId, TEXT_LIMIT)} already exists locally, but no storage mutation was performed.`
        : `New workspace dry run: workspace ${safeText(workspaceId, TEXT_LIMIT)} would be created after explicit import confirmation.`,
      noMutationNote(),
    ],
  };
}

function buildExportFiles(preview: WorkspaceManifestPreview | undefined): WorkspaceImportExportDryRunFile[] {
  const files: WorkspaceImportExportDryRunFile[] = [
    {
      path: 'agent-hangar.workspace-manifest-preview.json',
      kind: 'manifest',
      status: 'ready',
      reason: 'Manifest preview JSON is available for source-checkout handoff.',
    },
    {
      path: 'agent-hangar.workspace-import-export-dry-run.md',
      kind: 'markdown',
      status: 'ready',
      reason: 'Dry-run Markdown is available for copy/export preview.',
    },
  ];
  if (preview?.source.scenarioId) {
    files.push({
      path: `scenarios/${preview.source.scenarioId}.json`,
      kind: 'scenario',
      status: 'ready',
      reason: 'Selected scenario preview is available.',
    });
  }
  return files.map(sanitizeFile).sort(compareFiles);
}

function readImportFile(value: unknown): WorkspaceImportExportDryRunFile {
  if (!isRecord(value)) {
    return {
      path: 'unknown',
      kind: 'unknown',
      status: 'rejected',
      reason: 'Import candidate file entry must be an object.',
    };
  }

  const rawPath = typeof value.path === 'string' ? value.path : '';
  const rawKind = typeof value.kind === 'string' ? value.kind : 'unknown';
  const kind = toFileKind(rawKind);
  if (!isSafeRelativePath(rawPath)) {
    return {
      path: rawPath || 'unknown',
      kind,
      status: 'rejected',
      reason: 'File path must stay inside the source checkout bundle.',
    };
  }
  if (!SUPPORTED_IMPORT_KINDS.has(rawKind)) {
    return {
      path: rawPath,
      kind,
      status: 'rejected',
      reason: `Unsupported file kind ${rawKind || 'unknown'}.`,
    };
  }
  return {
    path: rawPath,
    kind,
    status: 'accepted',
    reason: 'Import candidate file is source-checkout safe.',
  };
}

function toFileKind(kind: string): WorkspaceDryRunFileKind {
  if (kind === 'manifest' || kind === 'scenario' || kind === 'markdown' || kind === 'evidence' || kind === 'bundle-index' || kind === 'note') {
    return kind;
  }
  return 'unknown';
}

function isSafeRelativePath(path: string): boolean {
  return Boolean(path.trim())
    && !path.startsWith('/')
    && !path.startsWith('~')
    && !path.includes('\\')
    && !path.split('/').includes('..');
}

function renderMarkdown(dryRun: Omit<WorkspaceImportExportDryRun, 'markdown'>): string {
  const modeHeading = dryRun.mode === 'export' ? 'Export Readiness' : 'Import Validation';
  return `---
schemaVersion: ${dryRun.schemaVersion}
mode: ${dryRun.mode}
workspaceId: ${dryRun.source.workspaceId}
sourceMode: ${dryRun.source.mode}
---

# Workspace Import/Export Dry Run

## ${modeHeading}
- Mode: ${dryRun.mode}
- Source mode: ${dryRun.source.mode}
- Workspace: ${dryRun.source.workspaceId}
- Scenario: ${dryRun.source.scenarioId ?? 'None'}
- Status: ${dryRun.summary.status}
- Providers: ${dryRun.summary.providerCount}
- Configured providers: ${dryRun.summary.configuredProviderCount}
- Templates: ${dryRun.summary.templateCount}
- Template issues: ${dryRun.summary.templateIssueCount}
- Accepted files: ${dryRun.summary.acceptedFileCount}
- Rejected files: ${dryRun.summary.rejectedFileCount}
- Missing files: ${dryRun.summary.missingFileCount}
- Blockers: ${dryRun.summary.blockerCount}

## Execution And Evidence
- Graph available: ${dryRun.execution.graphAvailable ? 'yes' : 'no'}
- Trail available: ${dryRun.execution.trailAvailable ? 'yes' : 'no'}
- Evidence available: ${dryRun.execution.evidenceAvailable ? 'yes' : 'no'}

## Files
${dryRun.files.length > 0 ? dryRun.files.map((file) => `- ${file.status} | ${file.kind} | ${file.path} | ${file.reason}`).join('\n') : '- None'}

## Decision Notes
${dryRun.decisionNotes.map((note) => `- ${note}`).join('\n')}

## Notes
${dryRun.notes.map((note) => `- ${note}`).join('\n')}

## Blockers
${dryRun.blockers.length > 0 ? dryRun.blockers.map((entry) => `- ${entry.code} | ${entry.severity} | ${entry.message}`).join('\n') : '- None'}
`;
}

function noMutationNote(): string {
  return 'No local provider secrets, encrypted key material, saved desktop state, or localStorage records were mutated.';
}

function validationIssue(
  code: WorkspaceImportExportDryRunValidationIssue['code'],
  field: string,
  message: string,
): WorkspaceImportExportDryRunValidationIssue {
  return { code, severity: 'blocking', field, message };
}

function blocker(
  code: WorkspaceImportExportDryRunBlockerCode,
  source: WorkspaceImportExportDryRunBlocker['source'],
  message: string,
): WorkspaceImportExportDryRunBlocker {
  return { code, severity: 'blocking', source, message };
}

function sanitizeFile(file: WorkspaceImportExportDryRunFile): WorkspaceImportExportDryRunFile {
  return {
    path: safePathText(file.path, TEXT_LIMIT),
    kind: file.kind,
    status: file.status,
    reason: safeText(file.reason, TEXT_LIMIT),
  };
}

function sanitizeBlocker(entry: WorkspaceImportExportDryRunBlocker): WorkspaceImportExportDryRunBlocker {
  return {
    code: entry.code,
    severity: entry.severity,
    source: entry.source,
    message: safeText(entry.message, TEXT_LIMIT * 2),
  };
}

function compareFiles(left: WorkspaceImportExportDryRunFile, right: WorkspaceImportExportDryRunFile): number {
  const statusOrder: WorkspaceDryRunFileStatus[] = ['ready', 'accepted', 'missing', 'rejected'];
  const reasonOrder = (file: WorkspaceImportExportDryRunFile) => file.reason.startsWith('Unsupported file kind') ? 0 : 1;
  return statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status)
    || (left.status === 'rejected' && right.status === 'rejected' ? reasonOrder(left) - reasonOrder(right) : 0)
    || left.kind.localeCompare(right.kind)
    || left.path.localeCompare(right.path);
}

function compareBlockers(left: WorkspaceImportExportDryRunBlocker, right: WorkspaceImportExportDryRunBlocker): number {
  const order: WorkspaceImportExportDryRunBlockerCode[] = [
    'unsupported-file-kind',
    'unsafe-file-path',
    'missing-bundle-manifest',
    'missing-bundle-files',
    'malformed-bundle',
    'unsupported-bundle-schema',
    'missing-manifest-preview',
    'unsupported-manifest-preview-schema',
    'malformed-input',
    'unsupported-mode',
    'malformed-manifest-input',
    'unsupported-manifest-schema',
    'missing-provider-binding',
    'disabled-tool',
    'missing-tool',
    'missing-escalation-policy',
    'graph-validation-issue',
    'unresolved-escalation',
    'high-priority-collaboration',
  ];
  return left.source.localeCompare(right.source)
    || order.indexOf(left.code) - order.indexOf(right.code)
    || left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message);
}

function deepSanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return safeText(value, Number.POSITIVE_INFINITY);
  }
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/^(encryptedApiKey|apiKey|encryptedKeyMaterial)$/i.test(key))
        .map(([key, entry]) => [key, deepSanitize(entry)]),
    );
  }
  return value;
}

function safeText(value: string, limit: number): string {
  return truncate(escapeMarkdown(redactSecretLikeText(value)), limit);
}

function safePathText(value: string, limit: number): string {
  const sanitized = safeText(value, limit);
  if (sanitized.includes('[redacted]') && sanitized.includes('/')) {
    const extension = sanitized.match(/(\.[A-Za-z0-9]+)$/)?.[1] ?? '';
    return `[redacted]${extension}`;
  }
  return sanitized;
}

function redactSecretLikeText(value: string): string {
  return value
    .trim()
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedApiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, '[redacted]')
    .replace(/\b(?:sk|sk-ant|sk-proj)-[A-Za-z0-9._-]+/g, '[redacted]')
    .replace(/\bAPI\s+token\s+\S+/gi, '[redacted]')
    .replace(/\bsecret\b(?:\s*[:=]\s*\S+)?/gi, '[redacted]')
    .replace(/\bprivate\s+note\b/gi, '[redacted]')
    .replace(/\bexample\s+customer\b/gi, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]')
    .replace(/\s+/g, ' ');
}

function redactSecretLikeMarkdown(value: string): string {
  return value
    .trim()
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedApiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, '[redacted]')
    .replace(/\b(?:sk|sk-ant|sk-proj)-[A-Za-z0-9._-]+/g, '[redacted]')
    .replace(/\bAPI\s+token\s+\S+/gi, '[redacted]')
    .replace(/\bsecret\b(?:\s*[:=]\s*\S+)?/gi, '[redacted]')
    .replace(/\bprivate\s+note\b/gi, '[redacted]')
    .replace(/\bexample\s+customer\b/gi, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]');
}

function escapeMarkdown(value: string): string {
  return value.replace(/(?<!\\)([|`])/g, '\\$1');
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 3).trimEnd()}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
