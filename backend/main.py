"""
CRQ FastAPI Backend — FAIR Methodology Engine v2
=================================================
Endpoints
---------
  GET  /                                            Health / root
  GET  /health
  GET  /scenarios/types                             Canonical 5 scenario definitions
  POST /fair/run                                    Ad-hoc Monte Carlo simulation
  GET  /clients                                     List all clients
  GET  /clients/{client_id}                         Full client record
  GET  /clients/{client_id}/risk                    Portfolio Monte Carlo (all scenarios)
  GET  /clients/{client_id}/scenarios/{sid}/risk    Single-scenario Monte Carlo
  PUT  /clients/{client_id}/scenarios/{sid}/parameters  Update FAIR inputs (consultant)
"""

from datetime import datetime
from typing import Optional
import json
import os

import io

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from fair_engine import compute_client_risk, run_scenario_risk, run_adhoc
from admin_router import router as admin_router
from limiter import limiter

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CRQ API — FAIR Risk Engine",
    description=(
        "Cyber Risk Quantification API implementing the FAIR methodology.\n\n"
        "**FAIR causal chain** (per scenario):\n"
        "```\n"
        "effective_vuln = VULN × (1 − DIFF)\n"
        "LEF            = TEF  × effective_vuln\n"
        "ALE            = LEF  × Loss Magnitude\n"
        "```"
    ),
    version="2.0.0",
    docs_url="/docs",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "clients.json")


# ---------------------------------------------------------------------------
# Canonical scenario definitions (the 5 supported types)
# ---------------------------------------------------------------------------

