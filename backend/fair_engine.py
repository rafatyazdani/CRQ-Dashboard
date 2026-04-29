"""
FAIR (Factor Analysis of Information Risk) Monte Carlo Engine — v2
================================================================
Supported inputs per scenario (all PERT-distributed):
  TEF   — Threat Event Frequency        (events/year)
  DIFF  — Difficulty / Control Strength (0–1; higher = harder to exploit)
  VULN  — Base Vulnerability            (0–1; innate exploitability pre-controls)
  LM    — Loss Magnitude                (USD, combined primary + secondary)
  asset_value  — Asset value in USD     (scalar reference, not sampled)

FAIR causal chain:
  effective_vuln = VULN × (1 − DIFF)   # DIFF attenuates exploitability
  LEF            = TEF  × effective_vuln
  ALE            = LEF  × LM

Loss Exceedance Curve format (percentile-indexed):
  percentile            : 0 → 100 (cumulative probability × 100)
  loss                  : ALE at that percentile
  exceedance_probability: 1 − percentile/100  (P[ALE > loss])
"""

from __future__ import annotations

import numpy as np
from typing import Any, Dict, List, Optional  # noqa: F401


# ── PERT / Beta distribution ─────────────────────────────────────────────────

def pert_sample(minimum: float, most_likely: float, maximum: float, size: int) -> np.ndarray:
    """
    Sample from a Modified PERT distribution (Beta approximation, λ=4).

    Weighted mean:  μ = (min + 4·ml + max) / 6
    Beta params:    α = 1 + 4·(μ−min)/(max−min)
                    β = 1 + 4·(max−μ)/(max−min)

    Degenerates gracefully when min == max.
    """
    minimum, most_likely, maximum = float(minimum), float(most_likely), float(maximum)

    if minimum >= maximum:
        return np.full(size, most_likely)

    # Parameterise directly from the mode (most_likely), not the weighted mean.
    # Beta params for PERT with λ=4:
    #   α = 1 + λ·(ml − min)/(max − min)
    #   β = 1 + λ·(max − ml)/(max − min)
    # This guarantees mode(Beta) == most_likely and mean == (min+4·ml+max)/6.
    ml_norm = float(np.clip((most_likely - minimum) / (maximum - minimum), 1e-6, 1 - 1e-6))

    alpha   = 1.0 + 4.0 * ml_norm
    beta_v  = 1.0 + 4.0 * (1.0 - ml_norm)

    return minimum + np.random.beta(alpha, beta_v, size) * (maximum - minimum)


# ── Statistics helpers ───────────────────────────────────────────────────────

_PERCENTILE_MARKS = [10, 25, 50, 75, 90, 95, 99]


def full_stats(arr: np.ndarray) -> Dict[str, float]:
    """Return mean, std, and key percentiles for an array."""
    pct = np.percentile(arr, _PERCENTILE_MARKS)
    return {
        "mean": float(np.mean(arr)),
        "std":  float(np.std(arr)),
        "p10":  float(pct[0]),
        "p25":  float(pct[1]),
        "p50":  float(pct[2]),
        "p75":  float(pct[3]),
        "p90":  float(pct[4]),
        "p95":  float(pct[5]),
        "p99":  float(pct[6]),
    }


def build_lec(ale_samples: np.ndarray, n_points: int = 101) -> List[Dict[str, float]]:
    """
    Build a Loss Exceedance Curve dataset at evenly-spaced percentiles.

    Each point answers: "What loss amount is exceeded with probability p?"
      exceedance_probability = 1 − percentile/100

    Returns 101 points (0 % → 100 %) for smooth chart rendering.
    """
    pct_values  = np.linspace(0.0, 100.0, n_points)
    loss_values = np.percentile(ale_samples, pct_values)
    return [
        {
            "percentile":             round(float(p), 1),
            "loss":                   float(max(l, 0.0)),
            "exceedance_probability": round(1.0 - float(p) / 100.0, 4),
        }
        for p, l in zip(pct_values, loss_values)
    ]


def build_histogram(arr: np.ndarray, bins: int = 50) -> List[Dict[str, Any]]:
    counts, edges = np.histogram(arr, bins=bins)
    n = len(arr)
    return [
        {
            "bin_mid":   float((edges[i] + edges[i + 1]) / 2),
            "count":     int(counts[i]),
            "frequency": float(counts[i] / n),
        }
        for i in range(len(counts))
    ]


