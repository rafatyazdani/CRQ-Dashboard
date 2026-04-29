import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "./MetricCard.jsx";

const SCENARIO_COLORS = {
  "ransomware":     "#ef4444",
  "data-breach":    "#f97316",
  "bec":            "#eab308",
  "insider-threat": "#a78bfa",
  "third-party":    "#38bdf8",
};

const DEFAULT_COLORS = ["#ef4444", "#f97316", "#eab308", "#a78bfa", "#38bdf8"];

// ── Risk rating badge based on Mean ALE ──────────────────────────────────────

function aleBadge(aleMean) {
  if (aleMean >= 5_000_000)   return { label: "Critical", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" };
  if (aleMean >= 1_000_000)   return { label: "High",     cls: "bg-orange-500/15 text-orange-300 border-orange-500/30" };
  if (aleMean >= 250_000)     return { label: "Medium",   cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  return                             { label: "Low",      cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const badge = aleBadge(d.mean);
  return (
    <div className="card px-4 py-3 text-xs shadow-2xl min-w-[200px]">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-semibold text-slate-200 truncate max-w-[180px]">{d.fullName}</p>
        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-bold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-6">
          <span className="text-emerald-400">P10 (Best)</span>
          <span className="font-mono font-semibold text-white">{formatCurrency(d.p10)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-brand-400">Mean ALE</span>
          <span className="font-mono font-semibold text-white">{formatCurrency(d.mean)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-red-400">VaR-90</span>
          <span className="font-mono font-semibold text-white">{formatCurrency(d.var90)}</span>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between gap-6">
          <span className="text-slate-400">Risk Share</span>
          <span className="font-mono text-amber-300">{d.pct}%</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-slate-400">Eff. Vuln</span>
          <span className="font-mono text-slate-300">{(d.effVuln * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

export default function ScenarioComparison({ scenarios }) {
  if (!scenarios?.length) return null;

  const data = scenarios.map((s) => ({
    shortName: (() => {
      const map = { ransomware: "Ransomware", "data-breach": "Data Breach", bec: "BEC",
                    "insider-threat": "Insider Threat", "third-party": "Third-Party" };
      return map[s.scenario_id] ?? s.scenario_name.split("—")[0].trim();
    })(),
    fullName:  s.scenario_name,
    mean:      s.ale.mean,
    var90:     s.var_90,
    p10:       s.ale.p10,
    pct:       s.contribution_pct,
    effVuln:   s.effective_vuln?.mean ?? 0,
    color:     SCENARIO_COLORS[s.scenario_id] ?? DEFAULT_COLORS[0],
    id:        s.scenario_id,
  })).sort((a, b) => b.mean - a.mean);

  const portfolioMean = data.reduce((s, d) => s + d.mean, 0);

  return (
    <div className="card p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-slate-200">Scenario Risk Comparison</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Mean Annual Loss Exposure per scenario — ranked by financial impact
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 100, left: 0, bottom: 4 }}
          barSize={22}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={formatCurrency}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            width={115}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#1e293b" }} />
          <ReferenceLine
            x={portfolioMean / data.length}
            stroke="#475569"
            strokeDasharray="4 3"
            label={{ value: "Portfolio avg", fill: "#475569", fontSize: 9, position: "top" }}
          />
          <Bar dataKey="mean" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={d.id} fill={d.color} fillOpacity={0.85} />
            ))}
            <LabelList
              dataKey="mean"
              position="right"
              formatter={formatCurrency}
              style={{ fill: "#94a3b8", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend row with risk badges */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-800">
        {data.map((d) => {
          const badge = aleBadge(d.mean);
          return (
            <div key={d.id} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
              <span className="text-slate-400">{d.shortName}</span>
              <span className="text-slate-600">—</span>
              <span className="font-mono text-slate-300">{d.pct}%</span>
              <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
