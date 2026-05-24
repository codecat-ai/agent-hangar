import { describe, expect, it } from 'vitest';
import { buildAuditHistoryPreview, buildCollaborationTriageView } from '../src/harness/collaborationAudit';
import { getDemoWorkspaceScenario } from '../src/harness/demoWorkspace';
import {
  formatScenarioEvidenceBundle,
  validateScenarioEvidenceBundle,
} from '../src/harness/scenarioEvidenceBundle';

describe('scenario evidence bundle formatter', () => {
  it('builds deterministic schema-versioned preview and Markdown from reusable run/audit/triage summaries', () => {
    const scenario = getDemoWorkspaceScenario('blocked-failure-recovery');
    const first = formatScenarioEvidenceBundle({ scenario });
    const second = formatScenarioEvidenceBundle({ scenario: structuredClone(scenario) });
    const triage = buildCollaborationTriageView(scenario.seed.collaborationItems);
    const audit = buildAuditHistoryPreview({
      auditEntries: scenario.seed.auditEntries,
      collaborationItems: triage.rows,
    });

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('agent-hangar.scenario-evidence-bundle.v1');
    expect(first.scenario).toEqual({
      id: 'blocked-failure-recovery',
      name: 'Blocked failure recovery',
      workspaceId: 'workspace-local-demo-blocked',
    });
    expect(first.runEvidence.schemaVersion).toBe('agent-hangar.run-evidence-export.v1');
    expect(first.graphStatusCounts).toEqual({
      queued: 0,
      runnable: 0,
      blocked: 1,
      working: 0,
      completed: 2,
      failed: 1,
    });
    expect(first.trailStatusCounts).toEqual({ accepted: 12, issue: 0 });
    expect(first.nextRunnableNodeIds).toEqual([]);
    expect(first.collaboration).toEqual({
      visibleCount: triage.compact.visibleCount,
      hiddenCount: triage.compact.hiddenCount,
      activeFilterLabels: triage.compact.activeFilterLabels,
      highPriorityUnresolvedCount: triage.compact.highPriorityUnresolvedCount,
      unresolvedEscalationCount: triage.compact.unresolvedEscalationCount,
      nextActionHints: triage.compact.nextActionHints,
      unresolvedEscalationCountFromAudit: audit.counts.unresolvedEscalations,
      highPriorityCountFromAudit: audit.counts.highPriorityItems + audit.counts.urgentItems,
    });
    expect(first.recentAuditEntries.map((entry) => entry.id)).toEqual([
      'audit:audit-recovery-review-canceled',
      'audit:audit-recovery-retry-queued',
      'collab:collab-recovery-escalation',
      'collab:collab-recovery-review',
    ]);
    expect(first.issueSummaries).toEqual([]);
    expect(first.markdown).toContain('schemaVersion: agent-hangar.scenario-evidence-bundle.v1');
    expect(first.markdown).toContain('# Scenario Evidence Bundle');
    expect(first.markdown).toContain('- Scenario: Blocked failure recovery (`blocked-failure-recovery`)');
    expect(first.markdown).toContain('- failed: 1');
    expect(first.markdown).toContain('- Unresolved escalations: 1');
    expect(first.markdown).toContain('## Run Evidence Export');
    expect(first.markdown).toContain('schemaVersion: agent-hangar.run-evidence-export.v1');
    expect(validateScenarioEvidenceBundle(first).issues).toEqual([]);
  });

  it('redacts secret-like text across preview fields and Markdown', () => {
    const scenario = getDemoWorkspaceScenario('coordination-happy-path');
    scenario.id = 'coordination-happy-path';
    scenario.label = 'Customer sk-scenario-secret';
    scenario.seed.workspaceId = 'workspace-customer-123';
    scenario.seed.graph.workspaceId = 'workspace-customer-123';
    scenario.seed.trail.workspaceId = 'workspace-customer-123';
    scenario.seed.trail.events = [
      ...scenario.seed.trail.events,
      {
        id: 'evt-secret',
        occurredAt: '2026-05-23T10:11:00.000Z',
        kind: 'node-started',
        actorId: 'operator Bearer bearer-token-secret',
        title: 'Secret note',
        nodeId: 'demo-reviewer',
        note: 'apiKey=sk-live-secret encryptedKeyMaterial=abc123 Bearer token-secret note: customer should stay hidden',
      },
    ];
    scenario.seed.collaborationItems[0] = {
      ...scenario.seed.collaborationItems[0]!,
      title: 'Bearer collab-secret',
      body: 'secret: keep customer API token sk-collab-secret private',
      note: 'private note contains encryptedKeyMaterial=abc123',
    };
    scenario.seed.auditEntries[0] = {
      ...scenario.seed.auditEntries[0]!,
      reason: 'Bearer audit-secret',
      note: 'secret note apiKey=sk-audit-secret',
    };

    const bundle = formatScenarioEvidenceBundle({ scenario });
    const serialized = JSON.stringify(bundle);

    expect(serialized).toContain('[redacted]');
    expect(serialized).not.toMatch(/apiKey|encryptedKeyMaterial|sk-live-secret|sk-collab-secret|sk-audit-secret|bearer-token-secret|collab-secret|audit-secret|customer-123|\bcustomer\b/i);
    expect(bundle.markdown).not.toMatch(/apiKey|encryptedKeyMaterial|Bearer|\bsk-[A-Za-z0-9._-]+|customer/i);
  });

  it('validates unsupported schema versions and malformed bundle input without throwing', () => {
    const unsupported = validateScenarioEvidenceBundle({
      schemaVersion: 'agent-hangar.scenario-evidence-bundle.v0',
      scenario: { id: 'x', name: 'x', workspaceId: 'x' },
    });
    const malformed = validateScenarioEvidenceBundle(null);

    expect(unsupported.issues).toEqual([
      {
        code: 'unsupported-schema-version',
        severity: 'blocking',
        field: 'schemaVersion',
        message: 'Scenario evidence bundle uses an unsupported schema version.',
      },
      {
        code: 'missing-markdown',
        severity: 'blocking',
        field: 'markdown',
        message: 'Scenario evidence bundle must include Markdown preview text.',
      },
    ]);
    expect(malformed.issues).toEqual([
      {
        code: 'malformed-bundle',
        severity: 'blocking',
        field: 'bundle',
        message: 'Scenario evidence bundle must be an object.',
      },
    ]);
  });

  it('accepts precomputed audit and triage summaries without changing deterministic output', () => {
    const scenario = getDemoWorkspaceScenario('coordination-happy-path');
    const triage = buildCollaborationTriageView(scenario.seed.collaborationItems);
    const audit = buildAuditHistoryPreview({
      auditEntries: scenario.seed.auditEntries,
      collaborationItems: triage.rows,
    });

    const withDefaults = formatScenarioEvidenceBundle({ scenario });
    const withSummaries = formatScenarioEvidenceBundle({ scenario, auditHistoryPreview: audit, collaborationTriage: triage });

    expect(withSummaries).toEqual(withDefaults);
  });
});
