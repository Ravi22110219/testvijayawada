import React from "react";
import { Ban, Camera, CheckCircle2, Droplets, MessageSquare, RefreshCw, Search, UserPlus } from "lucide-react";
import { PageScaffold } from "../../components/PageScaffold/PageScaffold";
import {
  fetchMisHotspotDetail,
  fetchMisHotspots,
  postMisHotspotAction,
  postMisHotspotPhoto
} from "../../services/api";
import type { MisActionPayload, MisHotspotDetailResponse, MisHotspotRecord, MisPhotoPayload } from "../../types/api";
import styles from "./HotspotsPage.module.css";

const actionOptions: Array<{ value: MisActionPayload["action_type"]; label: string }> = [
  { value: "assign_team", label: "Assign team" },
  { value: "dispatch_pump", label: "Dispatch pump" },
  { value: "close_traffic", label: "Close traffic" },
  { value: "update_status", label: "Update status" },
  { value: "add_remark", label: "Add remark" },
  { value: "resolve_incident", label: "Resolve" }
];

export function HotspotsPage() {
  const [hotspots, setHotspots] = React.useState<MisHotspotRecord[]>([]);
  const [summary, setSummary] = React.useState({ total_hotspots: 0, critical_hotspots: 0, assigned_hotspots: 0, in_progress_hotspots: 0, resolved_hotspots: 0, before_photos: 0, after_photos: 0 });
  const [selected, setSelected] = React.useState<MisHotspotDetailResponse | null>(null);
  const [query, setQuery] = React.useState("");
  const [impactFilter, setImpactFilter] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState("");
  const [criticalOnly, setCriticalOnly] = React.useState(false);
  const [message, setMessage] = React.useState("Loading hotspot MIS registry...");
  const [actionForm, setActionForm] = React.useState<MisActionPayload>({
    action_type: "assign_team",
    assigned_department: "VMC Field Operations",
    assigned_team_user: "",
    action_status: "assigned",
    remark: ""
  });
  const [photoForm, setPhotoForm] = React.useState<MisPhotoPayload>({
    stage: "before",
    filename: "",
    photo_url: "",
    caption: ""
  });

  const loadRegistry = React.useCallback(() => {
    setMessage("Loading hotspot MIS registry...");
    fetchMisHotspots({
      query,
      impact_status: impactFilter || undefined,
      action_status: actionFilter || undefined,
      critical_only: criticalOnly
    })
      .then((payload) => {
        setHotspots(payload.hotspots || []);
        setSummary(payload.summary);
        setMessage(payload.message);
        const firstId = payload.hotspots?.[0]?.hotspot_id;
        if (!selected && firstId) {
          return fetchMisHotspotDetail(firstId).then(setSelected);
        }
        if (selected) {
          return fetchMisHotspotDetail(selected.hotspot.hotspot_id).then(setSelected).catch(() => undefined);
        }
        return undefined;
      })
      .catch((error: Error) => setMessage(error.message || "MIS registry API is unavailable."));
  }, [actionFilter, criticalOnly, impactFilter, query, selected]);

  React.useEffect(() => {
    loadRegistry();
    // Initial load only; filters use the explicit refresh/search button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectHotspot = (hotspotId: string) => {
    fetchMisHotspotDetail(hotspotId)
      .then(setSelected)
      .catch((error: Error) => setMessage(error.message || "Unable to load hotspot detail."));
  };

  const submitAction = (actionType?: MisActionPayload["action_type"]) => {
    const hotspotId = selected?.hotspot.hotspot_id;
    if (!hotspotId) return;
    const payload = { ...actionForm, action_type: actionType || actionForm.action_type };
    postMisHotspotAction(hotspotId, payload)
      .then((response) => {
        setSelected((current) => current ? { ...current, hotspot: response.hotspot, audit: [response.audit_entry, ...current.audit] } : current);
        setMessage(response.audit_entry.summary);
        loadRegistry();
      })
      .catch((error: Error) => setMessage(error.message || "Unable to record MIS action."));
  };

  const submitPhoto = () => {
    const hotspotId = selected?.hotspot.hotspot_id;
    if (!hotspotId || !photoForm.filename.trim()) return;
    postMisHotspotPhoto(hotspotId, photoForm)
      .then((response) => {
        setSelected((current) => current ? { ...current, hotspot: response.hotspot, audit: [response.audit_entry, ...current.audit] } : current);
        setPhotoForm({ stage: "before", filename: "", photo_url: "", caption: "" });
        setMessage(response.audit_entry.summary);
        loadRegistry();
      })
      .catch((error: Error) => setMessage(error.message || "Unable to add photo evidence."));
  };

  return (
    <PageScaffold
      eyebrow="MIS Registry"
      title="Flood Hotspots"
      description="Phase 11 searchable hotspot registry with assignment, status updates, photo evidence, remarks, and audit history."
      statusItems={[
        { label: "Hotspots", value: String(summary.total_hotspots) },
        { label: "Critical", value: String(summary.critical_hotspots) },
        { label: "Assigned", value: String(summary.assigned_hotspots) },
        { label: "Resolved", value: String(summary.resolved_hotspots) }
      ]}
    >
      <section className={styles.toolbar}>
        <label>
          <Search aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search hotspot, ward, or team" />
        </label>
        <select value={impactFilter} onChange={(event) => setImpactFilter(event.target.value)}>
          <option value="">All impact</option>
          <option value="critical">Critical</option>
          <option value="watch">Watch</option>
          <option value="normal">Normal</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
          <option value="">All actions</option>
          <option value="new">New</option>
          <option value="monitoring">Monitoring</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In progress</option>
          <option value="pump_dispatched">Pump dispatched</option>
          <option value="traffic_closed">Traffic closed</option>
          <option value="resolved">Resolved</option>
        </select>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={criticalOnly} onChange={(event) => setCriticalOnly(event.target.checked)} />
          Critical only
        </label>
        <button type="button" onClick={loadRegistry}>
          <RefreshCw aria-hidden="true" />
          Refresh
        </button>
      </section>

      <section className={styles.layout}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>MIS Hotspot Table</h2>
            <span>{message}</span>
          </div>
          <div className={styles.hotspotTable}>
            <div className={styles.tableHeader}>
              <span>Hotspot</span>
              <span>Ward</span>
              <span>Depth</span>
              <span>Impact</span>
              <span>Action</span>
              <span>Team</span>
            </div>
            {hotspots.map((hotspot) => (
              <button
                className={`${styles.tableRow} ${selected?.hotspot.hotspot_id === hotspot.hotspot_id ? styles.selectedRow : ""}`}
                key={hotspot.hotspot_id}
                type="button"
                onClick={() => selectHotspot(hotspot.hotspot_id)}
              >
                <span>
                  <strong>{hotspot.hotspot_id}</strong>
                  <small>{hotspot.location_name}</small>
                </span>
                <span>{hotspot.ward_name || "unassigned"}</span>
                <span>{formatNumber(hotspot.predicted_depth_m)} m</span>
                <span className={styles[hotspot.impact_status]}>{hotspot.impact_status}</span>
                <span>{statusLabel(hotspot.action_status)}</span>
                <span>{hotspot.assigned_team_user || hotspot.assigned_department || "--"}</span>
              </button>
            ))}
          </div>
        </article>

        <aside className={styles.drawer}>
          {selected ? (
            <>
              <div className={styles.drawerHeader}>
                <div>
                  <p>{selected.hotspot.impact_status}</p>
                  <h2>{selected.hotspot.hotspot_id}</h2>
                  <span>{selected.hotspot.location_name}</span>
                </div>
                <strong>{formatNumber(selected.hotspot.predicted_depth_m)} m</strong>
              </div>

              <dl className={styles.detailGrid}>
                <div><dt>Ward</dt><dd>{selected.hotspot.ward_name || "--"}</dd></div>
                <div><dt>Duration</dt><dd>{formatNumber(selected.hotspot.wet_duration_minutes)} min</dd></div>
                <div><dt>Area</dt><dd>{formatNumber(selected.hotspot.hotspot_area_ha)} ha</dd></div>
                <div><dt>Status</dt><dd>{statusLabel(selected.hotspot.action_status)}</dd></div>
              </dl>

              <div className={styles.quickActions}>
                <button type="button" onClick={() => submitAction("assign_team")}><UserPlus aria-hidden="true" />Assign</button>
                <button type="button" onClick={() => submitAction("dispatch_pump")}><Droplets aria-hidden="true" />Pump</button>
                <button type="button" onClick={() => submitAction("close_traffic")}><Ban aria-hidden="true" />Traffic</button>
                <button type="button" onClick={() => submitAction("resolve_incident")}><CheckCircle2 aria-hidden="true" />Resolve</button>
              </div>

              <div className={styles.formGrid}>
                <select value={actionForm.action_type} onChange={(event) => setActionForm((current) => ({ ...current, action_type: event.target.value as MisActionPayload["action_type"] }))}>
                  {actionOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <input value={actionForm.assigned_department || ""} onChange={(event) => setActionForm((current) => ({ ...current, assigned_department: event.target.value }))} placeholder="Department" />
                <input value={actionForm.assigned_team_user || ""} onChange={(event) => setActionForm((current) => ({ ...current, assigned_team_user: event.target.value }))} placeholder="Team or user" />
                <select value={actionForm.action_status || "assigned"} onChange={(event) => setActionForm((current) => ({ ...current, action_status: event.target.value as MisActionPayload["action_status"] }))}>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In progress</option>
                  <option value="pump_dispatched">Pump dispatched</option>
                  <option value="traffic_closed">Traffic closed</option>
                  <option value="resolved">Resolved</option>
                </select>
                <textarea value={actionForm.remark || ""} onChange={(event) => setActionForm((current) => ({ ...current, remark: event.target.value }))} placeholder="Remark" />
                <button type="button" onClick={() => submitAction()}><MessageSquare aria-hidden="true" />Save Action</button>
              </div>

              <div className={styles.photoBox}>
                <h3>Photo Evidence</h3>
                <div className={styles.formGrid}>
                  <select value={photoForm.stage} onChange={(event) => setPhotoForm((current) => ({ ...current, stage: event.target.value as MisPhotoPayload["stage"] }))}>
                    <option value="before">Before</option>
                    <option value="after">After</option>
                    <option value="field">Field</option>
                    <option value="other">Other</option>
                  </select>
                  <input value={photoForm.filename} onChange={(event) => setPhotoForm((current) => ({ ...current, filename: event.target.value }))} placeholder="Filename" />
                  <input value={photoForm.photo_url || ""} onChange={(event) => setPhotoForm((current) => ({ ...current, photo_url: event.target.value }))} placeholder="Photo URL or storage key" />
                  <input value={photoForm.caption || ""} onChange={(event) => setPhotoForm((current) => ({ ...current, caption: event.target.value }))} placeholder="Caption" />
                  <button type="button" onClick={submitPhoto}><Camera aria-hidden="true" />Add Photo</button>
                </div>
                <p>{selected.hotspot.photos.length} photos / before {selected.hotspot.photos.filter((photo) => photo.stage === "before").length} / after {selected.hotspot.photos.filter((photo) => photo.stage === "after").length}</p>
              </div>

              <div className={styles.auditBox}>
                <h3>Audit Trail</h3>
                <ul>
                  {selected.audit.slice(0, 8).map((entry) => (
                    <li key={entry.audit_id}>
                      <strong>{entry.action_type.replace(/_/g, " ")}</strong>
                      <span>{entry.summary}</span>
                      <small>{entry.actor} / {new Date(entry.created_utc).toLocaleString()}</small>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className={styles.emptyState}>Select a hotspot to open MIS actions.</p>
          )}
        </aside>
      </section>
    </PageScaffold>
  );
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(2);
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}