SCENARIO_TYPES = {
    "ransomware": {
        "id":          "ransomware",
        "name":        "Ransomware",
        "description": (
            "Threat actor deploys ransomware encrypting critical systems, "
            "causing operational outage, recovery costs, and potential data loss."
        ),
        "typical_threat_actors": ["Organized Cybercriminal Group", "Ransomware-as-a-Service Affiliate"],
        "loss_categories": ["Business Interruption", "Recovery/Remediation", "Ransom Payment", "Regulatory Fines"],
        "default_parameters": {
            "tef":            {"min": 0.3,  "most_likely": 1.0,  "max": 3.5},
            "diff":           {"min": 0.15, "most_likely": 0.35, "max": 0.60},
            "vuln":           {"min": 0.15, "most_likely": 0.30, "max": 0.55},
            "loss_magnitude": {"min": 1_000_000, "most_likely": 6_000_000, "max": 25_000_000},
        },
    },
    "data-breach": {
        "id":          "data-breach",
        "name":        "Data Breach",
        "description": (
            "Unauthorized exfiltration of sensitive customer or employee data via compromised "
            "credentials, SQL injection, or insider access."
        ),
        "typical_threat_actors": ["Advanced Persistent Threat", "Opportunistic Attacker"],
        "loss_categories": ["Regulatory Fines", "Legal Liability", "Notification Costs", "Reputational Damage"],
        "default_parameters": {
            "tef":            {"min": 0.2,  "most_likely": 0.7,  "max": 2.0},
            "diff":           {"min": 0.20, "most_likely": 0.45, "max": 0.70},
            "vuln":           {"min": 0.10, "most_likely": 0.22, "max": 0.45},
            "loss_magnitude": {"min": 2_000_000, "most_likely": 10_000_000, "max": 45_000_000},
        },
    },
    "bec": {
        "id":          "bec",
        "name":        "Business Email Compromise",
        "description": (
            "Social engineering attack targeting finance or executive staff to initiate "
            "fraudulent wire transfers or redirect payroll/vendor payments."
        ),
        "typical_threat_actors": ["Cybercriminal Group", "Fraud Ring"],
        "loss_categories": ["Direct Financial Fraud Loss", "Recovery Costs", "Reputational Damage"],
        "default_parameters": {
            "tef":            {"min": 2.0,  "most_likely": 6.0,  "max": 15.0},
            "diff":           {"min": 0.30, "most_likely": 0.55, "max": 0.80},
            "vuln":           {"min": 0.03, "most_likely": 0.08, "max": 0.18},
            "loss_magnitude": {"min": 150_000, "most_likely": 700_000, "max": 3_500_000},
        },
    },
    "insider-threat": {
        "id":          "insider-threat",
        "name":        "Insider Threat",
        "description": (
            "Malicious or negligent employee / contractor with privileged access exfiltrates "
            "sensitive data, sabotages systems, or enables external compromise."
        ),
        "typical_threat_actors": ["Malicious Employee", "Negligent Insider", "Compromised Contractor"],
        "loss_categories": ["Data Exfiltration Costs", "Legal & HR", "IP Loss", "Regulatory"],
        "default_parameters": {
            "tef":            {"min": 0.1,  "most_likely": 0.4,  "max": 1.2},
            "diff":           {"min": 0.05, "most_likely": 0.20, "max": 0.40},
            "vuln":           {"min": 0.30, "most_likely": 0.50, "max": 0.75},
            "loss_magnitude": {"min": 400_000, "most_likely": 2_500_000, "max": 12_000_000},
        },
    },
    "third-party": {
        "id":          "third-party",
        "name":        "Third-Party / Supply Chain Attack",
        "description": (
            "Compromise through a trusted vendor, managed service provider, or software "
            "supply chain, giving attacker initial access with limited detectability."
        ),
        "typical_threat_actors": ["Nation-State Actor", "Sophisticated Cybercriminal Group"],
        "loss_categories": ["Breach Response", "Business Interruption", "Regulatory Fines", "Third-Party Liability"],
        "default_parameters": {
            "tef":            {"min": 0.1,  "most_likely": 0.3,  "max": 0.9},
            "diff":           {"min": 0.10, "most_likely": 0.30, "max": 0.55},
            "vuln":           {"min": 0.25, "most_likely": 0.45, "max": 0.70},
            "loss_magnitude": {"min": 2_000_000, "most_likely": 9_000_000, "max": 40_000_000},
        },
    },
}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ParameterRange(BaseModel):
    min:         float = Field(..., ge=0,   description="Minimum (optimistic) value")
    most_likely: float = Field(..., ge=0,   description="Most likely (mode) value")
    max:         float = Field(..., ge=0,   description="Maximum (pessimistic) value")

    @model_validator(mode="after")
    def check_order(self) -> "ParameterRange":
        if self.min > self.most_likely:
            raise ValueError("min must be ≤ most_likely")
        if self.most_likely > self.max:
            raise ValueError("most_likely must be ≤ max")
        return self


class ScenarioParameters(BaseModel):
    tef: ParameterRange = Field(
        ..., description="Threat Event Frequency — how often a threat actor acts against the asset (events/year)"
    )
    diff: ParameterRange = Field(
        ..., description="Difficulty / Control Strength — resistance the organisation presents (0=none, 1=perfect)"
    )
    vuln: ParameterRange = Field(
        ..., description="Base Vulnerability — innate exploitability of the asset before controls are applied (0–1)"
    )
    asset_value: Optional[float] = Field(
        None, ge=0, description="Market/replacement value of the asset at risk (USD)"
    )
    loss_magnitude: ParameterRange = Field(
        ..., description="Combined loss magnitude per loss event (USD) — primary + secondary losses"
    )


class AdHocScenario(BaseModel):
    name:        str              = Field("Ad-hoc Scenario", description="Human-readable scenario label")
    parameters:  ScenarioParameters


