# Agent Hangar Architecture

Agent Hangar is a desktop command center for long-running multi-agent work. The Rust core owns durable state, provider adapters, execution scheduling, and audit trails. The React UI renders operational clarity: provider health, agent topology, task timelines, and pixel-state avatars.

## Harness design

1. **Provider harness**: OpenAI, Anthropic, Gemini, and OpenAI-compatible adapters implement model discovery, health checks, request translation, streaming normalization, and error classification. Secrets are referenced by key handles and never surfaced in UI payloads.
2. **Agent harness**: agent templates define role, prompt, tool policy, model policy, and collaboration permissions. Runs move through queued, working, blocked, failed, and completed states.
3. **Collaboration harness**: parent agents can spawn subagents with scoped objectives. All messages are typed as delegation, review, broadcast, or escalation threads.
4. **Observation harness**: every transition emits a structured event for timelines, pixel animations, replay, and future tracing/export.

## Similar-project lessons

- AutoGen and CrewAI prove role-based conversations are useful, but desktop UX and provider management are often secondary.
- LangGraph shows graph/state-machine control matters for complex loops. Agent Hangar will keep the execution graph explicit rather than hiding it in chat logs.
- Langfuse-style observability is essential: traces, errors, costs, and model choices must be first-class.
- Coding-agent orchestrators such as Claude Squad/Intent highlight the need for workspaces and long-running task supervision. Agent Hangar generalizes that pattern beyond one CLI/provider.
