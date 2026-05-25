import { describe, expect, it } from 'vitest';
import {
  buildAuditHistoryPreview,
  buildCollaborationTriageView,
} from '../src/harness/collaborationAudit';
import { listDemoWorkspaceScenarios } from '../src/harness/demoWorkspace';
import { replayExecutionTrail } from '../src/harness/executionTrail';
import { formatRunEvidenceExport } from '../src/harness/runEvidenceExport';
import { formatScenarioEvidenceBundle } from '../src/harness/scenarioEvidenceBundle';
import { buildSourceCheckoutEvidenceQualityGate } from '../src/harness/sourceCheckoutEvidenceQualityGates';
import { buildSourceCheckoutOnboarding } from '../src/harness/sourceCheckoutOnboarding';
import { buildSourceCheckoutOperatorWalkthrough } from '../src/harness/sourceCheckoutOperatorWalkthrough';
import { buildWorkspaceImportExportDryRun } from '../src/harness/workspaceImportExportDryRun';
import { buildWorkspaceManifestPreview } from '../src/harness/workspaceManifestPreview';

describe('source checkout evidence quality gates', () => {
  it('reviews ready demo source-checkout evidence deterministically', () => {
    const preview = buildReadyDemoQualityGate();
    const second = buildReadyDemoQualityGate();

    expect(preview).toEqual(second);
    expect(preview.schemaVersion).toBe('agent-hangar.source-checkout-evidence-quality-gate.v1');
    expect(preview.source.mode).toBe('source-checkout-only');
    expect(preview.summary.status).toBe('ready');
    expect(preview.summary.checkedSurfaceCount).toBe(8);
    expect(preview.summary.severityCounts.blocking ?? 0).toBe(0);
    expect(preview.issues).toEqual([]);
    expect(preview.nextActions).toEqual(['Source-checkout evidence is ready for local review.']);
    expect(preview.markdown).toContain('# Source Checkout Evidence Quality Gate');
    expect(preview.markdown).toContain('- Checked surfaces: 8');
    expect(preview.markdown).not.toMatch(/\bnpm\s+(?:install|ci|exec|run)\b|\bnpx\b|\byarn\s+add\b|\bpip\s+install\b|\bcurl\b|apiKey|encryptedKeyMaterial|Bearer/i);
  });

  it('blocks malformed surfaces with unsafe Markdown, unsupported schemas, source-mode mismatches, secrets, and count mismatches', () => {
    const preview = buildSourceCheckoutEvidenceQualityGate({
      surfaces: [
        {
          id: 'walkthrough',
          label: 'Walkthrough',
          expectedSchemaVersion: 'agent-hangar.source-checkout-operator-walkthrough.v1',
          evidence: {
            schemaVersion: 'agent-hangar.source-checkout-operator-walkthrough.v0',
            source: { mode: 'provider-live' },
            summary: { stepCount: 7, blockerCount: 2 },
            markdown: '# Bad\nsourceMode: provider-live\n- Steps: 6\nnpm install agent-hangar\napiKey=sk-malformed-secret\nBearer malformed-token',
          },
          countChecks: [
            { label: 'Steps', structuredCount: 7, markdownPattern: /-\s*Steps:\s*(\d+)/i },
          ],
        },
        {
          id: 'scenario-bundle',
          label: 'Scenario bundle',
          expectedSchemaVersion: 'agent-hangar.scenario-evidence-bundle.v1',
          evidence: {
            schemaVersion: 'agent-hangar.scenario-evidence-bundle.v1',
            markdown: '   ',
          },
        },
        {
          id: 'audit-history',
          label: 'Audit history',
          expectedSchemaVersion: 'agent-hangar.audit-history-preview.v1',
          evidence: {
            schemaVersion: 'agent-hangar.audit-history-preview.v1',
            counts: { auditEntries: 1 },
            markdown: '# Audit\n- Audit entries: 2\nexample customer note encryptedKeyMaterial=abc123',
          },
          countChecks: [
            { label: 'Audit entries', structuredCount: 1, markdownPattern: /-\s*Audit entries:\s*(\d+)/i },
          ],
        },
      ],
    });

    expect(preview.summary.status).toBe('blocked');
    expect(preview.summary.checkedSurfaceCount).toBe(3);
    expect(preview.summary.issueCount).toBeGreaterThanOrEqual(7);
    expect(preview.summary.severityCounts.blocking).toBeGreaterThanOrEqual(5);
    expect(preview.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'unsupported-schema-version',
      'source-mode-mismatch',
      'package-registry-or-shell-command',
      'secret-like-content',
      'missing-markdown',
      'markdown-count-mismatch',
    ]));
    expect(preview.nextActions).toContain('Remove package-registry or shell command text from copied source-checkout evidence.');
    expect(preview.nextActions).toContain('Remove or regenerate evidence that contains secret-like content.');
    expect(preview.nextActions).toContain('Regenerate copied Markdown so structured counts and Markdown summaries agree.');
    expect(JSON.stringify(preview)).toContain('[redacted]');
    expect(JSON.stringify(preview)).not.toMatch(/sk-malformed-secret|malformed-token|encryptedKeyMaterial|apiKey|example customer/i);
    expect(preview.markdown).not.toMatch(/sk-malformed-secret|malformed-token|encryptedKeyMaterial|apiKey|example customer/i);
  });

  it('redacts deterministic next-action and issue output', () => {
    const preview = buildSourceCheckoutEvidenceQualityGate({
      surfaces: [{
        id: 'redaction-surface',
        label: 'ACME customer source',
        expectedSchemaVersion: 'agent-hangar.redaction-surface.v1',
        evidence: {
          schemaVersion: 'agent-hangar.redaction-surface.v1',
          source: { mode: 'source-checkout-only' },
          summary: { blockerCount: 0 },
          nextActions: ['Rotate Bearer redaction-token and remove apiKey=sk-redaction-secret from ACME customer handoff.'],
          markdown: '# Redaction\n- Blockers: 0\nBearer redaction-token\napiKey=sk-redaction-secret\nACME customer',
        },
        countChecks: [
          { label: 'Blockers', structuredCount: 0, markdownPattern: /-\s*Blockers:\s*(\d+)/i },
        ],
      }],
    });

    expect(preview.summary.status).toBe('blocked');
    expect(preview.nextActions).toEqual(expect.arrayContaining([
      'Remove or regenerate evidence that contains secret-like content.',
    ]));
    expect(JSON.stringify(preview)).toContain('[redacted]');
    expect(JSON.stringify(preview)).not.toMatch(/redaction-token|sk-redaction-secret|apiKey|ACME customer/i);
    expect(preview.markdown).toContain('[redacted]');
  });
});