class OperationalInputs(BaseModel):
    scenario_type:          str   = Field("ransomware", description="One of the 5 canonical scenario type IDs")
    incidents_per_year:     float = Field(..., ge=0,   description="Historical or estimated incidents/attempts per year")
    downtime_cost_per_day:  float = Field(0,   ge=0,   description="Business cost per day of downtime (USD)")
    avg_downtime_days:      float = Field(3,   ge=0,   description="Average recovery/downtime duration (days)")
    mfa_coverage_pct:       float = Field(50,  ge=0,   le=100, description="Percentage of users/systems covered by MFA (0–100)")
    edr_maturity:           str   = Field("Medium",    description="EDR deployment maturity: Low / Medium / High")
    backup_maturity:        str   = Field("Medium",    description="Backup & recovery maturity: Low / Medium / High")
    patch_cadence:          str   = Field("Monthly",   description="Patch management cadence: Ad-hoc / Monthly / Weekly")
    annual_revenue:         Optional[float] = Field(None, ge=0, description="Client annual revenue (USD) — optional context")


# ---------------------------------------------------------------------------
# Data access helpers
# ---------------------------------------------------------------------------

def _load() -> dict:
    with open(DATA_FILE, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _save(data: dict) -> None:
    with open(DATA_FILE, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)


def _client(data: dict, client_id: str) -> dict:
    c = next((x for x in data["clients"] if x["id"] == client_id), None)
    if not c:
        raise HTTPException(404, f"Client '{client_id}' not found")
    return c


def _scenario(client: dict, scenario_id: str) -> dict:
    s = next((x for x in client["scenarios"] if x["id"] == scenario_id), None)
    if not s:
        raise HTTPException(404, f"Scenario '{scenario_id}' not found")
    return s


def _clamp_simulations(n: int) -> int:
    return max(1_000, min(n, 50_000))


# ---------------------------------------------------------------------------
# Routes — health / meta
# ---------------------------------------------------------------------------

@app.get("/", tags=["Meta"])
def root():
    return {
        "service":     "CRQ API — FAIR Risk Engine",
        "version":     "2.0.0",
        "methodology": "FAIR (Factor Analysis of Information Risk)",
        "docs":        "/docs",
    }


@app.get("/health", tags=["Meta"])
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat() + "Z"}


@app.get("/scenarios/types", tags=["FAIR Engine"], summary="List the 5 canonical FAIR scenario types")
def list_scenario_types():
    """
    Returns the five supported scenario archetypes with their descriptions,
    typical threat actors, loss categories, and default PERT parameter ranges.
    Consultants use these as starting-point benchmarks when calibrating client parameters.
    """
    return list(SCENARIO_TYPES.values())


# ---------------------------------------------------------------------------
# Routes — ad-hoc simulation
# ---------------------------------------------------------------------------

@app.post(
    "/fair/run",
    tags=["FAIR Engine"],
    summary="Ad-hoc Monte Carlo FAIR simulation",
    description=(
        "Run a full FAIR simulation for a single scenario definition without "
        "requiring a persisted client record. Returns ALE stats, VaR-90, "
        "annualized loss range, loss exceedance curve, and histogram."
    ),
)
@limiter.limit("10/minute")
def adhoc_simulation(
    request: Request,
    scenario: AdHocScenario,
    simulations: int = Query(10_000, ge=1_000, le=50_000, description="Number of Monte Carlo iterations"),
):
    payload = {"name": scenario.name, "parameters": scenario.parameters.model_dump()}
    return run_adhoc(payload, _clamp_simulations(simulations))


