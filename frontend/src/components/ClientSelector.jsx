import { useNavigate } from "react-router-dom";
import { formatCurrency } from "./MetricCard.jsx";

const TIER_CLASS = {
  Critical: "badge-critical",
  High: "badge-high",
  Medium: "badge-medium",
  Low: "badge-low",
};

const INDUSTRY_ICONS = {
  "Financial Services": "🏦",
  Healthcare: "🏥",
  Technology: "💻",
  Default: "🏢",
};

export default function ClientSelector({ clients, selectedId }) {
  const navigate = useNavigate();

  if (!clients?.length) return null;

  return (
    <div className="space-y-2">
      {clients.map((client) => {
        const active = client.id === selectedId;
        const icon = INDUSTRY_ICONS[client.industry] ?? INDUSTRY_ICONS.Default;
        return (
          <button
            key={client.id}
            onClick={() => navigate(`/consultant/${client.id}`)}
            className={`w-full text-left rounded-xl px-4 py-3 border transition-all duration-150 ${
              active
                ? "bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500/30"
                : "bg-slate-900 border-slate-700/40 hover:bg-slate-800/60 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <span
                  className={`text-sm font-medium ${active ? "text-white" : "text-slate-300"}`}
                >
                  {client.name}
                </span>
              </div>
              <span className={TIER_CLASS[client.risk_tier] ?? "badge-medium"}>
                {client.risk_tier}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-slate-500">{client.industry}</span>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-500">
                {client.scenario_count} scenario{client.scenario_count !== 1 ? "s" : ""}
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-500">Updated {client.last_updated}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
