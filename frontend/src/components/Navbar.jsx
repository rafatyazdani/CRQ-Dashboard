import { Link, useLocation } from "react-router-dom";

const ShieldIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
    />
  </svg>
);

export default function Navbar() {
  const { pathname } = useLocation();

  const navLink = (to, label) => {
    const active = pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
          active
            ? "bg-brand-500 text-white"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-brand-500/20 rounded-lg text-brand-400">
            <ShieldIcon />
          </div>
          <div>
            <span className="font-semibold text-white tracking-tight">CRQ Platform</span>
            <span className="ml-2 text-xs text-slate-500 font-mono">FAIR v2.0</span>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLink("/consultant", "Consultant Portal")}
          <div className="w-px h-5 bg-slate-700 mx-1" />
          <span className="text-xs text-slate-500 px-2">Client Dashboards:</span>
          {navLink("/dashboard/nexus-financial", "Nexus Financial")}
          {navLink("/dashboard/medcore-health", "MedCore Health")}
          {navLink("/dashboard/techvault-solutions", "TechVault")}
          <div className="w-px h-5 bg-slate-700 mx-1" />
          <Link
            to="/admin"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
              pathname.startsWith("/admin")
                ? "bg-brand-500/20 text-brand-300 border border-brand-500/30"
                : "text-slate-600 hover:text-slate-400 hover:bg-slate-800/60"
            }`}
            title="Admin Panel"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Admin
          </Link>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-400">Live</span>
        </div>
      </div>
    </nav>
  );
}
