use agent_hangar_core::{
    ProviderConfig, ProviderKind, RawModel, build_provider_cards, normalize_provider_model,
};

#[test]
fn normalizes_models_across_supported_api_formats() {
    let openai = normalize_provider_model(ProviderKind::OpenAi, RawModel::new("gpt-4.1", None));
    assert_eq!(openai.id, "gpt-4.1");
    assert_eq!(openai.provider_kind, ProviderKind::OpenAi);

    let anthropic = normalize_provider_model(
        ProviderKind::Anthropic,
        RawModel::new("claude-sonnet-4-5", Some("Claude Sonnet 4.5")),
    );
    assert_eq!(anthropic.display_name, "Claude Sonnet 4.5");

    let gemini = normalize_provider_model(
        ProviderKind::Gemini,
        RawModel::new("models/gemini-2.5-pro", Some("Gemini 2.5 Pro")),
    );
    assert_eq!(gemini.id, "gemini-2.5-pro");
}

#[test]
fn provider_cards_never_expose_secret_references() {
    let cards = build_provider_cards(
        &[ProviderConfig::new(
            "openai-main",
            ProviderKind::OpenAi,
            "OpenAI",
            "https://api.openai.com/v1",
            Some("OPENAI_API_KEY"),
        )],
        &[("openai-main", 2)],
    );
    assert_eq!(cards[0].model_count, 2);
    assert!(cards[0].api_key_configured);
    assert_eq!(cards[0].health.as_str(), "ready");
    let debug = format!("{cards:?}");
    assert!(!debug.contains("OPENAI_API_KEY"));
}
