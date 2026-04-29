import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

export const fetchClients = () => api.get("/clients").then((r) => r.data);

export const fetchClient = (clientId) =>
  api.get(`/clients/${clientId}`).then((r) => r.data);

export const fetchClientRisk = (clientId, simulations = 10000) =>
  api.get(`/clients/${clientId}/risk`, { params: { simulations } }).then((r) => r.data);

export const updateScenarioParameters = (clientId, scenarioId, parameters) =>
  api
    .put(`/clients/${clientId}/scenarios/${scenarioId}/parameters`, parameters)
    .then((r) => r.data);

export const downloadClientPdf = async (clientId) => {
  const response = await api.get(`/clients/${clientId}/report.pdf`, {
    responseType: "blob",
    timeout: 120_000, // PDF generation can take a while
  });
  const url = URL.createObjectURL(response.data);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = `crq-report-${clientId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default api;
