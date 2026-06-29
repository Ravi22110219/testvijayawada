import React from "react";
import { AppShell } from "../components/AppShell/AppShell";
import { clearAuthToken, fetchCurrentUser, login, logout, readAuthToken } from "../services/api";
import type { CurrentUser } from "../types/api";
import { AdminPage } from "../pages/AdminPage/AdminPage";
import { AlertsPage } from "../pages/AlertsPage/AlertsPage";
import { DashboardPage } from "../pages/DashboardPage/DashboardPage";
import { HotspotsPage } from "../pages/HotspotsPage/HotspotsPage";
import { IncidentsPage } from "../pages/IncidentsPage/IncidentsPage";
import { LoginPage } from "../pages/LoginPage/LoginPage";
import { MapPage } from "../pages/MapPage/MapPage";
import { NowcastPage } from "../pages/NowcastPage/NowcastPage";
import { RainfallPage } from "../pages/RainfallPage/RainfallPage";
import { ReportsPage } from "../pages/ReportsPage/ReportsPage";
import { RunHistoryPage } from "../pages/RunHistoryPage/RunHistoryPage";
import styles from "./App.module.css";

const validRoutes = new Set([
  "/login",
  "/dashboard",
  "/map",
  "/nowcast",
  "/history",
  "/rainfall",
  "/mis/hotspots",
  "/incidents",
  "/alerts",
  "/reports",
  "/admin"
]);

export function App() {
  const [currentPath, setCurrentPath] = React.useState(() => normalizeRoute(window.location.pathname));
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [loginLoading, setLoginLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState("");

  const navigate = React.useCallback((path: string, replace = false) => {
    const nextPath = normalizeRoute(path);
    if (replace) {
      window.history.replaceState({}, "", nextPath);
    } else {
      window.history.pushState({}, "", nextPath);
    }
    setCurrentPath(nextPath);
  }, []);

  React.useEffect(() => {
    if (window.location.pathname === "/") {
      navigate("/dashboard", true);
    }
    const handlePopState = () => setCurrentPath(normalizeRoute(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  React.useEffect(() => {
    const token = readAuthToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    fetchCurrentUser(token)
      .then((payload) => {
        setUser(payload);
        setAuthError("");
      })
      .catch(() => {
        clearAuthToken();
        setUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  React.useEffect(() => {
    if (!authLoading && user && currentPath === "/login") {
      navigate("/dashboard", true);
    }
  }, [authLoading, currentPath, navigate, user]);

  const handleLogin = (email: string, password: string) => {
    setLoginLoading(true);
    setAuthError("");
    login(email, password)
      .then(() => fetchCurrentUser())
      .then((payload) => {
        setUser(payload);
        navigate("/dashboard", true);
      })
      .catch((error: Error) => setAuthError(error.message || "Unable to sign in."))
      .finally(() => setLoginLoading(false));
  };

  const handleLogout = () => {
    logout().finally(() => {
      setUser(null);
      navigate("/login", true);
    });
  };

  if (authLoading) {
    return (
      <main className={styles.loadingShell}>
        <span>Loading command center...</span>
      </main>
    );
  }

  if (!user || currentPath === "/login") {
    return <LoginPage error={authError} isLoading={loginLoading} onLogin={handleLogin} />;
  }

  return (
    <AppShell currentPath={currentPath} user={user} onNavigate={navigate} onLogout={handleLogout}>
      {renderRoute(currentPath, user)}
    </AppShell>
  );
}

function renderRoute(path: string, user: CurrentUser) {
  switch (path) {
    case "/map":
      return <MapPage />;
    case "/nowcast":
      return <NowcastPage />;
    case "/history":
      return <RunHistoryPage />;
    case "/rainfall":
      return <RainfallPage />;
    case "/mis/hotspots":
      return <HotspotsPage />;
    case "/incidents":
      return <IncidentsPage />;
    case "/alerts":
      return <AlertsPage />;
    case "/reports":
      return <ReportsPage />;
    case "/admin":
      return <AdminPage user={user} />;
    case "/dashboard":
    default:
      return <DashboardPage />;
  }
}

function normalizeRoute(path: string) {
  if (path === "/") {
    return "/dashboard";
  }
  return validRoutes.has(path) ? path : "/dashboard";
}
