import {
  Activity,
  Bell,
  CloudRain,
  FileText,
  History,
  Layers,
  LogOut,
  Map,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Siren,
  Sun,
  UserCircle,
  UserCog
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { fetchAwsAlerts, fetchLatestNowcast } from "../../services/api";
import type { CurrentUser } from "../../types/api";
import { GlobalAgent } from "../GlobalAgent/GlobalAgent";
import styles from "./AppShell.module.css";

type NavigationItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
};

const navigationItems: NavigationItem[] = [
  { path: "/dashboard", label: "Command", icon: Activity },
  { path: "/map", label: "Live Map", icon: Map },
  { path: "/rainfall", label: "Rainfall", icon: CloudRain },
  { path: "/alerts", label: "Alerts", icon: Bell },
  { path: "/history", label: "Run History", icon: History },
  { path: "/mis/hotspots", label: "Hotspots", icon: Layers },
  { path: "/incidents", label: "Incidents", icon: Siren },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/admin", label: "Admin", icon: UserCog, roles: ["admin"] }
];

type ThemeMode = "light" | "dark";
type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  tone: "info" | "warning" | "danger";
  path: string;
};

const themeStorageKey = "floodastra.theme";
const sidebarStorageKey = "floodastra.sidebar.collapsed";

export function AppShell(props: {
  children: ReactNode;
  currentPath: string;
  user: CurrentUser;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return window.localStorage.getItem(themeStorageKey) === "dark" ? "dark" : "light";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem(sidebarStorageKey) === "true";
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const userRoles = new Set(props.user.roles);
  const visibleItems = navigationItems.filter((item) => !item.roles || item.roles.some((role) => userRoles.has(role)));
  const activePage = visibleItems.find((item) => item.path === props.currentPath) || visibleItems[0];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    let cancelled = false;
    const refreshNotifications = () => {
      Promise.all([fetchAwsAlerts(), fetchLatestNowcast()])
        .then(([alertPayload, nowcastPayload]) => {
          if (cancelled) return;
          const alertItems: NotificationItem[] = (alertPayload.alerts || []).slice(0, 5).map((alert) => ({
            id: `aws-${alert.station_id}`,
            title: `${alert.alert_level} rainfall alert`,
            detail: `${alert.station_name}: ${alert.hourly_rate_mm_h.toFixed(1)} mm/hr`,
            tone: alert.alert_level === "red" ? "danger" : "warning",
            path: "/rainfall"
          }));
          const latest = nowcastPayload.latest;
          const nowcastItem: NotificationItem[] =
            latest && latest.status
              ? [
                  {
                    id: `nowcast-${latest.job_id}-${latest.status}`,
                    title: nowcastNotificationTitle(latest.status),
                    detail: latest.error || latest.phase || latest.run_scenario_id || latest.job_id,
                    tone: latest.status === "failed" ? "danger" : latest.status === "completed_with_warnings" ? "warning" : "info",
                    path: ["completed", "completed_with_warnings"].includes(latest.status) ? "/map" : "/history"
                  }
                ]
              : [];
          setNotifications([...alertItems, ...nowcastItem]);
        })
        .catch(() => {
          if (!cancelled) setNotifications([]);
        });
    };
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const openNotification = (item: NotificationItem) => {
    setNotificationsOpen(false);
    props.onNavigate(item.path);
  };

  return (
    <main className={`${styles.shell} ${sidebarCollapsed ? styles.collapsedShell : ""}`}>
      <aside className={styles.sidebar} aria-label="FloodAstra navigation">
        <div className={styles.topRow}>
          <div className={styles.brand}>
            <img src="/brand/floodresq-logo.png" alt="FloodReSQ" />
          </div>
        </div>
        <nav className={styles.navigation} aria-label="Primary navigation">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = props.currentPath === item.path;
            return (
              <a
                className={active ? styles.active : undefined}
                href={item.path}
                key={item.path}
                onClick={(event) => {
                  event.preventDefault();
                  props.onNavigate(item.path);
                }}
                title={item.label}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
        <div className={styles.userPanel}>
          <div>
            <strong>{props.user.display_name}</strong>
            <span>{props.user.roles.join(", ")}</span>
          </div>
          <button type="button" onClick={props.onLogout} aria-label="Log out">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </aside>

      <section className={styles.workspace} id="dashboard">
        <header className={styles.appBar}>
          <div className={styles.appBarLeft}>
            <button
              type="button"
              className={styles.menuButton}
              aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
              onClick={() => setSidebarCollapsed((value) => !value)}
            >
              {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            </button>
            <div className={styles.pageTitle}>
              <strong>{activePage?.label || "Command"}</strong>
              <span>Vijayawada Command</span>
            </div>
          </div>
          <div className={styles.appBarActions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={theme === "dark" ? "Light theme" : "Dark theme"}
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <div className={styles.notificationWrap}>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.notificationButton} ${notifications.length ? styles.notificationHot : ""}`}
                aria-label="Open operational notifications"
                title="Notifications"
                onClick={() => setNotificationsOpen((value) => !value)}
              >
                <Bell aria-hidden="true" />
                {notifications.length ? <span>{notifications.length}</span> : null}
              </button>
              {notificationsOpen ? (
                <div className={styles.notificationMenu}>
                  <strong>Notifications</strong>
                  {notifications.length ? (
                    notifications.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`${styles.notificationItem} ${styles[item.tone]}`}
                        onClick={() => openNotification(item)}
                      >
                        <span>{item.title}</span>
                        <small>{item.detail}</small>
                      </button>
                    ))
                  ) : (
                    <p>No active rainfall or nowcast notifications.</p>
                  )}
                </div>
              ) : null}
            </div>
            <div className={styles.userChip} title={`${props.user.display_name} · ${props.user.roles.join(", ")}`}>
              <UserCircle aria-hidden="true" />
              <span>{props.user.display_name}</span>
            </div>
          </div>
        </header>
        {props.children}
      </section>
      <GlobalAgent currentPath={props.currentPath} />
    </main>
  );
}

function nowcastNotificationTitle(status: string) {
  switch (status) {
    case "queued":
      return "Nowcast queued";
    case "running":
      return "Nowcast running";
    case "completed_with_warnings":
      return "Nowcast completed with warnings";
    case "completed":
      return "Nowcast completed";
    case "failed":
      return "Nowcast job failed";
    case "cancelled":
      return "Nowcast cancelled";
    default:
      return `Nowcast ${status}`;
  }
}
