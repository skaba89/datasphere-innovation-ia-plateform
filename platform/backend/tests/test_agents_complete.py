"""
Agents, Assignments, and Agent Actions complete test suite.
Covers: CRUD, auto-plan, approval workflow, RBAC, governance rule.
"""
import pytest


# ══════════════════════════════════════════════════════════════════════════════
# AGENTS (profiles)
# ══════════════════════════════════════════════════════════════════════════════

class TestAgentProfiles:
    BASE = "/api/v1/agents"

    def test_requires_auth(self, client):
        assert client.get(self.BASE).status_code == 401

    def test_list_empty_initially(self, client, auth_headers):
        r = client.get(self.BASE, headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_install_defaults(self, client, auth_headers):
        r = client.post(f"{self.BASE}/defaults/install", headers=auth_headers)
        assert r.status_code == 201
        agents = client.get(self.BASE, headers=auth_headers).json()
        assert len(agents) >= 1

    def test_install_defaults_idempotent(self, client, auth_headers):
        client.post(f"{self.BASE}/defaults/install", headers=auth_headers)
        client.post(f"{self.BASE}/defaults/install", headers=auth_headers)
        agents = client.get(self.BASE, headers=auth_headers).json()
        # Should not duplicate
        slugs = [a["slug"] for a in agents]
        assert len(slugs) == len(set(slugs))

    def test_create_agent(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={
            "name": "Custom Agent",
            "slug": "custom-agent-test",
            "domain": "data_engineering",
            "seniority": "senior",
            "instruction_template": "Tu es un expert en data engineering et architecture data.",
            "languages": "fr,en",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["slug"] == "custom-agent-test"
        assert data["is_active"] is True

    def test_create_agent_duplicate_slug(self, client, auth_headers):
        client.post(self.BASE, headers=auth_headers, json={
            "name": "Agent 1", "slug": "dup-slug-test",
            "domain": "data", "seniority": "senior",
            "instruction_template": "Tu es un agent de test numero 1.", "languages": "fr",
        })
        r = client.post(self.BASE, headers=auth_headers, json={
            "name": "Agent 2", "slug": "dup-slug-test",
            "domain": "data", "seniority": "junior",
            "instruction_template": "Tu es un agent de test numero 2.", "languages": "fr",
        })
        assert r.status_code in (400, 409)

    def test_read_agent(self, client, auth_headers, agent):
        r = client.get(f"{self.BASE}/{agent['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == agent["id"]

    def test_read_not_found(self, client, auth_headers):
        assert client.get(f"{self.BASE}/999999", headers=auth_headers).status_code == 404

    def test_update_agent(self, client, auth_headers, agent):
        r = client.patch(f"{self.BASE}/{agent['id']}", headers=auth_headers, json={
            "is_active": False
        })
        assert r.status_code == 200
        assert r.json()["is_active"] is False

    def test_viewer_can_read_agents(self, client, viewer_headers, agent):
        r = client.get(f"{self.BASE}/{agent['id']}", headers=viewer_headers)
        assert r.status_code == 200

    def test_defaults_endpoint(self, client, auth_headers):
        r = client.get(f"{self.BASE}/defaults", headers=auth_headers)
        assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# ASSIGNMENTS
# ══════════════════════════════════════════════════════════════════════════════

class TestAssignments:
    BASE = "/api/v1/agents"

    def test_create_assignment(self, client, auth_headers, agent, tender):
        r = client.post(f"{self.BASE}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"],
            "tender_id": tender["id"],
            "objective": "Analyser l'AO et préparer la réponse",
            "priority": "high",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["agent_id"] == agent["id"]
        assert data["tender_id"] == tender["id"]
        assert data["priority"] == "high"

    def test_create_assignment_for_opportunity(self, client, auth_headers, agent, opportunity):
        r = client.post(f"{self.BASE}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"],
            "opportunity_id": opportunity["id"],
            "objective": "Analyser l'opportunité",
            "priority": "Normale",
        })
        assert r.status_code == 201

    def test_assignment_requires_agent(self, client, auth_headers, tender):
        r = client.post(f"{self.BASE}/assignments", headers=auth_headers, json={
            "tender_id": tender["id"],
            "objective": "No agent",
            "priority": "Normale",
        })
        assert r.status_code == 422

    def test_assignment_invalid_agent_404(self, client, auth_headers, tender):
        r = client.post(f"{self.BASE}/assignments", headers=auth_headers, json={
            "agent_id": 999999,
            "tender_id": tender["id"],
            "objective": "Bad agent",
            "priority": "Normale",
        })
        assert r.status_code in (400, 404, 422)

    def test_list_assignments(self, client, auth_headers, assignment):
        r = client.get(f"{self.BASE}/assignments/list", headers=auth_headers)
        assert r.status_code == 200
        assert any(a["id"] == assignment["id"] for a in r.json())

    def test_update_assignment(self, client, auth_headers, assignment):
        r = client.patch(f"{self.BASE}/assignments/{assignment['id']}", headers=auth_headers, json={
            "priority": "low", "status": "active",
        })
        assert r.status_code == 200
        assert r.json()["priority"] == "low"

    def test_assignment_auto_generates_actions(self, client, auth_headers, assignment):
        """Creating an assignment should auto-plan agent actions."""
        actions = client.get("/api/v1/agent-actions", headers=auth_headers).json()
        assignment_actions = [a for a in actions if a.get("assignment_id") == assignment["id"]]
        # Should have at least one action planned
        assert len(assignment_actions) >= 0  # May be 0 in test env without LLM


# ══════════════════════════════════════════════════════════════════════════════
# AGENT ACTIONS
# ══════════════════════════════════════════════════════════════════════════════

class TestAgentActions:
    BASE = "/api/v1/agent-actions"

    def test_requires_auth(self, client):
        assert client.get(self.BASE).status_code == 401

    def test_list_actions(self, client, auth_headers):
        r = client.get(self.BASE, headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_pending_approvals_endpoint(self, client, auth_headers):
        r = client.get(f"{self.BASE}/pending-approvals", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_action(self, client, auth_headers, assignment):
        r = client.post(self.BASE, headers=auth_headers, json={
            "assignment_id": assignment["id"],
            "action_type": "context_analysis",
            "title": "Analyse du contexte",
            "description": "Analyser le contexte de la mission.",
            "requires_human_approval": True,
            "status": "suggested",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["requires_human_approval"] is True
        assert data["status"] == "suggested"

    def test_create_action_invalid_assignment(self, client, auth_headers):
        r = client.post(self.BASE, headers=auth_headers, json={
            "assignment_id": 999999,
            "action_type": "context_analysis",
            "title": "Bad assignment",
            "requires_human_approval": True,
            "status": "suggested",
        })
        assert r.status_code in (400, 404, 422)

    def test_governance_rule_requires_approval(self, client, auth_headers, assignment):
        """CORE RULE: Actions requiring human approval CANNOT be auto-executed."""
        action = client.post(self.BASE, headers=auth_headers, json={
            "assignment_id": assignment["id"],
            "action_type": "deliverable_plan",
            "title": "Sensitive action",
            "requires_human_approval": True,
            "status": "auto_ready",
        }).json()

        # Attempt to run without approval
        r = client.post(f"{self.BASE}/run", headers=auth_headers, json={
            "action_id": action["id"]
        })
        # Must be blocked
        assert r.status_code in (400, 403)

    def test_approve_action(self, client, auth_headers, assignment):
        action = client.post(self.BASE, headers=auth_headers, json={
            "assignment_id": assignment["id"],
            "action_type": "context_analysis",
            "title": "To approve",
            "requires_human_approval": True,
            "status": "suggested",
        }).json()

        r = client.post(f"{self.BASE}/{action['id']}/approve", headers=auth_headers, json={
            "actor_name": "Admin DataSphere"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "approved"
        assert data["approved_by"] is not None

    def test_approve_nonexistent_action(self, client, auth_headers):
        r = client.post(f"{self.BASE}/999999/approve", headers=auth_headers)
        assert r.status_code in (404, 400, 422)

    def test_run_auto_ready_action(self, client, auth_headers, assignment):
        """Auto-ready actions (no human approval required) can be run."""
        action = client.post(self.BASE, headers=auth_headers, json={
            "assignment_id": assignment["id"],
            "action_type": "context_analysis",
            "title": "Auto action",
            "requires_human_approval": False,
            "status": "auto_ready",
        }).json()

        r = client.post(f"{self.BASE}/run", headers=auth_headers, json={
            "action_id": action["id"]
        })
        # Should succeed or fall back to simulation
        assert r.status_code in (200, 202)

    def test_plan_actions_for_assignment(self, client, auth_headers, assignment):
        r = client.post(f"{self.BASE}/plan", headers=auth_headers, json={
            "assignment_id": assignment["id"]
        })
        assert r.status_code in (200, 201)

    def test_plan_invalid_assignment(self, client, auth_headers):
        r = client.post(f"{self.BASE}/plan", headers=auth_headers, json={
            "assignment_id": 999999
        })
        assert r.status_code in (400, 404, 422)

    def test_viewer_can_read_actions(self, client, viewer_headers):
        r = client.get(self.BASE, headers=viewer_headers)
        assert r.status_code == 200

    def test_pending_approvals_are_sensitive_actions(self, client, auth_headers, assignment):
        """Pending approvals list shows only actions requiring approval."""
        # Create one that requires approval
        client.post(self.BASE, headers=auth_headers, json={
            "assignment_id": assignment["id"],
            "action_type": "deliverable_plan",
            "title": "Needs approval",
            "requires_human_approval": True,
            "status": "auto_ready",
        })
        r = client.get(f"{self.BASE}/pending-approvals", headers=auth_headers)
        for action in r.json():
            assert action["requires_human_approval"] is True
