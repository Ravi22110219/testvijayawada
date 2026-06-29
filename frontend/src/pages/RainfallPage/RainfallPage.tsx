import React from "react";
import { ChevronDown, ChevronUp, Download, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { PageScaffold } from "../../components/PageScaffold/PageScaffold";
import {
  awareForecastCsvUrl,
  fetchAwareLatest,
  fetchAwareOfficialStatus,
  fetchAwareSnapshots,
  fetchAwsAlerts,
  fetchAwsLatest,
  syncAwareOfficialSources
} from "../../services/api";
import type { AwareLatestResponse, AwareOfficialSummary, AwareSnapshotArchive, AwsAlert, AwsLatestResponse } from "../../types/api";
import styles from "./RainfallPage.module.css";

export function RainfallPage() {
  const [awsLatest, setAwsLatest] = React.useState<AwsLatestResponse | null>(null);
  const [alerts, setAlerts] = React.useState<AwsAlert[]>([]);
  const [aware, setAware] = React.useState<AwareLatestResponse | null>(null);
  const [official, setOfficial] = React.useState<AwareOfficialSummary | null>(null);
  const [snapshotArchive, setSnapshotArchive] = React.useState<AwareSnapshotArchive | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [message, setMessage] = React.useState("Loading telemetry...");
  const [showStations, setShowStations] = React.useState(true);
  const [stationQuery, setStationQuery] = React.useState("");
  const [stationAlertFilter, setStationAlertFilter] = React.useState("all");

  const loadRainfall = React.useCallback(() => {
    Promise.all([fetchAwsLatest(), fetchAwsAlerts(), fetchAwareLatest(), fetchAwareOfficialStatus(), fetchAwareSnapshots(8)])
      .then(([awsPayload, alertPayload, awarePayload, officialPayload, snapshotPayload]) => {
        setAwsLatest(awsPayload);
        setAlerts(alertPayload.alerts || []);
        setAware(awarePayload);
        setOfficial(officialPayload);
        setSnapshotArchive(snapshotPayload);
        setMessage(
          isUnavailable(awsPayload.quality_flag) && isUnavailable(awarePayload.quality_flag)
            ? "Live AWS/AWARE feeds are not connected; no synthetic rainfall is shown."
            : "Operational AWS/AWARE telemetry loaded with quality flags."
        );
      })
      .catch((error: Error) => setMessage(error.message || "Telemetry APIs are unavailable."));
  }, []);

  React.useEffect(() => {
    loadRainfall();
  }, [loadRainfall]);

  const syncOfficialSources = () => {
    setIsSyncing(true);
    setMessage("Syncing official AWARE APIs from Flood Modeling APIs contract...");
    syncAwareOfficialSources()
      .then((payload) => {
        setOfficial(payload);
        setAwsLatest(payload.aws_rainfall);
        setAware(payload.ecmwf_forecast);
        return fetchAwsAlerts();
      })
      .then((alertPayload) => {
        setAlerts(alertPayload.alerts || []);
        setMessage("Official AWARE API sync completed. Rainfall panels refreshed from operational responses.");
      })
      .catch((error: Error) => setMessage(error.message || "Official AWARE API sync failed."))
      .finally(() => setIsSyncing(false));
  };

  const awsUnavailable = isUnavailable(awsLatest?.quality_flag);
  const awareUnavailable = isUnavailable(aware?.quality_flag);
  const stations = awsLatest?.stations || [];
  const alertLevels = Array.from(new Set(stations.map((station) => station.alert_level).filter(Boolean))).sort();
  const filteredStations = stations.filter((station) => {
    const query = stationQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      station.name.toLowerCase().includes(query) ||
      station.station_id.toLowerCase().includes(query) ||
      station.ward.toLowerCase().includes(query) ||
      station.connectivity.toLowerCase().includes(query);
    const matchesAlert = stationAlertFilter === "all" || station.alert_level === stationAlertFilter;
    return matchesQuery && matchesAlert;
  });
  const forecastSteps = aware?.forecast_6h || [];
  const forecastHours = aware?.requested_forecast_hours || aware?.forecast_hours || 12;
  const forecastMax = aware?.max_forecast_rainfall_mm_h ?? aware?.max_6h_rainfall_mm_h;

  return (
    <PageScaffold
      eyebrow="Rainfall Intelligence"
      title="AWS and AWARE Rainfall"
      description="Observed station rainfall and AWARE forecasts with quality flags before official alert use."
      statusItems={[
        {
          label: "AWS Max",
          value: awsLatest && !awsUnavailable && typeof awsLatest.city_max_hourly_rate_mm_h === "number"
            ? `${awsLatest.city_max_hourly_rate_mm_h.toFixed(1)} mm/hr`
            : "--"
        },
        {
          label: "AWARE 12h Max",
          value: aware && !awareUnavailable && typeof forecastMax === "number"
            ? `${forecastMax.toFixed(1)} mm/hr`
            : "--"
        },
        { label: "Station Alerts", value: String(alerts.length) },
        { label: "Snapshots", value: String(snapshotArchive?.total || 0) },
        { label: "Quality", value: awsLatest?.quality_flag || "loading" }
      ]}
    >
      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>AWS Stations</h2>
              <span>{filteredStations.length} of {stations.length} stations · {awsLatest?.generated_utc || message}</span>
            </div>
            <button className={styles.toggleButton} type="button" onClick={() => setShowStations((value) => !value)}>
              {showStations ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              {showStations ? "Close" : "Open"}
            </button>
          </div>
          {showStations ? (
            <>
              <div className={styles.stationControls}>
                <label>
                  <Search aria-hidden="true" />
                  <input
                    value={stationQuery}
                    placeholder="Search station, ward, status..."
                    onChange={(event) => setStationQuery(event.currentTarget.value)}
                  />
                </label>
                <label>
                  <SlidersHorizontal aria-hidden="true" />
                  <select value={stationAlertFilter} onChange={(event) => setStationAlertFilter(event.currentTarget.value)}>
                    <option value="all">All alert levels</option>
                    {alertLevels.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.stationTable}>
                <div className={styles.tableHeader}>
                  <span>Station</span>
                  <span>1h</span>
                  <span>3h</span>
                  <span>24h</span>
                  <span>Trend</span>
                </div>
                {filteredStations.map((station) => (
                  <div className={styles.tableRow} key={station.station_id}>
                    <span>
                      <strong>{station.name}</strong>
                      <small>{station.station_id} · ward {station.ward} · {station.connectivity}</small>
                      <small>{station.latest_observation?.quality_flag || station.quality_flag}</small>
                    </span>
                    <span>{station.rainfall_1h_mm.toFixed(1)}</span>
                    <span>{station.rainfall_3h_mm.toFixed(1)}</span>
                    <span>{station.rainfall_24h_mm.toFixed(1)}</span>
                    <span className={styles[station.alert_level]}>{station.trend_6h}</span>
                  </div>
                ))}
                {awsLatest && stations.length > 0 && !filteredStations.length ? (
                  <p className={styles.muted}>No station matches the current search and filter.</p>
                ) : null}
                {awsLatest && !stations.length ? (
                  <p className={styles.muted}>No live AWS station registry is connected.</p>
                ) : null}
              </div>
            </>
          ) : (
            <div className={styles.collapsedStations}>
              <strong>{stations.length}</strong>
              <span>stations hidden. Open this panel to search by station, ward, connectivity, and alert level.</span>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>AWARE Forecast</h2>
              <span>{aware?.quality_flag || "loading"}</span>
            </div>
            <a className={styles.downloadButton} href={awareForecastCsvUrl(12)} download>
              <Download aria-hidden="true" />
              12h CSV
            </a>
          </div>
          <div className={styles.forecastList}>
            {forecastSteps.map((step) => (
              <div className={styles.forecastRow} key={step.lead_hour}>
                <span>+{step.lead_hour}h</span>
                <div>
                  <i style={{ width: `${Math.min(step.rainfall_mm_h * 2, 100)}%` }} />
                </div>
                <strong>{step.rainfall_mm_h.toFixed(1)} mm/hr</strong>
              </div>
            ))}
            {aware && !forecastSteps.length ? (
              <p className={styles.muted}>No live AWARE forecast is connected.</p>
            ) : null}
          </div>
          <p className={styles.muted}>
            {forecastHours}h forecast · Recommended forcing: <strong>{aware?.recommended_model_forcing || "--"}</strong>
          </p>
        </article>
      </section>

      <section className={styles.sourcePanel}>
        <div className={styles.panelHeader}>
          <h2>Official AWARE Sources</h2>
          <button className={styles.syncButton} type="button" onClick={syncOfficialSources} disabled={isSyncing}>
            <RefreshCw aria-hidden="true" />
            {isSyncing ? "Syncing" : "Sync"}
          </button>
        </div>
        <div className={styles.sourceGrid}>
          {(official?.sources || []).map((source) => (
            <article className={styles.sourceCard} key={source.source_id}>
              <strong>{source.label}</strong>
              <span>{source.method} · {source.status}</span>
              <small>{source.record_count} records · {source.quality_flag}</small>
            </article>
          ))}
          {official && !official.sources.length ? (
            <p className={styles.muted}>Official AWARE API contract is not initialized.</p>
          ) : null}
        </div>
      </section>

      <section className={styles.sourcePanel}>
        <div className={styles.panelHeader}>
          <h2>AWARE Snapshot Archive</h2>
          <span>{snapshotArchive?.status || "loading"}</span>
        </div>
        <div className={styles.snapshotGrid}>
          {(snapshotArchive?.snapshots || []).map((snapshot) => (
            <article key={snapshot.snapshot_id}>
              <strong>{snapshot.snapshot_id}</strong>
              <span>{snapshot.target_date || snapshot.modified_utc}</span>
              <small>
                {snapshot.status || "stored"} · {snapshot.confidence || "confidence pending"} · rainfall scale{" "}
                {snapshot.rainfall_scale_suggested ?? "--"}
              </small>
            </article>
          ))}
          {snapshotArchive && !snapshotArchive.snapshots.length ? (
            <p className={styles.muted}>No archived AWARE snapshots are available.</p>
          ) : null}
        </div>
      </section>

      <section className={styles.alertPanel}>
        <div className={styles.panelHeader}>
          <h2>Rainfall Alerts</h2>
          <span>threshold 30 mm/hr</span>
        </div>
        {alerts.length ? (
          <ul className={styles.alertList}>
            {alerts.map((alert) => (
              <li key={alert.station_id}>
                <strong>{alert.station_name}</strong>
                <span>{alert.hourly_rate_mm_h.toFixed(1)} mm/hr · {alert.alert_level} · {alert.quality_flag}</span>
                <small>{alert.affected_wards_within_2km.join(", ")}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>
            {awsLatest?.stations.length ? "No station is above the 30 mm/hr ward-impact threshold." : "No live station alerts are available."}
          </p>
        )}
      </section>
    </PageScaffold>
  );
}

function isUnavailable(value?: string | null) {
  return String(value || "").toLowerCase().includes("unavailable");
}
