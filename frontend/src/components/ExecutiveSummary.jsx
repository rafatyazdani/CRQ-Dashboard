import { formatCurrency } from "./MetricCard.jsx";

const SCENARIO_LABELS = {
  "ransomware":     "Ransomware",
  "data-breach":    "Data Breach",
  "bec":            "Business Email Compromise",
  "insider-threat": "Insider Threat",
  "third-party":    "Third-Party / Supply Chain",
};

function RangeBar({ p10, p50, p90, max }) {
  // Positions as % of max
  const pct = (v) => Math.min((v / max) * 100, 100).toFixed(1);
  return (
    <div className="relative">
      {/* Track */}
      <div className="h-2.5 rounded-full bg-slate-800 overflow-visible relative">
        {/* Filled range: P10 → P90 */}
        <div
          className="absolute h-full rounded-full bg-gradient-to-r from-emerald-500/60 via-blue-500/60 to-red-500/60"
          style={{ left: `${pct(p10)}%`, width: `${pct(p90) - pct(p10)}%` }}
        />
        {/* P50 tick */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-brand-400 rounded-full z-10"
          style={{ left: `${pct(p50)}%` }}
        />
        {/* P90 tick */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-red-400 rounded-full z-10"
          style={{ left: `${pct(p90)}%` }}
        />
      </div>

      {/* Labels below bar */}
      <div className="relative mt-2 h-5">
        <span
          className="absolute -translate-x-1/2 text-xs text-emerald-400 font-mono whitespace-nowrap"
          style={{ left: `${pct(p10)}%` }}
        >
          {formatCurrency(p10)}
        </span>
        <span
          className="absolute -translate-x-1/2 text-xs text-brand-400 font-mono whitespace-nowrap"
          style={{ left: `${pct(p50)}%` }}
        >
          {formatCurrency(p50)}
        </span>
        <span
          className="absolute -translate-x-1/2 text-xs text-red-400 font-mono whitespace-nowrap"
          style={{ left: `${Math.min(pct(p90), 92)}%` }}
        >
          {formatCurrency(p90)}
        </span>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />P10 — Best case
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-400" />P50 — Median
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />VaR-90 — Worst case
        </span>
      </div>
    </div>
  );
}

function KeyFinding({ riskData }) {
  const { total_ale, scenarios, total_var_90 } = riskData;
  const topScenario = [...scenarios].sort((a, b) => b.ale.mean - a.ale.mean)[0];
  const topName     = SCENARIO_LABELS[topScenario?.scenario_id] ?? topScenario?.scenario_name ?? "—";
  const topPct      = topScenario?.contribution_pct ?? 0;

  return (
    <div className="p-4 rounded-xl bg-brand-950/30 border border-brand-700/30">
      <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-2">Key Finding</p>
      <p className="text-sm text-slate-300 leading-relaxed">
        The organisation faces an expected annual cyber loss of{" "}
        <span className="font-semibold text-white">{formatCurrency(total_ale.mean)}</span> across{" "}
        <span className="font-semibold text-white">{scenarios.length}</span> modelled threat scenarios.
        In an adverse year (VaR-90), losses could reach{" "}
        <span className="font-semibold text-red-300">{formatCurrency(total_var_90)}</span>.
        The dominant driver is{" "}
        <span className="font-semibold text-amber-300">{topName}</span>, representing{" "}
        <span className="font-semibold text-white">{topPct}%</span> of the portfolio risk.
      </p>
    </div>
  );
}

export default function ExecutiveSummary({ riskData }) {
  if (!riskData) return null;
  const { total_ale, scenarios, total_var_90 } = riskData;
  const topScenario = [...scenarios].sort((a, b) => b.ale.mean - a.ale.mean)[0];
  const rangeMax    = total_ale.p99 * 1.05;

  const stats = [
    {
      label:    "VaR-90 (Worst Case)",
      value:    formatCurrency(total_var_90),
      sub:      "90th percentile portfolio loss",
      color:    "text-red-300",
    },
    {
      label:    "Top Risk Scenario",
      value:    SCENARIO_LABELS[topScenario?.scenario_id] ?? "—",
      sub:      `${topScenario?.contribution_pct}% of portfolio risk`,
      color:    "text-amber-300",
      small:    true,
    },
    {
      label:    "Scenarios Analysed",
      value:    scenarios.length,
      sub:      `${riskData.n_simulations.toLocaleString()} Monte Carlo iterations`,
      color:    "text-brand-300",
      isCurrency: false,
    },
  ];

  return (
    <section className="card p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="label mb-1">Executive Summary</p>
          <h2 className="text-xl font-bold text-white">Portfolio Risk at a Glance</h2>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
          FAIR — Annual Loss Exposure
        </span>
      </div>

      {/* Hero number + supporting stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Central ALE hero */}
        <div className="lg:col-span-1 text-center lg:text-left">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Mean Annual Loss</p>
          <p className="text-5xl font-bold text-white tracking-tight font-mono leading-none">
            {formatCurrency(total_ale.mean)}
          </p>
          <p className="text-xs text-slate-500 mt-2">per year (expected value)</p>
          <p className="text-xs text-slate-600 mt-0.5 font-mono">
            σ = {formatCurrency(total_ale.std)}
          </p>
        </div>

        {/* Supporting stats */}
        <div className="lg:col-span-3 grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/40">
              <p className="label mb-2">{s.label}</p>
              <p className={`font-mono font-bold ${s.small ? "text-base" : "text-2xl"} ${s.color}`}>
                {s.value}
              </p>
              <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Range bar */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">
          Annualised Loss Range — P10 to VaR-90
        </p>
        <RangeBar
          p10={total_ale.p10}
          p50={total_ale.p50}
          p90={total_ale.p90}
          max={rangeMax}
        />
      </div>

      {/* Key finding */}
      <KeyFinding riskData={riskData} />
    </section>
  );
}
