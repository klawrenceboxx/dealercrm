import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Pipeline from "./pages/Pipeline";
import Dashboard from "./pages/Dashboard";

const NAV_ITEMS = [
  {
    to: "/leads",
    label: "Leads",
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: "/pipeline",
    label: "Pipeline",
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="3" width="4" height="18" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="11" width="4" height="10" rx="1" />
      </svg>
    ),
  },
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

function Sidebar() {
  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen sticky top-0" style={{ backgroundColor: "#0f172a" }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "#2563eb" }}>
            <svg width="13" height="13" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">DealerCRM</p>
            <p className="text-xs leading-tight" style={{ color: "#475569" }}>Eli Doueri Auto</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-xs font-semibold tracking-wider px-2 mb-3" style={{ color: "#334155" }}>MENU</p>
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? "text-white" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`
            }
            style={({ isActive }) =>
              isActive ? { backgroundColor: "rgba(37,99,235,0.2)", color: "#93c5fd" } : {}
            }
          >
            {({ isActive }) => (
              <>
                <span style={{ color: isActive ? "#60a5fa" : "inherit" }}>{icon}</span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ backgroundColor: "#1e3a5f" }}>
            S
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: "#cbd5e1" }}>Sleiman M.</p>
            <p className="text-xs" style={{ color: "#475569" }}>Sales Rep</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen" style={{ backgroundColor: "#f1f5f9" }}>
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
