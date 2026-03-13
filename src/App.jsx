import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Pipeline from "./pages/Pipeline";
import Dashboard from "./pages/Dashboard";

function Sidebar() {
  const linkClass = ({ isActive }) =>
    `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-gray-200">
        <h1 className="text-sm font-semibold text-gray-900">DealerCRM</h1>
        <p className="text-xs text-gray-400 mt-0.5">Lead Management</p>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        <NavLink to="/leads" className={linkClass}>Leads</NavLink>
        <NavLink to="/pipeline" className={linkClass}>Pipeline</NavLink>
        <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
      </nav>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/leads" replace />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
