import { useState } from "react";
import { updateScenarioParameters } from "../api/client.js";
import { formatCurrency } from "./MetricCard.jsx";

// Display labels and formatting for each FAIR parameter key
const PARAM_META = {
  tef:            { label: "Threat Event Frequency", unit: "num",   hint: "Events per year" },
  diff:           { label: "Difficulty (Control Strength)", unit: "pct", hint: "0 = no controls · 1 = impenetrable" },
  vuln:           { label: "Base Vulnerability",     unit: "pct",   hint: "Innate exploitability before controls (0–1)" },
  loss_magnitude: { label: "Loss Magnitude",         unit: "$",     hint: "Combined primary + secondary loss per event (USD)" },
};

function fmtVal(unit, v) {
  if (v === null || v === undefined) return "—";
  if (unit === "$")   return formatCurrency(v);
  if (unit === "pct") return `${(v * 100).toFixed(1)}%`;
  return v?.toFixed(3);
}

function ParameterBlock({ paramKey, range }) {
  const meta = PARAM_META[paramKey];
  if (!meta || !range) return null;
  return (
    <tr className="border-b border-slate-800">
      <td className="py-2 px-3 text-xs text-slate-400">
        <div>{meta.label}</div>
        <div className="text-slate-600 mt-0.5">{meta.hint}</div>
      </td>
      <td className="py-2 px-3 text-xs font-mono text-emerald-400 text-right">{fmtVal(meta.unit, range.min)}</td>
      <td className="py-2 px-3 text-xs font-mono text-blue-300 text-right font-semibold">
        {fmtVal(meta.unit, range.most_likely)}
      </td>
      <td className="py-2 px-3 text-xs font-mono text-red-400 text-right">{fmtVal(meta.unit, range.max)}</td>
    </tr>
  );
}

function AssetValueRow({ value }) {
  if (value == null) return null;
  return (
    <tr className="border-b border-slate-800">
      <td className="py-2 px-3 text-xs text-slate-400">
        <div>Asset Value</div>
        <div className="text-slate-600 mt-0.5">Reference value of asset at risk (USD)</div>
      </td>
      <td colSpan={3} className="py-2 px-3 text-xs font-mono text-slate-300 text-right">
        {formatCurrency(value)}
      </td>
    </tr>
  );
}

// ── Edit Modal ───────────────────────────────────────────────────────────────

const EDITABLE_RANGES = ["tef", "diff", "vuln", "loss_magnitude"];

function EditModal({ clientId, scenario, onClose, onSaved }) {
  const [params, setParams] = useState(JSON.parse(JSON.stringify(scenario.parameters)));
  const [saving, setSaving]  = useState(false);
  const [error, setError]    = useState(null);

  const setRange = (key, subKey, raw) => {
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    setParams((prev) => ({ ...prev, [key]: { ...prev[key], [subKey]: num } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateScenarioParameters(clientId, scenario.id, params);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card w-full max-w-2xl mx-4 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-white">Edit FAIR Parameters</h3>
            <p className="text-xs text-slate-400 mt-0.5">{scenario.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* FAIR model hint */}
        <div className="mb-5 p-3 bg-slate-800/60 rounded-lg text-xs text-slate-400 font-mono">
          effective_vuln = VULN × (1 − DIFF) &nbsp;·&nbsp; LEF = TEF × effective_vuln &nbsp;·&nbsp; ALE = LEF × LM
        </div>

        {/* Editable PERT ranges */}
        <div className="space-y-4">
          {EDITABLE_RANGES.map((key) => {
            const meta = PARAM_META[key];
            const range = params[key];
            if (!range) return null;
            return (
              <div key={key}>
                <div className="mb-1.5">
                  <span className="label">{meta.label}</span>
                  <span className="ml-2 text-xs text-slate-600">{meta.hint}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {["min", "most_likely", "max"].map((sub) => (
                    <div key={sub}>
                      <label className="text-xs text-slate-500 mb-1 block capitalize">
                        {sub === "most_likely" ? "Most Likely" : sub.charAt(0).toUpperCase() + sub.slice(1)}
                      </label>
                      <input
                        type="number"
                        step={meta.unit === "pct" ? "0.01" : meta.unit === "$" ? "10000" : "0.1"}
                        value={range[sub]}
                        onChange={(e) => setRange(key, sub, e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Asset value (scalar) */}
          <div>
            <div className="mb-1.5">
              <span className="label">Asset Value (USD)</span>
              <span className="ml-2 text-xs text-slate-600">Reference value of the asset at risk</span>
            </div>
            <input
              type="number"
              step="100000"
              value={params.asset_value ?? ""}
              onChange={(e) => setParams((p) => ({ ...p, asset_value: parseFloat(e.target.value) || null }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 mt-4 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
            {saving ? "Saving…" : "Save Parameters"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function FAIRParameters({ clientId, scenarios, onParametersUpdated }) {
  const [editing, setEditing] = useState(null);

  if (!scenarios?.length) return null;

  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-200">FAIR Input Parameters</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          PERT distributions (Min / Most Likely / Max) per scenario — consultant-configurable
        </p>
      </div>

      {/* FAIR model legend */}
      <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        {[
          { abbr: "TEF",   color: "text-blue-400",    desc: "Threat Event Frequency (×/yr)" },
          { abbr: "DIFF",  color: "text-amber-400",   desc: "Difficulty / Control Strength (0–1)" },
          { abbr: "VULN",  color: "text-orange-400",  desc: "Base Vulnerability (0–1)" },
          { abbr: "Eff.V", color: "text-red-400",     desc: "Effective VULN = VULN×(1−DIFF)" },
          { abbr: "LM",    color: "text-violet-400",  desc: "Loss Magnitude per event ($)" },
        ].map((item) => (
          <div key={item.abbr} className="bg-slate-800/50 rounded-lg p-2 text-center">
            <span className={`font-mono font-bold ${item.color}`}>{item.abbr}</span>
            <p className="text-slate-500 mt-0.5 leading-tight">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="border border-slate-700/40 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800/60">
              <div>
                <span className="text-xs font-semibold text-slate-200">{scenario.name}</span>
                <span className="ml-2 text-xs text-slate-500">{scenario.asset}</span>
              </div>
              <button
                onClick={() => setEditing(scenario)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                </svg>
                Edit
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-1.5 px-3 label">FAIR Component</th>
                  <th className="text-right py-1.5 px-3 label text-emerald-600">Min</th>
                  <th className="text-right py-1.5 px-3 label text-blue-600">Most Likely</th>
                  <th className="text-right py-1.5 px-3 label text-red-600">Max</th>
                </tr>
              </thead>
              <tbody>
                {EDITABLE_RANGES.map((key) => (
                  <ParameterBlock
                    key={key}
                    paramKey={key}
                    range={scenario.parameters?.[key]}
                  />
                ))}
                <AssetValueRow value={scenario.parameters?.asset_value} />
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {editing && (
        <EditModal
          clientId={clientId}
          scenario={editing}
          onClose={() => setEditing(null)}
          onSaved={onParametersUpdated}
        />
      )}
    </div>
  );
}
