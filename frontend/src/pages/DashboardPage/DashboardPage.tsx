import React from "react";
import { Flame, MapPin, ShieldAlert } from "lucide-react";
import { HealthPill } from "../../components/HealthPill/HealthPill";
import { LiveMapPanel, type LiveMapPanelHandle } from "../../components/LiveMapPanel/LiveMapPanel";
import {
  fetchBackendHealth,
  fetchDashboardSummary,
  fetchImpactHotspots,
  fetchImpactSummary,
  fetchMisHotspots,
  googleMapsConfigured
} from "../../services/api";
import type { DashboardCard, DashboardSummary, HealthState, HotspotImpact, MisHotspotRecord, OperationalImpactSummary, WardImpact } from "../../types/api";
import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  const mapRef = React.useRef<LiveMapPanelHandle | null>(null);
  const [health, setHealth] = React.useState<HealthState>({
    status: "checking",
    detail: "Checking backend health..."
  });
  const [dashboardSummary, setDashboardSummary] = React.useState<DashboardSummary | null>(null);
  const [dashboardMessage, setDashboardMessage] = React.useState("Loading dashboard summary...");
  const [impactSummary, setImpactSummary] = React.useState<OperationalImpactSummary | null>(null);
  const [hotspots, setHotspots] = React.useState<HotspotImpact[]>([]);
  const [activeLayerTab, setActiveLayerTab] = React.useState<"hotspot" | "alert">("hotspot");

  React.useEffect(() => {
    const controller = new AbortController();
    fetchBackendHealth(controller.signal)
      .then(setHealth)
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setHealth({ status: "offline", detail: error.message || "Backend API is not reachable." });
        }
      });
    return () => controller.abort();
  }, []);

  const loadDashboardSummary = React.useCallback(() => {
    setDashboardMessage("Loading dashboard summary...");
    fetchDashboardSummary()
      .then((payload) => {
        setDashboardSummary(payload);
        setDashboardMessage(`Last updated ${formatTime(payload.generated_utc)}`);
      })
      .catch((error: Error) => {
        setDashboardMessage(error.message || "Dashboard summary is unavailable.");
      });
  }, []);

  React.useEffect(() => {
    loadDashboardSummary();
    const interval = window.setInterval(loadDashboardSummary, 60000);
    return () => window.clearInterval(interval);
  }, [loadDashboardSummary]);

  React.useEffect(() => {
    Promise.all([
      fetchImpactHotspots(12),
      fetchImpactSummary(),
      fetchMisHotspots()
    ])
      .then(([hotspotPayload, impactPayload, misPayload]) => {
        const impactHotspots = (hotspotPayload.hotspots || []).filter((hotspot) => hotspot.incident_candidate);
        const fallbackHotspots = (misPayload.hotspots || [])
          .filter((hotspot) => hotspot.impact_status !== "resolved")
          .map(misHotspotToImpactHotspot);
        setHotspots((impactHotspots.length ? impactHotspots : fallbackHotspots).slice(0, 8));
        setImpactSummary(impactPayload);
      })
      .catch(() => {
        setHotspots([]);
        setImpactSummary(null);
      });
  }, [dashboardSummary?.generated_utc]);

  const cards = dashboardSummary?.cards || [];
  const activeHotspots = findCard(cards, "active_hotspots");
  const wardsUnderAlert = findCard(cards, "wards_under_alert");
  const latestRun = findCard(cards, "latest_model_run");
  const rainfallCard = findCard(cards, "city_max_rainfall");
  const apsdmaWarning = findCard(cards, "apsdma_warning_level");
  const alertWards = (impactSummary?.top_wards || []).length
    ? (impactSummary?.top_wards || []).slice(0, 10)
    : hotspotsToWardAlerts(hotspots).slice(0, 10);
  const activeHotspotValue = hotspots.length ? String(hotspots.length) : activeHotspots?.value || "--";
  const wardsUnderAlertValue = alertWards.length ? String(alertWards.length) : wardsUnderAlert?.value || "--";

  return (
    <main className={styles.landing}>
      <section className={styles.mapPane} aria-label="Flood map landing preview">
        <LiveMapPanel
          ref={mapRef}
          googleMapsConfigured={googleMapsConfigured}
          refreshKey={dashboardSummary?.latest_model_run.run_scenario_id || dashboardSummary?.generated_utc}
          variant="landing"
          showAws={false}
          showHotspots={false}
          hotspotMarkers={activeLayerTab === "hotspot" ? hotspots : []}
          alertMarkers={activeLayerTab === "alert" ? alertWards : []}
        />
      </section>

      <aside className={styles.infoPane} aria-label="Flood map hotspot and alert information">
        <header className={styles.infoHeader}>
          <div>
            <h1>Flood Map Hotspots & Alerts</h1>
            <p>{dashboardMessage} · Flood overlay, hotspot, and ward alert intelligence</p>
          </div>
          <HealthPill status={health.status} />
        </header>

        <div className={styles.tabs} aria-label="Operational layer mode">
          <button type="button" className={activeLayerTab === "hotspot" ? styles.tabActive : undefined} onClick={() => setActiveLayerTab("hotspot")}>
            Hotspot
          </button>
          <button type="button" className={activeLayerTab === "alert" ? styles.tabActive : undefined} onClick={() => setActiveLayerTab("alert")}>
            Alert
          </button>
        </div>

        {activeLayerTab === "hotspot" ? <section className={styles.hotspotPanel} aria-label="Hotspot layer summary">
          <div className={styles.sectionTitle}>
            <Flame aria-hidden="true" />
            <div>
              <h2>Hotspot Layer</h2>
              <p>Shown as a right-side operational layer. Hidden from the dashboard map preview.</p>
            </div>
          </div>
          <div className={styles.hotspotGrid}>
            <StatusBlock icon={<MapPin aria-hidden="true" />} label="Active Hotspots" value={activeHotspotValue} hint={activeHotspots?.hint} />
            <StatusBlock icon={<ShieldAlert aria-hidden="true" />} label="Wards Under Alert" value={wardsUnderAlertValue} hint={wardsUnderAlert?.hint} />
          </div>
          <HotspotTable
            hotspots={hotspots}
            onSelect={(hotspot) => {
              if (hotspot.ward_id) {
                mapRef.current?.zoomToWard({
                  wardId: hotspot.ward_id,
                  label: `${hotspot.hotspot_id} · Ward ${hotspot.ward_id} · ${formatMetric(hotspot.model_depth_m, "m")}`
                });
                return;
              }
              mapRef.current?.zoomToLocation({
                latitude: hotspot.latitude,
                longitude: hotspot.longitude,
                label: hotspot.hotspot_id,
                zoom: 15
              });
            }}
          />
        </section> : (
          <section className={styles.hotspotPanel} aria-label="Alert ward table">
            <div className={styles.sectionTitle}>
              <ShieldAlert aria-hidden="true" />
              <div>
                <h2>Alert Table</h2>
                <p>Ward alert rows from the latest safe model impact summary.</p>
              </div>
            </div>
            <AlertTable
              wards={alertWards}
              onSelect={(ward) =>
                mapRef.current?.zoomToWard({
                  wardId: ward.ward_id,
                  label: `Ward ${ward.ward_id} · ${formatMetric(ward.max_depth_m, "m")} · ${formatMetric(ward.wet_area_km2, "km2")} flooded`
                })
              }
            />
          </section>
        )}

        <section className={styles.dataTable} aria-label="Operational data table">
          <div className={styles.tableHeader}>
            <strong>District / ULB</strong>
            <strong>Value</strong>
            <strong>Status</strong>
          </div>
          {[
            ["Vijayawada", rainfallCard?.value || "--", dashboardSummary?.rainfall_alert_level || "--"],
            ["Hotspots", activeHotspotValue, activeHotspots?.tone || "--"],
            ["Wards", wardsUnderAlertValue, wardsUnderAlert?.tone || "--"],
            ["APSDMA", apsdmaWarning?.value || "--", apsdmaWarning?.tone || "--"],
            ["Latest Run", latestRun?.value || "--", dashboardSummary?.latest_model_run.status || "--"]
          ].map(([name, value, status], index) => (
            <div className={styles.tableRow} key={`${name}-${index}`}>
              <span>{name}</span>
              <span>{value}</span>
              <span>{status}</span>
            </div>
          ))}
        </section>
      </aside>
    </main>
  );
}

