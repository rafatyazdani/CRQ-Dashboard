import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "./MetricCard.jsx";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { bin_mid, count, frequency } = payload[0].payload;
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400">Loss Bucket</p>
      <p className="font-mono font-semibold text-white">{formatCurrency(bin_mid)}</p>
      <p className="text-slate-400 mt-1">Simulations</p>
      <p className="font-mono font-semibold text-violet-300">{count.toLocaleString()}</p>
      <p className="text-slate-400 mt-0.5">Frequency</p>
      <p className="font-mono text-slate-300">{(frequency * 100).toFixed(2)}%</p>
    </div>
  );
};

export default function LossHistogram({ data, mean }) {
  if (!data?.length) return null;

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Annual Loss Distribution</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Frequency of simulated annual loss outcomes across {data.reduce((s, d) => s + d.count, 0).toLocaleString()} Monte Carlo iterations
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }} barCategoryGap="2%">
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="bin_mid"
            tickFormatter={formatCurrency}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
            interval={9}
            label={{
              value: "Annual Loss ($)",
              position: "insideBottom",
              offset: -5,
              fill: "#64748b",
              fontSize: 11,
            }}
          />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
            dataKey="frequency"
            label={{
              value: "Frequency",
              angle: -90,
              position: "insideLeft",
              fill: "#64748b",
              fontSize: 11,
              dy: 40,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {mean && (
            <ReferenceLine
              x={mean}
              stroke="#a78bfa"
              strokeDasharray="4 3"
              label={{ value: "Mean", fill: "#a78bfa", fontSize: 10, position: "top" }}
            />
          )}
          <Bar dataKey="frequency" fill="#7c3aed" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
