use agent_hangar_core::{
    AgentRunStatus, MessageChannel, create_agent_run, create_agent_template, route_agent_message,
    transition_run,
};

#[test]
fn creates_role_templates_with_safe_defaults() {
    let template = create_agent_template("Planner", "planning", "Break tasks into milestones.");
    assert!((template.model_policy.temperature - 0.2).abs() < f32::EPSILON);
    assert!(template.tools.is_empty());
}

#[test]
fn maps_status_transitions_to_pixel_animation_states() {
    let run = create_agent_run("task-1", "agent-planner");
    assert_eq!(run.status, AgentRunStatus::Queued);
    let working = transition_run(run.clone(), AgentRunStatus::Working, None);
    assert_eq!(working.pixel_state.as_str(), "working");
    let failed = transition_run(working, AgentRunStatus::Failed, Some("provider timeout"));
    assert_eq!(failed.pixel_state.as_str(), "failed");
    let completed = transition_run(run, AgentRunStatus::Completed, None);
    assert!(completed.finished_at_tick.is_some());
}

#[test]
fn routes_messages_between_parent_agents_and_subagents() {
    let message = route_agent_message(
        "agent-planner",
        "agent-researcher",
        "task-1",
        "Find prior art.",
        MessageChannel::Delegation,
    );
    assert_eq!(message.thread_id, "task-1:agent-planner->agent-researcher");
    assert_eq!(message.visibility.as_str(), "team");
}
