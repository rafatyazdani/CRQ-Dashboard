"""
PDF Report Generator
====================
Combines matplotlib charts (base64-encoded PNG) with a Jinja2 HTML template,
then converts the result to PDF bytes via WeasyPrint.

Usage (called from admin_router.py):
    from pdf_generator import generate_pdf
    pdf_bytes = generate_pdf(risk_data)   # risk_data = output of compute_client_risk()
"""

from __future__ import annotations

import base64
import io
import os
from datetime import datetime
from typing import Any, Dict, List

import matplotlib
matplotlib.use("Agg")  # non-interactive backend — must be set before importing pyplot

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")

SCENARIO_COLORS: Dict[str, str] = {
    "ransomware":     "#dc2626",
    "data-breach":    "#ea580c",
    "bec":            "#ca8a04",
    "insider-threat": "#7c3aed",
    "third-party":    "#0284c7",
}


# ---------------------------------------------------------------------------
# Currency formatter
# ---------------------------------------------------------------------------

def _fmt(v: float) -> str:
    """Short currency string for chart labels and tables."""
    if v >= 1_000_000:
        return f"${v / 1_000_000:.1f}M"
    if v >= 1_000:
        return f"${v / 1_000:.0f}K"
    return f"${v:.0f}"


# ---------------------------------------------------------------------------
# Chart generators
# ---------------------------------------------------------------------------

def _bar_chart_b64(scenarios: List[Dict[str, Any]]) -> str:
    """Horizontal bar chart — Mean ALE per scenario, sorted ascending."""
    data   = sorted(scenarios, key=lambda s: s["ale"]["mean"])
    names  = [s["scenario_name"].split("—")[0].strip()[:30] for s in data]
    values = [s["ale"]["mean"] for s in data]
    colors = [SCENARIO_COLORS.get(s["scenario_id"], "#64748b") for s in data]

    fig, ax = plt.subplots(figsize=(7.5, max(2.5, len(data) * 0.65)), facecolor="#ffffff")
    ax.set_facecolor("#f8fafc")

    bars = ax.barh(names, values, color=colors, height=0.55, edgecolor="none")

    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: _fmt(x)))
    ax.tick_params(axis="x", colors="#64748b", labelsize=9)
    ax.tick_params(axis="y", colors="#1e293b", labelsize=10)
    ax.set_xlabel("Mean Annual Loss Exposure (USD)", color="#64748b", fontsize=9, labelpad=8)

    for sp in ax.spines.values():
        sp.set_visible(False)
    ax.grid(axis="x", color="#e2e8f0", linestyle="-", linewidth=0.8)
    ax.set_axisbelow(True)

    for bar, val in zip(bars, values):
        ax.text(
            bar.get_width() + max(values) * 0.01,
            bar.get_y() + bar.get_height() / 2,
            _fmt(val), va="center", ha="left", color="#475569", fontsize=8.5,
        )

    plt.tight_layout(pad=0.8)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def _lec_chart_b64(lec_data: List[Dict[str, Any]], p50: float, p90: float) -> str:
    """Loss Exceedance Curve with P50 and VaR-90 reference lines."""
    losses = [p["loss"] for p in lec_data]
    probs  = [p["exceedance_probability"] for p in lec_data]

    fig, ax = plt.subplots(figsize=(7.5, 3.5), facecolor="#ffffff")
    ax.set_facecolor("#f8fafc")

    # Risk zone fills
    ax.axvspan(0,   p50, alpha=0.06, color="#22c55e")
    ax.axvspan(p50, p90, alpha=0.08, color="#f59e0b")
    ax.axvspan(p90, max(losses) * 1.05 if losses else p90 * 1.5, alpha=0.08, color="#ef4444")

    ax.plot(losses, probs, color="#2563eb", linewidth=2.2)
    ax.fill_between(losses, probs, alpha=0.10, color="#2563eb")

    # Reference lines
    ax.axvline(p50, color="#3b82f6", linestyle="--", linewidth=1.2, alpha=0.9)
    ax.axvline(p90, color="#ef4444",  linestyle="--", linewidth=1.2, alpha=0.9)

    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda x, _: _fmt(x)))
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda y, _: f"{y * 100:.0f}%"))
    ax.tick_params(colors="#64748b", labelsize=9)
    ax.set_xlabel("Annual Loss Threshold (USD)", color="#64748b", fontsize=9, labelpad=8)
    ax.set_ylabel("Exceedance Probability", color="#64748b", fontsize=9, labelpad=8)

    for sp in ax.spines.values():
        sp.set_visible(False)
    ax.grid(color="#e2e8f0", linestyle="-", linewidth=0.7)
    ax.set_axisbelow(True)

    # Labels for reference lines
    ymax = ax.get_ylim()[1]
    ax.text(p50, ymax * 0.96, " P50", color="#2563eb", fontsize=8, va="top")
    ax.text(p90, ymax * 0.96, " VaR-90", color="#ef4444", fontsize=8, va="top")

    plt.tight_layout(pad=0.8)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def generate_pdf(risk_data: Dict[str, Any]) -> bytes:
    """
    Render a full FAIR risk report to PDF bytes.

    Parameters
    ----------
    risk_data : dict
        Output of ``fair_engine.compute_client_risk()``.

    Returns
    -------
    bytes
        Raw PDF content ready to stream as ``application/pdf``.
    """
    try:
        from weasyprint import HTML  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError(
            "WeasyPrint is required for PDF export. "
            "Install it with: pip install weasyprint"
        ) from exc

    total_ale = risk_data["total_ale"]
    p50 = total_ale.get("p50", 0)
    p90 = total_ale.get("p90", 0)

    bar_chart = _bar_chart_b64(risk_data["scenarios"])
    lec_chart = _lec_chart_b64(risk_data["loss_exceedance_curve"], p50, p90)

    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=select_autoescape(["html"]),
    )
    env.filters["fmt"] = _fmt

    template = env.get_template("report.html")
    html_str = template.render(
        risk=risk_data,
        bar_chart_b64=bar_chart,
        lec_chart_b64=lec_chart,
        generated_at=datetime.utcnow().strftime("%d %B %Y"),
        fmt=_fmt,
    )

    return HTML(string=html_str, base_url=TEMPLATE_DIR).write_pdf()
