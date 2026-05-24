import {
  buildWorkspaceImportExportDryRun,
  type WorkspaceImportExportDryRun,
  type WorkspaceImportExportDryRunInput,
} from './workspaceImportExportDryRun';

export interface WorkspaceImportExportFixture {
  id: string;
  label: string;
  intent: string;
  expectedStatus: 'ready' | 'blocked';
  candidateBundle: WorkspaceImportExportDryRunInput['candidateBundle'];
  existingWorkspaceIds?: string[];
}

export interface WorkspaceImportExportFixtureReport {
  fixtureId: string;
  label: string;
  expectedStatus: WorkspaceImportExportFixture['expectedStatus'];
  deterministic: boolean;
  sourceCheckoutOnly: boolean;
  secretSafe: boolean;
  dryRun: WorkspaceImportExportDryRun;
  issues: string[];
}

export interface WorkspaceImportExportFixtureReview {
  schemaVersion: 'agent-hangar.workspace-fixture-review.v1';
  summary: {
    fixtureCount: number;
    readyCount: number;
    blockedCount: number;
    issueCount: number;
  };
  reports: WorkspaceImportExportFixtureReport[];
}

const REVIEW_SCHEMA_VERSION = 'agent-hangar.workspace-fixture-review.v1';
const SECRET_OR_CUSTOMER_TEXT = /apiKey|encryptedApiKey|encryptedKeyMaterial|Bearer\s+\S+|\b(?:sk|sk-ant|sk-proj)-[A-Za-z0-9._-]+|API\s+token|example customer|customer[A-Za-z0-9_-]*/i;

export function reviewWorkspaceImportExportFixtures(
  fixtures: WorkspaceImportExportFixture[],
): WorkspaceImportExportFixtureReview {
  const reports = fixtures
    .map(reviewWorkspaceImportExportFixture)
    .sort((left, right) => left.fixtureId.localeCompare(right.fixtureId));

  return {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    summary: {
      fixtureCount: reports.length,
      readyCount: reports.filter((report) => report.dryRun.summary.status === 'ready').length,
      blockedCount: reports.filter((report) => report.dryRun.summary.status === 'blocked').length,
      issueCount: reports.reduce((sum, report) => sum + report.issues.length, 0),
    },
    reports,
  };
}

function reviewWorkspaceImportExportFixture(fixture: WorkspaceImportExportFixture): WorkspaceImportExportFixtureReport {
  const input = toDryRunInput(fixture);
  const dryRun = buildWorkspaceImportExportDryRun(input);
  const repeatedDryRun = buildWorkspaceImportExportDryRun(structuredClone(input));
  const deterministic = JSON.stringify(dryRun) === JSON.stringify(repeatedDryRun);
  const sourceCheckoutOnly = dryRun.source.mode === 'source-checkout-only'
    && dryRun.files.every((file) => isSafeRelativePath(file.path));
  const secretSafe = !SECRET_OR_CUSTOMER_TEXT.test(JSON.stringify({ fixture, dryRun }));
  const issues = [
    ...(deterministic ? [] : ['Fixture dry run is not deterministic.']),
    ...(sourceCheckoutOnly ? [] : ['Fixture dry run is not source-checkout-only.']),
    ...(secretSafe ? [] : ['Fixture or dry run contains secret-looking or customer-like text.']),
    ...(dryRun.summary.status === fixture.expectedStatus ? [] : [
      `Fixture expected ${fixture.expectedStatus} but dry run returned ${dryRun.summary.status}.`,
    ]),
  ];

  return {
    fixtureId: fixture.id,
    label: fixture.label,
    expectedStatus: fixture.expectedStatus,
    deterministic,
    sourceCheckoutOnly,
    secretSafe,
    dryRun,
    issues,
  };
}

function toDryRunInput(fixture: WorkspaceImportExportFixture): WorkspaceImportExportDryRunInput {
  return {
    mode: 'import',
    candidateBundle: fixture.candidateBundle,
    existingWorkspaceIds: fixture.existingWorkspaceIds ?? [],
  };
}

function isSafeRelativePath(path: string): boolean {
  return Boolean(path.trim())
    && !path.startsWith('/')
    && !path.startsWith('~')
    && !path.includes('\\')
    && !path.split('/').includes('..');
}
