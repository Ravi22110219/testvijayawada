import React from "react";
import { AppShell } from "../components/AppShell/AppShell";
import type { CurrentUser } from "../types/api";
import { AdminPage } from "../pages/AdminPage/AdminPage";
import { AlertsPage } from "../pages/AlertsPage/AlertsPage";
import { DashboardPage } from "../pages/DashboardPage/DashboardPage";
import { HotspotsPage } from "../pages/HotspotsPage/HotspotsPage";
import { IncidentsPage } from "../pages/IncidentsPage/IncidentsPage";
import { MapPage } from "../pages/MapPage/MapPage";
import { NowcastPage } from "../pages/NowcastPage/NowcastPage";
import { RainfallPage } from "../pages/RainfallPage/RainfallPage";
import { ReportsPage } from "../pages/ReportsPage/ReportsPage";
import { RunHistoryPage } from "../pages/RunHistoryPage/RunHistoryPage";

const validRoutes = new Set([
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

const demoUser: CurrentUser = {
  email: "demo@floodastra.local",
  display_name: "FloodAstra Demo",
  roles: ["admin", "operator"],
  auth_mode: "disabled"
};

export function App() {
  const [currentPath, setCurrentPath] = React.useState(() => normalizeRoute(window.location.pathname));

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

  return (
    <AppShell currentPath={currentPath} user={demoUser} onNavigate={navigate}>
      {renderRoute(currentPath, demoUser)}
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
