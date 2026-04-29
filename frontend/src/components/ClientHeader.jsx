import { formatCurrency } from "./MetricCard.jsx";

const TIER_CONFIG = {
  Critical: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/40 ring-rose-500/20", dot: "bg-rose-400" },
  High:     { cls: "bg-orange-500/15 text-orange-300 border-orange-500/40 ring-orange-500/20", dot: "bg-orange-400" },
  Medium:   { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40 ring-amber-500/20", dot: "bg-amber-400" },
  Low:      { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 ring-emerald-500/20", dot: "bg-emerald-400" },
};

const INDUSTRY_ABBR = {
  "Financial Services": "FS",
  "Healthcare":         "HC",
  "Technology":         "TV",
};

function LogoPlaceholder({ name, industry }) {
  const abbr = INDUSTRY_ABBR[industry] ?? name.slice(0, 2).toUpperCase();
  return (
    <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/40">
      <span className="text-white font-bold text-lg tracking-tight">{abbr}</span>
    </div>
  );
}

export default function ClientHeader({ clientDetail, riskData, onDownloadPdf, pdfLoading }) {
  const name      = clientDetail?.name     ?? riskData?.client_name ?? "—";
  const industry  = clientDetail?.industry ?? riskData?.industry    ?? "—";
  const tier      = clientDetail?.risk_tier ?? "Medium";
  const contact   = clientDetail?.contact;
  const updated   = clientDetail?.last_updated;
  const nsim      = riskData?.n_simulations ?? 10000;
  const tierCfg   = TIER_CONFIG[tier] ?? TIER_CONFIG.Medium;

  const today = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <header className="relative overflow-hidden rounded-2xl border border-slate-700/40 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800">
      {/* Decorative gradient glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-500/[0.07] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-brand-700/[0.05] blur-3xl" />

      <div className="relative px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          {/* Logo + names */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <LogoPlaceholder name={name} industry={industry} />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-0.5">
                Cyber Risk Assessment
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight truncate">
                {name}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">{industry}</p>
            </div>
          </div>

          {/* Right-side badges + meta */}
          <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
            {/* Risk tier badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ring-1 ${tierCfg.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tierCfg.dot}`} />
              {tier} Risk
            </span>

            {/* Meta pills */}
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-400">
                FAIR Methodology
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-400 font-mono">
                {nsim.toLocaleString()} simulations
              </span>
            </div>
          </div>
        </div>

        {/* Divider + footer row */}
        <div className="mt-5 pt-4 border-t border-slate-700/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {contact && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                {contact}
              </span>
            )}
            {updated && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                Parameters last updated {updated}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Report generated {today}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onDownloadPdf && (
              <button
                onClick={onDownloadPdf}
                disabled={pdfLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/15 hover:bg-brand-500/25
                  border border-brand-500/30 text-brand-300 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pdfLoading ? (
                  <><span className="w-3 h-3 border border-brand-400/40 border-t-brand-400 rounded-full animate-spin" />Generating…</>
                ) : (
                  <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>Executive Summary PDF</>
                )}
              </button>
            )}
            <span className="text-xs px-2.5 py-1 rounded border border-slate-700/60 text-slate-500 tracking-widest font-semibold">
              CONFIDENTIAL
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
