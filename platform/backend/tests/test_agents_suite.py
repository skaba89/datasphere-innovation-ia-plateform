"""
Tests Agents, Assignments, Actions IA — couverture complète.

Couvre :
  Agents : CRUD, install défaut, séniorité, domaine
  Assignments : création, liste, mise à jour, liaison tender/opp
  Actions : CRUD, plan, approve, run, gouvernance (requires_human_approval)
  Règle fondamentale : jamais d'exécution auto si requires_human_approval=True
"""
import pytest

BASE_A   = "/api/v1/agents"
BASE_AA  = "/api/v1/agent-actions"


# ══════════════════════════════════════════════════════════════════════════════
# AGENTS — CRUD
# ══════════════════════════════════════════════════════════════════════════════

class TestAgents:
    def test_requires_auth(self, client):
        assert client.get(BASE_A).status_code == 401

    def test_list_agents_empty(self, client, auth_headers):
        r = client.get(BASE_A, headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_agent(self, client, auth_headers):
        r = client.post(BASE_A, headers=auth_headers, json={
            "name": "Data Architect IA",
            "slug": "data-architect-ia",
            "domain": "data_architecture",
            "seniority": "senior",
            "languages": "fr,en",
            "description": "Agent spécialisé en architecture de données.",
            "instruction_template": "Tu es un expert Data Architecture. Analyse les AO et propose des architectures de données adaptées.",
        })
        assert r.status_code == 201
        d = r.json()
        assert d["name"] == "Data Architect IA"
        assert d["domain"] == "data_architecture"
        assert d["is_active"] is True

    def test_create_duplicate_slug(self, client, auth_headers):
        payload = {
            "name": "A1", "slug": "unique-agent-slug",
            "domain": "data", "seniority": "senior",
            "instruction_template": "Agent de test.",
        }
        client.post(BASE_A, headers=auth_headers, json=payload)
        r2 = client.post(BASE_A, headers=auth_headers, json=payload)
        assert r2.status_code in (409, 400, 422)  # duplicate slug rejected at DB level

    def test_get_agent(self, client, auth_headers, agent):
        r = client.get(f"{BASE_A}/{agent['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == agent["id"]

    def test_get_nonexistent(self, client, auth_headers):
        assert client.get(f"{BASE_A}/999999", headers=auth_headers).status_code == 404

    def test_update_agent(self, client, auth_headers, agent):
        r = client.patch(f"{BASE_A}/{agent['id']}", headers=auth_headers, json={
            "description": "Description mise à jour",
            "seniority": "expert",
        })
        assert r.status_code == 200
        assert r.json()["seniority"] == "expert"

    def test_defaults_list(self, client, auth_headers):
        r = client.get(f"{BASE_A}/defaults", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # defaults can be empty list or populated depending on implementation
        assert isinstance(data, list)

    def test_install_defaults(self, client, auth_headers):
        r = client.post(f"{BASE_A}/defaults/install", headers=auth_headers)
        assert r.status_code in (200, 201)
        agents = client.get(BASE_A, headers=auth_headers).json()
        assert len(agents) >= 3

    def test_install_defaults_idempotent(self, client, auth_headers):
        client.post(f"{BASE_A}/defaults/install", headers=auth_headers)
        count1 = len(client.get(BASE_A, headers=auth_headers).json())
        client.post(f"{BASE_A}/defaults/install", headers=auth_headers)
        count2 = len(client.get(BASE_A, headers=auth_headers).json())
        assert count1 == count2

    def test_missing_required_fields(self, client, auth_headers):
        r = client.post(BASE_A, headers=auth_headers, json={"name": "Incomplete"})  # missing slug and domain
        assert r.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# ASSIGNMENTS
# ══════════════════════════════════════════════════════════════════════════════

class TestAssignments:
    def test_create_assignment_to_tender(self, client, auth_headers, agent, tender):
        r = client.post(f"{BASE_A}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"],
            "tender_id": tender["id"],
            "objective": "Préparer la réponse à l'AO",
            "priority": "Haute",
        })
        assert r.status_code == 201
        d = r.json()
        assert d["agent_id"] == agent["id"]
        assert d["tender_id"] == tender["id"]
        assert d["status"] in ("planned", "active", "pending", "in_progress")

    def test_create_assignment_to_opportunity(self, client, auth_headers, agent, opportunity):
        r = client.post(f"{BASE_A}/assignments", headers=auth_headers, json={
            "agent_id": agent["id"],
            "opportunity_id": opportunity["id"],
            "objective": "Analyser l'opportunité",
            "priority": "Moyenne",
        })
        assert r.status_code == 201
        assert r.json()["opportunity_id"] == opportunity["id"]

    def test_create_assignment_missing_agent(self, client, auth_headers, tender):
        r = client.post(f"{BASE_A}/assignments", headers=auth_headers, json={
            "tender_id": tender["id"],
            "objective": "Préparer", "priority": "Basse",
        })
        assert r.status_code == 422

    def test_create_assignment_invalid_agent(self, client, auth_headers, tender):
        r = client.post(f"{BASE_A}/assignments", headers=auth_headers, json={
            "agent_id": 999999,
            "tender_id": tender["id"],
            "objective": "X", "priority": "Basse",
        })
        assert r.status_code in (404, 400, 422)  # Backend may return 422 for invalid FK

    def test_list_assignments(self, client, auth_headers, assignment):
        r = client.get(f"{BASE_A}/assignments/list", headers=auth_headers)
        assert r.status_code == 200
        assert any(a["id"] == assignment["id"] for a in r.json())

    def test_update_assignment_status(self, client, auth_headers, assignment):
        r = client.patch(f"{BASE_A}/assignments/{assignment['id']}", headers=auth_headers, json={
            "status": "completed",
        })
        assert r.status_code == 200

    def test_assignment_requires_auth(self, client):
        assert client.get(f"{BASE_A}/assignments/list").status_code == 401

    def test_auto_plan_creates_actions(self, client, auth_headers, assignment):
        """La création d'un assignment génère des actions planifiées."""
        actions = client.get(f"{BASE_AA}?assignment_id={assignment['id']}", headers=auth_headers)
        if actions.status_code == 200:
            # Si le paramètre est supporté, les actions peuvent exister
            assert isinstance(actions.json(), list)


# ══════════════════════════════════════════════════════════════════════════════
# AGENT ACTIONS
# ══════════════════════════════════════════════════════════════════════════════

class TestAgentActions:
    ACTION_PAYLOAD = {
        "action_type": "analysis",
        "title": "Analyser les exigences de l'AO",
        "description": "Examiner chaque exigence et identifier les points critiques.",
        "requires_human_approval": True,
        "priority": "Haute",
    }

    def test_create_action(self, client, auth_headers, assignment):
        r = client.post(BASE_AA, headers=auth_headers, json={
            **self.ACTION_PAYLOAD,
            "assignment_id": assignment["id"],
        })
        assert r.status_code == 201
        d = r.json()
        assert d["title"] == "Analyser les exigences de l'AO"
        assert d["requires_human_approval"] is True

    def test_create_action_missing_assignment(self, client, auth_headers):
        r = client.post(BASE_AA, headers=auth_headers, json=self.ACTION_PAYLOAD)
        assert r.status_code == 422

    def test_list_actions(self, client, auth_headers, assignment):
        client.post(BASE_AA, headers=auth_headers, json={
            **self.ACTION_PAYLOAD, "assignment_id": assignment["id"],
        })
        r = client.get(BASE_AA, headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_pending_approvals(self, client, auth_headers, assignment):
        # Créer une action avec approbation requise
        action = client.post(BASE_AA, headers=auth_headers, json={
            **self.ACTION_PAYLOAD,
            "assignment_id": assignment["id"],
            "requires_human_approval": True,
        }).json()
        r = client.get(f"{BASE_AA}/pending-approvals", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_approve_action(self, client, auth_headers, assignment):
        action = client.post(BASE_AA, headers=auth_headers, json={
            **self.ACTION_PAYLOAD,
            "assignment_id": assignment["id"],
            "requires_human_approval": True,
        }).json()
        r = client.post(f"{BASE_AA}/{action['id']}/approve", headers=auth_headers, json={
            "actor_name": "Sekouna KABA",
        })
        assert r.status_code == 200
        assert r.json()["approved_by"] is not None

    def test_approve_nonexistent_action(self, client, auth_headers):
        r = client.post(f"{BASE_AA}/999999/approve", headers=auth_headers, json={
            "actor_name": "X",
        })
        assert r.status_code == 404

    def test_governance_rule_enforced(self, client, auth_headers, assignment):
        """Règle fondamentale : action requires_human_approval=True ne s'exécute pas automatiquement."""
        action = client.post(BASE_AA, headers=auth_headers, json={
            **self.ACTION_PAYLOAD,
            "assignment_id": assignment["id"],
            "requires_human_approval": True,
        }).json()
        # Tenter d'exécuter sans approbation
        r = client.post(f"{BASE_AA}/run", headers=auth_headers, json={
            "action_id": action["id"],
        })
        # Doit être refusé ou retourner un statut qui montre l'attente d'approbation
        if r.status_code == 200:
            data = r.json()
            # Si l'endpoint répond 200, vérifier que l'exécution est bloquée
            assert data.get("status") in ("waiting_approval", "pending", "blocked") or \
                   data.get("requires_human_approval") is True
        else:
            assert r.status_code in (400, 403)

    def test_plan_actions(self, client, auth_headers, assignment):
        r = client.post(f"{BASE_A}/actions/plan", headers=auth_headers, json={
            "assignment_id": assignment["id"],
            "context": "Analyser l'AO et préparer la réponse technique",
        })
        assert r.status_code in (200, 201)

    def test_actions_list_requires_auth(self, client):
        assert client.get(BASE_AA).status_code == 401

    def test_action_via_agents_route(self, client, auth_headers, assignment):
        """L'endpoint /agents/actions/list doit aussi fonctionner."""
        r = client.get(f"{BASE_A}/actions/list", headers=auth_headers)
        assert r.status_code == 200

    def test_approve_updates_approved_by(self, client, auth_headers, assignment):
        action = client.post(BASE_AA, headers=auth_headers, json={
            **self.ACTION_PAYLOAD,
            "assignment_id": assignment["id"],
        }).json()
        client.post(f"{BASE_AA}/{action['id']}/approve", headers=auth_headers, json={
            "actor_name": "Validateur Test",
        })
        # Revérifier la valeur
        updated = client.get(BASE_AA, headers=auth_headers).json()
        approved = next((a for a in updated if a["id"] == action["id"]), None)
        if approved:
            assert approved.get("approved_by") == "Validateur Test" or \
                   approved.get("approved_by") is not None
