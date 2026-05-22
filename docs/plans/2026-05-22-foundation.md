# Agent Hangar Foundation Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build the foundation for a professional Rust Tauri + React multi-agent management desktop app.

**Architecture:** Rust core crates own provider abstraction, agent runtime state, execution harnesses, and durable domain logic. React renders a clear command-center UI. Tauri bridges desktop capabilities once the core harness is stable.

**Tech Stack:** Rust 2024 workspace, Tauri 2, React 19, TypeScript, Vite, Vitest, GitHub Actions.

---

## Product design

- **Provider management:** OpenAI, Anthropic, Gemini, and OpenAI-compatible providers; API key references stay secret-safe; model discovery returns one normalized model shape.
- **Agent template studio:** role, prompt, model policy, tool policy, permissions, and version history.
- **Execution graph:** task -> team -> agent runs -> subagents; explicit status transitions; pause/resume/cancel/retry later.
- **Communication:** typed threads for delegation, review, broadcast, and escalation.
- **Visual state:** pixel-state avatars map runtime states to queued/working/blocked/failed/completed.

## Harness boundaries

1. `agent-hangar-core`: pure tested domain logic.
2. `src-tauri`: desktop bridge, storage, secret vault, provider network calls.
3. `src/harness`: TypeScript UI-facing mirrors/adapters.
4. `src`: React management interface.

## Immediate TDD tasks

### Task 1: Provider normalization core

- Test: `crates/agent-hangar-core/tests/provider_catalog.rs`
- Implement: `crates/agent-hangar-core/src/lib.rs`
- Verify: `cargo test -p agent-hangar-core normalizes_models_across_supported_api_formats`

### Task 2: Secret-safe provider cards

- Test: `crates/agent-hangar-core/tests/provider_catalog.rs`
- Implement provider config/card types without exposing `api_key_ref` in debug card payloads.
- Verify: `cargo test -p agent-hangar-core provider_cards_never_expose_secret_references`

### Task 3: Agent runtime primitives

- Test: `crates/agent-hangar-core/tests/agent_runtime.rs`
- Implement template defaults, run transitions, pixel states, and message routing.
- Verify: `cargo test -p agent-hangar-core`

### Task 4: UI shell

- Create `src/main.tsx` and `src/styles.css`.
- Render provider cards, agent runway, and harness principles.
- Verify with frontend tests once npm dependencies are installed.

### Task 5: Documentation and CI

- Add MIT license, multilingual READMEs with language switcher, roadmap, architecture notes, and GitHub Actions.
- Verify: `cargo fmt --check`, `cargo test -p agent-hangar-core`, future `npm test` and `npm run build` after lockfile creation.
