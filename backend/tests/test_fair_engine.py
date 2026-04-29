"""Unit tests for the FAIR Monte Carlo engine."""

import numpy as np
import pytest

from fair_engine import (
    pert_sample,
    full_stats,
    build_lec,
    build_histogram,
    _control_benefit,
    compute_client_risk,
    run_scenario_risk,
)

# ── Helpers ──────────────────────────────────────────────────────────────────

SIMPLE_SCENARIO = {
    "id": "ransomware",
    "scenario_type": "ransomware",
    "name": "Ransomware Test",
    "description": "",
    "asset": "Test Asset",
    "threat_actor": "Test Actor",
    "parameters": {
        "tef":            {"min": 0.3,  "most_likely": 1.0,  "max": 3.5},
        "diff":           {"min": 0.15, "most_likely": 0.35, "max": 0.60},
        "vuln":           {"min": 0.15, "most_likely": 0.30, "max": 0.55},
        "asset_value":    10_000_000,
        "loss_magnitude": {"min": 1_000_000, "most_likely": 6_000_000, "max": 25_000_000},
    },
}

SIMPLE_CLIENT = {
    "id": "test-client",
    "name": "Test Client",
    "industry": "Technology",
    "scenarios": [SIMPLE_SCENARIO],
}


# ── pert_sample ───────────────────────────────────────────────────────────────

def test_pert_sample_shape():
    samples = pert_sample(1.0, 5.0, 10.0, 1_000)
    assert samples.shape == (1_000,)


def test_pert_sample_within_bounds():
    samples = pert_sample(1.0, 5.0, 10.0, 10_000)
    assert float(np.min(samples)) >= 1.0
    assert float(np.max(samples)) <= 10.0


def test_pert_sample_degenerate_min_equals_max():
    samples = pert_sample(5.0, 5.0, 5.0, 200)
    assert np.all(samples == 5.0)


def test_pert_sample_mode_near_most_likely():
    # With 50k samples the mode (most frequent bin) should be near most_likely
    samples = pert_sample(0.0, 6.0, 10.0, 50_000)
    counts, edges = np.histogram(samples, bins=100)
    mode_bin_mid = (edges[np.argmax(counts)] + edges[np.argmax(counts) + 1]) / 2
    assert abs(mode_bin_mid - 6.0) < 1.0  # within 10% of range


# ── full_stats ────────────────────────────────────────────────────────────────

def test_full_stats_has_all_keys():
    arr = np.random.rand(1_000)
    stats = full_stats(arr)
    for key in ("mean", "std", "p10", "p25", "p50", "p75", "p90", "p95", "p99"):
        assert key in stats


def test_full_stats_percentile_order():
    arr = np.random.rand(10_000)
    s = full_stats(arr)
    assert s["p10"] <= s["p25"] <= s["p50"] <= s["p75"] <= s["p90"] <= s["p95"] <= s["p99"]


def test_full_stats_std_nonnegative():
    arr = np.random.rand(1_000)
    assert full_stats(arr)["std"] >= 0.0


# ── build_lec ─────────────────────────────────────────────────────────────────

def test_build_lec_returns_101_points():
    arr = np.random.exponential(1e6, 10_000)
    assert len(build_lec(arr)) == 101


def test_build_lec_exceedance_probability_bounds():
    arr = np.random.exponential(1e6, 10_000)
    lec = build_lec(arr)
    assert lec[0]["exceedance_probability"] == 1.0
    assert lec[-1]["exceedance_probability"] == 0.0


def test_build_lec_exceedance_monotone_decreasing():
    arr = np.random.exponential(1e6, 10_000)
    probs = [pt["exceedance_probability"] for pt in build_lec(arr)]
    assert all(probs[i] >= probs[i + 1] for i in range(len(probs) - 1))


def test_build_lec_loss_nonnegative():
    arr = np.abs(np.random.randn(10_000)) * 1e6
    for pt in build_lec(arr):
        assert pt["loss"] >= 0.0


# ── build_histogram ───────────────────────────────────────────────────────────

def test_build_histogram_bin_count():
    arr = np.random.rand(10_000)
    hist = build_histogram(arr, bins=50)
    assert len(hist) == 50


def test_build_histogram_keys():
    arr = np.random.rand(1_000)
    for entry in build_histogram(arr, bins=10):
        assert {"bin_mid", "count", "frequency"} <= entry.keys()


def test_build_histogram_frequencies_sum_to_one():
    arr = np.random.rand(10_000)
    total = sum(h["frequency"] for h in build_histogram(arr, bins=50))
    assert abs(total - 1.0) < 1e-9