# ── Control cost-benefit helper ──────────────────────────────────────────────

def _control_benefit(ctrl: Dict[str, Any], ale_stats: Dict[str, float]) -> Optional[Dict[str, Any]]:
    """
    Compute cost-benefit metrics for a proposed security control.

    Residual ALE is estimated by applying the consultant-supplied
    `residual_ale_reduction_pct` to the simulated mean and P90 ALE.
    ROI = (ALE reduction − control cost) / control cost × 100.
    """
    if not ctrl:
        return None

    mean_ale    = ale_stats["mean"]
    var_90      = ale_stats["p90"]
    annual_cost = float(ctrl.get("annual_cost", 0))
    red_pct     = float(ctrl.get("residual_ale_reduction_pct", 0)) / 100.0

    residual_mean = mean_ale * (1.0 - red_pct)
    residual_p90  = var_90   * (1.0 - red_pct)   # proportional approximation
    ale_reduction = mean_ale - residual_mean
    net_benefit   = ale_reduction - annual_cost

    return {
        "name":                ctrl.get("name", ""),
        "description":         ctrl.get("description", ""),
        "annual_cost":         annual_cost,
        "ale_reduction_pct":   round(red_pct * 100, 1),
        "residual_ale_mean":   residual_mean,
        "residual_var_90":     residual_p90,
        "ale_reduction":       ale_reduction,
        "net_annual_benefit":  net_benefit,
        "roi_pct":             round(net_benefit / annual_cost * 100, 1) if annual_cost > 0 else None,
        "payback_months":      round(annual_cost / ale_reduction * 12, 1) if ale_reduction > 0 else None,
    }


# ── Core simulation ──────────────────────────────────────────────────────────

def _simulate(params: Dict[str, Any], n: int) -> Dict[str, np.ndarray]:
    """
    Draw n Monte Carlo samples for one scenario.

    Returns a dict of raw numpy arrays (not yet summarised) so that
    callers can aggregate across scenarios before computing statistics.
    """
    tef_p  = params["tef"]
    diff_p = params["diff"]
    vuln_p = params["vuln"]
    lm_p   = params["loss_magnitude"]

    tef_s  = pert_sample(tef_p["min"],  tef_p["most_likely"],  tef_p["max"],  n)
    diff_s = np.clip(pert_sample(diff_p["min"], diff_p["most_likely"], diff_p["max"], n), 0.0, 1.0)
    vuln_s = np.clip(pert_sample(vuln_p["min"], vuln_p["most_likely"], vuln_p["max"], n), 0.0, 1.0)
    lm_s   = pert_sample(lm_p["min"],  lm_p["most_likely"],  lm_p["max"],  n)

    # DIFF reduces exploitability: effective_vuln = VULN × (1 − DIFF)
    eff_vuln_s = vuln_s * (1.0 - diff_s)
    lef_s      = tef_s  * eff_vuln_s
    ale_s      = lef_s  * lm_s

    return {
        "tef":            tef_s,
        "diff":           diff_s,
        "vuln":           vuln_s,
        "effective_vuln": eff_vuln_s,
        "lef":            lef_s,
        "lm":             lm_s,
        "ale":            ale_s,
    }


def _scenario_output(scenario: Dict[str, Any], s: Dict[str, np.ndarray]) -> Dict[str, Any]:
    """
    Compute all per-scenario FAIR outputs from raw simulation arrays.
    contribution_pct is left at 0.0 for the caller to fill.
    """
    ale_s = s["ale"]
    stats  = full_stats(ale_s)

    return {
        # Identity
        "scenario_id":   scenario["id"],
        "scenario_name": scenario["name"],
        "scenario_type": scenario.get("scenario_type", ""),
        "asset":         scenario.get("asset", ""),
        "threat_actor":  scenario.get("threat_actor", ""),
        "description":   scenario.get("description", ""),
        "asset_value":   scenario["parameters"].get("asset_value"),

        # ALE distribution
        "ale": stats,

        # 90th-percentile Value-at-Risk
        "var_90": stats["p90"],

        # Annualized loss range (P10 / P50 / P90)
        "annualized_loss_range": {
            "min":    stats["p10"],
            "likely": stats["p50"],
            "max":    stats["p90"],
        },

        # FAIR intermediate factors
        "lef": {
            "mean": float(np.mean(s["lef"])),
            "p50":  float(np.median(s["lef"])),
            "p90":  float(np.percentile(s["lef"], 90)),
        },
        "loss_magnitude": {
            "mean": float(np.mean(s["lm"])),
            "p50":  float(np.median(s["lm"])),
        },
        "effective_vuln": {
            "mean": float(np.mean(s["effective_vuln"])),
            "p50":  float(np.median(s["effective_vuln"])),
        },
        "diff_mean": float(np.mean(s["diff"])),
        "vuln_mean": float(np.mean(s["vuln"])),

        # Per-scenario LEC (for drill-down views)
        "loss_exceedance_curve": build_lec(ale_s),

        # Risk share across portfolio (filled by caller)
        "contribution_pct": 0.0,

        # Control cost-benefit (populated when proposed_control is defined in JSON)
        "control_benefit": _control_benefit(scenario.get("proposed_control", {}), stats),
    }


