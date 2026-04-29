import { formatCurrency } from "./MetricCard.jsx";

const SCENARIO_COLORS = {
  "ransomware":     "bg-red-500",
  "data-breach":    "bg-orange-500",
  "bec":            "bg-yellow-500",
  "insider-threat": "bg-violet-500",
  "third-party":    "bg-sky-500",
};

// ROI thresholds → display config
function roiStyle(roi) {
  if (roi === null || roi === undefined) return { cls: "text-slate-400", label: "N/A" };
  if (roi >= 400) return { cls: "text-emerald-300 font-bold", label: `${roi.toFixed(0)}%` };
  if (roi >= 100) return { cls: "text-brand-300 font-semibold",  label: `${roi.toFixed(0)}%` };
  if (roi >= 0)   return { cls: "text-amber-300",                label: `${roi.toFixed(0)}%` };
  return            { cls: "text-red-400",                       label: `${roi.toFixed(0)}%` };
}

function ReductionBar({ pct }) {
  if (!pct) return null;
  const w = Math.min(pct, 100);
  const color = pct >= 55 ? "bg-emerald-500" : pct >= 40 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-300 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function ControlsBenefitTable({ scenarios }) {
  // Filter to scenarios that have control_benefit populated
  const rows = (scenarios ?? []).filter((s) => s.control_benefit);
  if (!rows.length) return null;

  // Portfolio totals
  const totals = rows.reduce(
    (acc, s) => {
      const cb = s.control_benefit;
      acc.currentAle     += s.ale.mean;
      acc.controlCost    += cb.annual_cost;
      acc.residualAle    += cb.residual_ale_mean;
      acc.aleReduction   += cb.ale_reduction;
      acc.netBenefit     += cb.net_annual_benefit;
      return acc;
    },
    { currentAle: 0, controlCost: 0, residualAle: 0, aleReduction: 0, netBenefit: 0 }
  );
  const portfolioRoi = totals.controlCost > 0
    ? ((totals.netBenefit / totals.controlCost) * 100).toFixed(0)
    : null;

  return (
    <section className="card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Cost-Benefit of Controls</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Proposed security controls · current vs. residual ALE · ROI analysis
          </p>
        </div>
        {/* Portfolio ROI badge */}
        <div className="text-right">
          <p className="text-xs text-slate-500 mb-1">Portfolio ROI</p>
          <span className={`text-2xl font-bold font-mono ${roiStyle(Number(portfolioRoi)).cls}`}>
            {portfolioRoi ? `${portfolioRoi}%` : "—"}
          </span>
        </div>
      </div>

      {/* Formula note */}
      <div className="mb-4 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
        <p className="text-xs font-mono text-slate-500">
          ROI = (ALE Reduction − Control Cost) ÷ Control Cost × 100 &nbsp;·&nbsp;
          Residual ALE = Current Mean ALE × (1 − Reduction%)
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60">
              <th className="text-left py-2.5 px-3 label">Scenario</th>
              <th className="text-left py-2.5 px-3 label min-w-[160px]">Proposed Control</th>
              <th className="text-right py-2.5 px-3 label">Current ALE</th>
              <th className="text-right py-2.5 px-3 label">Control Cost / yr</th>
              <th className="text-right py-2.5 px-3 label">Residual ALE</th>
              <th className="text-left py-2.5 px-3 label min-w-[120px]">ALE Reduction</th>
              <th className="text-right py-2.5 px-3 label">Net Benefit / yr</th>
              <th className="text-right py-2.5 px-3 label">ROI</th>
              <th className="text-right py-2.5 px-3 label">Payback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const cb  = s.control_benefit;
              const roi = roiStyle(cb.roi_pct);
              const colorDot = SCENARIO_COLORS[s.scenario_id] ?? "bg-slate-500";
              return (
                <tr key={s.scenario_id} className="border-b border-slate-800/80 hover:bg-slate-800/30 transition-colors">
                  {/* Scenario */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${colorDot}`} />
                      <div>
                        <p className="text-slate-200 font-medium leading-tight">
                          {s.scenario_name.split("—")[0].trim()}
                        </p>
                        <p className="text-slate-500 mt-0.5 truncate max-w-[160px]">{s.asset}</p>
                      </div>
                    </div>
                  </td>

                  {/* Proposed control */}
                  <td className="py-3.5 px-3">
                    <p className="text-slate-300 font-medium leading-tight">{cb.name}</p>
                    <p className="text-slate-600 mt-0.5 leading-relaxed max-w-[200px]" title={cb.description}>
                      {cb.description.length > 80 ? cb.description.slice(0, 80) + "…" : cb.description}
                    </p>
                  </td>

                  {/* Current ALE */}
                  <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                    {formatCurrency(s.ale.mean)}
                  </td>

                  {/* Control cost */}
                  <td className="py-3.5 px-3 text-right font-mono text-amber-300">
                    {formatCurrency(cb.annual_cost)}
                  </td>

                  {/* Residual ALE */}
                  <td className="py-3.5 px-3 text-right font-mono text-emerald-400">
                    {formatCurrency(cb.residual_ale_mean)}
                  </td>

                  {/* ALE reduction bar */}
                  <td className="py-3.5 px-3">
                    <ReductionBar pct={cb.ale_reduction_pct} />
                    <p className="text-slate-500 mt-1">{formatCurrency(cb.ale_reduction)}</p>
                  </td>

                  {/* Net benefit */}
                  <td className={`py-3.5 px-3 text-right font-mono font-semibold ${cb.net_annual_benefit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {cb.net_annual_benefit >= 0 ? "+" : ""}{formatCurrency(cb.net_annual_benefit)}
                  </td>

                  {/* ROI */}
                  <td className={`py-3.5 px-3 text-right font-mono ${roi.cls}`}>
                    {roi.label}
                  </td>

                  {/* Payback */}
                  <td className="py-3.5 px-3 text-right text-slate-400">
                    {cb.payback_months != null
                      ? cb.payback_months < 12
                        ? `${cb.payback_months.toFixed(0)} mo`
                        : `${(cb.payback_months / 12).toFixed(1)} yr`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Portfolio totals */}
          <tfoot>
            <tr className="border-t-2 border-slate-600 bg-slate-800/40">
              <td colSpan={2} className="py-3.5 px-3 font-semibold text-slate-300">
                Portfolio Total
              </td>
              <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-200">
                {formatCurrency(totals.currentAle)}
              </td>
              <td className="py-3.5 px-3 text-right font-mono font-semibold text-amber-300">
                {formatCurrency(totals.controlCost)}
              </td>
              <td className="py-3.5 px-3 text-right font-mono font-semibold text-emerald-400">
                {formatCurrency(totals.residualAle)}
              </td>
              <td className="py-3.5 px-3">
                <p className="text-xs text-slate-400 font-mono">{formatCurrency(totals.aleReduction)}</p>
              </td>
              <td className={`py-3.5 px-3 text-right font-mono font-bold ${totals.netBenefit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {totals.netBenefit >= 0 ? "+" : ""}{formatCurrency(totals.netBenefit)}
              </td>
              <td className={`py-3.5 px-3 text-right font-mono font-bold ${roiStyle(Number(portfolioRoi)).cls}`}>
                {portfolioRoi ? `${portfolioRoi}%` : "—"}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ROI legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
        {[
          { label: "≥ 400% — Excellent",     cls: "text-emerald-300" },
          { label: "100–400% — Good",          cls: "text-blue-300" },
          { label: "0–100% — Marginal",        cls: "text-amber-300" },
          { label: "< 0% — Negative return",   cls: "text-red-400" },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className={`font-bold ${item.cls}`}>●</span>
            <span>{item.label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
