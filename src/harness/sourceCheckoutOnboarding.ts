export type SourceCheckoutOnboardingStatus = 'ready' | 'warning';

export type SourceCheckoutOnboardingRegionId =
  | 'source-checkout-onboarding'
  | 'provider-evidence'
  | 'template-evidence'
  | 'execution-evidence'
  | 'collaboration-evidence'
  | 'portability-evidence';

export interface SourceCheckoutOnboardingRegionInput {
  id: SourceCheckoutOnboardingRegionId;
  label: string;
  accessibleName?: string;
  statusRegionName?: string;
  targetId?: string;
}

export interface SourceCheckoutOnboardingInput {
  regions?: SourceCheckoutOnboardingRegionInput[];
  setupNotes?: string[];
  primaryWalkthroughNotes?: string[];
}

export interface SourceCheckoutOnboardingRegion {
  id: SourceCheckoutOnboardingRegionId;
  label: string;
  accessibleName: string;
  statusRegionName: string;
  targetId: string;
  order: number;
  warnings: string[];
}

export interface SourceCheckoutOnboarding {
  schemaVersion: 'agent-hangar.source-checkout-onboarding.v1';
  source: {
    mode: 'source-checkout-only';
  };
  primaryWalkthrough: {
    heading: string;
    keyboardStart: string;
    reviewPath: string[];
    notes: string[];
  };
  keyboard: {
    order: SourceCheckoutOnboardingRegion[];
  };
  setupNotes: string[];
  statusExpectations: string[];
  summary: {
    status: SourceCheckoutOnboardingStatus;
    regionCount: number;
    warningCount: number;
  };
  blockers: string[];
  nextActions: string[];
  markdown: string;
}

const SCHEMA_VERSION = 'agent-hangar.source-checkout-onboarding.v1';
const TEXT_LIMIT = 240;

const DEFAULT_REGIONS: SourceCheckoutOnboardingRegionInput[] = [
  {
    id: 'source-checkout-onboarding',
    label: 'Source-checkout onboarding',
    accessibleName: 'Source-checkout onboarding',
    statusRegionName: 'Source-checkout onboarding status',
    targetId: 'source-checkout-onboarding-heading',
  },
  {
    id: 'provider-evidence',
    label: 'Provider evidence',
    accessibleName: 'Provider evidence',
    statusRegionName: 'Provider evidence status',
    targetId: 'source-checkout-walkthrough-heading',
  },
  {
    id: 'template-evidence',
    label: 'Template evidence',
    accessibleName: 'Template evidence',
    statusRegionName: 'Template evidence status',
    targetId: 'source-checkout-walkthrough-heading',
  },
  {
    id: 'execution-evidence',
    label: 'Execution evidence',
    accessibleName: 'Execution evidence',
    statusRegionName: 'Execution evidence status',
    targetId: 'execution-trail-heading',
  },
  {
    id: 'collaboration-evidence',
    label: 'Collaboration evidence',
    accessibleName: 'Collaboration evidence',
    statusRegionName: 'Collaboration evidence status',
    targetId: 'collaboration-inbox-heading',
  },
  {
    id: 'portability-evidence',
    label: 'Portability evidence',
    accessibleName: 'Portability evidence',
    statusRegionName: 'Portability evidence status',
    targetId: 'workspace-manifest-heading',
  },
];

const DEFAULT_SETUP_NOTES = [
  'Use a local source checkout or cloned repository workspace.',
  'Review checked-in fixtures and local preview data before handoff.',
  'Keep live discovery disabled until reviewed local gates are satisfied.',
  'Treat the desktop build as source-checkout evaluation; no published installer is claimed.',
];

const DEFAULT_WALKTHROUGH_NOTES = [
  'Use the guided walkthrough as the first review pass.',
  'Keep provider, template, execution, collaboration, and portability evidence visible for follow-up checks.',
];

export function buildSourceCheckoutOnboarding(input: SourceCheckoutOnboardingInput = {}): SourceCheckoutOnboarding {
  const regions = buildRegions(input.regions ?? DEFAULT_REGIONS);
  const setupNotes = uniqueOrdered((input.setupNotes ?? DEFAULT_SETUP_NOTES).map((note) => safeText(note)));
  const primaryNotes = uniqueOrdered((input.primaryWalkthroughNotes ?? DEFAULT_WALKTHROUGH_NOTES).map((note) => safeText(note)));
  const statusExpectations = [
    'Every required operator region has an accessible name.',
    'Every required operator region has named status text for readiness or follow-up.',
    'Warnings stay visible as next actions instead of hiding evidence.',
  ].map((note) => safeText(note));
  const missingWarnings = regions.flatMap((region) => region.warnings);
  const nextActions = uniqueOrdered(missingWarnings.map((warning) => safeText(warning)));
  const preview: Omit<SourceCheckoutOnboarding, 'markdown'> = {
    schemaVersion: SCHEMA_VERSION,
    source: {
      mode: 'source-checkout-only',
    },
    primaryWalkthrough: {
      heading: 'Start with the guided source-checkout walkthrough',
      keyboardStart: 'Tab to Source-checkout onboarding, then continue through provider, template, execution, collaboration, and portability evidence in order.',
      reviewPath: regions.map((region) => region.label),
      notes: primaryNotes,
    },
    keyboard: {
      order: regions,
    },
    setupNotes,
    statusExpectations,
    summary: {
      status: missingWarnings.length > 0 ? 'warning' : 'ready',
      regionCount: regions.length,
      warningCount: missingWarnings.length,
    },
    blockers: [],
    nextActions,
  };
  const sanitized = deepSanitize(preview) as Omit<SourceCheckoutOnboarding, 'markdown'>;

  return {
    ...sanitized,
    markdown: formatSourceCheckoutOnboardingMarkdown(sanitized),
  };
}