function buildReadyDemoQualityGate() {
  const scenario = listDemoWorkspaceScenarios()[0]!;
  const triage = buildCollaborationTriageView(scenario.seed.collaborationItems);
  const audit = buildAuditHistoryPreview({
    auditEntries: scenario.seed.auditEntries,
    collaborationItems: triage.rows,
  });
  const trailSummary = replayExecutionTrail(scenario.seed.graph, scenario.seed.trail);
  const runEvidence = formatRunEvidenceExport({ trailSummary });
  const scenarioBundle = formatScenarioEvidenceBundle({ scenario, collaborationTriage: triage, auditHistoryPreview: audit });
  const manifest = buildWorkspaceManifestPreview({ scenario, graph: scenario.seed.graph, collaborationItems: triage.rows });
  const dryRun = buildWorkspaceImportExportDryRun({ mode: 'export', manifestPreview: manifest });
  const walkthrough = buildSourceCheckoutOperatorWalkthrough({
    scenario,
    providerProfileCount: 1,
    discoveryDryRunSummary: {
      schemaVersion: 'provider-discovery-dry-run-summary/v1',
      providerCount: 1,
      modelCount: 1,
      countsByStatus: { ready: 1 },
      countsBySeverity: { success: 1 },
      nextActions: [],
    },
    templateReports: manifest.templates.reports,
    runEvidence,
    scenarioEvidenceBundle: scenarioBundle,
    collaborationTriage: triage,
    auditHistoryPreview: audit,
    workspaceManifestPreview: manifest,
    workspaceDryRun: dryRun,
  });
  const onboarding = buildSourceCheckoutOnboarding();

  return buildSourceCheckoutEvidenceQualityGate({
    surfaces: [
      {
        id: 'walkthrough',
        label: 'Source-checkout operator walkthrough',
        expectedSchemaVersion: 'agent-hangar.source-checkout-operator-walkthrough.v1',
        evidence: walkthrough,
        countChecks: [
          { label: 'Steps', structuredCount: walkthrough.summary.stepCount, markdownPattern: /-\s*Steps:\s*(\d+)/i },
          { label: 'Blockers', structuredCount: walkthrough.summary.blockerCount, markdownPattern: /-\s*Blockers:\s*(\d+)/i },
        ],
      },
      {
        id: 'scenario-bundle',
        label: 'Scenario evidence bundle',
        expectedSchemaVersion: 'agent-hangar.scenario-evidence-bundle.v1',
        evidence: scenarioBundle,
        countChecks: [
          { label: 'Unresolved escalations', structuredCount: scenarioBundle.collaboration.unresolvedEscalationCount, markdownPattern: /-\s*Unresolved escalations:\s*(\d+)/i },
        ],
      },
      {
        id: 'workspace-manifest',
        label: 'Workspace portability manifest',
        expectedSchemaVersion: 'agent-hangar.workspace-manifest-preview.v1',
        evidence: manifest,
        countChecks: [
          { label: 'Blockers', structuredCount: manifest.summary.blockerCount, markdownPattern: /-\s*Blockers:\s*(\d+)/i },
          { label: 'Provider inventories', structuredCount: manifest.providers.total, markdownPattern: /-\s*Provider inventories:\s*(\d+)/i },
        ],
      },
      {
        id: 'workspace-dry-run',
        label: 'Workspace import/export dry run',
        expectedSchemaVersion: 'agent-hangar.workspace-import-export-dry-run.v1',
        evidence: dryRun,
        countChecks: [
          { label: 'Accepted files', structuredCount: dryRun.summary.acceptedFileCount, markdownPattern: /-\s*Accepted files:\s*(\d+)/i },
          { label: 'Blockers', structuredCount: dryRun.summary.blockerCount, markdownPattern: /-\s*Blockers:\s*(\d+)/i },
        ],
      },
      {
        id: 'collaboration-triage',
        label: 'Collaboration triage preview',
        expectedSchemaVersion: 'agent-hangar.collaboration-triage-view.v1',
        evidence: { ...triage, markdown: scenarioBundle.markdown },
      },
      {
        id: 'audit-history',
        label: 'Audit history preview',
        expectedSchemaVersion: 'agent-hangar.audit-history-preview.v1',
        evidence: audit,
        countChecks: [
          { label: 'Audit entries', structuredCount: audit.counts.auditEntries, markdownPattern: /-\s*Audit entries:\s*(\d+)/i },
          { label: 'Unresolved escalations', structuredCount: audit.counts.unresolvedEscalations, markdownPattern: /-\s*Unresolved escalations:\s*(\d+)/i },
        ],
      },
      {
        id: 'run-evidence',
        label: 'Run evidence export',
        expectedSchemaVersion: 'agent-hangar.run-evidence-export.v1',
        evidence: runEvidence,
        countChecks: [
          { label: 'Events', structuredCount: runEvidence.counts.events, markdownPattern: /-\s*Events:\s*(\d+)/i },
          { label: 'Graph issues', structuredCount: runEvidence.counts.graphIssues, markdownPattern: /-\s*Graph issues:\s*(\d+)/i },
        ],
      },
      {
        id: 'onboarding',
        label: 'Source-checkout onboarding',
        expectedSchemaVersion: 'agent-hangar.source-checkout-onboarding.v1',
        evidence: onboarding,
      },
    ],
  });
}