@app.post(
    "/fair/derive-parameters",
    tags=["FAIR Engine"],
    summary="Derive FAIR parameters from operational data",
    description=(
        "Translates operational security metrics (incident history, downtime costs, "
        "control maturity) into FAIR PERT input ranges for TEF, DIFF, VULN, and "
        "Loss Magnitude. Use this to quickly bootstrap a new client's parameters "
        "from data they already have, rather than estimating FAIR inputs from scratch."
    ),
)
def derive_parameters(inputs: OperationalInputs):
    # ── TEF: anchor to historical/estimated incident frequency ─────────────────
    tef_mode = max(0.1, float(inputs.incidents_per_year))
    tef = {
        "min":         round(tef_mode * 0.5, 2),
        "most_likely": round(tef_mode,       2),
        "max":         round(tef_mode * 2.0, 2),
    }

    # ── Loss Magnitude: anchor to downtime cost; fall back to scenario default ─
    base_loss = inputs.downtime_cost_per_day * inputs.avg_downtime_days
    if base_loss <= 0:
        sc_defaults = SCENARIO_TYPES.get(inputs.scenario_type, SCENARIO_TYPES["ransomware"])
        base_loss = sc_defaults["default_parameters"]["loss_magnitude"]["most_likely"]

    loss_magnitude = {
        "min":         round(base_loss * 0.30),
        "most_likely": round(base_loss),
        "max":         round(base_loss * 3.0),
    }

    # ── DIFF: weighted score from control maturity signals ────────────────────
    edr_scores    = {"Low": 0.10, "Medium": 0.25, "High": 0.40}
    backup_scores = {"Low": 0.05, "Medium": 0.15, "High": 0.25}
    patch_scores  = {"Ad-hoc": 0.03, "Monthly": 0.08, "Weekly": 0.15}

    control_score = (
        (inputs.mfa_coverage_pct / 100.0) * 0.30
        + edr_scores.get(inputs.edr_maturity,    0.25)
        + backup_scores.get(inputs.backup_maturity, 0.15)
        + patch_scores.get(inputs.patch_cadence,   0.08)
    )
    control_score = min(control_score, 0.90)

    diff_mode = round(control_score, 2)
    diff = {
        "min":         round(max(0.05, diff_mode - 0.20), 2),
        "most_likely": diff_mode,
        "max":         round(min(0.95, diff_mode + 0.20), 2),
    }

    # ── VULN: use scenario archetype defaults (innate asset exploitability) ────
    sc = SCENARIO_TYPES.get(inputs.scenario_type, SCENARIO_TYPES["ransomware"])
    vuln = sc["default_parameters"]["vuln"]

    # ── Derivation notes for transparency ─────────────────────────────────────
    notes = [
        f"TEF anchored to {inputs.incidents_per_year} incidents/yr → mode {tef_mode:.1f} (range ×0.5 – ×2.0)",
        f"Loss Magnitude anchored to ${base_loss:,.0f} (${inputs.downtime_cost_per_day:,.0f}/day × {inputs.avg_downtime_days} days)",
        f"DIFF {diff_mode:.0%} from: MFA {inputs.mfa_coverage_pct:.0f}%, "
        f"EDR {inputs.edr_maturity}, Backup {inputs.backup_maturity}, Patch {inputs.patch_cadence}",
        f"VULN uses {inputs.scenario_type} archetype defaults (innate exploitability, pre-controls)",
    ]

    return {
        "tef":                           tef,
        "diff":                          diff,
        "vuln":                          vuln,
        "loss_magnitude":                loss_magnitude,
        "control_effectiveness_estimate": round(control_score, 2),
        "derivation_notes":              notes,
    }


# ---------------------------------------------------------------------------
# Routes — clients
# ---------------------------------------------------------------------------

@app.get("/clients", tags=["Clients"], summary="List all clients")
def list_clients():
    data = _load()
    return [
        {
            "id":             c["id"],
            "name":           c["name"],
            "industry":       c["industry"],
            "contact":        c.get("contact"),
            "last_updated":   c.get("last_updated"),
            "scenario_count": len(c.get("scenarios", [])),
            "risk_tier":      c.get("risk_tier", "Medium"),
        }
        for c in data["clients"]
    ]


@app.get(
    "/clients/{client_id}",
    tags=["Clients"],
    summary="Get full client record (FAIR parameters included)",
)
def get_client(client_id: str):
    return _client(_load(), client_id)