export function formatSourceCheckoutOnboardingMarkdown(guidance: Omit<SourceCheckoutOnboarding, 'markdown'> | SourceCheckoutOnboarding): string {
  const notes = guidance.setupNotes.map((note) => `- ${escapeMarkdown(safeText(note))}`).join('\n');
  const regions = guidance.keyboard.order
    .map((region) => `| ${region.order} | ${escapeMarkdown(region.label)} | ${escapeMarkdown(region.accessibleName)} | ${escapeMarkdown(region.statusRegionName)} |`)
    .join('\n');
  const nextActions = guidance.nextActions.length > 0
    ? guidance.nextActions.map((action) => `- ${escapeMarkdown(safeText(action))}`).join('\n')
    : '- None';

  return safeMarkdown(`# Source Checkout Onboarding

schemaVersion: ${guidance.schemaVersion}
sourceMode: ${guidance.source.mode}

## Primary Review Path
- ${escapeMarkdown(safeText(guidance.primaryWalkthrough.heading))}
- Keyboard start: ${escapeMarkdown(safeText(guidance.primaryWalkthrough.keyboardStart))}

## Setup Notes
${notes}

## Keyboard Order
| Order | Region | Accessible Name | Status Text |
| --- | --- | --- | --- |
${regions}

## Next Actions
${nextActions}
`);
}

function buildRegions(inputRegions: SourceCheckoutOnboardingRegionInput[]): SourceCheckoutOnboardingRegion[] {
  const byId = new Map(inputRegions.map((region) => [region.id, region]));

  return DEFAULT_REGIONS.map((defaultRegion, index) => {
    const input = byId.get(defaultRegion.id);
    const label = safeText(input?.label ?? defaultRegion.label);
    const accessibleName = safeText(input?.accessibleName ?? defaultRegion.accessibleName);
    const statusRegionName = safeText(input?.statusRegionName ?? defaultRegion.statusRegionName);
    const warnings = [
      ...(input ? [] : [`Add the ${label} region to the source-checkout review path.`]),
      ...(input && !input.accessibleName?.trim() ? [`Name the ${label} region before source-checkout handoff.`] : []),
      ...(input && !input.statusRegionName?.trim() ? [`Add a named status text region for ${label}.`] : []),
    ];

    return {
      id: defaultRegion.id,
      label,
      accessibleName,
      statusRegionName,
      targetId: safeText(input?.targetId ?? defaultRegion.targetId),
      order: index + 1,
      warnings: uniqueOrdered(warnings.map((warning) => safeText(warning))),
    };
  });
}

function deepSanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepSanitize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepSanitize(child)]));
  }
  if (typeof value === 'string') {
    return safeText(value);
  }
  return value;
}

function safeText(value: unknown, limit = TEXT_LIMIT): string {
  const redacted = redactSecretLikeText(String(value ?? 'Local source-checkout review.')).replace(/\s+/g, ' ').trim();
  return truncate(redacted || 'Local source-checkout review.', limit);
}

function safeMarkdown(value: string): string {
  return redactSecretLikeText(value);
}

function redactSecretLikeText(value: string): string {
  return value
    .replace(/\bapiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedApiKey(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bencryptedKeyMaterial(?:\s*=\s*\S+)?/gi, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, '[redacted]')
    .replace(/\b(?:sk|sk-ant|sk-proj|AIza)[A-Za-z0-9._-]{6,}\b/g, '[redacted]')
    .replace(/\blocal-demo:v1:[a-f0-9A-Za-z._-]+\b/g, '[redacted]')
    .replace(/\bAPI\s+token\s+\S+/gi, '[redacted]')
    .replace(/\bsecret(?:\s*[:=]\s*\S+)?/gi, '[redacted]')
    .replace(/\b[A-Z][A-Z0-9&.-]{2,}\s+(?:customer|workspace|account|tenant|project)\b/g, '[redacted]')
    .replace(/\bcustomer[A-Za-z0-9_-]*/gi, '[redacted]')
    .replace(/\bACME\b/gi, '[redacted]');
}

function escapeMarkdown(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/`/g, '\\`');
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function uniqueOrdered(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
