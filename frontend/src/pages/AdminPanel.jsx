import { useEffect, useState, useCallback } from "react";
import {
  adminListClients,
  adminGetClient,
  adminUpsertClient,
  adminGenerateReport,
  adminDownloadPdf,
  deriveParameters,
} from "../api/admin.js";

// ── Default FAIR parameters per scenario type ────────────────────────────────

const SCENARIO_DEFAULTS = {
  ransomware: {
    id: "ransomware", scenario_type: "ransomware",
    name: "Ransomware — Critical Systems",
    description: "Threat actor deploys ransomware encrypting critical systems, causing operational outage, recovery costs, and potential regulatory fines.",
    asset: "Critical IT Infrastructure", threat_actor: "Organized Cybercriminal Group (RaaS)",
    tef:            { min: 0.3,       most_likely: 1.0,       max: 3.5 },
    diff:           { min: 0.15,      most_likely: 0.35,      max: 0.60 },
    vuln:           { min: 0.15,      most_likely: 0.30,      max: 0.55 },
    loss_magnitude: { min: 1_000_000, most_likely: 6_000_000, max: 25_000_000 },
    asset_value: null,
    proposed_control: { name: "", description: "", annual_cost: 0, residual_ale_reduction_pct: 0 },
  },
  "data-breach": {
    id: "data-breach", scenario_type: "data-breach",
    name: "Data Breach — Customer PII",
    description: "Unauthorized exfiltration of sensitive customer data via compromised credentials or SQL injection, triggering regulatory penalties and litigation.",
    asset: "Customer Database (PII)", threat_actor: "Advanced Persistent Threat",
    tef:            { min: 0.2,       most_likely: 0.7,        max: 2.0 },
    diff:           { min: 0.20,      most_likely: 0.45,       max: 0.70 },
    vuln:           { min: 0.10,      most_likely: 0.22,       max: 0.45 },
    loss_magnitude: { min: 2_000_000, most_likely: 10_000_000, max: 45_000_000 },
    asset_value: null,
    proposed_control: { name: "", description: "", annual_cost: 0, residual_ale_reduction_pct: 0 },
  },
  bec: {
    id: "bec", scenario_type: "bec",
    name: "Business Email Compromise (BEC)",
    description: "Social engineering targeting finance staff to initiate fraudulent wire transfers or redirect vendor payments.",
    asset: "Finance & Treasury Operations", threat_actor: "Cybercriminal Group / Fraud Ring",
    tef:            { min: 2.0,    most_likely: 6.0,     max: 15.0 },
    diff:           { min: 0.30,   most_likely: 0.55,    max: 0.80 },
    vuln:           { min: 0.03,   most_likely: 0.08,    max: 0.18 },
    loss_magnitude: { min: 150_000, most_likely: 700_000, max: 3_500_000 },
    asset_value: null,
    proposed_control: { name: "", description: "", annual_cost: 0, residual_ale_reduction_pct: 0 },
  },
  "insider-threat": {
    id: "insider-threat", scenario_type: "insider-threat",
    name: "Insider Threat",
    description: "Malicious or negligent employee/contractor with privileged access exfiltrates data, sabotages systems, or enables external compromise.",
    asset: "Privileged Internal Systems", threat_actor: "Malicious Employee / Negligent Insider",
    tef:            { min: 0.1,    most_likely: 0.4,     max: 1.2 },
    diff:           { min: 0.05,   most_likely: 0.20,    max: 0.40 },
    vuln:           { min: 0.30,   most_likely: 0.50,    max: 0.75 },
    loss_magnitude: { min: 400_000, most_likely: 2_500_000, max: 12_000_000 },
    asset_value: null,
    proposed_control: { name: "", description: "", annual_cost: 0, residual_ale_reduction_pct: 0 },
  },
  "third-party": {
    id: "third-party", scenario_type: "third-party",
    name: "Third-Party / Supply Chain Attack",
    description: "Compromise through a trusted vendor, MSP, or software supply chain giving attacker initial access with limited detectability.",
    asset: "Vendor/MSP Integration Points", threat_actor: "Nation-State Actor / Sophisticated Group",
    tef:            { min: 0.1,       most_likely: 0.3,      max: 0.9 },
    diff:           { min: 0.10,      most_likely: 0.30,     max: 0.55 },
    vuln:           { min: 0.25,      most_likely: 0.45,     max: 0.70 },
    loss_magnitude: { min: 2_000_000, most_likely: 9_000_000, max: 40_000_000 },
    asset_value: null,
    proposed_control: { name: "", description: "", annual_cost: 0, residual_ale_reduction_pct: 0 },
  },
};

