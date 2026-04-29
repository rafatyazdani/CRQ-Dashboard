import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "./MetricCard.jsx";

// Short format for tooltip: $2.4M, $850K etc.
function fmtLoss(v) {
  if (!v && v !== 0) return "—";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)         return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { loss, exceedance_probability, percentile } = payload[0].payload;
  return (
    <div className="card px-3 py-2.5 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">Loss Threshold</p>
      <p className="font-mono font-bold text-white text-sm">{fmtLoss(loss)}</p>
      <div className="mt-2 pt-2 border-t border-slate-700/60 space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-slate-400">Exceedance Prob.</span>
          <span className="font-mono font-semibold text-brand-300">
            {(exceedance_probability * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-slate-400">Percentile</span>
          <span className="font-mono text-slate-300">{percentile.toFixed(0)}th</span>
        </div>
      </div>
    </div>
  );
};

export default function LossExceedanceCurve({ data, percentiles }) {
  if (!data?.length) return null;

  const p50 = percentiles?.p50;
  const p90 = percentiles?.p90;
  const p10 = percentiles?.p10;

  // Risk zone boundaries
  const zoneMax = data[data.length - 1]?.loss ?? 0;

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Loss Exceedance Curve</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Probability that annual loss exceeds a given threshold — shading shows risk zones
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 24, bottom: 24 }}>
          <defs>
            <linearGradient id="lecGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#A100FF" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#A100FF" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Risk zones */}
          {p10 !== undefined && p50 !== undefined && (
            <ReferenceArea x1={0} x2={p50} fill="#22c55e" fillOpacity={0.04} ifOverflow="hidden" />
          )}
          {p50 !== undefined && p90 !== undefined && (
            <ReferenceArea x1={p50} x2={p90} fill="#f59e0b" fillOpacity={0.05} ifOverflow="hidden" />
          )}
          {p90 !== undefined && (
            <ReferenceArea x1={p90} x2={zoneMax} fill="#ef4444" fillOpacity={0.06} ifOverflow="hidden" />
          )}

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="loss"
            type="number"
            scale="linear"
            domain={[0, "dataMax"]}
            tickFormatter={fmtLoss}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
            label={{
              value: "Annual Loss ($)",
              position: "insideBottom",
              offset: -12,
              fill: "#64748b",
              fontSize: 11,
            }}
          />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            domain={[0, 1]}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
            label={{
              value: "P(loss exceeds threshold)",
              angle: -90,
              position: "insideLeft",
              fill: "#64748b",
              fontSize: 10,
              dx: -8,
              dy: 80,
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {p50 && (
            <ReferenceLine
              x={p50}
              stroke="#A100FF"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{ value: "P50", fill: "#A100FF", fontSize: 10, position: "insideTopLeft", dy: -4 }}
            />
          )}
          {p90 && (
            <ReferenceLine
              x={p90}
              stroke="#f87171"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{ value: "VaR-90", fill: "#f87171", fontSize: 10, position: "insideTopLeft", dy: -4 }}
            />
          )}

          <Area
            type="monotone"
            dataKey="exceedance_probability"
            stroke="#A100FF"
            strokeWidth={2.5}
            fill="url(#lecGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#A100FF", stroke: "#0f172a", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Zone legend */}
      <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-emerald-500/40 border border-emerald-500/30" />
          &lt; P50 — Lower risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-amber-500/40 border border-amber-500/30" />
          P50 – VaR-90 — Elevated risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-red-500/40 border border-red-500/30" />
          &gt; VaR-90 — Tail risk
        </span>
      </div>
    </div>
  );
}
