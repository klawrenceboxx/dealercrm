import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ProfileProvider, useProfile } from "./lib/ProfileContext";
import { isManagerAdminOrOwner, isOwnerRole } from "./lib/roles";
import NotificationBell from "./components/NotificationBell";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Pipeline from "./pages/Pipeline";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import ReportsPage from "./pages/ReportsPage";
import OwnerDashboardPage from "./pages/OwnerDashboardPage";
import NotificationsPage from "./pages/NotificationsPage";

const DEMO_SESSION = {
  user: {
    id: "00000000-0000-0000-0000-000000000000",
    email: "demo@dealercrm.local",
    user_metadata: {
      full_name: "Demo User",
    },
  },
};

function hasDemoSession() {
  return typeof window !== "undefined" && window.localStorage.getItem("demo_session") === "true";
}

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
    to: "/inventory",
    label: "Inventory",
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="1" y="3" width="15" height="13" rx="1" />
        <path d="M16 8h4l3 5v3h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  {
    to: "/dashboard",
    label: "Dashboard",
    visible: (role) => isManagerAdminOrOwner(role),
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: "/admin",
    label: "Admin",
    visible: (role) => isManagerAdminOrOwner(role),
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 2l2.4 4.86 5.36.78-3.88 3.78.92 5.34L12 14.27 7.2 16.76l.92-5.34L4.24 7.64l5.36-.78L12 2z" />
      </svg>
    ),
  },
  {
    to: "/reports",
    label: "Reports",
    visible: (role) => isManagerAdminOrOwner(role),
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-7" />
      </svg>
    ),
  },
  {
    to: "/owner",
    label: "Owner",
    visible: (role) => isOwnerRole(role),
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: (
      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
];

function Sidebar({ profile, userEmail }) {
  const displayName = profile?.full_name || profile?.name || userEmail?.split("@")[0] || "User";
  const initial = displayName[0].toUpperCase();
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.visible || item.visible(profile?.role));

  async function handleLogout() {
    localStorage.removeItem("demo_session");
    await supabase.auth.signOut();
  }

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
        {visibleNavItems.map(({ to, label, icon }) => (
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

      {/* User + logout */}
      <div className="px-4 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ backgroundColor: "#1e3a5f" }}>
              {initial}
            </div>
            <div>
              <p className="text-xs font-medium truncate max-w-24" style={{ color: "#cbd5e1" }}>
                {displayName}
              </p>
              {profile?.role && (
                <p className="text-xs capitalize" style={{ color: "#475569" }}>{profile.role}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="transition-colors"
            style={{ color: "#475569" }}
            onMouseEnter={e => e.currentTarget.style.color = "#94a3b8"}
            onMouseLeave={e => e.currentTarget.style.color = "#475569"}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

function ElevatedRoute({ children }) {
  const { profile } = useProfile();

  if (!isManagerAdminOrOwner(profile?.role)) {
    return <Navigate to="/leads" replace />;
  }

  return children;
}

function OwnerRoute({ children }) {
  const { profile } = useProfile();

  if (!isOwnerRole(profile?.role)) {
    return <Navigate to="/leads" replace />;
  }

  return children;
}

function AuthenticatedApp({ session }) {
  const { profile, profileLoading } = useProfile();

  useEffect(() => {
    if (!profile?.suspended_at) return;
    supabase.auth.signOut();
  }, [profile?.suspended_at]);

  if (profileLoading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "24px", height: "24px", border: "2px solid #1e3a5f", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#f1f5f9" }}>
      <Sidebar profile={profile} userEmail={session.user?.email} />
      <main className="flex-1 min-w-0 overflow-auto">
        <div
          className="sticky top-0 z-20 flex justify-end border-b px-6 py-4"
          style={{
            backgroundColor: "rgba(241,245,249,0.92)",
            borderColor: "#e2e8f0",
            backdropFilter: "blur(10px)",
          }}
        >
          <NotificationBell userId={session.user?.id} />
        </div>

        <Routes>
          <Route path="/" element={<Navigate to="/leads" replace />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route
            path="/dashboard"
            element={(
              <ElevatedRoute>
                <Dashboard />
              </ElevatedRoute>
            )}
          />
          <Route
            path="/admin"
            element={(
              <ElevatedRoute>
                <Admin currentProfile={profile} />
              </ElevatedRoute>
            )}
          />
          <Route
            path="/reports"
            element={(
              <ElevatedRoute>
                <ReportsPage />
              </ElevatedRoute>
            )}
          />
          <Route
            path="/owner"
            element={(
              <OwnerRoute>
                <OwnerDashboardPage />
              </OwnerRoute>
            )}
          />
          <Route path="*" element={<Navigate to="/leads" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => (hasDemoSession() ? DEMO_SESSION : null));
  const [loading, setLoading] = useState(() => !hasDemoSession());

  useEffect(() => {
    if (hasDemoSession()) return undefined;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "24px", height: "24px", border: "2px solid #1e3a5f", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <BrowserRouter>
      <ProfileProvider user={session.user}>
        <AuthenticatedApp session={session} />
      </ProfileProvider>
    </BrowserRouter>
  );
}
