import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { fetchClients, fetchClient, fetchClientRisk } from "../api/client.js";
import ClientSelector from "../components/ClientSelector.jsx";
import MetricCard, { formatCurrency } from "../components/MetricCard.jsx";
import LossExceedanceCurve from "../components/LossExceedanceCurve.jsx";
import LossHistogram from "../components/LossHistogram.jsx";
import ScenarioComparison from "../components/ScenarioComparison.jsx";
import ScenarioTable from "../components/ScenarioTable.jsx";
import FAIRParameters from "../components/FAIRParameters.jsx";

function LoadingSpinner({ label = "Loading…" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="p-4 bg-slate-800 rounded-2xl">
        <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      </div>
      <div>
        <p className="text-slate-300 font-medium">Select a client</p>
        <p className="text-xs text-slate-500 mt-1">Choose a client from the sidebar to view their risk profile</p>
      </div>
    </div>
  );
}

export default function ConsultantDashboard() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [clientDetail, setClientDetail] = useState(null);
  const [risk, setRisk] = useState(null);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState(null);

  // Load client list
  useEffect(() => {
    fetchClients()
      .then((data) => {
        setClients(data);
        if (!clientId && data.length > 0) {
          navigate(`/consultant/${data[0].id}`, { replace: true });
        }
      })
      .catch(() => setError("Could not reach the API. Is the backend running on port 8000?"))
      .finally(() => setLoadingClients(false));
  }, []);

  // Load selected client detail + risk on clientId change
  const loadClientData = useCallback(() => {
    if (!clientId) return;
    setLoadingRisk(true);
    setError(null);
    Promise.all([fetchClient(clientId), fetchClientRisk(clientId)])
      .then(([detail, riskData]) => {
        setClientDetail(detail);
        setRisk(riskData);
      })
      .catch((e) => setError(e.response?.data?.detail ?? "Failed to load client data"))
      .finally(() => setLoadingRisk(false));
  }, [clientId]);

  useEffect(() => {
    loadClientData();
  }, [loadClientData]);

  const tabs = [
    { id: "overview", label: "Risk Overview" },
    { id: "parameters", label: "FAIR Parameters" },
    { id: "scenarios", label: "Scenario Detail" },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 border-r border-slate-800 bg-slate-900/50 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clients</h2>
            <span className="text-xs text-slate-600">{clients.length} total</span>
          </div>
          {loadingClients ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ClientSelector clients={clients} selectedId={clientId} />
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!clientId && !loadingClients && <EmptyState />}

        {clientId && (
          <>
            {/* Client header */}
            {clientDetail && (
              <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold text-white">{clientDetail.name}</h1>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {clientDetail.industry} · {clientDetail.scenarios?.length} scenarios ·
                      Contact: {clientDetail.contact} · Updated: {clientDetail.last_updated}
                    </p>
                  </div>
                  <Link
                    to={`/dashboard/${clientId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                    Client View
                  </Link>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mt-3">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingRisk && <LoadingSpinner label="Running Monte Carlo simulation…" />}

            {!loadingRisk && risk && (
              <div className="px-6 py-6 space-y-6">
                {/* Risk Overview Tab */}
                {activeTab === "overview" && (
                  <>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                      <MetricCard
                        title="ALE — P10 (Best Case)"
                        value={risk.total_ale.p10}
                        subtitle="10th percentile"
                        accent="green"
                      />
                      <MetricCard
                        title="ALE — P50 (Median)"
                        value={risk.total_ale.p50}
                        subtitle="50th percentile"
                        accent="blue"
                      />
                      <MetricCard
                        title="VaR-90 (Worst Case)"
                        value={risk.total_var_90}
                        subtitle={`Range: ${formatCurrency(risk.total_annualized_loss_range?.min)} – ${formatCurrency(risk.total_annualized_loss_range?.max)}`}
                        accent="red"
                      />
                      <MetricCard
                        title="Mean Annual Loss"
                        value={risk.total_ale.mean}
                        subtitle={`Std Dev: ${formatCurrency(risk.total_ale.std)}`}
                        accent="violet"
                      />
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      <LossExceedanceCurve
                        data={risk.loss_exceedance_curve}
                        percentiles={risk.total_ale}
                      />
                      <LossHistogram data={risk.histogram} mean={risk.total_ale.mean} />
                    </div>
                    <ScenarioComparison scenarios={risk.scenarios} />
                  </>
                )}

                {/* Parameters Tab */}
                {activeTab === "parameters" && clientDetail && (
                  <FAIRParameters
                    clientId={clientId}
                    scenarios={clientDetail.scenarios}
                    onParametersUpdated={loadClientData}
                  />
                )}

                {/* Scenarios Tab */}
                {activeTab === "scenarios" && (
                  <ScenarioTable scenarios={risk.scenarios} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
