"""Integration tests for the FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from main import app

ADMIN_TOKEN = "changeme"

ADHOC_PAYLOAD = {
    "name": "Integration Test Scenario",
    "parameters": {
        "tef":            {"min": 0.3,  "most_likely": 1.0,  "max": 3.5},
        "diff":           {"min": 0.15, "most_likely": 0.35, "max": 0.60},
        "vuln":           {"min": 0.15, "most_likely": 0.30, "max": 0.55},
        "loss_magnitude": {"min": 1_000_000, "most_likely": 6_000_000, "max": 25_000_000},
    },
}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ── Meta ──────────────────────────────────────────────────────────────────────

def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "CRQ API — FAIR Risk Engine"


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_scenario_types_returns_five(client):
    r = client.get("/scenarios/types")
    assert r.status_code == 200
    types = r.json()
    assert len(types) == 5
    ids = {t["id"] for t in types}
    assert ids == {"ransomware", "data-breach", "bec", "insider-threat", "third-party"}


# ── Clients ───────────────────────────────────────────────────────────────────

def test_list_clients_returns_three(client):
    r = client.get("/clients")
    assert r.status_code == 200
    assert len(r.json()) == 3


def test_get_nexus_financial(client):
    r = client.get("/clients/nexus-financial")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == "nexus-financial"
    assert len(data["scenarios"]) == 5


def test_get_medcore_health(client):
    r = client.get("/clients/medcore-health")
    assert r.status_code == 200
    assert r.json()["industry"] == "Healthcare"


def test_get_techvault_solutions(client):
    r = client.get("/clients/techvault-solutions")
    assert r.status_code == 200
    assert r.json()["industry"] == "Technology"


def test_get_client_not_found(client):
    r = client.get("/clients/does-not-exist")
    assert r.status_code == 404


# ── FAIR engine (ad-hoc) ──────────────────────────────────────────────────────

def test_adhoc_simulation_returns_ale(client):
    r = client.post("/fair/run?simulations=1000", json=ADHOC_PAYLOAD)
    assert r.status_code == 200
    data = r.json()
    assert "ale" in data
    assert "var_90" in data
    assert "loss_exceedance_curve" in data


def test_adhoc_simulation_ale_percentile_order(client):
    r = client.post("/fair/run?simulations=1000", json=ADHOC_PAYLOAD)
    ale = r.json()["ale"]
    assert ale["p10"] <= ale["p50"] <= ale["p90"]


def test_adhoc_simulation_below_min_simulations_rejected(client):
    r = client.post("/fair/run?simulations=100", json=ADHOC_PAYLOAD)
    assert r.status_code == 422


def test_adhoc_invalid_pert_range_rejected(client):
    bad = {
        "name": "Bad",
        "parameters": {
            "tef":            {"min": 5.0, "most_likely": 1.0, "max": 3.5},  # min > most_likely
            "diff":           {"min": 0.1, "most_likely": 0.3, "max": 0.6},
            "vuln":           {"min": 0.1, "most_likely": 0.3, "max": 0.6},
            "loss_magnitude": {"min": 1e6,  "most_likely": 5e6, "max": 20e6},
        },
    }
    r = client.post("/fair/run", json=bad)
    assert r.status_code == 422


# ── Risk endpoints ────────────────────────────────────────────────────────────

def test_client_risk_structure(client):
    r = client.get("/clients/nexus-financial/risk?simulations=1000")
    assert r.status_code == 200
    data = r.json()
    for key in ("total_ale", "total_var_90", "loss_exceedance_curve", "scenarios"):
        assert key in data
    assert len(data["scenarios"]) == 5


def test_client_risk_scenario_contributions_sum_100(client):
    r = client.get("/clients/nexus-financial/risk?simulations=1000")
    total = sum(s["contribution_pct"] for s in r.json()["scenarios"])
    assert abs(total - 100.0) < 0.2


def test_single_scenario_risk(client):
    r = client.get("/clients/nexus-financial/scenarios/ransomware/risk?simulations=1000")
    assert r.status_code == 200
    data = r.json()
    assert data["scenario_id"] == "ransomware"
    assert "ale" in data


def test_single_scenario_risk_not_found(client):
    r = client.get("/clients/nexus-financial/scenarios/nonexistent/risk")
    assert r.status_code == 404


# ── Admin auth ────────────────────────────────────────────────────────────────

def test_admin_requires_token(client):
    r = client.get("/admin/clients")
    assert r.status_code == 422  # missing required X-Admin-Token header


def test_admin_wrong_token_rejected(client):
    r = client.get("/admin/clients", headers={"X-Admin-Token": "wrong-token"})
    assert r.status_code == 401


def test_admin_correct_token_accepted(client):
    r = client.get("/admin/clients", headers={"X-Admin-Token": ADMIN_TOKEN})
    assert r.status_code == 200
    assert len(r.json()) == 3


def test_admin_get_client(client):
    r = client.get("/admin/clients/nexus-financial", headers={"X-Admin-Token": ADMIN_TOKEN})
    assert r.status_code == 200
    assert r.json()["id"] == "nexus-financial"


def test_admin_list_reports(client):
    r = client.get("/admin/reports", headers={"X-Admin-Token": ADMIN_TOKEN})
    assert r.status_code == 200
    assert isinstance(r.json(), list)
