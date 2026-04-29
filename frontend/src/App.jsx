import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ConsultantDashboard from "./pages/ConsultantDashboard.jsx";
import ClientDashboard from "./pages/ClientDashboard.jsx";
import AdminPanel from "./pages/AdminPanel.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/consultant" replace />} />
            <Route path="/consultant" element={<ConsultantDashboard />} />
            <Route path="/consultant/:clientId" element={<ConsultantDashboard />} />
            <Route path="/dashboard/:clientId" element={<ClientDashboard />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<Navigate to="/consultant" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
