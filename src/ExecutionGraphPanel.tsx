import React, { useEffect, useMemo, useState } from 'react';
import { Clipboard, GitBranch } from 'lucide-react';
import {
  applyExecutionControlAction,
  deriveAllowedExecutionControlActions,
  type ExecutionControlAction,
  type ExecutionControlAuditEntry,
  type ExecutionControlState,
  type ExecutionControlStatus,
} from './harness/executionControls';
import {
  applyCollaborationInboxMutation,
  buildAuditHistoryPreview,
  buildCollaborationTriageView,
  sortCollaborationInboxItems,
  type CollaborationTriageFilters,
  type CollaborationTriagePriorityFilter,
  type CollaborationTriageStatusFilter,
  type CollaborationTriageTypeFilter,
  type CollaborationMutationAction,
  type CollaborationMutationAuditEntry,
  type CollaborationInboxRecord,
} from './harness/collaborationAudit';
import {
  buildExecutionGraphSummary,
  validateExecutionGraph,
  type ExecutionGraph,
  type ExecutionNodeStatus,
} from './harness/executionGraph';
import { replayExecutionTrail, type ExecutionTrailSummary } from './harness/executionTrail';
import { type DemoWorkspaceScenario } from './harness/demoWorkspace';
import { formatRunEvidenceExport } from './harness/runEvidenceExport';
import { formatScenarioEvidenceBundle } from './harness/scenarioEvidenceBundle';
import { type NormalizedModel } from './harness/providerCatalog';
import { type ProviderProfile } from './harness/providerProfiles';
import {
  buildWorkspaceManifestPreview,
  type WorkspaceManifestPreview,
} from './harness/workspaceManifestPreview';
import { buildWorkspaceImportExportDryRun } from './harness/workspaceImportExportDryRun';
import { type EscalationPolicyRecord, type PromptTemplateRecord, type WorkspaceToolRecord } from './harness/promptTemplates';

export interface ExecutionGraphPanelProps {
  graph?: ExecutionGraph;
  trailSummary?: ExecutionTrailSummary;
  collaborationItems?: CollaborationInboxRecord[];
  auditEntries?: ExecutionControlAuditEntry[];
  demoScenarios?: DemoWorkspaceScenario[];
  initialDemoScenarioId?: string;
  collaborationActorId?: string;
  collaborationClock?: () => string;
  collaborationStorage?: CollaborationStorage;
  secretPreview?: string;
  workspaceManifestProviders?: ProviderProfile[];
  workspaceManifestModelsByProvider?: Record<string, NormalizedModel[]>;
  workspaceManifestTemplates?: PromptTemplateRecord[];
  workspaceManifestTools?: WorkspaceToolRecord[];
  workspaceManifestEscalationPolicies?: EscalationPolicyRecord[];
  copyRunEvidence?: (markdown: string) => void | Promise<void>;
  copyAuditHistory?: (markdown: string) => void | Promise<void>;
  copyScenarioEvidenceBundle?: (markdown: string) => void | Promise<void>;
  copyWorkspaceManifest?: (markdown: string) => void | Promise<void>;
  copyWorkspaceDryRun?: (markdown: string) => void | Promise<void>;
}

interface CollaborationStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface CollaborationUiState {
  items: CollaborationInboxRecord[];
  auditEntries: CollaborationMutationAuditEntry[];
  statusMessage?: string;
  issueMessage?: string;
}

const EMPTY_COLLABORATION_ITEMS: CollaborationInboxRecord[] = [];
const EMPTY_GRAPH: ExecutionGraph = {
  schemaVersion: 'agent-hangar.execution-graph.v1',
  workspaceId: 'workspace-local-empty',
  nodes: [],
  edges: [],
};
const DEFAULT_TRIAGE_FILTERS: Required<CollaborationTriageFilters> = {
  status: 'all',
  priority: 'all',
  type: 'all',
  query: '',
};