const SCENARIO_ORDER = ["ransomware", "data-breach", "bec", "insider-threat", "third-party"];

const SCENARIO_COLORS = {
  ransomware: "bg-red-500",
  "data-breach": "bg-orange-500",
  bec: "bg-yellow-500",
  "insider-threat": "bg-violet-500",
  "third-party": "bg-sky-500",
};

const RISK_TIERS = ["Critical", "High", "Medium", "Low"];

// ── Utility ──────────────────────────────────────────────────────────────────

function newClientForm() {
  return {
    id: "",
    name: "",
    industry: "",
    revenue: "",
    contact: "",
    risk_tier: "Medium",
    scenarios: SCENARIO_ORDER.map((k) => ({ ...SCENARIO_DEFAULTS[k], proposed_control: { name: "", description: "", annual_cost: "", residual_ale_reduction_pct: "" } })),
  };
}

function clientToForm(client) {
  const scenarios = SCENARIO_ORDER.map((sid) => {
    const s = client.scenarios.find((x) => x.id === sid);
    if (!s) return { ...SCENARIO_DEFAULTS[sid] };
    return {
      id:            s.id,
      scenario_type: s.scenario_type,
      name:          s.name,
      description:   s.description ?? "",
      asset:         s.asset ?? "",
      threat_actor:  s.threat_actor ?? "",
      tef:            { ...s.parameters.tef },
      diff:           { ...s.parameters.diff },
      vuln:           { ...s.parameters.vuln },
      loss_magnitude: { ...s.parameters.loss_magnitude },
      asset_value:    s.parameters.asset_value ?? "",
      proposed_control: s.proposed_control
        ? { ...s.proposed_control }
        : { name: "", description: "", annual_cost: "", residual_ale_reduction_pct: "" },
    };
  });
  return {
    id:        client.id,
    name:      client.name,
    industry:  client.industry ?? "",
    revenue:   client.revenue ?? "",
    contact:   client.contact ?? "",
    risk_tier: client.risk_tier ?? "Medium",
    scenarios,
  };
}

