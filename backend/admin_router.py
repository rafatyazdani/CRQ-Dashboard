"""
Admin API — Consultant admin panel routes
=========================================
All routes require the ``X-Admin-Token`` request header that matches the
``ADMIN_TOKEN`` environment variable (defaults to ``"changeme"``).

Endpoints
---------
  GET  /admin/clients                                 List all clients
  GET  /admin/clients/{id}                            Full client record
  POST /admin/clients                                 Create or replace a client
  POST /admin/clients/{id}/generate-report            Run Monte Carlo, cache result
  GET  /admin/clients/{id}/report.pdf                 Export cached (or fresh) PDF
  GET  /admin/reports                                 List generated reports
"""

from __future__ import annotations

import io
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from fair_engine import compute_client_risk
from limiter import limiter

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Load .env if present (development convenience — no-op if python-dotenv missing)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "changeme")

DATA_FILE   = os.path.join(os.path.dirname(__file__), "data", "clients.json")
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")


# ---------------------------------------------------------------------------
# Authentication dependency
# ---------------------------------------------------------------------------

def require_admin(x_admin_token: str = Header(..., description="Admin authentication token")):
    if x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return x_admin_token


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------

def _load() -> dict:
    with open(DATA_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _save(data: dict) -> None:
    with open(DATA_FILE, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)


def _client_or_404(data: dict, client_id: str) -> dict:
    c = next((x for x in data["clients"] if x["id"] == client_id), None)
    if not c:
        raise HTTPException(404, f"Client '{client_id}' not found")
    return c


def _has_report(client_id: str) -> bool:
    return os.path.exists(os.path.join(REPORTS_DIR, client_id, "latest.json"))


# ---------------------------------------------------------------------------
# Pydantic input models
# ---------------------------------------------------------------------------

class ParameterRangeIn(BaseModel):
    min:         float
    most_likely: float
    max:         float


class ProposedControlIn(BaseModel):
    name:                       str   = ""
    description:                str   = ""
    annual_cost:                float = 0.0
    residual_ale_reduction_pct: float = 0.0


class ScenarioIn(BaseModel):
    id:               str
    scenario_type:    str
    name:             str
    description:      str                      = ""
    asset:            str                      = ""
    threat_actor:     str                      = ""
    tef:              ParameterRangeIn
    diff:             ParameterRangeIn
    vuln:             ParameterRangeIn
    loss_magnitude:   ParameterRangeIn
    asset_value:      Optional[float]          = None
    proposed_control: Optional[ProposedControlIn] = None


class ClientIn(BaseModel):
    id:        str
    name:      str
    industry:  str            = ""
    revenue:   Optional[float] = None
    contact:   str            = ""
    risk_tier: str            = "Medium"
    scenarios: List[ScenarioIn]


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/clients", summary="List all clients (admin)")
def admin_list_clients(_: str = Depends(require_admin)) -> List[Dict[str, Any]]:
    data = _load()
    return [
        {
            "id":             c["id"],
            "name":           c["name"],
            "industry":       c.get("industry", ""),
            "risk_tier":      c.get("risk_tier", "Medium"),
            "scenario_count": len(c.get("scenarios", [])),
            "last_updated":   c.get("last_updated"),
            "has_report":     _has_report(c["id"]),
        }
        for c in data["clients"]
    ]


@router.get("/clients/{client_id}", summary="Get full client record (admin)")
def admin_get_client(client_id: str, _: str = Depends(require_admin)) -> dict:
    return _client_or_404(_load(), client_id)


@router.post("/clients", summary="Create or replace a client record")
@limiter.limit("20/minute")
def admin_upsert_client(request: Request, payload: ClientIn, _: str = Depends(require_admin)) -> dict:
    data = _load()

    scenarios: List[Dict[str, Any]] = []
    for sc in payload.scenarios:
        entry: Dict[str, Any] = {
            "id":            sc.id,
            "scenario_type": sc.scenario_type,
            "name":          sc.name,
            "description":   sc.description,
            "asset":         sc.asset,
            "threat_actor":  sc.threat_actor,
            "parameters": {
                "tef":            sc.tef.model_dump(),
                "diff":           sc.diff.model_dump(),
                "vuln":           sc.vuln.model_dump(),
                "asset_value":    sc.asset_value,
                "loss_magnitude": sc.loss_magnitude.model_dump(),
            },
        }
        if sc.proposed_control:
            entry["proposed_control"] = sc.proposed_control.model_dump()
        scenarios.append(entry)

    new_client: Dict[str, Any] = {
        "id":           payload.id,
        "name":         payload.name,
        "industry":     payload.industry,
        "contact":      payload.contact,
        "risk_tier":    payload.risk_tier,
        "last_updated": datetime.utcnow().strftime("%Y-%m-%d"),
        "scenarios":    scenarios,
    }
    if payload.revenue is not None:
        new_client["revenue"] = payload.revenue

    idx = next((i for i, c in enumerate(data["clients"]) if c["id"] == payload.id), None)
    if idx is not None:
        data["clients"][idx] = new_client
    else:
        data["clients"].append(new_client)

    _save(data)
    return {"status": "saved", "client_id": payload.id}


@router.post(
    "/clients/{client_id}/generate-report",
    summary="Run Monte Carlo simulation and cache the results",
)
@limiter.limit("5/minute")
def admin_generate_report(
    request: Request,
    client_id: str,
    simulations: int = 10_000,
    _: str = Depends(require_admin),
) -> dict:
    data   = _load()
    client = _client_or_404(data, client_id)

    risk_data = compute_client_risk(client, simulations)

    os.makedirs(os.path.join(REPORTS_DIR, client_id), exist_ok=True)
    report_path = os.path.join(REPORTS_DIR, client_id, "latest.json")
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(risk_data, fh, indent=2)

    return {
        "status":          "generated",
        "client_id":       client_id,
        "generated_at":    datetime.utcnow().isoformat() + "Z",
        "n_simulations":   simulations,
        "total_ale_mean":  risk_data["total_ale"]["mean"],
        "total_var_90":    risk_data["total_var_90"],
    }


@router.get(
    "/clients/{client_id}/report.pdf",
    summary="Export risk report as a PDF (uses cached results if available)",
)
def admin_export_pdf(client_id: str, _: str = Depends(require_admin)):
    # lazy import — WeasyPrint startup can be slow
    from pdf_generator import generate_pdf  # noqa: PLC0415

    report_path = os.path.join(REPORTS_DIR, client_id, "latest.json")
    if os.path.exists(report_path):
        with open(report_path, "r", encoding="utf-8") as fh:
            risk_data = json.load(fh)
    else:
        data   = _load()
        client = _client_or_404(data, client_id)
        risk_data = compute_client_risk(client, 10_000)

    pdf_bytes = generate_pdf(risk_data)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="crq-report-{client_id}.pdf"',
        },
    )


@router.get("/reports", summary="List all generated reports")
def admin_list_reports(_: str = Depends(require_admin)) -> List[Dict[str, Any]]:
    if not os.path.exists(REPORTS_DIR):
        return []
    reports = []
    for cid in sorted(os.listdir(REPORTS_DIR)):
        latest = os.path.join(REPORTS_DIR, cid, "latest.json")
        if os.path.exists(latest):
            mtime = os.path.getmtime(latest)
            reports.append({
                "client_id":    cid,
                "generated_at": datetime.utcfromtimestamp(mtime).isoformat() + "Z",
            })
    return reports
