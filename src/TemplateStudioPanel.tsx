import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Save, X } from 'lucide-react';
import {
  createPromptTemplate,
  createTemplateFromPreset,
  promptTemplateRoles,
  rolePresets,
  updatePromptTemplate,
  validatePromptTemplate,
  type PromptTemplateClock,
  type PromptTemplateIdSource,
  type PromptTemplateRecord,
  type PromptTemplateRole,
} from './harness/promptTemplates';

export interface TemplateProviderOption {
  id: string;
  label: string;
  modelIds: string[];
  secretPreview?: string;
}

export interface EscalationPolicyOption {
  id: string;
  label: string;
}

export interface TemplateStudioPanelProps {
  clock: PromptTemplateClock;
  idSource: PromptTemplateIdSource;
  initialTemplates: PromptTemplateRecord[];
  providerOptions: TemplateProviderOption[];
  escalationPolicies: EscalationPolicyOption[];
}

interface TemplateDraft {
  id: string;
  title: string;
  role: string;
  body: string;
  providerProfileId: string;
  modelId: string;
  escalationPolicyId: string;
  policyBindings: string;
}

export function TemplateStudioPanel({
  clock,
  idSource,
  initialTemplates,
  providerOptions,
  escalationPolicies,
}: TemplateStudioPanelProps) {
  const [templates, setTemplates] = useState<PromptTemplateRecord[]>(initialTemplates);
  const [editingId, setEditingId] = useState<string | undefined>(initialTemplates[0]?.id);
  const [draft, setDraft] = useState<TemplateDraft>(() => (
    initialTemplates[0] ? draftFromTemplate(initialTemplates[0]) : emptyDraft(providerOptions, escalationPolicies)
  ));
  const selectedProvider = useMemo(
    () => providerOptions.find((provider) => provider.id === draft.providerProfileId),
    [draft.providerProfileId, providerOptions],
  );

  function updateDraft(field: keyof TemplateDraft, value: string) {
    setDraft((current) => {
      if (field === 'providerProfileId') {
        const provider = providerOptions.find((item) => item.id === value);
        return { ...current, providerProfileId: value, modelId: provider?.modelIds[0] ?? '' };
      }
      return { ...current, [field]: value };
    });
  }

  function createFromPreset(role: PromptTemplateRole) {
    const provider = providerOptions[0];
    const template = createTemplateFromPreset(role, {
      id: idSource,
      clock,
      providerProfileId: provider?.id ?? '',
      modelId: provider?.modelIds[0] ?? '',
      escalationPolicyId: escalationPolicies[0]?.id ?? '',
    });
    setTemplates((current) => [...current, template]);
    setEditingId(template.id);
    setDraft(draftFromTemplate(template));
  }

  function startEdit(template: PromptTemplateRecord) {
    setEditingId(template.id);
    setDraft(draftFromTemplate(template));
  }

  function startCreate() {
    setEditingId(undefined);
    setDraft(emptyDraft(providerOptions, escalationPolicies));
  }

  function saveTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const policyBindings = parsePolicyBindings(draft.policyBindings);

    if (editingId) {
      setTemplates((current) => current.map((template) => (
        template.id === editingId
          ? updatePromptTemplate(template, {
              title: draft.title,
              role: draft.role,
              body: draft.body,
              providerProfileId: draft.providerProfileId,
              modelId: draft.modelId,
              escalationPolicyId: draft.escalationPolicyId,
              policyBindings,
            }, clock)
          : template
      )));
      return;
    }

    const template = createPromptTemplate({
      id: draft.id || idSource(),
      title: draft.title,
      role: draft.role,
      body: draft.body,
      providerProfileId: draft.providerProfileId,
      modelId: draft.modelId,
      escalationPolicyId: draft.escalationPolicyId,
      policyBindings,
    }, clock);
    setTemplates((current) => [...current, template]);
    setEditingId(template.id);
    setDraft(draftFromTemplate(template));
  }

  return (
    <section className="panel template-studio" aria-labelledby="template-studio-heading">
      <div className="panel-heading">
        <div>
          <h2 id="template-studio-heading">Template studio</h2>
          <p>Local prompt records keep role, model binding, variables, escalation policy, and version status deterministic.</p>
        </div>
        <button className="icon-button" type="button" onClick={startCreate} aria-label="Create blank template">
          <Plus size={18} />
        </button>
      </div>

      <div className="preset-row" aria-label="Role presets">
        {rolePresets.map((preset) => (
          <button type="button" key={preset.role} onClick={() => createFromPreset(preset.role)} aria-label={`Create ${preset.role} template`}>
            <Plus size={15} />
            {preset.role}
          </button>
        ))}
      </div>

      <form className="profile-form template-form" onSubmit={saveTemplate}>
        <label>
          Template title
          <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
        </label>
        <label>
          Role
          <select value={draft.role} onChange={(event) => updateDraft('role', event.target.value)}>
            {promptTemplateRoles.map((role) => <option value={role} key={role}>{role}</option>)}
          </select>
        </label>
        <label>
          Provider
          <select value={draft.providerProfileId} onChange={(event) => updateDraft('providerProfileId', event.target.value)}>
            <option value="">Select provider</option>
            {providerOptions.map((provider) => <option value={provider.id} key={provider.id}>{provider.label}</option>)}
          </select>
        </label>
        <label>
          Model
          <select value={draft.modelId} onChange={(event) => updateDraft('modelId', event.target.value)}>
            <option value="">Select model</option>
            {(selectedProvider?.modelIds ?? []).map((modelId) => <option value={modelId} key={modelId}>{modelId}</option>)}
          </select>
        </label>
        <label>
          Escalation policy
          <select value={draft.escalationPolicyId} onChange={(event) => updateDraft('escalationPolicyId', event.target.value)}>
            <option value="">Select policy</option>
            {escalationPolicies.map((policy) => <option value={policy.id} key={policy.id}>{policy.label}</option>)}
          </select>
        </label>
        <label>
          Policy variables
          <input value={draft.policyBindings} onChange={(event) => updateDraft('policyBindings', event.target.value)} />
        </label>
        <label className="wide-field">
          Prompt body
          <textarea value={draft.body} onChange={(event) => updateDraft('body', event.target.value)} rows={5} />
        </label>
        <div className="form-actions">
          <button type="submit">
            <Save size={16} />
            Save template
          </button>
          {editingId ? (
            <button type="button" onClick={startCreate}>
              <X size={16} />
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="template-list">
        {templates.length === 0 ? <p className="empty-state">No prompt templates yet.</p> : null}
        {templates.map((template) => {
          const issues = validatePromptTemplate(template);
          const status = issues.length === 0 ? 'Valid' : 'Needs attention';
          return (
            <article className="card provider-card template-card" key={template.id} data-testid={`template-card-${template.id}`}>
              <div className="card-body">
                <div className="card-title">
                  <strong>{template.title || 'Untitled template'}</strong>
                  <small>{template.role} · {template.providerProfileId || 'no provider'} · {template.modelId || 'no model'}</small>
                </div>
                <div className="summary-grid">
                  <span>{status}</span>
                  <span>Variables: {template.variables.length > 0 ? template.variables.join(', ') : 'none'}</span>
                  <span>Versions: {template.versions.length}</span>
                </div>
                {issues.length > 0 ? (
                  <ul className="issue-list">
                    {issues.map((issue) => <li key={`${template.id}-${issue.code}-${issue.message}`}>{issue.message}</li>)}
                  </ul>
                ) : null}
              </div>
              <div className="card-actions">
                <button className="icon-button" type="button" onClick={() => startEdit(template)} aria-label={`Edit ${template.title || 'Untitled template'}`}>
                  <Pencil size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function emptyDraft(providerOptions: TemplateProviderOption[], escalationPolicies: EscalationPolicyOption[]): TemplateDraft {
  const provider = providerOptions[0];
  return {
    id: '',
    title: '',
    role: 'planner',
    body: '',
    providerProfileId: provider?.id ?? '',
    modelId: provider?.modelIds[0] ?? '',
    escalationPolicyId: escalationPolicies[0]?.id ?? '',
    policyBindings: '',
  };
}

function draftFromTemplate(template: PromptTemplateRecord): TemplateDraft {
  return {
    id: template.id,
    title: template.title,
    role: template.role,
    body: template.body,
    providerProfileId: template.providerProfileId,
    modelId: template.modelId,
    escalationPolicyId: template.escalationPolicyId,
    policyBindings: template.policyBindings.join(', '),
  };
}

function parsePolicyBindings(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}
