# Provider discovery adapter contract review

[English](../README.md) | [中文](../README-zh.md) | [日本語](../README-ja.md)

Status: reviewed boundary; disabled fixture-backed adapter shell implemented; live provider discovery remains disabled.

Agent Hangar currently ships deterministic provider discovery dry-run previews and a disabled-by-default fixture-backed adapter shell only. This document records the adapter boundary that future live discovery implementations must satisfy before any provider call is enabled in the desktop app.

## Goals

- Let a provider-specific adapter refresh model inventory and capability metadata for a local provider profile.
- Keep the UI and persistence layers independent from provider SDKs, network clients, shell commands, and package registries.
- Preserve Agent Hangar's current secret-safe display/export contract.
- Make failures inspectable without exposing API keys, bearer tokens, encrypted key material, customer-like text, prompts, or raw provider responses that may contain sensitive content.

## Non-goals

- No live provider calls are enabled by this review.
- No background polling, automatic credential use, or real shell execution is approved here.
- No package-registry release or hosted service is implied.
- No provider-specific SDK choice is locked in; adapters may use fetch clients, SDKs, or Tauri commands later if they satisfy this contract.

## Adapter shape

A future adapter should be a small boundary around one provider family. It should accept a normalized request and return a normalized result:

```ts
interface ProviderDiscoveryRequest {
  profileId: string;
  providerId: string;
  baseUrl?: string;
  apiKeyRef: string;
  consent: "operator-initiated";
  timeoutMs: number;
  retryLimit: number;
  requestedAt: string;
}

interface ProviderDiscoveryResult {
  schemaVersion: 1;
  profileId: string;
  providerId: string;
  status: "ready" | "empty" | "degraded" | "permission_error" | "network_error" | "timeout" | "unsupported";
  retrievedAt: string;
  models: Array<{
    id: string;
    displayName?: string;
    contextWindow?: number;
    capabilities: string[];
  }>;
  issues: Array<{
    code: string;
    severity: "info" | "warning" | "error";
    message: string;
    retryable: boolean;
  }>;
  audit: {
    requestId: string;
    providerId: string;
    profileId: string;
    attemptCount: number;
    durationMs: number;
  };
}
```

The result should remain useful after JSON serialization and must not contain raw secrets, raw authorization headers, encrypted key material, prompt contents, customer data, or unbounded provider error bodies.

## Safety requirements

1. **Explicit consent:** live discovery must be triggered by a visible operator action. The adapter receives `consent: "operator-initiated"`; missing or different consent is a validation error.
2. **No secret display:** adapters receive an opaque key reference or temporary secret through a secure runtime channel, but returned results, logs, React props, copied Markdown, and test snapshots must contain only redacted summaries.
3. **Bounded network behavior:** adapters must honor `timeoutMs`, `retryLimit`, and cancellation. Retries must be conservative and never run forever in the background.
4. **No shell/package-registry execution:** discovery must not install packages, run shell commands, open browsers, or execute provider-provided instructions.
5. **Typed failures:** HTTP status, timeout, malformed payload, permission, quota, and unsupported-provider states should become typed `issues` instead of thrown UI crashes.
6. **Response minimization:** keep normalized model ids, display names, coarse capabilities, context-window hints, and concise issues. Drop raw response payloads unless a future debug mode is separately reviewed and redacted.
7. **Deterministic capability mapping:** model capability inference should reuse the existing provider catalog helpers and be covered by fixtures for text, vision, embeddings, reasoning, tool-use, fast, and long-context tags.
8. **Audit without secrets:** audit entries should include provider/profile ids, request id, timestamps, duration, attempt count, status, and issue codes, never API keys or raw response bodies.

## Fixture and test requirements

Before enabling a live adapter, add fixture-backed tests for:

- ready inventory with multiple capability shapes;
- valid empty inventory;
- permission or quota error with secret-looking strings in the provider body;
- timeout or network failure with retry count;
- malformed JSON or unsupported response schema;
- stale cached inventory promoted to a warning state;
- redaction in JSON previews, Markdown previews, React rendering, debug strings, and audit entries;
- operator consent missing or invalid;
- bounded error text truncation.

The current dry-run preview remains the reference harness for expected result shape and redaction behavior.

## Disabled adapter shell

The implemented shell in `src/harness/providerDiscoveryAdapterShell.ts` is fixture-backed and remains disabled by default. It exercises the reviewed request/result boundary with typed blocked, missing-consent, missing-options, degraded/permission, malformed, stale, and ready results; injected request timestamps/options only; clone-safe JSON/Markdown previews; local audit metadata; next-action guidance; and redaction for raw API keys, bearer tokens, encrypted key material, API key references, and customer-like text.

The shell does not make provider calls, network calls, shell calls, package-registry calls, or Tauri API calls. The React surface is a read-only local preview in the provider profile panel.

## UI readiness gates

A live provider discovery button should stay disabled by default until all of these are true:

- secure storage/retrieval for provider credentials is reviewed;
- the operator sees the provider, profile, timeout/retry policy, and expected data use before triggering discovery;
- cancellation and retry behavior are visible;
- cached inventory replacement is previewed or reversible;
- audit entries are local-only, redacted, and export-safe;
- tests cover React rendering without exposing raw or encrypted secret material.

## Follow-up roadmap

This contract review completed the "Provider discovery contract review" roadmap item, and the disabled fixture-backed adapter shell has now been implemented. The next phase should stay narrow: perform a cadence review to decide whether Agent Hangar should move from `active-development` to `growth`, or continue live discovery readiness work behind the same disabled-by-default contract gates.
