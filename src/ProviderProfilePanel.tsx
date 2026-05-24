import React, { useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import {
  evaluateProviderDiscoveryAdapterShell,
  type ProviderDiscoveryAdapterShellResult,
} from './harness/providerDiscoveryAdapterShell';
import {
  buildProviderDiscoveryDryRun,
  summarizeDiscoveryDryRun,
  type ProviderDiscoveryFixture,
  type ProviderDiscoveryDryRunPreview,
  type ProviderDiscoveryDryRunSeverity,
} from './harness/providerDiscoveryDryRun';
import {
  createProfileFromDraft,
  deleteProviderProfileById,
  draftFromProfile,
  emptyProviderProfileDraft,
  summarizeProviderProfiles,
  updateProfileFromDraft,
  type ProviderProfileDraft,
} from './harness/providerProfileFlow';
import { type NormalizedModel, type ProviderKind } from './harness/providerCatalog';
import { type ProviderProfile, type ProviderProfileClock, type ProviderProfileCrypto } from './harness/providerProfiles';
import { deriveProviderShellState } from './harness/shellStates';

const providerKinds: ProviderKind[] = ['openai', 'anthropic', 'gemini', 'openai-compatible'];

export interface ProviderProfilePanelProps {
  crypto: ProviderProfileCrypto;
  clock: ProviderProfileClock;
  now: string;
  initialProfiles: ProviderProfile[];
  modelsByProvider: Record<string, NormalizedModel[]>;
  discoveryFixturesByProvider?: Record<string, ProviderDiscoveryFixture | unknown>;
}

export function ProviderProfilePanel({ crypto, clock, now, initialProfiles, modelsByProvider, discoveryFixturesByProvider }: ProviderProfilePanelProps) {
  const [profiles, setProfiles] = useState<ProviderProfile[]>(initialProfiles);
  const [draft, setDraft] = useState<ProviderProfileDraft>(emptyProviderProfileDraft());
  const [editingId, setEditingId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const summaries = useMemo(() => summarizeProviderProfiles(profiles, modelsByProvider, now), [profiles, modelsByProvider, now]);
  const shellState = useMemo(
    () => deriveProviderShellState({ profiles, modelsByProvider, now }),
    [modelsByProvider, now, profiles],
  );
  const discoveryPreviews = useMemo(
    () => discoveryFixturesByProvider
      ? buildProviderDiscoveryDryRun({
        profiles,
        fixturesByProvider: discoveryFixturesByProvider,
        now,
        staleAfterMs: 48 * 60 * 60 * 1000,
      })
      : [],
    [discoveryFixturesByProvider, now, profiles],
  );
  const discoverySummary = useMemo(() => summarizeDiscoveryDryRun(discoveryPreviews), [discoveryPreviews]);
  const adapterShellPreviews = useMemo(
    () => discoveryFixturesByProvider
      ? profiles.map((profile) => evaluateProviderDiscoveryAdapterShell({
        profile,
        fixture: discoveryFixturesByProvider[profile.id],
      }))
      : [],
    [discoveryFixturesByProvider, profiles],
  );

  function updateDraft(field: keyof ProviderProfileDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function startCreate() {
    setEditingId(undefined);
    setDraft(emptyProviderProfileDraft());
    setError(undefined);
  }

  function startEdit(profile: ProviderProfile) {
    setEditingId(profile.id);
    setDraft(draftFromProfile(profile));
    setError(undefined);
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    try {
      if (editingId) {
        setProfiles((current) => current.map((profile) => (
          profile.id === editingId ? updateProfileFromDraft(profile, draft, crypto, clock) : profile
        )));
      } else {
        const profile = createProfileFromDraft(draft, crypto, clock);
        if (profiles.some((existing) => existing.id === profile.id)) {
          throw new Error('Provider profile id already exists');
        }
        setProfiles((current) => [...current, profile]);
      }
      startCreate();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save provider profile');
    }
  }

  function deleteProfile(profile: ProviderProfile) {
    setProfiles((current) => deleteProviderProfileById(current, profile.id));
    if (editingId === profile.id) {
      startCreate();
    }
  }

  return (
    <section className="panel provider-manager" aria-labelledby="provider-profile-heading">
      <div className="panel-heading">
        <div>
          <h2 id="provider-profile-heading">Provider profiles</h2>
          <p>Local profile drafts use demo-only encryption until Tauri secure storage is wired in.</p>
        </div>
        <button className="icon-button" type="button" onClick={startCreate} aria-label="Create new provider profile">
          <Plus size={18} />
        </button>
      </div>

      <form className="profile-form" onSubmit={saveProfile}>
        <label>
          Profile ID
          <input value={draft.id} onChange={(event) => updateDraft('id', event.target.value)} disabled={Boolean(editingId)} />
        </label>
        <label>
          Provider kind
          <select value={draft.kind} onChange={(event) => updateDraft('kind', event.target.value)}>
            {providerKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
        </label>
        <label>
          Display name
          <input value={draft.displayName} onChange={(event) => updateDraft('displayName', event.target.value)} />
        </label>
        <label>
          Base URL
          <input value={draft.baseUrl} onChange={(event) => updateDraft('baseUrl', event.target.value)} />
        </label>
        <label className="wide-field">
          API key
          <input
            value={draft.apiKey ?? ''}
            onChange={(event) => updateDraft('apiKey', event.target.value)}
            type="password"
            autoComplete="off"
          />
        </label>
        <div className="form-actions">
          <button type="submit">
            <Save size={16} />
            Save profile
          </button>
          {editingId ? (
            <button type="button" onClick={startCreate}>
              <X size={16} />
              Cancel
            </button>
          ) : null}
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>

      <div className="shell-state-banner" role="status" aria-live="polite">
        <strong>{shellState.label}</strong>
        <span>{shellState.summary}</span>
      </div>
      <p className="shell-guidance">{shellState.guidance}</p>

      <div className="profile-list" aria-label="Provider shell states">
        {summaries.length === 0 ? <p className="empty-state">No provider profiles yet.</p> : null}
        {summaries.map((summary) => {
          const profile = profiles.find((item) => item.id === summary.id);
          if (!profile) {
            return null;
          }
          return (
            <article className="card provider-card profile-card" key={summary.id} data-testid={`provider-profile-${summary.id}`}>
              <span className={`dot ${summary.health.status}`} />
              <div className="card-body">
                <div className="card-title">
                  <strong>{summary.displayName}</strong>
                  <small>{summary.kind} · {summary.modelCount} models</small>
                </div>
                <div className="summary-grid">
                  <span>Key: {summary.keyStatus}</span>
                  <span><RefreshCw size={14} /> {summary.refreshStatus}</span>
                </div>
                <small className="health-detail">{summary.health.detail}</small>
                <div className="tag-row">
                  {summary.capabilities.tags.length > 0
                    ? summary.capabilities.tags.map((tag) => <span className="tag" key={tag}>{tag} {summary.capabilities.counts[tag]}</span>)
                    : <span className="tag muted">no model capabilities</span>}
                </div>
              </div>
              <div className="card-actions">
                <button className="icon-button" type="button" onClick={() => startEdit(profile)} aria-label={`Edit ${summary.displayName}`}>
                  <Pencil size={16} />
                </button>
                <button className="icon-button danger" type="button" onClick={() => deleteProfile(profile)} aria-label={`Delete ${summary.displayName}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {discoveryFixturesByProvider ? (
        <>
          <ProviderDiscoveryDryRunRegion previews={discoveryPreviews} summaryText={formatDiscoverySummary(discoverySummary)} />
          <ProviderDiscoveryAdapterShellRegion
            previews={adapterShellPreviews}
            summaryText={formatAdapterShellSummary(adapterShellPreviews)}
          />
        </>
      ) : null}
    </section>
  );
}

function ProviderDiscoveryDryRunRegion({ previews, summaryText }: { previews: ProviderDiscoveryDryRunPreview[]; summaryText: string }) {
  return (
    <section className="provider-discovery-preview" aria-label="Provider discovery dry-run preview">
      <div className="trail-heading">
        <div>
          <h3 id="provider-discovery-preview-heading">Provider discovery dry-run</h3>
          <p>{summaryText}</p>
        </div>
      </div>
      <div className="profile-list" aria-label="Provider discovery dry-run summaries">
        {previews.map((preview) => (
          <article className="card provider-card profile-card" key={preview.provider.id}>
            <span className={`dot ${preview.status}`} />
            <div className="card-body">
              <div className="card-title">
                <strong>{preview.provider.name}</strong>
                <small>{preview.status} · {preview.modelCount} {preview.modelCount === 1 ? 'model' : 'models'}</small>
              </div>
              <small className="health-detail">{preview.guidance}</small>
              {preview.issues.length > 0 ? (
                <ul className="issue-list">
                  {preview.issues.map((issue) => <li key={`${preview.provider.id}-${issue.code}`}>{issue.message}</li>)}
                </ul>
              ) : null}
              <div className="tag-row">
                {preview.capabilities.tags.length > 0
                  ? preview.capabilities.tags.map((tag) => <span className="tag" key={tag}>{tag} {preview.capabilities.counts[tag]}</span>)
                  : <span className="tag muted">no model capabilities</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProviderDiscoveryAdapterShellRegion({ previews, summaryText }: { previews: ProviderDiscoveryAdapterShellResult[]; summaryText: string }) {
  return (
    <section className="provider-discovery-adapter-preview" aria-label="Provider discovery adapter shell preview">
      <div className="trail-heading">
        <div>
          <h3 id="provider-discovery-adapter-preview-heading">Provider discovery adapter shell</h3>
          <p>{summaryText}</p>
        </div>
      </div>
      <div className="profile-list" aria-label="Provider discovery adapter shell summaries">
        {previews.map((preview) => (
          <article className="card provider-card profile-card" key={preview.provider.id}>
            <span className={`dot ${preview.status}`} />
            <div className="card-body">
              <div className="card-title">
                <strong>{preview.provider.name}</strong>
                <small>{preview.status} · {preview.modelCount} {preview.modelCount === 1 ? 'model' : 'models'}</small>
              </div>
              {preview.issues.length > 0 ? (
                <ul className="issue-list">
                  {preview.issues.map((issue) => (
                    <li key={`${preview.provider.id}-${issue.code}`}>
                      {issue.message}
                      <small>{issue.nextAction}</small>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="tag-row">
                {preview.capabilities.tags.length > 0
                  ? preview.capabilities.tags.map((tag) => <span className="tag" key={tag}>{tag} {preview.capabilities.counts[tag]}</span>)
                  : <span className="tag muted">no model capabilities</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDiscoverySummary(summary: ReturnType<typeof summarizeDiscoveryDryRun>): string {
  const readyCount = summary.countsByStatus.ready ?? 0;
  const warningCount = severityCount(summary.countsBySeverity, 'warning');
  const errorCount = severityCount(summary.countsBySeverity, 'error');
  return `${readyCount} ready · ${warningCount} warning · ${errorCount} error`;
}

function formatAdapterShellSummary(previews: ProviderDiscoveryAdapterShellResult[]): string {
  const readyCount = previews.filter((preview) => preview.status === 'ready').length;
  const blockedCount = previews.filter((preview) => preview.status === 'blocked').length;
  const issueCount = previews.reduce((total, preview) => total + preview.issueCount, 0);
  return `${readyCount} ready · ${blockedCount} blocked · ${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}`;
}

function severityCount(counts: Partial<Record<ProviderDiscoveryDryRunSeverity, number>>, severity: ProviderDiscoveryDryRunSeverity): number {
  return counts[severity] ?? 0;
}
