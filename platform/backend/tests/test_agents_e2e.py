"""
Tests E2E agents — flux complet bout en bout.

Scénario A : Install → Assignment → Plan → Approve → Run → Vérifier résultat
Scénario B : Tous les agents par défaut (5) — install + assignment + run
Scénario C : Exécution concurrente de plusieurs actions
Scénario D : Governance — action refusée si non approuvée
Scénario E : Cycle complet sur un AO (tender-linked assignment)
"""

import pytest
from unittest.mock import patch


BASE = "/api/v1"
AGENTS = f"{BASE}/agents"
ACTIONS = f"{BASE}/agent-actions"


# ── Fixtures helpers ──────────────────────────────────────────────────────────

def make_org(client, headers):
    r = client.post(f"{BASE}/organizations", headers=headers,
                    json={"name": "TestOrg E2E", "source": "manual"})
    assert r.status_code == 201, r.text
    return r.json()


def make_opp(client, headers, org_id):
    r = client.post(f"{BASE}/opportunities", headers=headers, json={
        "organization_id": org_id, "title": "Opp E2E Test",
        "status": "open", "source": "manual",
    })
    assert r.status_code == 201, r.text
    return r.json()


def make_tender(client, headers, opp_id):
    r = client.post(f"{BASE}/tenders", headers=headers, json={
        "opportunity_id": opp_id,
        "title": "Audit Plateforme Data Nationale",
        "buyer_name": "ARTP Guinée",
        "summary": "Audit de la couverture QoS des opérateurs télécoms.",
        "status": "draft", "source": "manual",
    })
    assert r.status_code == 201, r.text
    return r.json()


# ── Scénario A : Flux complet minimal ────────────────────────────────────────

class TestAgentFlowE2E:
    """Full agent pipeline: install → assign → plan → approve → run."""

    def test_a1_install_defaults(self, client, auth_headers):
        """Step 1: Install the 5 default agent profiles."""
        r = client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        assert r.status_code == 201
        agents = r.json()
        assert len(agents) >= 5
        slugs = {a["slug"] for a in agents}
        assert "data-architect-senior" in slugs
        assert "expert-reponse-ao" in slugs
        assert "consultant-data-gouvernance" in slugs

    def test_a2_agent_details(self, client, auth_headers):
        """Step 2: Read each agent and verify fields."""
        client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        r = client.get(AGENTS, headers=auth_headers)
        agents = r.json()
        for agent in agents:
            assert "id" in agent
            assert "name" in agent
            assert "instruction_template" in agent
            assert len(agent["instruction_template"]) >= 10
            assert agent["is_active"] is True

    def test_a3_create_assignment(self, client, auth_headers):
        """Step 3: Create an assignment linking agent + tender."""
        client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        agents = client.get(AGENTS, headers=auth_headers).json()
        ao_agent = next((a for a in agents if a["slug"] == "expert-reponse-ao"), agents[0])

        org = make_org(client, auth_headers)
        opp = make_opp(client, auth_headers, org["id"])
        tender = make_tender(client, auth_headers, opp["id"])

        r = client.post(f"{AGENTS}/assignments", headers=auth_headers, json={
            "agent_id": ao_agent["id"],
            "tender_id": tender["id"],
            "objective": "Analyser l'AO ARTP et préparer la réponse technique",
            "expected_deliverable": "Mémoire technique + matrice conformité",
            "priority": "Haute",
        })
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["agent_id"] == ao_agent["id"]
        assert data["tender_id"] == tender["id"]
        assert data["status"] == "planned"

    def test_a4_actions_auto_planned(self, client, auth_headers):
        """Step 4: Assignment creation auto-generates actions."""
        client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        agents = client.get(AGENTS, headers=auth_headers).json()
        ao_agent = next((a for a in agents if a["slug"] == "expert-reponse-ao"), agents[0])

        org = make_org(client, auth_headers)
        opp = make_opp(client, auth_headers, org["id"])
        tender = make_tender(client, auth_headers, opp["id"])

        assignment = client.post(f"{AGENTS}/assignments", headers=auth_headers, json={
            "agent_id": ao_agent["id"], "tender_id": tender["id"],
            "objective": "Analyser l'AO", "priority": "Haute",
        }).json()

        # Auto-generated actions
        r = client.get(f"{ACTIONS}?assignment_id={assignment['id']}", headers=auth_headers)
        assert r.status_code == 200
        actions = r.json()
        assert len(actions) >= 1
        for action in actions:
            assert "action_type" in action
            assert action["status"] in ("suggested", "pending", "approved", "auto_ready")

    def test_a5_approve_and_run_action(self, client, auth_headers):
        """Step 5: Approve an action then execute it — verify LLM result."""
        client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        agents = client.get(AGENTS, headers=auth_headers).json()
        agent = agents[0]

        org = make_org(client, auth_headers)
        opp = make_opp(client, auth_headers, org["id"])
        tender = make_tender(client, auth_headers, opp["id"])

        assignment = client.post(f"{AGENTS}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"], "tender_id": tender["id"],
            "objective": "Analyser le contexte de l'AO et préparer la réponse",
            "priority": "Haute",
        }).json()

        actions = client.get(f"{ACTIONS}?assignment_id={assignment['id']}", headers=auth_headers).json()
        assert len(actions) >= 1
        action = actions[0]

        # Approve if requires approval
        if action["requires_human_approval"]:
            r_approve = client.post(
                f"{ACTIONS}/{action['id']}/approve",
                headers=auth_headers,
                params={"actor_name": "admin@datasphere-innovation.fr"}
            )
            assert r_approve.status_code == 200, r_approve.text
            action = r_approve.json()
            assert action["status"] == "approved"

        # Run the action (mock LLM to avoid real API calls)
        with patch("app.services.llm_service.complete") as mock_llm:
            mock_llm.return_value = (
                "Analyse terminée. Exigences identifiées : Snowflake, Python 3.10+. "
                "Recommandation : GO. Probabilité de gain : 75%.",
                "simulation"
            )
            r_run = client.post(
                f"{ACTIONS}/run",
                headers=auth_headers,
                json={"action_id": action["id"], "force": True}
            )

        assert r_run.status_code == 200, r_run.text
        result = r_run.json()
        assert result["status"] == "done"
        assert result["result_summary"] is not None
        assert len(result["result_summary"]) > 10

    def test_a6_pending_approvals_list(self, client, auth_headers):
        """Step 6: Pending approvals endpoint returns correct actions."""
        client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        agents = client.get(AGENTS, headers=auth_headers).json()
        agent = agents[0]

        org = make_org(client, auth_headers)
        opp = make_opp(client, auth_headers, org["id"])
        tender = make_tender(client, auth_headers, opp["id"])

        client.post(f"{AGENTS}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"], "tender_id": tender["id"],
            "objective": "Test pending approvals", "priority": "Haute",
        })

        r = client.get(f"{ACTIONS}/pending-approvals", headers=auth_headers)
        assert r.status_code == 200
        pending = r.json()
        assert isinstance(pending, list)
        # All pending actions require approval and are not yet approved
        for a in pending:
            assert a["requires_human_approval"] is True
            assert a["status"] not in ("done", "failed")


