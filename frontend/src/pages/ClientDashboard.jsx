import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchClient, fetchClientRisk, downloadClientPdf } from "../api/client.js";
import ClientHeader        from "../components/ClientHeader.jsx";
import ExecutiveSummary    from "../components/ExecutiveSummary.jsx";
import ScenarioComparison  from "../components/ScenarioComparison.jsx";
import LossExceedanceCurve from "../components/LossExceedanceCurve.jsx";
import ControlsBenefitTable from "../components/ControlsBenefitTable.jsx";

// ── Loading / Error states ───────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border-2 border-slate-700" />
        <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-300">Running Monte Carlo simulation</p>
        <p className="text-xs text-slate-500 mt-1">10,000 iterations · FAIR methodology</p>
      </div>
      {/* Skeleton cards */}
      <div className="w-full max-w-4xl grid grid-cols-3 gap-4 mt-4 px-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-300">Failed to load risk data</p>
        <p className="text-xs text-red-400 mt-1">{message}</p>
      </div>
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, subtitle, children, id }) {
  return (
    <section id={id} className="space-y-4">
      {(title || subtitle) && (
        <div className="flex items-end justify-between border-b border-slate-800 pb-3">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-brand-500 inline-block" />
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 ml-3">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

// ── FAIR Methodology Footer ──────────────────────────────────────────────────

function FAIRFooter({ nSimulations }) {
  const items = [
    { abbr: "TEF",  name: "Threat Event Frequency",  desc: "How often a threat actor acts against the asset (events/year)" },
    { abbr: "DIFF", name: "Difficulty",               desc: "Control strength — attenuates exploitability: eff_vuln = VULN × (1 − DIFF)" },
    { abbr: "LEF",  name: "Loss Event Frequency",     desc: "Expected loss events per year: TEF × effective_vuln" },
    { abbr: "ALE",  name: "Annual Loss Exposure",     desc: "Expected annual financial loss: LEF × Loss Magnitude" },
    { abbr: "VaR",  name: "Value at Risk (90th)",     desc: "Loss threshold exceeded in only 10% of simulated years" },
    { abbr: "ROI",  name: "Control ROI",              desc: "(ALE reduction − control cost) ÷ control cost × 100" },
  ];
  return (
    <footer className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">FAIR Methodology Reference</p>
          <p className="text-xs text-slate-600 mt-0.5">Factor Analysis of Information Risk · Open FAIR Standard</p>
        </div>
        <span className="text-xs text-slate-600 font-mono">{nSimulations?.toLocaleString()} MC iterations · seed=42</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((item) => (
          <div key={item.abbr} className="bg-slate-800/40 rounded-lg p-3">
            <span className="font-mono font-bold text-brand-400 text-sm">{item.abbr}</span>
            <p className="text-slate-300 font-medium text-xs mt-1">{item.name}</p>
            <p className="text-slate-600 text-xs mt-1 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-700 text-center mt-4">
        Generated by CRQ Platform · FAIR v2 Engine · This report is confidential and intended solely for the named recipient.
      </p>
    </footer>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const { clientId } = useParams();
  const [clientDetail, setClientDetail] = useState(null);
  const [risk, setRisk]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [pdfLoading, setPdfLoading]     = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setRisk(null);
    setClientDetail(null);

    Promise.all([
      fetchClient(clientId).catch(() => null),       // non-fatal — header still works from risk data
      fetchClientRisk(clientId),
    ])
      .then(([detail, riskData]) => {
        setClientDetail(detail);
        setRisk(riskData);
      })
      .catch((e) => setError(e.response?.data?.detail ?? "Failed to load risk data"))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} />;
  if (!risk)   return null;

  const { total_ale, scenarios, loss_exceedance_curve } = risk;

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadClientPdf(clientId);
    } catch {
      // silently ignore — WeasyPrint may not be installed on dev servers
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8 space-y-8">

      {/* ① Client Branding Header */}
      <ClientHeader
        clientDetail={clientDetail}
        riskData={risk}
        onDownloadPdf={handleDownloadPdf}
        pdfLoading={pdfLoading}
      />

      {/* ② Executive Summary */}
      <Section id="executive-summary">
        <ExecutiveSummary riskData={risk} />
      </Section>

      {/* ③ Scenario Comparison  +  ④ Loss Exceedance Curve — side by side */}
      <Section
        id="risk-analysis"
        title="Risk Analysis"
        subtitle="Scenario-level ALE breakdown and portfolio loss probability distribution"
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ScenarioComparison scenarios={scenarios} />
          <LossExceedanceCurve data={loss_exceedance_curve} percentiles={total_ale} />
        </div>
      </Section>

      {/* ⑤ Cost-Benefit of Controls */}
      <Section
        id="controls-benefit"
        title="Cost-Benefit of Controls"
        subtitle="Consultant-recommended security investments · residual risk and annual ROI"
      >
        <ControlsBenefitTable scenarios={scenarios} />
      </Section>

      {/* Footer: FAIR methodology reference */}
      <FAIRFooter nSimulations={risk.n_simulations} />
    </div>
  );
}