function formToPayload(form) {
  return {
    id:        form.id,
    name:      form.name,
    industry:  form.industry,
    revenue:   form.revenue !== "" ? Number(form.revenue) : null,
    contact:   form.contact,
    risk_tier: form.risk_tier,
    scenarios: form.scenarios.map((s) => ({
      id:            s.id,
      scenario_type: s.scenario_type,
      name:          s.name,
      description:   s.description,
      asset:         s.asset,
      threat_actor:  s.threat_actor,
      tef:            { min: Number(s.tef.min), most_likely: Number(s.tef.most_likely), max: Number(s.tef.max) },
      diff:           { min: Number(s.diff.min), most_likely: Number(s.diff.most_likely), max: Number(s.diff.max) },
      vuln:           { min: Number(s.vuln.min), most_likely: Number(s.vuln.most_likely), max: Number(s.vuln.max) },
      loss_magnitude: { min: Number(s.loss_magnitude.min), most_likely: Number(s.loss_magnitude.most_likely), max: Number(s.loss_magnitude.max) },
      asset_value: s.asset_value !== "" ? Number(s.asset_value) : null,
      proposed_control: s.proposed_control?.name
        ? {
            name: s.proposed_control.name,
            description: s.proposed_control.description,
            annual_cost: Number(s.proposed_control.annual_cost),
            residual_ale_reduction_pct: Number(s.proposed_control.residual_ale_reduction_pct),
          }
        : null,
    })),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border max-w-sm
      ${isErr ? "bg-red-950/90 border-red-700/50 text-red-200" : "bg-emerald-950/90 border-emerald-700/50 text-emerald-200"}`}>
      <span className={`mt-0.5 text-lg ${isErr ? "text-red-400" : "text-emerald-400"}`}>{isErr ? "✕" : "✓"}</span>
      <p className="text-sm flex-1">{toast.text}</p>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-300 ml-2 text-lg leading-none">×</button>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="label mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, className = "" }) {
  return (
    <input
      type="text"
      className={`w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200
        placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function NumberInput({ value, onChange, step = "any", min, placeholder, className = "" }) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      className={`w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono
        placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function RangeInput({ label, value, onChange, step = "any", hint }) {
  return (
    <Field label={label} hint={hint}>
      <div className="grid grid-cols-3 gap-2">
        {[["min", "Min"], ["most_likely", "Likely"], ["max", "Max"]].map(([key, lbl]) => (
          <div key={key}>
            <p className="text-xs text-slate-600 mb-1">{lbl}</p>
            <NumberInput
              step={step}
              value={value[key]}
              onChange={(v) => onChange({ ...value, [key]: v })}
            />
          </div>
        ))}
      </div>
    </Field>
  );
}

// ── Quick Setup Panel ─────────────────────────────────────────────────────────

function QuickSetupPanel({ scenarioType, onApply }) {
  const [qs, setQs] = useState({
    incidents_per_year:    "",
    downtime_cost_per_day: "",
    avg_downtime_days:     3,
    mfa_coverage_pct:      50,
    edr_maturity:          "Medium",
    backup_maturity:       "Medium",
    patch_cadence:         "Monthly",
  });
  const [loading, setLoading]   = useState(false);
  const [notes,   setNotes]     = useState([]);
  const [error,   setError]     = useState("");

  const setField = (k, v) => setQs((q) => ({ ...q, [k]: v }));

  const handleDerive = async () => {
    setLoading(true);
    setError("");
    setNotes([]);
    try {
      const result = await deriveParameters({
        scenario_type:          scenarioType,
        incidents_per_year:     Number(qs.incidents_per_year) || 1,
        downtime_cost_per_day:  Number(qs.downtime_cost_per_day) || 0,
        avg_downtime_days:      Number(qs.avg_downtime_days),
        mfa_coverage_pct:       Number(qs.mfa_coverage_pct),
        edr_maturity:           qs.edr_maturity,
        backup_maturity:        qs.backup_maturity,
        patch_cadence:          qs.patch_cadence,
      });
      setNotes(result.derivation_notes);
      onApply(result);
    } catch {
      setError("Failed to derive parameters — check backend is running");
    } finally {
      setLoading(false);
    }
  };

  const maturityOpts = ["Low", "Medium", "High"];
  const patchOpts    = ["Ad-hoc", "Monthly", "Weekly"];

  return (
    <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Quick Setup — Derive FAIR Parameters from Operational Data</p>
      </div>
      <p className="text-xs text-slate-500">
        Enter what you know from the client's operational data. The engine will translate these into calibrated FAIR PERT ranges and auto-fill the parameters below.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* Incident history */}
        <Field label="Incidents / Attempts per Year" hint="Historical frequency of this threat type">
          <NumberInput
            value={qs.incidents_per_year}
            onChange={(v) => setField("incidents_per_year", v)}
            placeholder="e.g. 3"
            step="0.1"
          />
        </Field>

        {/* Loss sizing */}
        <Field label="Downtime Cost per Day (USD)" hint="Revenue loss + recovery cost per day of outage">
          <NumberInput
            value={qs.downtime_cost_per_day}
            onChange={(v) => setField("downtime_cost_per_day", v)}
            placeholder="e.g. 250000"
          />
        </Field>
        <Field label="Avg Recovery Time (Days)" hint="How long a typical incident takes to recover from">
          <NumberInput
            value={qs.avg_downtime_days}
            onChange={(v) => setField("avg_downtime_days", v)}
            placeholder="e.g. 5"
            step="0.5"
          />
        </Field>

        {/* Control maturity */}
        <Field label="MFA Coverage (%)" hint="% of users / systems enrolled in MFA">
          <NumberInput
            value={qs.mfa_coverage_pct}
            onChange={(v) => setField("mfa_coverage_pct", v)}
            placeholder="0–100"
            step="5"
          />
        </Field>
        <Field label="EDR Maturity">
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200
              focus:outline-none focus:border-brand-500 transition-colors"
            value={qs.edr_maturity}
            onChange={(e) => setField("edr_maturity", e.target.value)}
          >
            {maturityOpts.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Backup & Recovery Maturity">
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200
              focus:outline-none focus:border-brand-500 transition-colors"
            value={qs.backup_maturity}
            onChange={(e) => setField("backup_maturity", e.target.value)}
          >
            {maturityOpts.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Patch Cadence">
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200
              focus:outline-none focus:border-brand-500 transition-colors"
            value={qs.patch_cadence}
            onChange={(e) => setField("patch_cadence", e.target.value)}
          >
            {patchOpts.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>

      <button
        type="button"
        onClick={handleDerive}
        disabled={loading || !qs.incidents_per_year}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500
          disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
      >
        {loading ? (
          <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deriving…</>
        ) : (
          <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>Derive FAIR Parameters</>
        )}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {notes.length > 0 && (
        <div className="rounded-lg bg-slate-900/60 border border-slate-700/40 px-3 py-3 space-y-1">
          <p className="text-xs font-semibold text-slate-400 mb-2">Derivation Logic</p>
          {notes.map((n, i) => (
            <p key={i} className="text-xs text-slate-500 flex gap-2">
              <span className="text-amber-600 flex-shrink-0">→</span>{n}
            </p>
          ))}
          <p className="text-xs text-emerald-500 mt-2 font-medium">✓ FAIR parameters updated below</p>
        </div>
      )}
    </div>
  );
}

function ScenarioPanel({ scenario, onChange, isOpen, onToggle }) {
  const colorDot = SCENARIO_COLORS[scenario.id] ?? "bg-slate-500";
  const pc = scenario.proposed_control ?? {};
  const setPc = (k, v) => onChange({ ...scenario, proposed_control: { ...pc, [k]: v } });

  const [showQuickSetup, setShowQuickSetup] = useState(false);

  const handleApplyDerived = (result) => {
    onChange({
      ...scenario,
      tef:            result.tef,
      diff:           result.diff,
      vuln:           result.vuln,
      loss_magnitude: result.loss_magnitude,
    });
  };

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-900/60 hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colorDot}`} />
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-200">{scenario.name.split("—")[0].trim()}</p>
            <p className="text-xs text-slate-500 mt-0.5">{scenario.asset || "Asset not set"}</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Accordion body */}
      {isOpen && (
        <div className="px-4 py-5 bg-slate-900/30 space-y-5 border-t border-slate-800">
          {/* Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Scenario Name">
              <TextInput value={scenario.name} onChange={(v) => onChange({ ...scenario, name: v })} />
            </Field>
            <Field label="Asset at Risk">
              <TextInput value={scenario.asset} onChange={(v) => onChange({ ...scenario, asset: v })} placeholder="e.g. Core Banking Systems" />
            </Field>
            <Field label="Threat Actor">
              <TextInput value={scenario.threat_actor} onChange={(v) => onChange({ ...scenario, threat_actor: v })} placeholder="e.g. Ransomware-as-a-Service Group" />
            </Field>
            <Field label="Asset Value (USD)" hint="Replacement / market value — scalar reference">
              <NumberInput value={scenario.asset_value} onChange={(v) => onChange({ ...scenario, asset_value: v })} placeholder="e.g. 55000000" />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200
                placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors resize-none"
              rows={2}
              value={scenario.description}
              onChange={(e) => onChange({ ...scenario, description: e.target.value })}
            />
          </Field>

          {/* Quick Setup */}
          <div>
            <button
              type="button"
              onClick={() => setShowQuickSetup((s) => !s)}
              className="flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={showQuickSetup ? "m19.5 8.25-7.5 7.5-7.5-7.5" : "m8.25 4.5 7.5 7.5-7.5 7.5"} />
              </svg>
              {showQuickSetup ? "Hide" : "Quick Setup"} — Derive from Operational Data
            </button>
            {showQuickSetup && (
              <div className="mt-3">
                <QuickSetupPanel
                  scenarioType={scenario.scenario_type}
                  onApply={handleApplyDerived}
                />
              </div>
            )}
          </div>

          {/* FAIR Parameters */}
          <div>
            <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-3">FAIR Parameters (PERT distributions)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RangeInput
                label="TEF — Threat Event Frequency"
                value={scenario.tef}
                onChange={(v) => onChange({ ...scenario, tef: v })}
                step="0.01"
                hint="Attempts per year (e.g. 0.5 – 4.0)"
              />
              <RangeInput
                label="DIFF — Difficulty / Control Strength (0–1)"
                value={scenario.diff}
                onChange={(v) => onChange({ ...scenario, diff: v })}
                step="0.01"
                hint="0 = no controls, 1 = impenetrable"
              />
              <RangeInput
                label="VULN — Base Vulnerability (0–1)"
                value={scenario.vuln}
                onChange={(v) => onChange({ ...scenario, vuln: v })}
                step="0.01"
                hint="Exploitability before DIFF is applied"
              />
              <RangeInput
                label="Loss Magnitude (USD per event)"
                value={scenario.loss_magnitude}
                onChange={(v) => onChange({ ...scenario, loss_magnitude: v })}
                hint="Combined primary + secondary losses"
              />
            </div>
          </div>

          {/* Proposed Control */}
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">Proposed Control (optional)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Control Name">
                <TextInput value={pc.name ?? ""} onChange={(v) => setPc("name", v)} placeholder="e.g. Enhanced EDR + MDR Retainer" />
              </Field>
              <Field label="Annual Cost (USD)">
                <NumberInput value={pc.annual_cost ?? ""} onChange={(v) => setPc("annual_cost", v)} placeholder="e.g. 180000" />
              </Field>
              <Field label="Description">
                <TextInput value={pc.description ?? ""} onChange={(v) => setPc("description", v)} placeholder="Brief description of the control" />
              </Field>
              <Field label="Expected ALE Reduction (%)" hint="0–100%: percentage reduction in Mean ALE after implementing this control">
                <NumberInput value={pc.residual_ale_reduction_pct ?? ""} step="1" min="0" onChange={(v) => setPc("residual_ale_reduction_pct", v)} placeholder="e.g. 55" />
              </Field>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Login Gate ────────────────────────────────────────────────────────────────

function LoginGate({ onLogin }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    sessionStorage.setItem("crq_admin_token", token);
    try {
      await adminListClients();
      onLogin(token);
    } catch {
      setError("Invalid token. Please try again.");
      sessionStorage.removeItem("crq_admin_token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-sm">
        <div className="card p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500/20 mb-4">
              <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">Admin Panel</h2>
            <p className="text-xs text-slate-500 mt-1">Enter the admin token to continue</p>
          </div>

          <form onSubmit={handle} className="space-y-4">
            <Field label="Admin Token">
              <input
                type="password"
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200
                  font-mono placeholder:text-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter token…"
              />
            </Field>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={!token || loading}
              className="w-full py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:opacity-40
                disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {loading ? "Verifying…" : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-600 mt-4">
          Token is set via the <code className="font-mono text-slate-500">ADMIN_TOKEN</code> env variable
        </p>
      </div>
    </div>
  );
}

// ── Client Sidebar ────────────────────────────────────────────────────────────

function ClientSidebar({ clients, selectedId, onSelect, onNew }) {
  return (
    <aside className="w-64 flex-shrink-0 flex flex-col gap-3">
      <button
        onClick={onNew}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400
          text-white text-sm font-semibold transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        New Client
      </button>

      <div className="space-y-1">
        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors ${
              selectedId === c.id
                ? "bg-brand-500/15 border border-brand-500/30 text-white"
                : "hover:bg-slate-800/60 text-slate-400 hover:text-slate-200"
            }`}
          >
            <p className="text-sm font-medium truncate">{c.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500">{c.industry}</span>
              {c.has_report && (
                <span className="text-xs text-emerald-500">● report</span>
              )}
            </div>
          </button>
        ))}
        {!clients.length && (
          <p className="text-xs text-slate-600 px-3 py-2">No clients yet</p>
        )}
      </div>
    </aside>
  );
}

// ── Client Form ───────────────────────────────────────────────────────────────

function ClientForm({ form, setForm, onSave, onGenerate, onExportPdf, saving, generating, exportingPdf, reportResult }) {
  const [expandedScenario, setExpandedScenario] = useState(SCENARIO_ORDER[0]);

  const updateScenario = useCallback((idx, updated) => {
    setForm((f) => {
      const scenarios = [...f.scenarios];
      scenarios[idx] = updated;
      return { ...f, scenarios };
    });
  }, [setForm]);

  const isNew = !form.id || form.id === "";

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(); }}
      className="flex-1 space-y-6 min-w-0"
    >
      {/* Client metadata */}
      <div className="card p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Client Information</h3>
          {!isNew && <span className="text-xs font-mono text-slate-500">{form.id}</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Field label="Client ID" hint={isNew ? "Lowercase, hyphens only (e.g. acme-corp)" : "Cannot be changed after creation"}>
            <TextInput
              value={form.id}
              onChange={(v) => setForm((f) => ({ ...f, id: v }))}
              placeholder="acme-corp"
              className={!isNew ? "opacity-50 cursor-not-allowed" : ""}
            />
          </Field>
          <Field label="Client Name">
            <TextInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Acme Corporation" />
          </Field>
          <Field label="Industry">
            <TextInput value={form.industry} onChange={(v) => setForm((f) => ({ ...f, industry: v }))} placeholder="Financial Services" />
          </Field>
          <Field label="Annual Revenue (USD)" hint="Optional — for context only">
            <NumberInput value={form.revenue} onChange={(v) => setForm((f) => ({ ...f, revenue: v }))} placeholder="e.g. 850000000" />
          </Field>
          <Field label="Contact">
            <TextInput value={form.contact} onChange={(v) => setForm((f) => ({ ...f, contact: v }))} placeholder="Jane Smith — CISO" />
          </Field>
          <Field label="Risk Tier">
            <select
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200
                focus:outline-none focus:border-brand-500 transition-colors"
              value={form.risk_tier}
              onChange={(e) => setForm((f) => ({ ...f, risk_tier: e.target.value }))}
            >
              {RISK_TIERS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Scenarios */}
      <div className="card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Scenario FAIR Parameters</h3>
          <p className="text-xs text-slate-500 mt-0.5">Click a scenario to expand and edit its PERT inputs and proposed control</p>
        </div>
        <div className="space-y-2">
          {form.scenarios.map((sc, idx) => (
            <ScenarioPanel
              key={sc.id}
              scenario={sc}
              onChange={(updated) => updateScenario(idx, updated)}
              isOpen={expandedScenario === sc.id}
              onToggle={() => setExpandedScenario(expandedScenario === sc.id ? null : sc.id)}
            />
          ))}
        </div>
      </div>

      {/* Report result */}
      {reportResult && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-3.5">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Report Generated</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              ["Mean ALE", `$${(reportResult.total_ale_mean / 1e6).toFixed(2)}M`],
              ["VaR-90",   `$${(reportResult.total_var_90   / 1e6).toFixed(2)}M`],
              ["Simulations", reportResult.n_simulations?.toLocaleString()],
              ["Generated", new Date(reportResult.generated_at).toLocaleTimeString()],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-slate-500 label">{k}</p>
                <p className="text-emerald-300 font-mono font-semibold mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || !form.id || !form.name}
          className="px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:opacity-40
            disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
        >
          {saving ? (
            <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save Client</>
          )}
        </button>

        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !form.id || !form.name}
          className="px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40
            disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
        >
          {generating ? (
            <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running simulation…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>Generate Report</>
          )}
        </button>

        <button
          type="button"
          onClick={onExportPdf}
          disabled={exportingPdf || !form.id}
          className="px-5 py-2.5 rounded-lg bg-rose-700/80 hover:bg-rose-700 disabled:opacity-40
            disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
        >
          {exportingPdf ? (
            <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating PDF…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>Export PDF</>
          )}
        </button>
      </div>
    </form>
  );
}

// ── Main AdminPanel ───────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [authed,       setAuthed]       = useState(() => !!sessionStorage.getItem("crq_admin_token"));
  const [clients,      setClients]      = useState([]);
  const [selectedId,   setSelectedId]   = useState(null);
  const [form,         setForm]         = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [generating,   setGenerating]   = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [toast,        setToast]        = useState(null);
  const [reportResult, setReportResult] = useState(null);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  // Load client list after login
  const loadClients = useCallback(async () => {
    try {
      const data = await adminListClients();
      setClients(data);
    } catch {
      showToast("error", "Failed to load client list");
    }
  }, []);

  useEffect(() => {
    if (authed) loadClients();
  }, [authed, loadClients]);

  const handleLogin = (token) => {
    setAuthed(true);
  };

  const handleSelectClient = async (id) => {
    setSelectedId(id);
    setReportResult(null);
    try {
      const data = await adminGetClient(id);
      setForm(clientToForm(data));
    } catch {
      showToast("error", `Failed to load client ${id}`);
    }
  };

  const handleNewClient = () => {
    setSelectedId(null);
    setReportResult(null);
    setForm(newClientForm());
  };

  const handleSave = async () => {
    if (!form?.id || !form?.name) return;
    setSaving(true);
    try {
      await adminUpsertClient(formToPayload(form));
      showToast("success", `Client "${form.name}" saved successfully`);
      await loadClients();
      setSelectedId(form.id);
    } catch (e) {
      showToast("error", e?.response?.data?.detail ?? "Failed to save client");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!form?.id) return;
    // Save first if new or unsaved
    if (!clients.find((c) => c.id === form.id)) {
      showToast("error", "Save the client first before generating a report");
      return;
    }
    setGenerating(true);
    setReportResult(null);
    try {
      const result = await adminGenerateReport(form.id);
      setReportResult(result);
      showToast("success", `Report generated — Mean ALE: $${(result.total_ale_mean / 1e6).toFixed(2)}M`);
      await loadClients();
    } catch (e) {
      showToast("error", e?.response?.data?.detail ?? "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPdf = async () => {
    if (!form?.id) return;
    setExportingPdf(true);
    try {
      await adminDownloadPdf(form.id);
      showToast("success", "PDF downloaded");
    } catch (e) {
      const msg = e?.response?.status === 500
        ? "PDF export failed — ensure WeasyPrint is installed on the server"
        : e?.response?.data?.detail ?? "Failed to export PDF";
      showToast("error", msg);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("crq_admin_token");
    setAuthed(false);
    setClients([]);
    setForm(null);
    setSelectedId(null);
  };

  if (!authed) return <LoginGate onLogin={handleLogin} />;

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Page header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-white">Consultant Admin Panel</h1>
          <p className="text-xs text-slate-500 mt-1">Manage client FAIR parameters, generate reports, and export PDFs</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200
            hover:bg-slate-800 border border-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          Sign out
        </button>
      </div>

      {/* Content */}
      <div className="flex gap-6 items-start">
        <ClientSidebar
          clients={clients}
          selectedId={selectedId}
          onSelect={handleSelectClient}
          onNew={handleNewClient}
        />

        {form ? (
          <ClientForm
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onGenerate={handleGenerate}
            onExportPdf={handleExportPdf}
            saving={saving}
            generating={generating}
            exportingPdf={exportingPdf}
            reportResult={reportResult}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-[40vh]">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Select a client to edit, or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
