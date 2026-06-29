import React from "react";
import { Ban, CheckCircle2, Droplets, PlusCircle, RefreshCw, SlidersHorizontal } from "lucide-react";
import { PageScaffold } from "../../components/PageScaffold/PageScaffold";
import {
  createDispatchIncidentFromHotspot,
  fetchDispatchIncidentDetail,
  fetchDispatchIncidents,
  fetchMisHotspots,
  fetchPumpResources,
  postDispatchIncidentUpdate,
  postDispatchPump
} from "../../services/api";
import type {
  DispatchIncident,
  DispatchIncidentDetailResponse,
  DispatchPumpPayload,
  MisHotspotRecord,
  PumpResource,
  UpdateIncidentPayload
} from "../../types/api";
import styles from "./IncidentsPage.module.css";

export function IncidentsPage() {
  const [incidents, setIncidents] = React.useState<DispatchIncident[]>([]);
  const [criticalHotspots, setCriticalHotspots] = React.useState<MisHotspotRecord[]>([]);
  const [pumps, setPumps] = React.useState<PumpResource[]>([]);
  const [selected, setSelected] = React.useState<DispatchIncidentDetailResponse | null>(null);
  const [message, setMessage] = React.useState("Loading dispatch workflow...");
  const [summary, setSummary] = React.useState({
    total_incidents: 0,
    active_incidents: 0,
    dispatched_incidents: 0,
    resolved_incidents: 0,
    available_pumps: 0,
    dispatched_pumps: 0,
    road_blocks: 0,
    avg_silt_clearance_progress_pct: 0
  });
  const [createForm, setCreateForm] = React.useState({
    assigned_team_user: "",
    remark: ""
  });
  const [dispatchForm, setDispatchForm] = React.useState<DispatchPumpPayload>({
    pump_resource_id: "",
    pump_capacity_mld: null,
    remark: ""
  });
  const [updateForm, setUpdateForm] = React.useState<UpdateIncidentPayload>({
    status: "in_progress",
    road_block_status: "open",
    silt_clearance_progress_pct: 0,
    remark: ""
  });

  const loadData = React.useCallback(() => {
    setMessage("Loading dispatch workflow...");
    Promise.all([fetchDispatchIncidents(), fetchMisHotspots({ critical_only: true }), fetchPumpResources()])
      .then(([incidentPayload, hotspotPayload, pumpPayload]) => {
        setIncidents(incidentPayload.incidents || []);
        setSummary(incidentPayload.summary);
        setCriticalHotspots(hotspotPayload.hotspots || []);
        setPumps(pumpPayload.pumps || []);
        setMessage(incidentPayload.message);
        const selectedId = selected?.incident.incident_id || incidentPayload.incidents?.[0]?.incident_id;
        if (selectedId) {
          return fetchDispatchIncidentDetail(selectedId).then((detail) => {
            setSelected(detail);
            setUpdateForm((current) => ({
              ...current,
              status: detail.incident.status,
              road_block_status: detail.incident.road_block_status,
              silt_clearance_progress_pct: detail.incident.silt_clearance_progress_pct
            }));
          });
        }
        return undefined;
      })
      .catch((error: Error) => setMessage(error.message || "Dispatch APIs are unavailable."));
  }, [selected]);

  React.useEffect(() => {
    loadData();
    // Initial load only; refresh button handles subsequent explicit updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectIncident = (incidentId: string) => {
    fetchDispatchIncidentDetail(incidentId)
      .then((detail) => {
        setSelected(detail);
        setUpdateForm((current) => ({
          ...current,
          status: detail.incident.status,
          road_block_status: detail.incident.road_block_status,
          silt_clearance_progress_pct: detail.incident.silt_clearance_progress_pct
        }));
      })
      .catch((error: Error) => setMessage(error.message || "Unable to load incident detail."));
  };

  const createIncident = (hotspotId: string) => {
    createDispatchIncidentFromHotspot(hotspotId, {
      assigned_department: "VMC Engineering",
      assigned_team_user: createForm.assigned_team_user || null,
      remark: createForm.remark || `Incident created from hotspot ${hotspotId}.`
    })
      .then((response) => {
        setMessage(response.audit_entry.summary);
        return fetchDispatchIncidentDetail(response.incident.incident_id).then(setSelected);
      })
      .then(loadData)
      .catch((error: Error) => setMessage(error.message || "Unable to create dispatch incident."));
  };

  const dispatchPump = () => {
    const incidentId = selected?.incident.incident_id;
    if (!incidentId) return;
    postDispatchPump(incidentId, {
      pump_resource_id: dispatchForm.pump_resource_id || null,
      pump_capacity_mld: dispatchForm.pump_capacity_mld ?? null,
      remark: dispatchForm.remark || "Pump dispatch recorded from command center."
    })
      .then((response) => {
        setMessage(response.audit_entry.summary);
        return fetchDispatchIncidentDetail(response.incident.incident_id).then(setSelected);
      })
      .then(loadData)
      .catch((error: Error) => setMessage(error.message || "Unable to dispatch pump."));
  };

  const updateIncident = (status?: DispatchIncident["status"], roadBlock?: DispatchIncident["road_block_status"]) => {
    const incidentId = selected?.incident.incident_id;
    if (!incidentId) return;
    postDispatchIncidentUpdate(incidentId, {
      ...updateForm,
      status: status || updateForm.status,
      road_block_status: roadBlock || updateForm.road_block_status,
      remark: updateForm.remark || "Dispatch status updated."
    })
      .then((response) => {
        setMessage(response.audit_entry.summary);
        return fetchDispatchIncidentDetail(response.incident.incident_id).then(setSelected);
      })
      .then(loadData)
      .catch((error: Error) => setMessage(error.message || "Unable to update incident."));
  };

  const nearestPumps = selected?.nearest_pumps || [];

  return (
    <PageScaffold
      eyebrow="Response Workflow"
      title="Incident Dispatch"
      description="Phase 12 incident creation, pump dispatch, road-block status, ward engineer contact, and silt-clearance tracking."
      statusItems={[
        { label: "Active Incidents", value: String(summary.active_incidents) },
        { label: "Dispatched", value: String(summary.dispatched_incidents) },
        { label: "Available Pumps", value: String(summary.available_pumps) },
        { label: "Road Blocks", value: String(summary.road_blocks) }
      ]}
    >
      <section className={styles.toolbar}>
        <div>
          <strong>{message}</strong>
          <span>{pumps.length} pump/resource records loaded</span>
        </div>
        <input
          value={createForm.assigned_team_user}
          onChange={(event) => setCreateForm((current) => ({ ...current, assigned_team_user: event.target.value }))}
          placeholder="Default assigned team"
        />
        <input
          value={createForm.remark}
          onChange={(event) => setCreateForm((current) => ({ ...current, remark: event.target.value }))}
          placeholder="Creation remark"
        />
        <button type="button" onClick={loadData}><RefreshCw aria-hidden="true" />Refresh</button>
      </section>

      <section className={styles.layout}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Critical Hotspots</h2>
            <span>Create dispatch incident</span>
          </div>
          <div className={styles.hotspotList}>
            {criticalHotspots.slice(0, 8).map((hotspot) => (
              <div className={styles.hotspotRow} key={hotspot.hotspot_id}>
                <div>
                  <strong>{hotspot.hotspot_id}</strong>
                  <span>{hotspot.ward_name || "ward pending"} / {formatNumber(hotspot.predicted_depth_m)} m</span>
                </div>
                <button type="button" onClick={() => createIncident(hotspot.hotspot_id)}>
                  <PlusCircle aria-hidden="true" />
                  Create
                </button>
              </div>
            ))}
          </div>

          <div className={styles.panelHeader}>
            <h2>Incident Queue</h2>
            <span>{incidents.length} records</span>
          </div>
          <div className={styles.incidentTable}>
            <div className={styles.tableHeader}>
              <span>Incident</span>
              <span>Status</span>
              <span>Pump</span>
              <span>Silt</span>
            </div>
            {incidents.map((incident) => (
              <button
                className={`${styles.tableRow} ${selected?.incident.incident_id === incident.incident_id ? styles.selectedRow : ""}`}
                key={incident.incident_id}
                type="button"
                onClick={() => selectIncident(incident.incident_id)}
              >
                <span>
                  <strong>{incident.hotspot_id}</strong>
                  <small>{incident.title}</small>
                </span>
                <span className={styles[incident.severity]}>{statusLabel(incident.status)}</span>
                <span>{incident.pump_resource_id || "--"}</span>
                <span>{incident.silt_clearance_progress_pct}%</span>
              </button>
            ))}
          </div>
        </article>

        <aside className={styles.drawer}>
          {selected ? (
            <>
              <div className={styles.drawerHeader}>
                <div>
                  <p>{selected.incident.severity}</p>
                  <h2>{selected.incident.hotspot_id}</h2>
                  <span>{selected.incident.title}</span>
                </div>
                <strong>{statusLabel(selected.incident.status)}</strong>
              </div>

              <dl className={styles.detailGrid}>
                <div><dt>Ward Engineer</dt><dd>{selected.incident.engineer_contact?.engineer_name || "--"}</dd></div>
                <div><dt>Phone</dt><dd>{selected.incident.engineer_contact?.phone || "--"}</dd></div>
                <div><dt>Depth</dt><dd>{formatNumber(selected.incident.predicted_depth_m)} m</dd></div>
                <div><dt>Road Block</dt><dd>{selected.incident.road_block_status}</dd></div>
              </dl>

              <div className={styles.quickActions}>
                <button type="button" onClick={dispatchPump}><Droplets aria-hidden="true" />Dispatch Pump</button>
                <button type="button" onClick={() => updateIncident("blocked", "full")}><Ban aria-hidden="true" />Full Block</button>
                <button type="button" onClick={() => updateIncident("resolved", "cleared")}><CheckCircle2 aria-hidden="true" />Resolve</button>
              </div>

              <div className={styles.formGrid}>
                <select
                  value={dispatchForm.pump_resource_id || ""}
                  onChange={(event) => setDispatchForm((current) => ({ ...current, pump_resource_id: event.target.value }))}
                >
                  <option value="">Nearest available pump</option>
                  {nearestPumps.map((pump) => (
                    <option key={pump.resource_id} value={pump.resource_id}>
                      {pump.resource_id} / {pump.locality || "locality"} / {pump.distance_km?.toFixed(2) || "--"} km
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  value={dispatchForm.pump_capacity_mld ?? ""}
                  onChange={(event) => setDispatchForm((current) => ({ ...current, pump_capacity_mld: Number(event.target.value) || null }))}
                  placeholder="Pump capacity MLD"
                />
                <input
                  value={dispatchForm.remark || ""}
                  onChange={(event) => setDispatchForm((current) => ({ ...current, remark: event.target.value }))}
                  placeholder="Pump dispatch remark"
                />
              </div>

              <div className={styles.formGrid}>
                <select
                  value={updateForm.status || "in_progress"}
                  onChange={(event) => setUpdateForm((current) => ({ ...current, status: event.target.value as DispatchIncident["status"] }))}
                >
                  <option value="assigned">Assigned</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="in_progress">In progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select
                  value={updateForm.road_block_status || "open"}
                  onChange={(event) => setUpdateForm((current) => ({ ...current, road_block_status: event.target.value as DispatchIncident["road_block_status"] }))}
                >
                  <option value="open">Open</option>
                  <option value="partial">Partial block</option>
                  <option value="full">Full block</option>
                  <option value="cleared">Cleared</option>
                </select>
                <label className={styles.rangeLabel}>
                  <span>Silt clearance {updateForm.silt_clearance_progress_pct || 0}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={updateForm.silt_clearance_progress_pct || 0}
                    onChange={(event) => setUpdateForm((current) => ({ ...current, silt_clearance_progress_pct: Number(event.target.value) }))}
                  />
                </label>
                <textarea
                  value={updateForm.remark || ""}
                  onChange={(event) => setUpdateForm((current) => ({ ...current, remark: event.target.value }))}
                  placeholder="Status update remark"
                />
                <button type="button" onClick={() => updateIncident()}><SlidersHorizontal aria-hidden="true" />Save Update</button>
              </div>

              <div className={styles.auditBox}>
                <h3>Nearest Pumps</h3>
                <ul>
                  {nearestPumps.slice(0, 4).map((pump) => (
                    <li key={pump.resource_id}>
                      <strong>{pump.resource_id}</strong>
                      <span>{pump.locality || "locality pending"} / {pump.status}</span>
                      <small>{formatNumber(pump.distance_km)} km / {formatNumber(pump.capacity_mld)} MLD</small>
                    </li>
                  ))}
                </ul>
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
            <p className={styles.emptyState}>Create or select an incident to dispatch resources.</p>
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