function HotspotTable(props: { hotspots: HotspotImpact[]; onSelect: (hotspot: HotspotImpact) => void }) {
  if (!props.hotspots.length) {
    return <p className={styles.emptyHotspots}>No active hotspot table rows are available.</p>;
  }
  return (
    <div className={styles.hotspotTable} aria-label="Active hotspot table">
      <div className={styles.hotspotHeader}>
        <strong>Hotspot</strong>
        <strong>Ward</strong>
        <strong>Depth</strong>
      </div>
      {props.hotspots.map((hotspot) => (
        <button
          type="button"
          className={styles.hotspotRow}
          key={hotspot.hotspot_id}
          onClick={() => props.onSelect(hotspot)}
        >
          <span>{hotspot.hotspot_id}</span>
          <span>{hotspot.ward_id || "--"}</span>
          <span>{formatMetric(hotspot.model_depth_m, "m")}</span>
        </button>
      ))}
    </div>
  );
}

function AlertTable(props: { wards: WardImpact[]; onSelect: (ward: WardImpact) => void }) {
  if (!props.wards.length) {
    return <p className={styles.emptyHotspots}>No ward alert rows are available.</p>;
  }
  return (
    <div className={styles.alertTable} aria-label="Ward alert table">
      <div className={styles.alertHeader}>
        <strong>Ward</strong>
        <strong>Depth</strong>
        <strong>Flooded Area</strong>
        <strong>Est. Pop.</strong>
      </div>
      {props.wards.map((ward) => (
        <button type="button" className={styles.alertRow} key={ward.ward_id} onClick={() => props.onSelect(ward)}>
          <span>{ward.ward_id}</span>
          <span>{formatMetric(ward.max_depth_m, "m")}</span>
          <span>{formatMetric(ward.wet_area_km2, "km2")}</span>
          <span>{estimatedAffectedPopulation(ward).toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}

function estimatedAffectedPopulation(ward: WardImpact) {
  const urbanDensityPerKm2 = 12000;
  return Math.round(Math.max(0, ward.wet_area_km2 || 0) * urbanDensityPerKm2);
}

function misHotspotToImpactHotspot(hotspot: MisHotspotRecord): HotspotImpact {
  const depth = hotspot.predicted_depth_m ?? null;
  return {
    hotspot_id: hotspot.hotspot_id,
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    ward_id: hotspot.ward_id,
    model_depth_m: depth,
    model_persistence_minutes: hotspot.wet_duration_minutes,
    area_ha: hotspot.hotspot_area_ha,
    estimated_impacted_area_ha: hotspot.hotspot_area_ha || 0,
    source_run: hotspot.source_run_id,
    alert_level: hotspotStatusToAlertLevel(hotspot.impact_status, depth),
    incident_candidate: hotspot.impact_status === "critical" || (depth ?? 0) >= 0.15,
    alert_reasons: [
      hotspot.location_name,
      hotspot.ward_name || hotspot.ward_id ? `Ward ${hotspot.ward_name || hotspot.ward_id}` : "",
      hotspot.action_status ? `Action ${hotspot.action_status.replace(/_/g, " ")}` : ""
    ].filter(Boolean)
  };
}

function hotspotsToWardAlerts(hotspots: HotspotImpact[]): WardImpact[] {
  const wards = new Map<string, WardImpact>();
  hotspots.forEach((hotspot) => {
    if (!hotspot.ward_id) {
      return;
    }
    const existing = wards.get(hotspot.ward_id);
    const depth = hotspot.model_depth_m || 0;
    const wetAreaKm2 = (hotspot.estimated_impacted_area_ha || hotspot.area_ha || 0) / 100;
    if (!existing) {
      wards.set(hotspot.ward_id, {
        ward_id: hotspot.ward_id,
        wet_area_km2: wetAreaKm2,
        max_depth_m: depth,
        road_segments_wet: 0,
        road_segments_high: 0,
        flooded_road_length_km: 0,
        alert_level: hotspot.alert_level,
        alert_reasons: hotspot.alert_reasons
      });
      return;
    }
    existing.wet_area_km2 += wetAreaKm2;
    existing.max_depth_m = Math.max(existing.max_depth_m, depth);
    existing.alert_level = maxAlertLevel(existing.alert_level, hotspot.alert_level);
    existing.alert_reasons = Array.from(new Set([...existing.alert_reasons, ...hotspot.alert_reasons]));
  });
  return Array.from(wards.values()).sort((left, right) => right.max_depth_m - left.max_depth_m);
}

function hotspotStatusToAlertLevel(status: MisHotspotRecord["impact_status"], depth?: number | null): WardImpact["alert_level"] {
  if (status === "critical" || (depth ?? 0) >= 0.3) return "red";
  if (status === "watch" || (depth ?? 0) >= 0.15) return "orange";
  if ((depth ?? 0) > 0) return "yellow";
  return "green";
}

function maxAlertLevel(left: WardImpact["alert_level"], right: WardImpact["alert_level"]) {
  const order: Record<WardImpact["alert_level"], number> = { green: 0, yellow: 1, orange: 2, red: 3 };
  return order[right] > order[left] ? right : left;
}

function StatusBlock(props: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <article className={styles.statusBlock}>
      <div>{props.icon}</div>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.hint || "Operational data available"}</small>
    </article>
  );
}

function findCard(cards: DashboardCard[], id: string) {
  return cards.find((card) => card.id === id);
}

function formatMetric(value?: number | null, unit = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(2)} ${unit}`.trim();
}

function formatTime(value?: string | null) {
  if (!value) return "--";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  }).format(new Date(timestamp));
}
