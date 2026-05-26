from __future__ import annotations

import json
import os
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
API_TOKEN = os.getenv("API_TOKEN")


def call_api(method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    if not API_TOKEN:
        raise RuntimeError("Missing API_TOKEN environment variable")

    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        f"{BASE_URL}{path}",
        data=body,
        method=method,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_TOKEN}",
        },
    )

    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise RuntimeError(f"{method} {path} failed with HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"{method} {path} failed: {exc}") from exc


def main() -> int:
    suffix = str(int(time.time()))
    print(f"Running API smoke test against {BASE_URL}")

    me = call_api("GET", "/auth/me")
    print(f"OK auth/me: {me.get('email')}")

    organization = call_api("POST", "/organizations", {
        "name": f"Smoke Institution {suffix}",
        "country": "Guinee",
        "sector": "Public",
        "organization_type": "Institution publique",
        "description": "Created by smoke test.",
    })
    print(f"OK organization: {organization['id']}")

    opportunity = call_api("POST", "/opportunities", {
        "organization_id": organization["id"],
        "title": f"Smoke opportunity {suffix}",
        "opportunity_type": "Appel d offres public",
        "country": "Guinee",
        "sector": "Transformation digitale",
        "status": "analysis",
        "priority": "Haute",
        "probability": 60,
        "owner_name": "Smoke Test",
        "notes": "Created by smoke test.",
    })
    print(f"OK opportunity: {opportunity['id']}")

    tender = call_api("POST", "/tenders", {
        "opportunity_id": opportunity["id"],
        "reference": f"SMOKE-{suffix}",
        "title": f"Smoke tender {suffix}",
        "buyer_name": organization["name"],
        "summary": "Created by smoke test.",
        "go_no_go_score": 0,
        "go_no_go_decision": "TO_QUALIFY",
        "status": "analysis",
    })
    tender_id = tender["id"]
    print(f"OK tender: {tender_id}")

    requirement = call_api("POST", f"/tenders/{tender_id}/requirements", {
        "tender_id": tender_id,
        "requirement_code": "REQ-SMOKE-001",
        "section": "Architecture",
        "description": "Proposer une architecture securisee, scalable et documentee.",
        "requirement_type": "Technique",
        "response_strategy": "Presenter une architecture cible et un plan de gouvernance.",
        "proof_or_deliverable": "Schema architecture, matrice securite, plan projet.",
        "owner_name": "Smoke Test",
        "status": "covered",
    })
    print(f"OK requirement: {requirement['id']}")

    criteria = call_api("POST", f"/tender-templates/tenders/{tender_id}/go-no-go/default")
    print(f"OK default criteria: {len(criteria)}")

    compliance = call_api("POST", f"/tender-templates/tenders/{tender_id}/compliance/from-requirements")
    print(f"OK compliance rows: {len(compliance)}")

    go_summary = call_api("GET", f"/tender-governance/tenders/{tender_id}/go-no-go/summary")
    compliance_summary = call_api("GET", f"/tender-governance/tenders/{tender_id}/compliance/summary")
    print(f"OK go/no-go: {go_summary['percentage']}%")
    print(f"OK compliance: {compliance_summary['total_items']} item(s)")
    print("SMOKE TEST PASSED")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"SMOKE TEST FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