# ── Scénario B : Tous les agents par défaut ───────────────────────────────────

class TestAllDefaultAgents:
    """Each default agent runs an action successfully."""

    @pytest.mark.parametrize("slug,action_type", [
        ("data-architect-senior",       "context_analysis"),
        ("expert-reponse-ao",           "tender_requirements_review"),
        ("consultant-data-gouvernance", "deliverable_plan"),
        ("business-analyst-it-data",    "compliance_matrix"),
        ("expert-documentation-client", "commercial_proposal"),
    ])
    def test_agent_executes_action(self, client, auth_headers, slug, action_type):
        """Each agent can be assigned and execute an action."""
        client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        agents = client.get(AGENTS, headers=auth_headers).json()
        agent = next((a for a in agents if a["slug"] == slug), None)
        assert agent is not None, f"Agent {slug} not found after install"

        org = make_org(client, auth_headers)
        opp = make_opp(client, auth_headers, org["id"])
        tender = make_tender(client, auth_headers, opp["id"])

        assignment = client.post(f"{AGENTS}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"], "tender_id": tender["id"],
            "objective": f"Test {slug} sur AO ARTP",
            "priority": "Haute",
        }).json()
        assert "id" in assignment

        # Create specific action
        action_r = client.post(ACTIONS, headers=auth_headers, json={
            "assignment_id": assignment["id"],
            "action_type": action_type,
            "title": f"Action {action_type} pour {slug}",
            "priority": "Haute",
            "requires_human_approval": False,
        })
        assert action_r.status_code == 201, action_r.text
        action = action_r.json()

        # Run with mocked LLM
        with patch("app.services.llm_service.complete") as mock_llm:
            mock_llm.return_value = (
                f"Résultat simulé pour {slug}: analyse complète. Points clés identifiés.",
                "simulation"
            )
            r_run = client.post(f"{ACTIONS}/run", headers=auth_headers,
                                json={"action_id": action["id"], "force": True})

        assert r_run.status_code == 200, r_run.text
        assert r_run.json()["status"] == "done"
        assert r_run.json()["result_summary"]


# ── Scénario C : Governance ───────────────────────────────────────────────────