# ── Public API ───────────────────────────────────────────────────────────────

def compute_client_risk(client: Dict[str, Any], n_simulations: int = 10000) -> Dict[str, Any]:
    """
    Aggregate Monte Carlo FAIR analysis across all client scenarios.

    Scenarios are summed per-simulation iteration (shared RNG seed
    preserves run-to-run reproducibility).
    """
    np.random.seed(42)

    raw: List[Dict[str, np.ndarray]] = []
    total_ale = np.zeros(n_simulations)

    for scenario in client.get("scenarios", []):
        s = _simulate(scenario["parameters"], n_simulations)
        total_ale += s["ale"]
        raw.append(s)

    # Compute per-scenario outputs + contribution percentages
    total_mean = float(np.mean(total_ale)) or 1.0
    scenario_results: List[Dict[str, Any]] = []
    for scenario, s in zip(client["scenarios"], raw):
        out = _scenario_output(scenario, s)
        out["contribution_pct"] = round(out["ale"]["mean"] / total_mean * 100, 1)
        scenario_results.append(out)

    total_stats = full_stats(total_ale)

    return {
        # Client metadata
        "client_id":    client["id"],
        "client_name":  client["name"],
        "industry":     client.get("industry", ""),
        "n_simulations": n_simulations,

        # Portfolio-level ALE
        "total_ale": total_stats,

        # Portfolio VaR and loss range
        "total_var_90": total_stats["p90"],
        "total_annualized_loss_range": {
            "min":    total_stats["p10"],
            "likely": total_stats["p50"],
            "max":    total_stats["p90"],
        },

        # Portfolio Loss Exceedance Curve (percentile → loss amount)
        "loss_exceedance_curve": build_lec(total_ale),

        # Distribution histogram
        "histogram": build_histogram(total_ale),

        # Per-scenario results
        "scenarios": scenario_results,
    }


def run_scenario_risk(scenario: Dict[str, Any], n_simulations: int = 10000) -> Dict[str, Any]:
    """
    Run a full FAIR analysis for a single named scenario.
    Useful for per-scenario drill-down or ad-hoc analysis.
    """
    np.random.seed(42)
    s = _simulate(scenario["parameters"], n_simulations)
    out = _scenario_output(scenario, s)
    out["n_simulations"] = n_simulations
    out["histogram"]     = build_histogram(s["ale"])
    return out


def run_adhoc(scenario_def: Dict[str, Any], n_simulations: int = 10000) -> Dict[str, Any]:
    """
    Ad-hoc Monte Carlo run for a scenario definition submitted via POST /fair/run.
    Does not require a persisted client record.
    """
    np.random.seed(0)
    s     = _simulate(scenario_def["parameters"], n_simulations)
    ale_s = s["ale"]
    stats = full_stats(ale_s)

    return {
        "scenario_name": scenario_def.get("name", "Ad-hoc Scenario"),
        "n_simulations": n_simulations,

        # ALE
        "ale": stats,
        "var_90": stats["p90"],
        "annualized_loss_range": {
            "min":    stats["p10"],
            "likely": stats["p50"],
            "max":    stats["p90"],
        },

        # Intermediate factors
        "lef_mean":           float(np.mean(s["lef"])),
        "effective_vuln_mean": float(np.mean(s["effective_vuln"])),
        "diff_mean":           float(np.mean(s["diff"])),
        "vuln_mean":           float(np.mean(s["vuln"])),

        # Charts
        "loss_exceedance_curve": build_lec(ale_s),
        "histogram":             build_histogram(ale_s),
    }
