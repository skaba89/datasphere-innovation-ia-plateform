from app.core.default_agents import get_default_agent_profiles


def test_default_agent_profiles_are_valid():
    profiles = get_default_agent_profiles()

    assert len(profiles) >= 5
    assert {profile.slug for profile in profiles} == {
        "data-architect-senior",
        "expert-reponse-ao",
        "consultant-data-gouvernance",
        "business-analyst-it-data",
        "expert-documentation-client",
    }

    for profile in profiles:
        assert profile.name
        assert profile.domain
        assert profile.languages
        assert len(profile.instruction_template) >= 20
        assert profile.governance_rules
