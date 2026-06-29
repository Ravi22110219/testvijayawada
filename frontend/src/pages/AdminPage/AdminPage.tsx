import React from "react";
import { RefreshCw } from "lucide-react";
import { PageScaffold } from "../../components/PageScaffold/PageScaffold";
import { fetchParitySystemStatus } from "../../services/api";
import type { CurrentUser, ParitySystemStatus } from "../../types/api";
import styles from "./AdminPage.module.css";

export function AdminPage(props: { user: CurrentUser }) {
  const isAdmin = props.user.roles.includes("admin");
  const [status, setStatus] = React.useState<ParitySystemStatus | null>(null);
  const [message, setMessage] = React.useState("Loading system parity status...");

  const load = React.useCallback(() => {
    setMessage("Loading system parity status...");
    fetchParitySystemStatus()
      .then((payload) => {
        setStatus(payload);
        setMessage(payload.message);
      })
      .catch((error: Error) => setMessage(error.message || "System status API is unavailable."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <PageScaffold
      eyebrow="Administration"
      title="Admin Console"
      description="Role-aware administration route for system parity, governance, deployment settings, and production readiness."
      statusItems={[
        { label: "Access", value: isAdmin ? "granted" : "restricted" },
        { label: "Auth mode", value: props.user.auth_mode },
        { label: "Ready", value: String(status?.completed_count || 0) },
        { label: "Pending", value: String(status?.pending_count || 0) }
      ]}
    >
      <section className={isAdmin ? styles.panel : styles.restrictedPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{isAdmin ? "System Parity" : "Admin Role Required"}</h2>
            <p>{isAdmin ? message : "This route is intentionally visible only to admin users in the sidebar."}</p>
          </div>
          <button type="button" onClick={load}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </button>
        </div>
        {status ? (
          <div className={styles.statusGrid}>
            {status.items.map((item) => (
              <article className={styles[item.status]} key={item.id}>
                <span>{item.status}</span>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </PageScaffold>
  );
}
