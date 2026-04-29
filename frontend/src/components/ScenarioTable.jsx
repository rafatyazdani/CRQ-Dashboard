import { formatCurrency } from "./MetricCard.jsx";

const CONTRIBUTION_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-red-500",
];

export default function ScenarioTable({ scenarios }) {
  if (!scenarios?.length) return null;

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Scenario Detail</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Per-scenario FAIR outputs — VaR-90, Annualised Loss Range [P10 / P50 / P90], and portfolio contribution
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left py-2 px-3 label">Scenario</th>
              <th className="text-left py-2 px-3 label">Asset / Threat Actor</th>
              <th className="text-right py-2 px-3 label">Eff. Vuln</th>
              <th className="text-right py-2 px-3 label">LEF P50</th>
              <th className="text-right py-2 px-3 label">P10 ALE</th>
              <th className="text-right py-2 px-3 label">P50 ALE</th>
              <th className="text-right py-2 px-3 label">VaR-90</th>
              <th className="text-right py-2 px-3 label">Mean ALE</th>
              <th className="text-left py-2 px-3 label">Risk Share</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s, i) => (
              <tr
                key={s.scenario_id}
                className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors"
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                        CONTRIBUTION_COLORS[i % CONTRIBUTION_COLORS.length]
                      }`}
                    />
                    <span className="text-slate-200 font-medium">{s.scenario_name}</span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <p className="text-slate-300">{s.asset}</p>
                  <p className="text-slate-500 mt-0.5">{s.threat_actor}</p>
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-300">
                  {(s.effective_vuln?.mean * 100).toFixed(1)}%
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-300">
                  {s.lef?.p50?.toFixed(3)}×/yr
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-400">
                  {formatCurrency(s.ale?.p10)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-blue-400">
                  {formatCurrency(s.ale?.p50)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-red-400 font-semibold">
                  {formatCurrency(s.var_90)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-violet-400">
                  {formatCurrency(s.ale?.mean)}
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden min-w-[60px]">
                      <div
                        className={`h-full rounded-full ${
                          CONTRIBUTION_COLORS[i % CONTRIBUTION_COLORS.length]
                        }`}
                        style={{ width: `${s.contribution_pct}%` }}
                      />
                    </div>
                    <span className="text-slate-400 tabular-nums w-10 text-right">
                      {s.contribution_pct}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
