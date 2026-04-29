import axios from "axios";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const adminApi = axios.create({ baseURL: BASE });

// Inject the stored admin token into every request header
adminApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("crq_admin_token");
  if (token) config.headers["X-Admin-Token"] = token;
  return config;
});

export const adminListClients = () =>
  adminApi.get("/admin/clients").then((r) => r.data);

export const adminGetClient = (id) =>
  adminApi.get(`/admin/clients/${id}`).then((r) => r.data);

export const adminUpsertClient = (payload) =>
  adminApi.post("/admin/clients", payload).then((r) => r.data);

export const adminGenerateReport = (clientId, simulations = 10_000) =>
  adminApi
    .post(`/admin/clients/${clientId}/generate-report`, null, {
      params: { simulations },
    })
    .then((r) => r.data);

export const adminDownloadPdf = async (clientId) => {
  const response = await adminApi.get(`/admin/clients/${clientId}/report.pdf`, {
    responseType: "blob",
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

export const adminListReports = () =>
  adminApi.get("/admin/reports").then((r) => r.data);

// Uses public endpoint — no admin token required
export const deriveParameters = (inputs) =>
  axios.post(`${BASE}/fair/derive-parameters`, inputs).then((r) => r.data);
