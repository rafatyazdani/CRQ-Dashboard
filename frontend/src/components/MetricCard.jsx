export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

const ACCENT = {
  blue: {
    border: "border-brand-500/30",
    glow: "bg-brand-500/10",
    label: "text-brand-400",
    value: "text-brand-300",
  },
  violet: {
    border: "border-violet-500/30",
    glow: "bg-violet-500/10",
    label: "text-violet-400",
    value: "text-violet-300",
  },
  amber: {
    border: "border-amber-500/30",
    glow: "bg-amber-500/10",
    label: "text-amber-400",
    value: "text-amber-300",
  },
  red: {
    border: "border-red-500/30",
    glow: "bg-red-500/10",
    label: "text-red-400",
    value: "text-red-300",
  },
  green: {
    border: "border-emerald-500/30",
    glow: "bg-emerald-500/10",
    label: "text-emerald-400",
    value: "text-emerald-300",
  },
};

export default function MetricCard({ title, value, subtitle, accent = "blue", icon, isCurrency = true }) {
  const colors = ACCENT[accent] ?? ACCENT.blue;
  const display = isCurrency ? formatCurrency(value) : value;

  return (
    <div className={`card p-5 flex flex-col gap-3 border ${colors.border}`}>
      <div className="flex items-start justify-between">
        <p className="label">{title}</p>
        {icon && (
          <div className={`p-2 rounded-lg ${colors.glow}`}>
            <span className={colors.label}>{icon}</span>
          </div>
        )}
      </div>
      <p className={`text-3xl font-bold tracking-tight font-mono ${colors.value}`}>{display}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}