export function ExecutionGraphPanel({
  graph: graphProp,
  trailSummary,
  collaborationItems = EMPTY_COLLABORATION_ITEMS,
  auditEntries = [],
  demoScenarios,
  initialDemoScenarioId,
  collaborationActorId = 'operator-local-demo',
  collaborationClock = () => '2026-05-23T10:08:00.000Z',
  collaborationStorage,
  workspaceManifestProviders,
  workspaceManifestModelsByProvider,
  workspaceManifestTemplates,
  workspaceManifestTools,
  workspaceManifestEscalationPolicies,
  copyRunEvidence,
  copyAuditHistory,
  copyScenarioEvidenceBundle,
  copyWorkspaceManifest,
  copyWorkspaceDryRun,
}: ExecutionGraphPanelProps) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    initialDemoScenarioId ?? demoScenarios?.[0]?.id ?? '',
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [auditCopyState, setAuditCopyState] = useState<'idle' | 'copied'>('idle');
  const [scenarioBundleCopyState, setScenarioBundleCopyState] = useState<'idle' | 'copied'>('idle');
  const [workspaceManifestCopyState, setWorkspaceManifestCopyState] = useState<'idle' | 'copied'>('idle');
  const [workspaceDryRunCopyState, setWorkspaceDryRunCopyState] = useState<'idle' | 'copied'>('idle');
  const selectedScenario = useMemo(
    () => demoScenarios?.find((scenario) => scenario.id === selectedScenarioId) ?? demoScenarios?.[0],
    [demoScenarios, selectedScenarioId],
  );
  const graph = selectedScenario?.seed.graph ?? graphProp ?? EMPTY_GRAPH;
  const activeTrailSummary = useMemo(
    () => selectedScenario ? replayExecutionTrail(selectedScenario.seed.graph, selectedScenario.seed.trail) : trailSummary,
    [selectedScenario, trailSummary],
  );
  const activeCollaborationItems = selectedScenario?.seed.collaborationItems ?? collaborationItems;
  const activeAuditEntries = selectedScenario?.seed.auditEntries ?? auditEntries;
  const issues = useMemo(() => validateExecutionGraph(graph), [graph]);
  const summary = useMemo(() => buildExecutionGraphSummary(graph), [graph]);
  const initialControlState = useMemo(
    () => (activeTrailSummary ? createInitialControlState(graph, activeTrailSummary.latestNodeStatuses) : undefined),
    [activeTrailSummary, graph],
  );
  const [controlState, setControlState] = useState<ExecutionControlState | undefined>(initialControlState);
  const [controlIssue, setControlIssue] = useState<string | undefined>();
  const [latestAuditEntry, setLatestAuditEntry] = useState<ExecutionControlAuditEntry | undefined>();
  const [triageFilters, setTriageFilters] = useState<Required<CollaborationTriageFilters>>(DEFAULT_TRIAGE_FILTERS);
  const collaborationStorageKey = `agent-hangar:${graph.workspaceId}:collaboration-persistence:v1`;
  const storage = useMemo(() => collaborationStorage ?? getLocalStorage(), [collaborationStorage]);
  const initialCollaborationState = useMemo(
    () => readInitialCollaborationState(activeCollaborationItems, storage, collaborationStorageKey),
    [activeCollaborationItems, collaborationStorageKey, storage],
  );
  const [collaborationState, setCollaborationState] = useState<CollaborationUiState>(initialCollaborationState);
  const runEvidenceExport = useMemo(() => (
    activeTrailSummary
      ? formatRunEvidenceExport({ trailSummary: activeTrailSummary, graphSummary: summary, graphIssues: issues })
      : undefined
  ), [activeTrailSummary, issues, summary]);
  const sortedCollaborationItems = useMemo(
    () => sortCollaborationInboxItems(collaborationState.items),
    [collaborationState.items],
  );
  const collaborationTriage = useMemo(
    () => buildCollaborationTriageView(sortedCollaborationItems, triageFilters),
    [sortedCollaborationItems, triageFilters],
  );
  const auditHistoryPreview = useMemo(() => (
    buildAuditHistoryPreview({
      auditEntries: [...activeAuditEntries, ...(controlState?.auditLog ?? []), ...collaborationState.auditEntries],
      collaborationItems: collaborationTriage.rows,
    })
  ), [activeAuditEntries, collaborationState.auditEntries, collaborationTriage.rows, controlState?.auditLog]);
  const scenarioEvidenceBundle = useMemo(() => (
    selectedScenario
      ? formatScenarioEvidenceBundle({
        scenario: selectedScenario,
        collaborationTriage,
        auditHistoryPreview,
      })
      : undefined
  ), [auditHistoryPreview, collaborationTriage, selectedScenario]);
  const workspaceManifestPreview = useMemo(() => buildWorkspaceManifestPreview({
    workspaceId: graph.workspaceId,
    providerProfiles: workspaceManifestProviders,
    modelsByProvider: workspaceManifestModelsByProvider,
    promptTemplates: workspaceManifestTemplates,
    workspaceTools: workspaceManifestTools,
    escalationPolicies: workspaceManifestEscalationPolicies,
    scenario: selectedScenario,
    graph,
    collaborationItems: sortedCollaborationItems,
  }), [
    graph,
    selectedScenario,
    sortedCollaborationItems,
    workspaceManifestEscalationPolicies,
    workspaceManifestModelsByProvider,
    workspaceManifestProviders,
    workspaceManifestTemplates,
    workspaceManifestTools,
  ]);
  const workspaceDryRun = useMemo(() => buildWorkspaceImportExportDryRun({
    mode: 'export',
    manifestPreview: workspaceManifestPreview,
  }), [workspaceManifestPreview]);
  const allowedControlActions = useMemo(
    () => (controlState ? deriveAllowedExecutionControlActions(controlState) : []),
    [controlState],
  );
  const blockingLabel = `${summary.blockingIssueCount} blocking ${summary.blockingIssueCount === 1 ? 'issue' : 'issues'}`;
  const unresolvedCollaborationCount = sortedCollaborationItems.filter((item) => item.status !== 'resolved').length;
  const urgentCollaborationCount = sortedCollaborationItems.filter((item) => item.priority === 'urgent').length;
  const demoWorkspaceRoles = useMemo(
    () => [...new Set(graph.nodes.map((node) => node.role.trim()).filter(Boolean))],
    [graph.nodes],
  );
  const collaborationTypeCounts = useMemo(() => ({
    delegation: sortedCollaborationItems.filter((item) => item.type === 'delegation').length,
    review: sortedCollaborationItems.filter((item) => item.type === 'review').length,
    broadcast: sortedCollaborationItems.filter((item) => item.type === 'broadcast').length,
    escalation: sortedCollaborationItems.filter((item) => item.type === 'escalation').length,
  }), [sortedCollaborationItems]);

  useEffect(() => {
    setControlState(initialControlState);
    setControlIssue(undefined);
    setLatestAuditEntry(undefined);
  }, [initialControlState]);

  useEffect(() => {
    setCollaborationState(initialCollaborationState);
    setTriageFilters(DEFAULT_TRIAGE_FILTERS);
  }, [initialCollaborationState]);

  const handleCopyRunEvidence = () => {
    if (!runEvidenceExport) {
      return;
    }
    const copy = copyRunEvidence ?? ((markdown: string) => navigator.clipboard?.writeText(markdown));
    void Promise.resolve(copy(runEvidenceExport.markdown)).then(() => setCopyState('copied'));
  };
  const handleCopyAuditHistory = () => {
    const copy = copyAuditHistory ?? ((markdown: string) => navigator.clipboard?.writeText(markdown));
    void Promise.resolve(copy(auditHistoryPreview.markdown)).then(() => setAuditCopyState('copied'));
  };
  const handleCopyScenarioEvidenceBundle = () => {
    if (!scenarioEvidenceBundle) {
      return;
    }
    const copy = copyScenarioEvidenceBundle ?? ((markdown: string) => navigator.clipboard?.writeText(markdown));
    void Promise.resolve(copy(scenarioEvidenceBundle.markdown)).then(() => setScenarioBundleCopyState('copied'));
  };
  const handleCopyWorkspaceManifest = () => {
    const copy = copyWorkspaceManifest ?? ((markdown: string) => navigator.clipboard?.writeText(markdown));
    void Promise.resolve(copy(workspaceManifestPreview.markdown)).then(() => setWorkspaceManifestCopyState('copied'));
  };
  const handleCopyWorkspaceDryRun = () => {
    const copy = copyWorkspaceDryRun ?? ((markdown: string) => navigator.clipboard?.writeText(markdown));
    void Promise.resolve(copy(workspaceDryRun.markdown)).then(() => setWorkspaceDryRunCopyState('copied'));
  };
  const handleControlAction = (action: ExecutionControlAction) => {
    if (!controlState) {
      return;
    }
    const result = applyExecutionControlAction(controlState, action, {
      actorId: 'operator-local-demo',
      clock: () => '2026-05-23T10:08:00.000Z',
      reason: 'Local deterministic demo control.',
    });
    setControlState(result.state);
    if (result.ok) {
      setLatestAuditEntry(result.auditEntry);
      setControlIssue(undefined);
    } else {
      setLatestAuditEntry(undefined);
      setControlIssue(result.issue.message);
    }
  };
  const handleCollaborationAction = (itemId: string, action: CollaborationMutationAction) => {
    const result = applyCollaborationInboxMutation(collaborationState.items, {
      action,
      itemId,
      actorId: collaborationActorId,
      clock: collaborationClock,
      reason: action === 'resolve' ? 'Resolved from local collaboration inbox.' : undefined,
      note: action === 'acknowledge' ? 'Acknowledged from local collaboration inbox.' : undefined,
      existingAuditEntries: collaborationState.auditEntries,
      auditHistoryEntries: controlState?.auditLog ?? [],
    });

    if (!result.ok) {
      setCollaborationState((current) => ({
        ...current,
        issueMessage: result.issue?.message ?? 'Collaboration mutation failed.',
        statusMessage: undefined,
      }));
      return;
    }

    const persistenceAvailable = persistCollaborationState(storage, collaborationStorageKey, result.persistencePayload);
    setCollaborationState({
      items: result.items,
      auditEntries: result.auditEntries,
      statusMessage: `${formatActionPastTense(action)} ${itemId}.${persistenceAvailable ? '' : ' Local persistence is unavailable.'}`,
      issueMessage: undefined,
    });
  };
  const handleTriageFilterChange = <Key extends keyof CollaborationTriageFilters>(
    key: Key,
    value: Required<CollaborationTriageFilters>[Key],
  ) => {
    setTriageFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="panel execution-graph" aria-labelledby="execution-graph-heading">
      <div className="panel-heading">
        <div>
          <h2 id="execution-graph-heading">Execution graph</h2>
          <p>Local workspace preview for agent roles, task dependencies, handoffs, and deterministic runnable-node planning.</p>
        </div>
        <span className="graph-icon" aria-hidden="true"><GitBranch size={20} /></span>
      </div>

      {demoScenarios && demoScenarios.length > 0 ? (
        <div className="scenario-selector">
          <label htmlFor="local-demo-scenario">Local demo scenario</label>
          <select
            id="local-demo-scenario"
            aria-label="Local demo scenario"
            value={selectedScenario?.id ?? selectedScenarioId}
            onChange={(event) => setSelectedScenarioId(event.target.value)}
          >
            {demoScenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
            ))}
          </select>
          {selectedScenario ? <p>{selectedScenario.description}</p> : null}
        </div>
      ) : null}

      <div className="summary-grid graph-summary" aria-label="Execution graph summary">
        <span>{summary.nodeCount} {summary.nodeCount === 1 ? 'node' : 'nodes'}</span>
        <span>{summary.edgeCount} {summary.edgeCount === 1 ? 'edge' : 'edges'}</span>
        <span>{blockingLabel}</span>
        <span>{summary.statusCounts.completed} completed</span>
        <span>{summary.statusCounts.queued + summary.statusCounts.runnable} queued</span>
      </div>

      <div className="graph-columns">
        <div>
          <h3>Preview</h3>
          <ol className="graph-node-list">
            {graph.nodes.map((node) => (
              <li key={node.id}>
                <strong>{node.title}</strong>
                <small>{node.role} · {node.status}</small>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h3>Next runnable</h3>
          {summary.nextRunnableNodeIds.length > 0 ? (
            <ul className="tag-row" aria-label="Next runnable nodes">
              {summary.nextRunnableNodeIds.map((nodeId) => <li className="tag" key={nodeId}>{nodeId}</li>)}
            </ul>
          ) : (
            <p className="empty-state" role="status">No runnable nodes are ready.</p>
          )}
        </div>
      </div>

      {sortedCollaborationItems.length > 0 ? (
        <section className="demo-workspace-summary" aria-labelledby="demo-workspace-summary-heading">
          <div className="trail-heading">
            <div>
              <h3 id="demo-workspace-summary-heading">Demo workspace summary</h3>
              <p>{demoWorkspaceRoles.length} {demoWorkspaceRoles.length === 1 ? 'role' : 'roles'}</p>
            </div>
          </div>
          <div className="summary-grid trail-summary" aria-label="Demo workspace coordination summary">
            <span>{demoWorkspaceRoles.join(', ')}</span>
            <span>
              delegation {collaborationTypeCounts.delegation} · review {collaborationTypeCounts.review} · broadcast {collaborationTypeCounts.broadcast} · escalation {collaborationTypeCounts.escalation}
            </span>
          </div>
          <div className="control-audit-preview">
            <strong>Next operator action</strong>
            <p>{auditHistoryPreview.nextActionHints[0]}</p>
          </div>
        </section>
      ) : null}

      {issues.length > 0 ? (
        <ul className="issue-list" aria-label="Execution graph issues">
          {issues.map((issue) => (
            <li key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}

      {activeTrailSummary ? (
        <div className="trail-preview" aria-labelledby="execution-trail-heading">
          <div className="trail-heading">
            <h3 id="execution-trail-heading">Local execution trail</h3>
            <div className="summary-grid trail-summary" aria-label="Execution trail summary">
              <span>{activeTrailSummary.eventCount} {activeTrailSummary.eventCount === 1 ? 'event' : 'events'}</span>
              <span>{activeTrailSummary.issueCount} trail {activeTrailSummary.issueCount === 1 ? 'issue' : 'issues'}</span>
              <span>{activeTrailSummary.eventStatusCounts.accepted} accepted</span>
              <span>{activeTrailSummary.latestNodeStatuses
                ? Object.values(activeTrailSummary.latestNodeStatuses).filter((status) => status === 'completed').length
                : 0} completed</span>
            </div>
          </div>
          <ol className="trail-list" aria-label="Local execution timeline">
            {activeTrailSummary.timeline.map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.occurredAt}>{entry.occurredAt.slice(11, 16)}</time>
                <div>
                  <strong>{entry.title}</strong>
                  <small>{entry.kind} · {entry.status}</small>
                  {entry.note ? <p>{entry.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {activeTrailSummary && controlState ? (
        <section className="execution-controls" aria-labelledby="execution-controls-heading">
          <div className="trail-heading">
            <div>
              <h3 id="execution-controls-heading">Guarded execution controls</h3>
              <p>{controlState.nodeId ?? controlState.runId} · {controlState.status}</p>
            </div>
            <div className="tag-row" aria-label="Allowed guarded actions">
              {allowedControlActions.length > 0 ? allowedControlActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleControlAction(action)}
                  aria-label={`${formatActionLabel(action)} local run ${controlState.nodeId ?? controlState.runId}`}
                >
                  {formatActionLabel(action)}
                </button>
              )) : <span className="tag muted">No actions</span>}
            </div>
          </div>
          {allowedControlActions.length === 0 ? (
            <p className="empty-state">No guarded actions are available for this local state.</p>
          ) : null}
          {latestAuditEntry ? (
            <div className="control-audit-preview">
              <p role="status">{controlState.nodeId ?? controlState.runId} is {controlState.status}.</p>
              <small>
                {latestAuditEntry.actorId} · {latestAuditEntry.action} · {latestAuditEntry.fromStatus} -&gt; {latestAuditEntry.toStatus} · {latestAuditEntry.occurredAt}
              </small>
            </div>
          ) : null}
          {controlIssue ? <p className="form-error" role="alert">{controlIssue}</p> : null}
        </section>
      ) : null}

      <section className="collaboration-inbox" aria-labelledby="collaboration-inbox-heading">
        <div className="trail-heading">
          <div>
            <h3 id="collaboration-inbox-heading">Collaboration inbox</h3>
            <div className="summary-grid trail-summary" aria-label="Collaboration inbox summary">
              <span>{collaborationTriage.compact.visibleCount} visible</span>
              <span>{collaborationTriage.compact.hiddenCount} hidden</span>
              <span>{collaborationTriage.compact.highPriorityUnresolvedCount} high-priority unresolved</span>
              <span>{collaborationTriage.compact.unresolvedEscalationCount} unresolved {collaborationTriage.compact.unresolvedEscalationCount === 1 ? 'escalation' : 'escalations'}</span>
              <span>{unresolvedCollaborationCount} unresolved</span>
              <span>{urgentCollaborationCount} urgent</span>
            </div>
          </div>
        </div>
        <div className="triage-filter-grid" aria-label="Collaboration triage filters">
          <label>
            Status
            <select
              aria-label="Collaboration status filter"
              value={triageFilters.status}
              onChange={(event) => handleTriageFilterChange('status', event.target.value as CollaborationTriageStatusFilter)}
            >
              <option value="unresolved">Unresolved</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </label>
          <label>
            Priority
            <select
              aria-label="Collaboration priority filter"
              value={triageFilters.priority}
              onChange={(event) => handleTriageFilterChange('priority', event.target.value as CollaborationTriagePriorityFilter)}
            >
              <option value="all">All</option>
              <option value="high">High and urgent</option>
            </select>
          </label>
          <label>
            Type
            <select
              aria-label="Collaboration type filter"
              value={triageFilters.type}
              onChange={(event) => handleTriageFilterChange('type', event.target.value as CollaborationTriageTypeFilter)}
            >
              <option value="all">All</option>
              <option value="delegation">Delegation</option>
              <option value="review">Review</option>
              <option value="broadcast">Broadcast</option>
              <option value="escalation">Escalation</option>
            </select>
          </label>
          <label>
            Search
            <input
              aria-label="Search collaboration text"
              type="search"
              value={triageFilters.query}
              onChange={(event) => handleTriageFilterChange('query', event.target.value)}
            />
          </label>
        </div>
        {collaborationTriage.compact.activeFilterLabels.length > 0 ? (
          <ul className="tag-row active-filter-list" aria-label="Active collaboration filters">
            {collaborationTriage.compact.activeFilterLabels.map((label) => <li className="tag" key={label}>{label}</li>)}
          </ul>
        ) : null}
        <ul className="issue-list" aria-label="Filtered collaboration next actions">
          {collaborationTriage.compact.nextActionHints.map((hint) => <li key={hint}>{hint}</li>)}
        </ul>
        {collaborationTriage.rows.length > 0 ? (
          <ol className="trail-list" aria-label="Collaboration inbox items">
            {collaborationTriage.rows.slice(0, 4).map((item) => (
              <li key={item.id}>
                <time dateTime={item.createdAt}>{item.createdAt.slice(11, 16)}</time>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.type} · {item.priority} · {item.status}{item.assignedAgentId ? ` · ${item.assignedAgentId}` : ''}</small>
                  {item.body ? <p>{item.body}</p> : null}
                  {item.note ? <p>{item.note}</p> : null}
                  {item.status !== 'resolved' ? (
                    <div className="tag-row" aria-label={`Collaboration actions for ${item.id}`}>
                      {item.status === 'open' ? (
                        <button
                          type="button"
                          onClick={() => handleCollaborationAction(item.id, 'acknowledge')}
                          aria-label={`Acknowledge collaboration item ${item.id}`}
                        >
                          Acknowledge
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleCollaborationAction(item.id, 'resolve')}
                        aria-label={`Resolve collaboration item ${item.id}`}
                      >
                        Resolve
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">No collaboration inbox items are pending.</p>
        )}
        {collaborationState.statusMessage ? <p className="copy-status" role="status">{collaborationState.statusMessage}</p> : null}
        {collaborationState.issueMessage ? <p className="form-error" role="alert">{collaborationState.issueMessage}</p> : null}
      </section>

      <section className="audit-history-preview" aria-labelledby="audit-history-heading">
        <div className="trail-heading">
          <div>
            <h3 id="audit-history-heading">Audit history preview</h3>
            <div className="summary-grid trail-summary" aria-label="Audit history summary">
              <span>{auditHistoryPreview.counts.auditEntries} audit {auditHistoryPreview.counts.auditEntries === 1 ? 'entry' : 'entries'}</span>
              <span>{auditHistoryPreview.counts.collaborationItems} collaboration {auditHistoryPreview.counts.collaborationItems === 1 ? 'item' : 'items'}</span>
              <span>{auditHistoryPreview.counts.unresolvedEscalations} unresolved {auditHistoryPreview.counts.unresolvedEscalations === 1 ? 'escalation' : 'escalations'}</span>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={handleCopyAuditHistory} aria-label="Copy audit history preview" title="Copy audit history preview">
            <Clipboard size={18} aria-hidden="true" />
          </button>
        </div>
        <ul className="issue-list" aria-label="Audit history next actions">
          {auditHistoryPreview.nextActionHints.map((hint) => <li key={hint}>{hint}</li>)}
        </ul>
        <pre className="run-evidence-markdown" aria-label="Audit history Markdown preview">
          {auditHistoryPreview.markdown.split('\n').map((line, index) => (
            <code key={`${index}-${line}`}>{line || ' '}</code>
          ))}
        </pre>
        {auditCopyState === 'copied' ? <p className="copy-status" role="status">Copied audit history preview.</p> : null}
      </section>

      {scenarioEvidenceBundle ? (
        <section className="scenario-evidence-bundle-preview" aria-labelledby="scenario-evidence-bundle-heading">
          <div className="trail-heading">
            <div>
              <h3 id="scenario-evidence-bundle-heading">Scenario evidence bundle</h3>
              <div className="summary-grid trail-summary" aria-label="Scenario evidence bundle metadata">
                <span>{scenarioEvidenceBundle.schemaVersion}</span>
                <span>{scenarioEvidenceBundle.scenario.id}</span>
                <span>{scenarioEvidenceBundle.collaboration.unresolvedEscalationCount} unresolved {scenarioEvidenceBundle.collaboration.unresolvedEscalationCount === 1 ? 'escalation' : 'escalations'}</span>
              </div>
            </div>
            <button className="icon-button" type="button" onClick={handleCopyScenarioEvidenceBundle} aria-label="Copy scenario evidence bundle" title="Copy scenario evidence bundle">
              <Clipboard size={18} aria-hidden="true" />
            </button>
          </div>
          <pre className="run-evidence-markdown" aria-label="Scenario evidence bundle Markdown preview">
            {scenarioEvidenceBundle.markdown.split('\n').map((line, index) => (
              <code key={`${index}-${line}`}>{line || ' '}</code>
            ))}
          </pre>
          {scenarioBundleCopyState === 'copied' ? <p className="copy-status" role="status">Copied scenario evidence bundle.</p> : null}
        </section>
      ) : null}

      <section className="workspace-manifest-preview" aria-labelledby="workspace-manifest-heading">
        <div className="trail-heading">
          <div>
            <h3 id="workspace-manifest-heading">Workspace portability manifest preview</h3>
            <div className="summary-grid trail-summary" aria-label="Workspace portability manifest metadata">
              <span>{workspaceManifestPreview.schemaVersion}</span>
              <span>{workspaceManifestPreview.source.mode}</span>
              <span>{workspaceManifestPreview.summary.status}</span>
              <span>{workspaceManifestPreview.providers.total} {workspaceManifestPreview.providers.total === 1 ? 'provider' : 'providers'}</span>
              <span>{workspaceManifestPreview.collaboration.unresolvedEscalationCount} unresolved {workspaceManifestPreview.collaboration.unresolvedEscalationCount === 1 ? 'escalation' : 'escalations'}</span>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={handleCopyWorkspaceManifest} aria-label="Copy workspace portability manifest preview" title="Copy workspace portability manifest preview">
            <Clipboard size={18} aria-hidden="true" />
          </button>
        </div>
        {workspaceManifestPreview.blockers.length > 0 ? (
          <ul className="issue-list" aria-label="Workspace portability blockers">
            {workspaceManifestPreview.blockers.slice(0, 4).map(renderWorkspaceManifestBlocker)}
          </ul>
        ) : null}
        <pre className="run-evidence-markdown" aria-label="Workspace portability manifest Markdown preview">
          {workspaceManifestPreview.markdown.split('\n').map((line, index) => (
            <code key={`${index}-${line}`}>{line || ' '}</code>
          ))}
        </pre>
        {workspaceManifestCopyState === 'copied' ? <p className="copy-status" role="status">Copied workspace portability manifest preview.</p> : null}
      </section>

      {selectedScenario ? (
        <section className="workspace-dry-run-preview" aria-labelledby="workspace-dry-run-heading">
          <div className="trail-heading">
            <div>
              <h3 id="workspace-dry-run-heading">Workspace import/export dry run</h3>
              <div className="summary-grid trail-summary" aria-label="Workspace import/export dry-run metadata">
                <span>{workspaceDryRun.schemaVersion}</span>
                <span>{workspaceDryRun.mode}</span>
                <span>{workspaceDryRun.source.mode}</span>
                <span>{workspaceDryRun.source.workspaceId}</span>
                <span>{workspaceDryRun.summary.acceptedFileCount} accepted {workspaceDryRun.summary.acceptedFileCount === 1 ? 'file' : 'files'}</span>
              </div>
            </div>
            <button className="icon-button" type="button" onClick={handleCopyWorkspaceDryRun} aria-label="Copy workspace import/export dry run" title="Copy workspace import/export dry run">
              <Clipboard size={18} aria-hidden="true" />
            </button>
          </div>
          <pre className="run-evidence-markdown" aria-label="Workspace import/export dry-run Markdown preview">
            {workspaceDryRun.markdown.split('\n').map((line, index) => (
              <code key={`${index}-${line}`}>{line || ' '}</code>
            ))}
          </pre>
          <p className="copy-status">{workspaceDryRun.decisionNotes[1]}</p>
          {workspaceDryRunCopyState === 'copied' ? <p className="copy-status" role="status">Copied workspace import/export dry run.</p> : null}
        </section>
      ) : null}

      {runEvidenceExport ? (
        <div className="run-evidence-preview" aria-labelledby="run-evidence-heading">
          <div className="trail-heading">
            <div>
              <h3 id="run-evidence-heading">Run evidence export</h3>
              <div className="summary-grid trail-summary" aria-label="Run evidence export metadata">
                <span>{runEvidenceExport.schemaVersion}</span>
                <span>{runEvidenceExport.workspaceId}</span>
              </div>
            </div>
            <button className="icon-button" type="button" onClick={handleCopyRunEvidence} aria-label="Copy run evidence export" title="Copy run evidence export">
              <Clipboard size={18} aria-hidden="true" />
            </button>
          </div>
          <pre className="run-evidence-markdown" aria-label="Run evidence export preview">
            {runEvidenceExport.markdown.split('\n').map((line, index) => (
              <code key={`${index}-${line}`}>{line || ' '}</code>
            ))}
          </pre>
          {copyState === 'copied' ? <p className="copy-status" role="status">Copied run evidence export.</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function createInitialControlState(
  graph: ExecutionGraph,
  latestNodeStatuses: Record<string, ExecutionNodeStatus>,
): ExecutionControlState | undefined {
  const candidates = graph.nodes.map((node) => {
    const status = toControlStatus(latestNodeStatuses[node.id] ?? node.status);
    return {
      node,
      status,
      allowedActions: deriveAllowedExecutionControlActions({ status }),
    };
  });
  const selected = candidates.find((candidate) => candidate.allowedActions.length > 0) ?? candidates[0];
  if (!selected) {
    return undefined;
  }
  return {
    schemaVersion: 'agent-hangar.execution-control-state.v1',
    runId: `${graph.workspaceId}:${selected.node.id}`,
    nodeId: selected.node.id,
    status: selected.status,
    auditLog: [],
  };
}

function toControlStatus(status: ExecutionNodeStatus): ExecutionControlStatus {
  return status;
}

function renderWorkspaceManifestBlocker(blocker: WorkspaceManifestPreview['blockers'][number]) {
  return <li key={`${blocker.code}-${blocker.source}-${blocker.message}`}>{blocker.message}</li>;
}

function formatActionLabel(action: ExecutionControlAction): string {
  return action.slice(0, 1).toUpperCase() + action.slice(1);
}

function formatActionPastTense(action: CollaborationMutationAction): string {
  return action === 'acknowledge' ? 'Acknowledged' : 'Resolved';
}

function readInitialCollaborationState(
  collaborationItems: CollaborationInboxRecord[],
  storage: CollaborationStorage | undefined,
  storageKey: string,
): CollaborationUiState {
  const persisted = readPersistedCollaborationState(storage, storageKey);
  return persisted ?? {
    items: sortCollaborationInboxItems(collaborationItems),
    auditEntries: [],
  };
}

function readPersistedCollaborationState(
  storage: CollaborationStorage | undefined,
  storageKey: string,
): CollaborationUiState | undefined {
  if (!storage) {
    return undefined;
  }

  try {
    const rawPayload = storage.getItem(storageKey);
    if (!rawPayload) {
      return undefined;
    }
    const payload = JSON.parse(rawPayload) as {
      schemaVersion?: string;
      collaborationItems?: CollaborationInboxRecord[];
      mutationAuditEntries?: CollaborationMutationAuditEntry[];
    };
    if (
      payload.schemaVersion !== 'agent-hangar.collaboration-persistence.v1'
      || !Array.isArray(payload.collaborationItems)
      || !Array.isArray(payload.mutationAuditEntries)
    ) {
      return undefined;
    }
    return {
      items: sortCollaborationInboxItems(payload.collaborationItems),
      auditEntries: payload.mutationAuditEntries,
    };
  } catch {
    return undefined;
  }
}

function persistCollaborationState(
  storage: CollaborationStorage | undefined,
  storageKey: string,
  payload: unknown,
): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function getLocalStorage(): CollaborationStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
