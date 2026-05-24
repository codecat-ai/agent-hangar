import { describe, expect, it } from 'vitest';
import {
  reviewWorkspaceImportExportFixtures,
  type WorkspaceImportExportFixture,
} from '../src/harness/workspaceFixtureReview';
import missingManifestFixture from '../examples/workspace-fixtures/missing-manifest-source-checkout.json';
import portableFixture from '../examples/workspace-fixtures/portable-source-checkout.json';

const SECRET_OR_CUSTOMER_TEXT = /apiKey|encryptedApiKey|encryptedKeyMaterial|Bearer\s+\S+|\b(?:sk|sk-ant|sk-proj)-[A-Za-z0-9._-]+|API\s+token|example customer|customer[A-Za-z0-9_-]*/i;
const PROVIDER_OR_REGISTRY_EXECUTION = /\b(?:npm|npx|pnpm|yarn|bun|cargo install|openai|anthropic|gemini|provider call|network call|registry command|https?:\/\/)\b/i;

function readFixtureFiles(): Array<{ name: string; fixture: WorkspaceImportExportFixture; serialized: string }> {
  return [
    {
      name: 'missing-manifest-source-checkout.json',
      fixture: missingManifestFixture as WorkspaceImportExportFixture,
    },
    {
      name: 'portable-source-checkout.json',
      fixture: portableFixture as WorkspaceImportExportFixture,
    },
  ].map((entry) => ({
    ...entry,
    serialized: JSON.stringify(entry.fixture),
  }));
}

describe('workspace import/export source-checkout fixtures', () => {
  it('keeps checked-in import validation examples deterministic and secret-safe', () => {
    const fixtures = readFixtureFiles();
    const first = reviewWorkspaceImportExportFixtures(fixtures.map((entry) => entry.fixture));
    const second = reviewWorkspaceImportExportFixtures(structuredClone(fixtures.map((entry) => entry.fixture)));

    expect(fixtures.map((entry) => entry.name)).toEqual([
      'missing-manifest-source-checkout.json',
      'portable-source-checkout.json',
    ]);
    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe('agent-hangar.workspace-fixture-review.v1');
    expect(first.summary).toEqual({
      fixtureCount: 2,
      readyCount: 1,
      blockedCount: 1,
      issueCount: 0,
    });

    for (const { serialized } of fixtures) {
      expect(serialized).not.toMatch(SECRET_OR_CUSTOMER_TEXT);
      expect(serialized).not.toMatch(PROVIDER_OR_REGISTRY_EXECUTION);
    }

    expect(first.reports.map((report) => report.fixtureId)).toEqual([
      'missing-manifest-source-checkout',
      'portable-source-checkout',
    ]);
    expect(first.reports.map((report) => report.dryRun.summary.status)).toEqual(['blocked', 'ready']);
    expect(first.reports.every((report) => report.sourceCheckoutOnly)).toBe(true);
    expect(first.reports.every((report) => report.secretSafe)).toBe(true);
    expect(first.reports.every((report) => report.deterministic)).toBe(true);
    expect(first.reports.flatMap((report) => report.issues)).toEqual([]);
    expect(JSON.stringify(first)).not.toMatch(SECRET_OR_CUSTOMER_TEXT);
  });

  it('proves fixture manifests validate through the existing import dry-run path', () => {
    const review = reviewWorkspaceImportExportFixtures(readFixtureFiles().map((entry) => entry.fixture));
    const portable = review.reports.find((report) => report.fixtureId === 'portable-source-checkout');
    const missingManifest = review.reports.find((report) => report.fixtureId === 'missing-manifest-source-checkout');

    expect(portable?.dryRun).toMatchObject({
      mode: 'import',
      source: {
        mode: 'source-checkout-only',
        workspaceId: 'fixture-workspace-portable',
        scenarioId: 'fixture-coordination',
      },
      summary: {
        status: 'ready',
        acceptedFileCount: 4,
        rejectedFileCount: 0,
        missingFileCount: 0,
        blockerCount: 0,
      },
      execution: {
        graphAvailable: true,
        trailAvailable: true,
        evidenceAvailable: true,
      },
    });
    expect(portable?.dryRun.files.map((file) => file.path)).toEqual([
      'evidence/fixture-coordination.run-evidence.md',
      'agent-hangar.workspace-manifest-preview.json',
      'agent-hangar.workspace-import-export-dry-run.md',
      'scenarios/fixture-coordination.json',
    ]);

    expect(missingManifest?.dryRun.summary).toMatchObject({
      status: 'blocked',
      acceptedFileCount: 2,
      rejectedFileCount: 0,
      missingFileCount: 1,
      blockerCount: 1,
    });
    expect(missingManifest?.dryRun.blockers.map((blocker) => blocker.code)).toEqual(['missing-bundle-manifest']);
    expect(missingManifest?.dryRun.files).toContainEqual({
      path: 'agent-hangar.workspace-manifest-preview.json',
      kind: 'manifest',
      status: 'missing',
      reason: 'Import candidate must include a workspace manifest preview file.',
    });
  });
});