class TestAgentGovernance:
    """Human-in-the-loop governance rules are enforced."""

    def test_action_blocked_without_approval(self, client, auth_headers):
        """Action requiring approval cannot run without being approved first."""
        client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        agents = client.get(AGENTS, headers=auth_headers).json()
        agent = agents[0]

        org = make_org(client, auth_headers)
        opp = make_opp(client, auth_headers, org["id"])
        tender = make_tender(client, auth_headers, opp["id"])
        assignment = client.post(f"{AGENTS}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"], "tender_id": tender["id"],
            "objective": "Test governance", "priority": "Haute",
        }).json()

        action = client.post(ACTIONS, headers=auth_headers, json={
            "assignment_id": assignment["id"],
            "action_type": "context_analysis",
            "title": "Action gouvernée",
            "priority": "Haute",
            "requires_human_approval": True,
        }).json()

        # Try to run without approval → should be blocked
        r = client.post(f"{ACTIONS}/run", headers=auth_headers,
                        json={"action_id": action["id"]})
        assert r.status_code in (400, 403), \
            f"Expected 400/403 but got {r.status_code}: {r.text}"

    def test_action_approved_then_runs(self, client, auth_headers):
        """Same action runs successfully after approval."""
        client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        agents = client.get(AGENTS, headers=auth_headers).json()
        agent = agents[0]

        org = make_org(client, auth_headers)
        opp = make_opp(client, auth_headers, org["id"])
        tender = make_tender(client, auth_headers, opp["id"])
        assignment = client.post(f"{AGENTS}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"], "tender_id": tender["id"],
            "objective": "Test approval flow", "priority": "Haute",
        }).json()

        action = client.post(ACTIONS, headers=auth_headers, json={
            "assignment_id": assignment["id"],
            "action_type": "context_analysis",
            "title": "Action à approuver",
            "priority": "Haute",
            "requires_human_approval": True,
        }).json()

        # Approve
        r_approve = client.post(
            f"{ACTIONS}/{action['id']}/approve", headers=auth_headers,
            params={"actor_name": "admin@datasphere-innovation.fr"}
        )
        assert r_approve.status_code == 200
        assert r_approve.json()["approved_by"] == "admin@datasphere-innovation.fr"

        # Run
        with patch("app.services.llm_service.complete") as mock_llm:
            mock_llm.return_value = ("Analyse approuvée et exécutée avec succès.", "simulation")
            r_run = client.post(f"{ACTIONS}/run", headers=auth_headers,
                                json={"action_id": action["id"]})
        assert r_run.status_code == 200
        assert r_run.json()["status"] == "done"


# ── Scénario D : Plan + run multiple actions ──────────────────────────────────

class TestAgentPlanAndRun:
    """plan endpoint generates multiple actions, run each in sequence."""

    def test_plan_generates_multi_actions(self, client, auth_headers):
        """POST /agent-actions/plan returns list (may be 0 if already created by assignment)."""
        client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        agents = client.get(AGENTS, headers=auth_headers).json()
        agent = agents[0]

        org = make_org(client, auth_headers)
        opp = make_opp(client, auth_headers, org["id"])
        tender = make_tender(client, auth_headers, opp["id"])
        assignment = client.post(f"{AGENTS}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"], "tender_id": tender["id"],
            "objective": "Plan multi-actions", "priority": "Haute",
        }).json()

        # /plan deduplicates vs auto-created actions
        r = client.post(f"{AGENTS}/actions/plan", headers=auth_headers, json={
            "assignment_id": assignment["id"],
        })
        assert r.status_code in (200, 201), r.text
        # Verify all actions for this assignment (auto + planned)
        all_actions = client.get(f"{ACTIONS}?assignment_id={assignment['id']}", headers=auth_headers).json()
        assert isinstance(all_actions, list)
        assert len(all_actions) >= 1

    def test_run_all_non_governed_actions(self, client, auth_headers):
        """Auto-run all actions that don't require approval."""
        client.post(f"{AGENTS}/defaults/install", headers=auth_headers)
        agents = client.get(AGENTS, headers=auth_headers).json()
        agent = agents[0]

        org = make_org(client, auth_headers)
        opp = make_opp(client, auth_headers, org["id"])
        tender = make_tender(client, auth_headers, opp["id"])
        assignment = client.post(f"{AGENTS}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"], "tender_id": tender["id"],
            "objective": "Auto-run test", "priority": "Haute",
        }).json()

        # Create 3 non-governed actions
        created_ids = []
        for i, action_type in enumerate(["context_analysis", "deliverable_plan", "commercial_proposal"]):
            a = client.post(ACTIONS, headers=auth_headers, json={
                "assignment_id": assignment["id"],
                "action_type": action_type,
                "title": f"Action auto {i+1}",
                "priority": "Haute",
                "requires_human_approval": False,
            }).json()
            created_ids.append(a["id"])

        # Run all
        results = []
        with patch("app.services.llm_service.complete") as mock_llm:
            mock_llm.return_value = ("Résultat E2E.", "simulation")
            for action_id in created_ids:
                r = client.post(f"{ACTIONS}/run", headers=auth_headers,
                                json={"action_id": action_id})
                results.append(r.status_code)

        assert all(s == 200 for s in results), f"Some runs failed: {results}"
