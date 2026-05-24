import { describe, expect, it } from 'vitest';
import { buildWorkspaceManifestPreview, validateWorkspaceManifestPreview } from '../src/harness/workspaceManifestPreview';
import { normalizeCollaborationInbox } from '../src/harness/collaborationAudit';
import { getDemoWorkspaceScenario } from '../src/harness/demoWorkspace';
import { createExecutionGraphFromTemplates } from '../src/harness/executionGraph';
import { createProviderProfile, localDemoProviderProfileCrypto } from '../src/harness/providerProfiles';
import { createPromptTemplate } from '../src/harness/promptTemplates';

const clock = () => '2026-05-23T10:00:00.000Z';
const profileClock = () => new Date('2026-05-23T10:00:00.000Z');

describe('workspace manifest preview', () => {
  it('builds deterministic source-checkout-only preview data and Markdown from reusable workspace helpers', () => {
    const provider = createProviderProfile({
      id: 'openai-main',
      kind: 'openai',
      displayName: 'OpenAI Main',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-provider-secret',
      health: { checkedAt: clock(), modelInventoryUpdatedAt: clock() },
    }, localDemoProviderProfileCrypto, profileClock);
    const template = createPromptTemplate({
      id: 'template-planner',
      title: 'Planner',
      role: 'planner',
      body: 'Plan {{task}}.',
      providerProfileId: 'openai-main',
      modelId: 'gpt-4.1',
      escalationPolicyId: 'manual-escalation',
      requiredToolIds: ['browser'],
    }, clock);
    const graph = createExecutionGraphFromTemplates({
      workspaceId: 'workspace-portable',
      templates: [template],
    });

    const first = buildWorkspaceManifestPreview({
      workspaceId: 'workspace-portable',
      providerProfiles: [provider],
      modelsByProvider: {
        'openai-main': [{ id: 'gpt-4.1', displayName: 'GPT 4.1', providerKind: 'openai' }],
      },
      promptTemplates: [template],
      workspaceTools: [{ id: 'browser', name: 'Browser', enabled: true }],
      escalationPolicies: [{ id: 'manual-escalation', label: 'Manual escalation', mode: 'manual' }],
      graph,
    });
    const second = buildWorkspaceManifestPreview({
      workspaceId: 'workspace-portable',
      providerProfiles: structuredClone([provider]),
      modelsByProvider: {
        'openai-main': [{ id: 'gpt-4.1', displayName: 'GPT 4.1', providerKind: 'openai' }],
      },
      promptTemplates: structuredClone([template]),
      workspaceTools: [{ id: 'browser', name: 'Browser', enabled: true }],
      escalationPolicies: [{ id: 'manual-escalation', label: 'Manual escalation', mode: 'manual' }],
      graph: structuredClone(graph),
    });

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('agent-hangar.workspace-manifest-preview.v1');
    expect(first.source).toEqual({
      mode: 'source-checkout-only',
      workspaceId: 'workspace-portable',
      scenarioId: undefined,
    });
    expect(first.providers).toEqual({
      total: 1,
      configured: 1,
      missingBindingIds: [],
      inventories: [
        {
          id: 'openai-main',
          kind: 'openai',
          displayName: 'OpenAI Main',
          keyConfigured: true,
          modelCount: 1,
          modelIds: ['gpt-4.1'],
        },
      ],
    });
    expect(first.templates.summary).toEqual({
      total: 1,
      blockingIssueCount: 0,
      warningIssueCount: 0,
      missingToolCount: 0,
      disabledToolCount: 0,
    });
    expect(first.execution.evidenceAvailable).toBe(false);
    expect(first.blockers).toEqual([]);
    expect(first.portabilityNotes).toContain('Source checkout only: recreate this workspace from local files and configured desktop state, not npm/npx/package registry commands.');
    expect(first.markdown).toContain('schemaVersion: agent-hangar.workspace-manifest-preview.v1');
    expect(first.markdown).toContain('# Workspace Portability Manifest Preview');
    expect(first.markdown).toContain('- Source mode: source-checkout-only');
    expect(first.markdown).toContain('- Provider inventories: 1');
    expect(validateWorkspaceManifestPreview(first).issues).toEqual([]);
  });

  it('flags portability blockers from provider bindings, template tools, graph validation, and collaboration state', () => {
    const template = createPromptTemplate({
      id: 'template-operator',
      title: 'Operator',
      role: 'operator',
      body: 'Coordinate {{incident}}.',
      providerProfileId: 'missing-provider',
      modelId: 'gpt-4.1',
      escalationPolicyId: 'policy-missing',
      requiredToolIds: ['shell'],
      requiredToolNames: ['Deploy Console'],
    }, clock);
    const graph = createExecutionGraphFromTemplates({
      workspaceId: 'workspace-blocked',
      templates: [template],
      handoffs: [{ fromTemplateId: 'template-operator', toTemplateId: 'missing-node' }],
    });
    const collaborationItems = normalizeCollaborationInbox([
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'esc-portable',
        type: 'escalation',
        priority: 'urgent',
        status: 'open',
        createdAt: clock(),
        title: 'Operator escalation',
      },
      {
        schemaVersion: 'agent-hangar.collaboration-inbox-item.v1',
        id: 'review-portable',
        type: 'review',
        priority: 'high',
        status: 'acknowledged',
        createdAt: clock(),
        title: 'Review follow-up',
      },
    ]).items;

    const preview = buildWorkspaceManifestPreview({
      workspaceId: 'workspace-blocked',
      providerProfiles: [],
      promptTemplates: [template],
      workspaceTools: [{ id: 'shell', name: 'Shell', enabled: false }],
      escalationPolicies: [],
      graph,
      collaborationItems,
    });

    expect(preview.summary.status).toBe('blocked');
    expect(preview.providers.missingBindingIds).toEqual(['missing-provider']);
    expect(preview.templates.summary).toMatchObject({
      blockingIssueCount: 3,
      missingToolCount: 1,
      disabledToolCount: 1,
    });
    expect(preview.collaboration).toMatchObject({
      unresolvedEscalationCount: 1,
      highPriorityUnresolvedCount: 2,
    });
    expect(preview.blockers.map((blocker) => blocker.code)).toEqual([
      'missing-provider-binding',
      'disabled-tool',
      'missing-tool',
      'missing-escalation-policy',
      'graph-validation-issue',
      'unresolved-escalation',
      'high-priority-collaboration',
    ]);
    expect(preview.markdown).toContain('- missing-provider-binding | blocking | Provider binding missing-provider is referenced but not available in this source checkout.');
    expect(preview.markdown).toContain('- graph-validation-issue | blocking | Execution graph edge template-operator->missing-node references missing target node missing-node.');
  });

  it('redacts secret-looking material from JSON and Markdown output', () => {
    const provider = createProviderProfile({
      id: 'openai-main',
      kind: 'openai',
      displayName: 'Customer sk-provider-secret',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-provider-secret',
    }, localDemoProviderProfileCrypto, profileClock);
    const scenario = getDemoWorkspaceScenario('coordination-happy-path');
    scenario.label = 'Bearer scenario-token';
    scenario.seed.workspaceId = 'workspace-customer-123';
    scenario.seed.auditEntries[0] = {
      ...scenario.seed.auditEntries[0]!,
      reason: 'apiKey=sk-audit-secret encryptedKeyMaterial=abc123',
      note: 'private note contains customer details',
    };
    scenario.seed.collaborationItems[0] = {
      ...scenario.seed.collaborationItems[0]!,
      body: 'secret: customer token sk-collab-secret',
      note: 'Bearer collab-token',
    };

    const preview = buildWorkspaceManifestPreview({
      manifest: { schemaVersion: 'agent-hangar.workspace-manifest-preview.v0', note: 'Bearer manifest-token' },
      providerProfiles: [provider],
      scenario,
      collaborationItems: scenario.seed.collaborationItems,
    });
    const serialized = JSON.stringify(preview);

    expect(serialized).toContain('[redacted]');
    expect(serialized).not.toMatch(/apiKey|encryptedApiKey|encryptedKeyMaterial|sk-provider-secret|sk-audit-secret|sk-collab-secret|scenario-token|manifest-token|customer/i);
    expect(preview.markdown).not.toMatch(/apiKey|encryptedApiKey|encryptedKeyMaterial|Bearer|\bsk-[A-Za-z0-9._-]+|customer/i);
    expect(preview.blockers).toContainEqual({
      code: 'unsupported-manifest-schema',
      severity: 'blocking',
      source: 'manifest',
      message: 'Workspace manifest input uses an unsupported schema version.',
    });
  });

  it('validates unsupported schema versions and malformed preview inputs without throwing', () => {
    expect(validateWorkspaceManifestPreview(null).issues).toEqual([
      {
        code: 'malformed-preview',
        severity: 'blocking',
        field: 'preview',
        message: 'Workspace manifest preview must be an object.',
      },
    ]);
    expect(validateWorkspaceManifestPreview({
      schemaVersion: 'agent-hangar.workspace-manifest-preview.v0',
      markdown: '',
    }).issues).toEqual([
      {
        code: 'unsupported-schema-version',
        severity: 'blocking',
        field: 'schemaVersion',
        message: 'Workspace manifest preview uses an unsupported schema version.',
      },
      {
        code: 'missing-markdown',
        severity: 'blocking',
        field: 'markdown',
        message: 'Workspace manifest preview must include Markdown preview text.',
      },
    ]);

    const malformedInputPreview = buildWorkspaceManifestPreview({ manifest: 'not an object' });
    expect(malformedInputPreview.blockers).toContainEqual({
      code: 'malformed-manifest-input',
      severity: 'blocking',
      source: 'manifest',
      message: 'Workspace manifest input must be an object when provided.',
    });
  });
});
