# Roadmap

## Milestone 0 — Foundation
- [x] MIT-licensed repository scaffold.
- [x] Rust core crate with provider and agent runtime harness tests.
- [x] React/Tauri shell with provider and agent state panels.
- [ ] Installable frontend lockfile once package registry access is reliable.

## Milestone 1 — Provider management
- Add encrypted local provider profiles.
- Implement OpenAI, Anthropic, Gemini, and OpenAI-compatible model discovery.
- Add provider health checks and model capability tags.

## Milestone 2 — Agent template studio
- Prompt template CRUD with variables and version history.
- Role presets: planner, researcher, implementer, reviewer, operator.
- Validation harness for missing model/tool/provider policies.

## Milestone 3 — Execution graph
- Create tasks, assign agent teams, spawn subagents, and stream events.
- Support pause/resume/cancel/retry with durable audit logs.
- Add inter-agent communication inbox and escalation rules.

## Milestone 4 — Observability and polish
- Timeline replay, token/cost tracking, structured error taxonomy.
- Pixel animation pack for queued/working/blocked/failed/completed states.
- Import/export workspace bundles.
