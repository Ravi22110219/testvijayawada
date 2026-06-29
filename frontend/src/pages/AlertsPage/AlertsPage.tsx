import React from "react";
import { Download, FileText, Radio, RefreshCw, Send } from "lucide-react";
import { PageScaffold } from "../../components/PageScaffold/PageScaffold";
import {
  fetchAwareOfficialStatus,
  fetchDisseminationSummary,
  generateWardPdf,
  postDisseminationAction,
  toApiUrl
} from "../../services/api";
import type { AwareOfficialSummary, DisseminationSummary, DisseminationWard } from "../../types/api";
import styles from "./AlertsPage.module.css";

export function AlertsPage() {
  const [summary, setSummary] = React.useState<DisseminationSummary | null>(null);
  const [officialSources, setOfficialSources] = React.useState<AwareOfficialSummary | null>(null);
  const [heatmapVisible, setHeatmapVisible] = React.useState(true);
  const [message, setMessage] = React.useState("Loading AWARE dissemination package...");
  const [selectedWardIds, setSelectedWardIds] = React.useState<string[]>([]);
  const [recipients, setRecipients] = React.useState("");

  const loadSummary = React.useCallback(() => {
    setMessage("Loading AWARE dissemination package...");
    Promise.all([fetchDisseminationSummary(), fetchAwareOfficialStatus()])
      .then(([disseminationPayload, officialPayload]) => {
        setSummary(disseminationPayload);
        setOfficialSources(officialPayload);
        setHeatmapVisible(disseminationPayload.heatmap_enabled_default);
        setSelectedWardIds(disseminationPayload.wards.slice(0, 12).map((ward) => ward.ward_id));
        setMessage(disseminationPayload.message);
      })
      .catch((error: Error) => setMessage(error.message || "Dissemination APIs are unavailable."));
  }, []);

  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const generatePdf = () => {
    generateWardPdf({
      actor: "operator",
      ulb_id: "VMC",
      ward_ids: selectedWardIds.length ? selectedWardIds : null
    })
      .then((payload) => {
        setSummary((current) => current ? { ...current, latest_pdf_artifact: payload.artifact, official_message: payload.official_message, audit: [payload.audit_entry, ...current.audit] } : current);
        setMessage(payload.audit_entry.summary);
      })
      .catch((error: Error) => setMessage(error.message || "Unable to generate ward PDF."));
  };

  const recordSend = (actionType: "send" | "export" | "approve_draft") => {
    postDisseminationAction({
      actor: "operator",
      action_type: actionType,
      channel: actionType === "send" ? "email" : "manual_export",
      recipients: recipients.split(",").map((item) => item.trim()).filter(Boolean),
      artifact_id: summary?.latest_pdf_artifact?.artifact_id || null,
      note: "Phase 13 operator review action."
    })
      .then((payload) => {
        setSummary((current) => current ? { ...current, official_message: payload.official_message, audit: [payload.audit_entry, ...current.audit] } : current);
        setMessage(payload.audit_entry.summary);
      })
      .catch((error: Error) => setMessage(error.message || "Unable to record dissemination action."));
  };

  const toggleWard = (ward: DisseminationWard) => {
    setSelectedWardIds((current) =>
      current.includes(ward.ward_id)
        ? current.filter((item) => item !== ward.ward_id)
        : [...current, ward.ward_id]
    );
  };

  const ulb = summary?.ulbs[0];
  const awareUnavailable = String(summary?.aware_quality_flag || "").toLowerCase().includes("unavailable");

  return (
    <PageScaffold
      eyebrow="AWARE Dissemination"
      title="Alerts and Official Messages"
      description="Phase 13 AP/ULB alert view, 6-hour rainfall heatmap, ward details PDF, message preview, and audited send/export workflow."
      statusItems={[
        { label: "ULB Alert", value: ulb?.alert_level || "--" },
        {
          label: "6h Rainfall",
          value: summary && !awareUnavailable && typeof summary.aware_max_6h_rainfall_mm_h === "number"
            ? `${summary.aware_max_6h_rainfall_mm_h.toFixed(1)} mm/hr`
            : "--"
        },
        { label: "Wards", value: String(summary?.wards.length || 0) },
        { label: "Quality", value: summary?.aware_quality_flag || "loading" }
      ]}
    >
      <section className={styles.toolbar}>
        <div>
          <strong>{message}</strong>
          <span>{summary?.generated_utc || "waiting for backend"}</span>
        </div>
        <label>
          <input type="checkbox" checked={heatmapVisible} onChange={(event) => setHeatmapVisible(event.target.checked)} />
          6h heatmap
        </label>
        <button type="button" onClick={loadSummary}><RefreshCw aria-hidden="true" />Refresh</button>
        <button type="button" onClick={generatePdf}><FileText aria-hidden="true" />Ward PDF</button>
      </section>

      <section className={styles.mapAndMessage}>
        <article className={styles.mapPanel}>
          <div className={styles.panelHeader}>
            <h2>AP / ULB View</h2>
            <span>{String(summary?.ap_view.selected_ulb_name || "Vijayawada")}</span>
          </div>
          <div className={styles.apCanvas}>
            <div className={styles.apOutline}>
              <span>Andhra Pradesh</span>
              <strong>{String(summary?.ap_view.district || "NTR District")}</strong>
              {ulb ? (
                <button className={`${styles.ulbMarker} ${styles[ulb.alert_level]}`} type="button" title={ulb.ulb_name}>
                  {ulb.ulb_id}
                </button>
              ) : null}
              {heatmapVisible && summary?.heatmap_cells.map((cell) => (
                <i
                  className={`${styles.heatCell} ${styles[cell.alert_level]}`}
                  key={cell.cell_id}
                  style={heatCellStyle(cell.latitude, cell.longitude)}
                  title={`${cell.cell_id}: ${cell.rainfall_mm_h.toFixed(1)} impact index`}
                />
              ))}
            </div>
          </div>
          <div className={styles.heatLegend}>
            {summary?.heatmap_cells.length ? (
              summary.heatmap_cells.map((cell) => (
                <span key={cell.cell_id} className={styles[cell.alert_level]}>
                  {cell.cell_id.replace(/aware_/g, "").replace(/model_ward_/g, "Ward ")}: {cell.rainfall_mm_h.toFixed(1)}
                </span>
              ))
            ) : (
              <span>No live AWARE heatmap cells available</span>
            )}
          </div>
        </article>

        <article className={styles.messagePanel}>
          <div className={styles.panelHeader}>
            <h2>Official Message Preview</h2>
            <span>{summary?.official_message.quality_flag || "quality pending"}</span>
          </div>
          <strong>{summary?.official_message.subject || "AWARE Flood Risk Advisory"}</strong>
          <pre>{summary?.official_message.body || "Generate or load the dissemination package to preview message text."}</pre>
          <input value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="Recipients" />
          <div className={styles.actionRow}>
            <button type="button" onClick={() => recordSend("approve_draft")}><Radio aria-hidden="true" />Approve</button>
            <button type="button" onClick={() => recordSend("export")}><Download aria-hidden="true" />Export</button>
            <button type="button" onClick={() => recordSend("send")}><Send aria-hidden="true" />Send</button>
          </div>
          {summary?.latest_pdf_artifact ? (
            <a className={styles.downloadLink} href={toApiUrl(summary.latest_pdf_artifact.artifact_url)} target="_blank" rel="noreferrer">
              Open latest ward PDF
            </a>
          ) : null}
        </article>
      </section>

      <section className={styles.officialPanel}>
        <div className={styles.panelHeader}>
          <h2>Official AWARE Feed Status</h2>
          <span>{officialSources?.status || "loading"}</span>
        </div>
        <div className={styles.officialGrid}>
          {(officialSources?.sources || []).map((source) => (
            <article className={styles.officialCard} key={source.source_id}>
              <strong>{source.label}</strong>
              <span>{source.status} · {source.record_count} records</span>
              <small>{source.updated_utc || source.quality_flag}</small>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>ULB Table</h2>
            <span>click zoom represented by selected marker</span>
          </div>
          <div className={styles.ulbTable}>
            <div className={styles.ulbHeader}>
              <span>ULB</span>
              <span>Depth</span>
              <span>Duration</span>
              <span>Hotspot Area</span>
              <span>Alert</span>
            </div>
            {(summary?.ulbs || []).map((item) => (
              <div className={styles.ulbRow} key={item.ulb_id}>
                <span>
                  <strong>{item.ulb_name}</strong>
                  <small>{item.district} / {item.mandal}</small>
                </span>
                <span>{item.predicted_depth_m.toFixed(2)} m</span>
                <span>{item.duration_minutes.toFixed(1)} min</span>
                <span>{item.hotspot_area_ha.toFixed(2)} ha</span>
                  <span className={`${styles.alertText} ${styles[item.alert_level]}`}>{item.alert_level}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Ward Table</h2>
            <span>{selectedWardIds.length} selected for PDF</span>
          </div>
          <div className={styles.wardTable}>
            <div className={styles.wardHeader}>
              <span>Use</span>
              <span>Ward</span>
              <span>Depth</span>
              <span>Duration</span>
              <span>Area</span>
              <span>Alert</span>
            </div>
            {(summary?.wards || []).slice(0, 28).map((ward) => (
              <button className={styles.wardRow} key={ward.ward_id} type="button" onClick={() => toggleWard(ward)}>
                <span>{selectedWardIds.includes(ward.ward_id) ? "yes" : "no"}</span>
                <span>{ward.ward_id}</span>
                <span>{ward.predicted_depth_m.toFixed(2)} m</span>
                <span>{ward.duration_minutes.toFixed(1)} min</span>
                <span>{ward.hotspot_area_ha.toFixed(2)} ha</span>
                <span className={`${styles.alertText} ${styles[ward.alert_level]}`}>{ward.alert_level}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Dissemination Audit</h2>
          <span>{summary?.audit.length || 0} records</span>
        </div>
        <ul className={styles.auditList}>
          {(summary?.audit || []).slice(0, 8).map((entry) => (
            <li key={entry.audit_id}>
              <strong>{entry.action_type.replace(/_/g, " ")}</strong>
              <span>{entry.summary}</span>
              <small>{entry.actor} / {new Date(entry.created_utc).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      </section>
    </PageScaffold>
  );
}

function heatCellStyle(latitude: number, longitude: number): React.CSSProperties {
  const left = 50 + (longitude - 80.648) * 820;
  const top = 52 - (latitude - 16.5062) * 820;
  return {
    left: `${Math.min(86, Math.max(10, left))}%`,
    top: `${Math.min(78, Math.max(16, top))}%`
  };
}
