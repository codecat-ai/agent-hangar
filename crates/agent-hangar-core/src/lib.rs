#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProviderKind {
    OpenAi,
    Anthropic,
    Gemini,
    OpenAiCompatible,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RawModel {
    pub id_or_name: String,
    pub display_name: Option<String>,
}

impl RawModel {
    #[must_use]
    pub fn new(id_or_name: &str, display_name: Option<&str>) -> Self {
        Self {
            id_or_name: id_or_name.to_owned(),
            display_name: display_name.map(str::to_owned),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NormalizedModel {
    pub id: String,
    pub display_name: String,
    pub provider_kind: ProviderKind,
}

#[must_use]
pub fn normalize_provider_model(provider_kind: ProviderKind, raw: RawModel) -> NormalizedModel {
    let id = match provider_kind {
        ProviderKind::Gemini => raw
            .id_or_name
            .strip_prefix("models/")
            .unwrap_or(&raw.id_or_name)
            .to_owned(),
        ProviderKind::OpenAi | ProviderKind::Anthropic | ProviderKind::OpenAiCompatible => {
            raw.id_or_name
        }
    };
    let display_name = raw.display_name.unwrap_or_else(|| id.clone());
    NormalizedModel {
        id,
        display_name,
        provider_kind,
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProviderConfig {
    pub id: String,
    pub kind: ProviderKind,
    pub display_name: String,
    pub base_url: String,
    api_key_ref: Option<String>,
}

impl ProviderConfig {
    #[must_use]
    pub fn new(
        id: &str,
        kind: ProviderKind,
        display_name: &str,
        base_url: &str,
        api_key_ref: Option<&str>,
    ) -> Self {
        Self {
            id: id.to_owned(),
            kind,
            display_name: display_name.to_owned(),
            base_url: base_url.to_owned(),
            api_key_ref: api_key_ref.map(str::to_owned),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProviderHealth {
    Ready,
    NeedsKey,
    Empty,
}

impl ProviderHealth {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Ready => "ready",
            Self::NeedsKey => "needs-key",
            Self::Empty => "empty",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProviderCard {
    pub id: String,
    pub kind: ProviderKind,
    pub display_name: String,
    pub base_url: String,
    pub api_key_configured: bool,
    pub model_count: usize,
    pub health: ProviderHealth,
}

#[must_use]
pub fn build_provider_cards(
    configs: &[ProviderConfig],
    model_counts: &[(&str, usize)],
) -> Vec<ProviderCard> {
    configs
        .iter()
        .map(|config| {
            let model_count = model_counts
                .iter()
                .find_map(|(id, count)| (*id == config.id).then_some(*count))
                .unwrap_or(0);
            let api_key_configured = config.api_key_ref.is_some();
            let health = if !api_key_configured {
                ProviderHealth::NeedsKey
            } else if model_count == 0 {
                ProviderHealth::Empty
            } else {
                ProviderHealth::Ready
            };
            ProviderCard {
                id: config.id.clone(),
                kind: config.kind,
                display_name: config.display_name.clone(),
                base_url: config.base_url.clone(),
                api_key_configured,
                model_count,
                health,
            }
        })
        .collect()
}

#[derive(Clone, Debug, PartialEq)]
pub struct ModelPolicy {
    pub temperature: f32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct AgentTemplate {
    pub name: String,
    pub role: String,
    pub prompt: String,
    pub model_policy: ModelPolicy,
    pub tools: Vec<String>,
}

#[must_use]
pub fn create_agent_template(name: &str, role: &str, prompt: &str) -> AgentTemplate {
    AgentTemplate {
        name: name.to_owned(),
        role: role.to_owned(),
        prompt: prompt.to_owned(),
        model_policy: ModelPolicy { temperature: 0.2 },
        tools: Vec::new(),
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AgentRunStatus {
    Queued,
    Working,
    Failed,
    Completed,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PixelState {
    Idle,
    Working,
    Failed,
    Completed,
}

impl PixelState {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Idle => "idle",
            Self::Working => "working",
            Self::Failed => "failed",
            Self::Completed => "completed",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentRun {
    pub task_id: String,
    pub agent_id: String,
    pub status: AgentRunStatus,
    pub pixel_state: PixelState,
    pub error: Option<String>,
    pub finished_at_tick: Option<u64>,
}

#[must_use]
pub fn create_agent_run(task_id: &str, agent_id: &str) -> AgentRun {
    AgentRun {
        task_id: task_id.to_owned(),
        agent_id: agent_id.to_owned(),
        status: AgentRunStatus::Queued,
        pixel_state: PixelState::Idle,
        error: None,
        finished_at_tick: None,
    }
}

#[must_use]
pub fn transition_run(mut run: AgentRun, status: AgentRunStatus, error: Option<&str>) -> AgentRun {
    run.status = status;
    run.pixel_state = match status {
        AgentRunStatus::Queued => PixelState::Idle,
        AgentRunStatus::Working => PixelState::Working,
        AgentRunStatus::Failed => PixelState::Failed,
        AgentRunStatus::Completed => PixelState::Completed,
    };
    run.error = error.map(str::to_owned);
    if matches!(status, AgentRunStatus::Failed | AgentRunStatus::Completed) {
        run.finished_at_tick = Some(1);
    }
    run
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MessageChannel {
    Delegation,
    Review,
    Broadcast,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MessageVisibility {
    Team,
    Private,
}

impl MessageVisibility {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Team => "team",
            Self::Private => "private",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentMessage {
    pub from: String,
    pub to: String,
    pub task_id: String,
    pub body: String,
    pub channel: MessageChannel,
    pub thread_id: String,
    pub visibility: MessageVisibility,
}

#[must_use]
pub fn route_agent_message(
    from: &str,
    to: &str,
    task_id: &str,
    body: &str,
    channel: MessageChannel,
) -> AgentMessage {
    AgentMessage {
        from: from.to_owned(),
        to: to.to_owned(),
        task_id: task_id.to_owned(),
        body: body.to_owned(),
        channel,
        thread_id: format!("{task_id}:{from}->{to}"),
        visibility: MessageVisibility::Team,
    }
}