# ── _control_benefit ─────────────────────────────────────────────────────────

def test_control_benefit_basic_roi():
    stats = {"mean": 1_000_000.0, "p90": 2_000_000.0}
    ctrl  = {
        "name": "EDR", "description": "",
        "annual_cost": 100_000,
        "residual_ale_reduction_pct": 50,
    }
    result = _control_benefit(ctrl, stats)
    assert result is not None
    assert result["ale_reduction"]       == pytest.approx(500_000.0)
    assert result["net_annual_benefit"]  == pytest.approx(400_000.0)
    assert result["roi_pct"]             == pytest.approx(400.0, abs=0.1)


def test_control_benefit_payback_months():
    stats = {"mean": 1_200_000.0, "p90": 2_400_000.0}
    ctrl  = {"name": "X", "description": "", "annual_cost": 100_000, "residual_ale_reduction_pct": 100}
    result = _control_benefit(ctrl, stats)
    # ALE reduction = 1,200,000; annual_cost = 100,000 → payback = 1 month
    assert result["payback_months"] == pytest.approx(1.0, abs=0.1)


def test_control_benefit_empty_returns_none():
    assert _control_benefit({}, {"mean": 1e6, "p90": 2e6}) is None


def test_control_benefit_zero_cost_roi_is_none():
    stats = {"mean": 1e6, "p90": 2e6}
    ctrl  = {"name": "X", "description": "", "annual_cost": 0, "residual_ale_reduction_pct": 50}
    result = _control_benefit(ctrl, stats)
    assert result["roi_pct"] is None


# ── compute_client_risk ───────────────────────────────────────────────────────

def test_compute_client_risk_top_level_keys():
    result = compute_client_risk(SIMPLE_CLIENT, n_simulations=1_000)
    for key in ("client_id", "total_ale", "total_var_90",
                "loss_exceedance_curve", "histogram", "scenarios"):
        assert key in result


def test_compute_client_risk_ale_percentile_order():
    result = compute_client_risk(SIMPLE_CLIENT, n_simulations=1_000)
    ale = result["total_ale"]
    assert ale["p10"] <= ale["p50"] <= ale["p90"]


def test_compute_client_risk_single_scenario_contribution():
    # One scenario must contribute 100 % of the portfolio
    result = compute_client_risk(SIMPLE_CLIENT, n_simulations=1_000)
    assert result["scenarios"][0]["contribution_pct"] == pytest.approx(100.0, abs=0.01)


def test_compute_client_risk_var90_equals_ale_p90():
    result = compute_client_risk(SIMPLE_CLIENT, n_simulations=1_000)
    assert result["total_var_90"] == pytest.approx(result["total_ale"]["p90"], rel=1e-6)


def test_compute_client_risk_lec_length():
    result = compute_client_risk(SIMPLE_CLIENT, n_simulations=1_000)
    assert len(result["loss_exceedance_curve"]) == 101


def test_compute_client_risk_scenario_count():
    client = {
        "id": "multi", "name": "Multi", "industry": "Finance",
        "scenarios": [SIMPLE_SCENARIO, {**SIMPLE_SCENARIO, "id": "data-breach"}],
    }
    result = compute_client_risk(client, n_simulations=1_000)
    assert len(result["scenarios"]) == 2


def test_compute_client_risk_contributions_sum_to_100():
    client = {
        "id": "multi", "name": "Multi", "industry": "Finance",
        "scenarios": [
            SIMPLE_SCENARIO,
            {**SIMPLE_SCENARIO, "id": "data-breach", "scenario_type": "data-breach"},
        ],
    }
    result = compute_client_risk(client, n_simulations=2_000)
    total = sum(s["contribution_pct"] for s in result["scenarios"])
    assert abs(total - 100.0) < 0.1


# ── run_scenario_risk ─────────────────────────────────────────────────────────

def test_run_scenario_risk_structure():
    result = run_scenario_risk(SIMPLE_SCENARIO, n_simulations=1_000)
    for key in ("ale", "var_90", "annualized_loss_range", "loss_exceedance_curve", "histogram"):
        assert key in result


def test_run_scenario_risk_deterministic():
    r1 = run_scenario_risk(SIMPLE_SCENARIO, n_simulations=500)
    r2 = run_scenario_risk(SIMPLE_SCENARIO, n_simulations=500)
    assert r1["ale"]["mean"] == pytest.approx(r2["ale"]["mean"], rel=1e-6)
