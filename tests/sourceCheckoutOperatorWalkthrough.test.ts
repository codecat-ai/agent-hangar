import { describe, expect, it } from 'vitest';
import {
  buildAuditHistoryPreview,
  buildCollaborationTriageView,
} from '../src/harness/collaborationAudit';
import { listDemoWorkspaceScenarios } from '../src/harness/demoWorkspace';
import { replayExecutionTrail } from '../src/harness/executionTrail';
import { formatRunEvidenceExport } from '../src/harness/runEvidenceExport';
import { formatScenarioEvidenceBundle } from '../src/harness/scenarioEvidenceBundle';
import {
  buildSourceCheckoutOperatorWalkthrough,
  summarizeSourceCheckoutWalkthrough,
} from '../src/harness/sourceCheckoutOperatorWalkthrough';
import { buildWorkspaceImportExportDryRun } from '../src/harness/workspaceImportExportDryRun';
import { buildWorkspaceManifestPreview } from '../src/harness/workspaceManifestPreview';

describe('source checkout operator walkthrough', () => {
  it('builds deterministic schema-versioned steps that connect local-first review surfaces', () => {
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

    const first = buildSourceCheckoutOperatorWalkthrough({
      scenario,
      providerProfileCount: 2,
      discoveryDryRunSummary: {
        schemaVersion: 'provider-discovery-dry-run-summary/v1',
        providerCount: 2,
        modelCount: 4,
        countsByStatus: { ready: 2 },
        countsBySeverity: { success: 2 },
        nextActions: [],
      },
      adapterShellResults: [{
        schemaVersion: 'provider-discovery-adapter-shell/v1',
        status: 'blocked',
        severity: 'warning',
        issueCount: 1,
        nextActions: ['Keep the fixture adapter disabled until operator consent is explicit.'],
      }],
      templateReports: manifest.templates.reports,
      runEvidence,
      scenarioEvidenceBundle: scenarioBundle,
      collaborationTriage: triage,
      auditHistoryPreview: audit,
      workspaceManifestPreview: manifest,
      workspaceDryRun: dryRun,
    });
    const second = buildSourceCheckoutOperatorWalkthrough({
      scenario,
      providerProfileCount: 2,
      discoveryDryRunSummary: {
        schemaVersion: 'provider-discovery-dry-run-summary/v1',
        providerCount: 2,
        modelCount: 4,
        countsByStatus: { ready: 2 },
        countsBySeverity: { success: 2 },
        nextActions: [],
      },
      adapterShellResults: [{
        schemaVersion: 'provider-discovery-adapter-shell/v1',
        status: 'blocked',
        severity: 'warning',
        issueCount: 1,
        nextActions: ['Keep the fixture adapter disabled until operator consent is explicit.'],
      }],
      templateReports: manifest.templates.reports,
      runEvidence,
      scenarioEvidenceBundle: scenarioBundle,
      collaborationTriage: triage,
      auditHistoryPreview: audit,
      workspaceManifestPreview: manifest,
      workspaceDryRun: dryRun,
    });

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('agent-hangar.source-checkout-operator-walkthrough.v1');
    expect(first.source.mode).toBe('source-checkout-only');
    expect(first.steps.map((step) => step.id)).toEqual([
      'provider-readiness',
      'template-validation',
      'demo-scenario',
      'execution-evidence',
      'collaboration-triage',
      'workspace-portability',
      'import-export-dry-run',
    ]);
    expect(first.summary.stepCount).toBe(7);
    expect(first.markdown).toContain('# Source Checkout Operator Walkthrough');
    expect(first.markdown).toContain('schemaVersion: agent-hangar.source-checkout-operator-walkthrough.v1');
    expect(first.markdown).not.toMatch(/\bnpm\s+(?:install|ci|run|exec)\b|\bpip\s+install\b|\bcurl\b/i);
  });

  it('aggregates status counts, blockers, and next actions deterministically', () => {
    const scenario = listDemoWorkspaceScenarios()[1]!;
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
      providerProfileCount: 0,
      templateReports: manifest.templates.reports,
      runEvidence,
      scenarioEvidenceBundle: scenarioBundle,
      collaborationTriage: triage,
      auditHistoryPreview: audit,
      workspaceManifestPreview: manifest,
      workspaceDryRun: dryRun,
    });

    expect(walkthrough.summary.statusCounts.blocked).toBeGreaterThan(0);
    expect(walkthrough.summary.blockerCount).toBeGreaterThan(0);
    expect(walkthrough.blockers[0]!.stepId).toBe('provider-readiness');
    expect(walkthrough.nextActions[0]).toBe('Add at least one local provider profile before reviewing source-checkout readiness.');
    expect(summarizeSourceCheckoutWalkthrough(walkthrough)).toEqual({
      schemaVersion: 'agent-hangar.source-checkout-operator-walkthrough-summary.v1',
      status: 'blocked',
      stepCount: 7,
      readyCount: walkthrough.summary.statusCounts.ready ?? 0,
      blockedCount: walkthrough.summary.statusCounts.blocked ?? 0,
      warningCount: walkthrough.summary.statusCounts.warning ?? 0,
      blockerCount: walkthrough.summary.blockerCount,
      nextActionCount: walkthrough.nextActions.length,
    });
  });

  it('redacts secret-like text from step data and Markdown copy preview', () => {
    const walkthrough = buildSourceCheckoutOperatorWalkthrough({
      providerProfileCount: 1,
      discoveryDryRunSummary: {
        schemaVersion: 'provider-discovery-dry-run-summary/v1',
        providerCount: 1,
        modelCount: 0,
        countsByStatus: { degraded: 1 },
        countsBySeverity: { error: 1 },
        nextActions: ['Fix apiKey=sk-walkthrough-secret for ACME customer before retrying.'],
      },
      adapterShellResults: [{
        schemaVersion: 'provider-discovery-adapter-shell/v1',
        status: 'blocked',
        severity: 'warning',
        issueCount: 1,
        nextActions: ['Do not expose Bearer abcdef123456 or encryptedKeyMaterial=secret-value.'],
      }],
    });

    const serialized = JSON.stringify(walkthrough);
    expect(serialized).toContain('[redacted]');
    expect(serialized).not.toMatch(/sk-walkthrough-secret|Bearer abcdef123456|encryptedKeyMaterial|ACME customer|apiKey/i);
    expect(walkthrough.markdown).not.toMatch(/sk-walkthrough-secret|Bearer abcdef123456|encryptedKeyMaterial|ACME customer|apiKey/i);
  });
});