# ---------------------------------------------------------------------------
# Routes — risk computation
# ---------------------------------------------------------------------------

@app.get(
    "/clients/{client_id}/risk",
    tags=["Risk"],
    summary="Portfolio-level Monte Carlo FAIR analysis (all scenarios aggregated)",
    description=(
        "Runs 10 000 (or custom) Monte Carlo iterations per scenario, sums ALE samples "
        "across all scenarios, and returns: aggregated ALE distribution, total VaR-90, "
        "annualized loss range, portfolio loss exceedance curve (percentile → loss), "
        "histogram, and per-scenario breakdowns."
    ),
)
def get_client_risk(
    client_id: str,
    simulations: int = Query(10_000, ge=1_000, le=50_000, description="Monte Carlo iterations"),
):
    data = _load()
    client = _client(data, client_id)
    return compute_client_risk(client, _clamp_simulations(simulations))


@app.get(
    "/clients/{client_id}/scenarios/{scenario_id}/risk",
    tags=["Risk"],
    summary="Single-scenario Monte Carlo FAIR analysis",
    description=(
        "Runs a full FAIR simulation for one named scenario and returns its "
        "ALE distribution, VaR-90, annualized loss range [P10/P50/P90], "
        "per-scenario loss exceedance curve, and histogram."
    ),
)
def get_scenario_risk(
    client_id: str,
    scenario_id: str,
    simulations: int = Query(10_000, ge=1_000, le=50_000),
):
    data = _load()
    client   = _client(data, client_id)
    scenario = _scenario(client, scenario_id)
    return run_scenario_risk(scenario, _clamp_simulations(simulations))


# ---------------------------------------------------------------------------
# Routes — parameter management (consultant)
# ---------------------------------------------------------------------------

@app.get(
    "/clients/{client_id}/report.pdf",
    tags=["Clients"],
    summary="Export executive risk report as PDF (public — no auth required)",
)
def get_client_report_pdf(client_id: str):
    """
    Generates and streams a PDF risk report for a client.
    Uses the cached Monte Carlo results if available (generated via the admin panel),
    otherwise runs a fresh 10,000-iteration simulation.

    Requires WeasyPrint to be installed: ``pip install weasyprint``
    """
    try:
        from pdf_generator import generate_pdf  # noqa: PLC0415
    except ImportError:
        raise HTTPException(500, "PDF generation requires WeasyPrint: pip install weasyprint")

    _reports_dir = os.path.join(os.path.dirname(__file__), "reports")
    report_path  = os.path.join(_reports_dir, client_id, "latest.json")

    if os.path.exists(report_path):
        with open(report_path, "r", encoding="utf-8") as fh:
            risk_data = json.load(fh)
    else:
        data   = _load()
        client = _client(data, client_id)
        risk_data = compute_client_risk(client, 10_000)

    try:
        pdf_bytes = generate_pdf(risk_data)
    except RuntimeError as exc:
        raise HTTPException(500, str(exc))

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="crq-report-{client_id}.pdf"'},
    )


@app.put(
    "/clients/{client_id}/scenarios/{scenario_id}/parameters",
    tags=["Consultant"],
    summary="Update FAIR input parameters for a scenario",
    description=(
        "Persists updated TEF / DIFF / VULN / asset_value / loss_magnitude "
        "for one scenario. Re-running the risk endpoint will reflect the new values."
    ),
)
def update_parameters(client_id: str, scenario_id: str, params: ScenarioParameters):
    data     = _load()
    client   = _client(data, client_id)
    scenario = _scenario(client, scenario_id)

    scenario["parameters"] = params.model_dump()
    client["last_updated"] = datetime.utcnow().strftime("%Y-%m-%d")
    _save(data)

    return {
        "status":      "updated",
        "client_id":   client_id,
        "scenario_id": scenario_id,
        "updated_at":  client["last_updated"],
        "parameters":  scenario["parameters"],
    }
