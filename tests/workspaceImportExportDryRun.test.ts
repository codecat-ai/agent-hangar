import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceImportExportDryRun,
  validateWorkspaceImportExportDryRunInput,
} from '../src/harness/workspaceImportExportDryRun';
import { buildWorkspaceManifestPreview } from '../src/harness/workspaceManifestPreview';
import { getDemoWorkspaceScenario } from '../src/harness/demoWorkspace';

describe('workspace import/export dry run', () => {
  it('builds deterministic schema-versioned export readiness from a manifest preview', () => {
    const scenario = getDemoWorkspaceScenario('coordination-happy-path');
    const manifestPreview = buildWorkspaceManifestPreview({
      scenario,
      providerProfiles: [
        {
          id: 'local-provider-demo',
          kind: 'openai-compatible',
          displayName: 'Local Demo Provider',
          baseUrl: 'http://localhost:11434/v1',
          createdAt: '2026-05-23T10:00:00.000Z',
          updatedAt: '2026-05-23T10:00:00.000Z',
          encryptedApiKey: 'local-demo:v1:redaction-fixture',
        },
      ],
      modelsByProvider: {
        'local-provider-demo': [{ id: 'local-model-planner', displayName: 'Local Planner', providerKind: 'openai-compatible' }],
      },
    });

    const first = buildWorkspaceImportExportDryRun({ mode: 'export', manifestPreview });
    const second = buildWorkspaceImportExportDryRun({ mode: 'export', manifestPreview: structuredClone(manifestPreview) });

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('agent-hangar.workspace-import-export-dry-run.v1');
    expect(first.mode).toBe('export');
    expect(first.source.mode).toBe('source-checkout-only');
    expect(first.source.workspaceId).toBe('workspace-local-demo');
    expect(first.source.scenarioId).toBe('coordination-happy-path');
    expect(first.summary).toMatchObject({
      status: 'blocked',
      providerCount: 1,
      configuredProviderCount: 1,
      templateCount: 0,
      templateIssueCount: 0,
      acceptedFileCount: 3,
    });
    expect(first.execution).toEqual({
      graphAvailable: true,
      trailAvailable: true,
      evidenceAvailable: true,
    });
    expect(first.files.map((file) => file.path)).toEqual([
      'agent-hangar.workspace-manifest-preview.json',
      'agent-hangar.workspace-import-export-dry-run.md',
      'scenarios/coordination-happy-path.json',
    ]);
    expect(first.files.every((file) => file.status === 'ready')).toBe(true);
    expect(first.blockers.map((blocker) => blocker.code)).toEqual([
      'unresolved-escalation',
      'high-priority-collaboration',
    ]);
    expect(first.notes).toContain('Export dry run only: no files were written, no provider calls were made, and no package registry commands are required.');
    expect(first.markdown).toContain('schemaVersion: agent-hangar.workspace-import-export-dry-run.v1');
    expect(first.markdown).toContain('# Workspace Import/Export Dry Run');
    expect(first.markdown).toContain('## Export Readiness');
    expect(first.markdown).toContain('- Workspace: workspace-local-demo');
    expect(first.markdown).not.toMatch(/apiKey|encryptedApiKey|encryptedKeyMaterial|redaction-fixture|Bearer/i);
  });

  it('validates import bundle shape before storage mutation and reports rejected files', () => {
    const dryRun = buildWorkspaceImportExportDryRun({
      mode: 'import',
      candidateBundle: {
        schemaVersion: 'agent-hangar.workspace-export-bundle.v1',
        workspaceId: 'workspace-imported',
        scenarioId: 'scenario-imported',
        files: [
          { path: 'agent-hangar.workspace-manifest-preview.json', kind: 'manifest', sizeBytes: 4096 },
          { path: 'scenarios/scenario-imported.json', kind: 'scenario', sizeBytes: 2048 },
          { path: '../outside.json', kind: 'manifest', sizeBytes: 128 },
          { path: 'notes/apiKey.md', kind: 'note', sizeBytes: 64 },
        ],
      },
      existingWorkspaceIds: ['workspace-imported'],
    });

    expect(dryRun.mode).toBe('import');
    expect(dryRun.source.workspaceId).toBe('workspace-imported');
    expect(dryRun.source.scenarioId).toBe('scenario-imported');
    expect(dryRun.summary.status).toBe('blocked');
    expect(dryRun.summary.acceptedFileCount).toBe(2);
    expect(dryRun.summary.rejectedFileCount).toBe(2);
    expect(dryRun.decisionNotes).toEqual([
      'Replacement dry run: workspace workspace-imported already exists locally, but no storage mutation was performed.',
      'No local provider secrets, encrypted key material, saved desktop state, or localStorage records were mutated.',
    ]);
    expect(dryRun.files).toEqual([
      {
        path: 'agent-hangar.workspace-manifest-preview.json',
        kind: 'manifest',
        status: 'accepted',
        reason: 'Import candidate file is source-checkout safe.',
      },
      {
        path: 'scenarios/scenario-imported.json',
        kind: 'scenario',
        status: 'accepted',
        reason: 'Import candidate file is source-checkout safe.',
      },
      {
        path: '[redacted].md',
        kind: 'note',
        status: 'rejected',
        reason: 'Unsupported file kind note.',
      },
      {
        path: '../outside.json',
        kind: 'manifest',
        status: 'rejected',
        reason: 'File path must stay inside the source checkout bundle.',
      },
    ]);
    expect(dryRun.blockers.map((blocker) => blocker.code)).toEqual(['unsupported-file-kind', 'unsafe-file-path']);
    expect(dryRun.markdown).toContain('## Import Validation');
    expect(dryRun.markdown).toContain('- Accepted files: 2');
    expect(dryRun.markdown).toContain('- Rejected files: 2');
    expect(dryRun.markdown).toContain('No local provider secrets, encrypted key material, saved desktop state, or localStorage records were mutated.');
    expect(JSON.stringify(dryRun)).not.toMatch(/customer|apiKey|encryptedApiKey|encryptedKeyMaterial|Bearer|\bsk-[A-Za-z0-9._-]+/i);
  });

  it('returns validation blockers for malformed and unsupported input without throwing', () => {
    expect(validateWorkspaceImportExportDryRunInput(null).issues).toEqual([
      {
        code: 'malformed-input',
        severity: 'blocking',
        field: 'input',
        message: 'Workspace import/export dry-run input must be an object.',
      },
    ]);

    const unsupported = buildWorkspaceImportExportDryRun({
      mode: 'import',
      candidateBundle: {
        schemaVersion: 'agent-hangar.workspace-export-bundle.v0',
        workspaceId: 'workspace-old',
        files: [],
      },
    });

    expect(unsupported.summary.status).toBe('blocked');
    expect(unsupported.blockers).toContainEqual({
      code: 'unsupported-bundle-schema',
      severity: 'blocking',
      source: 'import',
      message: 'Import candidate uses an unsupported bundle schema version.',
    });
    expect(() => buildWorkspaceImportExportDryRun({ mode: 'import', candidateBundle: 'bad bundle' })).not.toThrow();
    expect(buildWorkspaceImportExportDryRun({ mode: 'import', candidateBundle: 'bad bundle' }).blockers).toContainEqual({
      code: 'malformed-bundle',
      severity: 'blocking',
      source: 'import',
      message: 'Import candidate bundle must be an object.',
    });
  });

  it('redacts secret-looking text and escapes Markdown table delimiters from user-provided fields', () => {
    const manifestPreview = buildWorkspaceManifestPreview({
      workspaceId: 'workspace-|pipe|',
      manifest: { schemaVersion: 'agent-hangar.workspace-manifest-preview.v0' },
    });
    manifestPreview.source.workspaceId = 'workspace-|pipe|-apiKey=redaction-fixture';
    manifestPreview.source.scenarioId = 'scenario-`tick`-secret=redaction-fixture';
    manifestPreview.blockers = [
      {
        code: 'unsupported-manifest-schema',
        severity: 'blocking',
        source: 'manifest',
        message: 'Blocked by user note with apiKey=redaction-fixture and pipe | marker',
      },
    ];

    const dryRun = buildWorkspaceImportExportDryRun({ mode: 'export', manifestPreview });
    const serialized = JSON.stringify(dryRun);

    expect(serialized).toContain('[redacted]');
    expect(dryRun.source.workspaceId).toContain('\\|pipe\\|');
    expect(dryRun.source.scenarioId).toContain('\\`tick\\`');
    expect(serialized).not.toMatch(/apiKey|redaction-fixture|Bearer/);
    expect(dryRun.markdown).toContain('workspace-\\|pipe\\|-[redacted]');
    expect(dryRun.markdown).toContain('scenario-\\`tick\\`-[redacted]');
    expect(dryRun.markdown).not.toMatch(/apiKey|redaction-fixture|Bearer/);
  });
});
