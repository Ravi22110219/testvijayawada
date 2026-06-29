import React from "react";
import { CloudRain, LoaderCircle, MapPin, PlayCircle, ShieldAlert } from "lucide-react";
import { HealthPill } from "../../components/HealthPill/HealthPill";
import { LiveMapPanel, type LiveMapPanelHandle } from "../../components/LiveMapPanel/LiveMapPanel";
import { NowcastQueue } from "../../components/NowcastQueue/NowcastQueue";
import {
  activeStatuses,
  cancelNowcastJob,
  fetchBackendHealth,
  fetchImpactHotspots,
  fetchImpactSummary,
  fetchLatestTomorrowForecast,
  fetchNowcastJob,
  fetchNowcastJobs,
  fetchNowcastOptions,
  fetchTomorrow12hForecast,
  googleMapsConfigured,
  pauseNowcastJob,
  resumeNowcastJob,
  submitNowcastRun,
  terminalStatuses
} from "../../services/api";
import type {
  HealthState,
  HotspotImpact,
  NowcastJob,
  NowcastOptions,
  NowcastSelection,
  OperationalImpactSummary,
  TomorrowForecastResponse,
  WardImpact
} from "../../types/api";
import styles from "./MapPage.module.css";

const defaultSelection: NowcastSelection = {
  rainfall: "design_peak_6h",
  hydrograph: "budameru_supplied_peak",
  stage: "high_stage",
  run_length: "quick_10min_check",
  build_animation: true
};

export function MapPage() {
  const mapRef = React.useRef<LiveMapPanelHandle | null>(null);
  const selectedRunId = React.useMemo(() => new URLSearchParams(window.location.search).get("run"), []);
  const [health, setHealth] = React.useState<HealthState>({ status: "checking", detail: "Checking backend health..." });
  const [activeTab, setActiveTab] = React.useState<"nowcast" | "hotspot" | "alert">("nowcast");
  const [impactSummary, setImpactSummary] = React.useState<OperationalImpactSummary | null>(null);
  const [hotspots, setHotspots] = React.useState<HotspotImpact[]>([]);
  const [options, setOptions] = React.useState<NowcastOptions | null>(null);
  const [selection, setSelection] = React.useState<NowcastSelection>(defaultSelection);
  const [activeJob, setActiveJob] = React.useState<NowcastJob | null>(null);
  const [nowcastMessage, setNowcastMessage] = React.useState("Loading nowcast options...");
  const [tomorrowForecast, setTomorrowForecast] = React.useState<TomorrowForecastResponse | null>(null);
  const [forecastMessage, setForecastMessage] = React.useState("Loading forecast rainfall...");
  const [isFetchingForecast, setFetchingForecast] = React.useState(false);
  const [isRunningForecast, setRunningForecast] = React.useState(false);

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

  const loadOptions = React.useCallback(() => {
    setNowcastMessage("Loading nowcast options...");
    fetchNowcastOptions()
      .then((payload) => {
        setOptions(payload);
        setSelection((current) => ({
          ...current,
          rainfall: payload.defaults?.rainfall || current.rainfall,
          hydrograph: payload.defaults?.hydrograph || current.hydrograph,
          stage: payload.defaults?.stage || current.stage,
          run_length: payload.run_lengths?.some((item) => item.id === "quick_10min_check")
            ? "quick_10min_check"
            : payload.defaults?.run_length || current.run_length
        }));
        setNowcastMessage("Nowcast queue is ready.");
      })
      .catch((error: Error) => setNowcastMessage(error.message || "Nowcast options are unavailable."));
  }, []);

  const loadImpact = React.useCallback(() => {
    Promise.all([fetchImpactHotspots(12), fetchImpactSummary()])
      .then(([hotspotPayload, impactPayload]) => {
        setHotspots((hotspotPayload.hotspots || []).filter((hotspot) => hotspot.incident_candidate).slice(0, 8));
        setImpactSummary(impactPayload);
      })
      .catch(() => {
        setHotspots([]);
        setImpactSummary(null);
      });
  }, []);

  React.useEffect(() => {
    loadOptions();
    loadImpact();
  }, [loadImpact, loadOptions]);

  React.useEffect(() => {
    fetchLatestTomorrowForecast()
      .then((payload) => {
        setTomorrowForecast(payload);
        setForecastMessage(payload.message);
      })
      .catch(() => setForecastMessage("Fetch a fresh 12-hour forecast before forecast run."));
  }, []);

  React.useEffect(() => {
    fetchNowcastJobs()
      .then((payload) => {
        const active = (payload.jobs || []).find((job) => activeStatuses.has(job.status));
        if (active) {
          setActiveJob(active);
          setNowcastMessage(`Restored ${active.status}: ${active.phase}`);
        }
      })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (!activeJob || terminalStatuses.has(activeJob.status)) {
      return;
    }
    const interval = window.setInterval(() => {
      fetchNowcastJob(activeJob.job_id)
        .then((payload) => {
          setActiveJob(payload);
          setNowcastMessage(`Job ${payload.status}: ${payload.phase}`);
          if (terminalStatuses.has(payload.status)) {
            loadImpact();
          }
        })
        .catch((error: Error) => setNowcastMessage(error.message || "Job status unavailable."));
    }, 3000);
    return () => window.clearInterval(interval);
  }, [activeJob, loadImpact]);

  const submitNowcast = () => {
    if (activeJob && !terminalStatuses.has(activeJob.status)) {
      setNowcastMessage("A model job is already active. Pause, resume, or stop it before starting another run.");
      return;
    }
    setNowcastMessage("Submitting nowcast job...");
    submitNowcastRun(selection)
      .then((payload) => {
        setActiveJob(payload);
        setNowcastMessage(`Job ${payload.status}: ${payload.phase}`);
        if (terminalStatuses.has(payload.status)) {
          loadImpact();
        }
      })
      .catch((error: Error) => setNowcastMessage(error.message || "Nowcast submit failed."));
  };

  const fetchForecast = () => {
    setFetchingForecast(true);
    setForecastMessage("Fetching Tomorrow.io rainfall forecast...");
    fetchTomorrow12hForecast()
      .then((payload) => {
        setTomorrowForecast(payload);
        setForecastMessage(payload.message);
      })
      .catch((error: Error) => setForecastMessage(error.message || "Forecast fetch failed."))
      .finally(() => setFetchingForecast(false));
  };

  const runForecastNowcast = () => {
    if (activeJob && !terminalStatuses.has(activeJob.status)) {
      setForecastMessage("A model job is already active. Pause, resume, or stop it before starting another run.");
      return;
    }
    if (!tomorrowForecast || tomorrowForecast.status !== "ready") {
      setForecastMessage("Fetch a ready forecast before running on forecast data.");
      return;
    }
    setRunningForecast(true);
    setForecastMessage("Submitting model run on forecast rainfall...");
    setNowcastMessage("Submitting 12-hour forecast nowcast...");
    submitNowcastRun({
      rainfall: "design_peak_6h",
      hydrograph: selection.hydrograph || defaultSelection.hydrograph,
      stage: selection.stage || defaultSelection.stage,
      run_length: "forecast_12h",
      use_tomorrow_latest: true,
      tomorrow_forecast_id: tomorrowForecast.forecast_id,
      build_animation: true
    })
      .then((payload) => {
        setActiveJob(payload);
        setNowcastMessage(`Job ${payload.status}: ${payload.phase}`);
        setForecastMessage("Forecast nowcast submitted. Open Command after completion to review flood preview, hotspots, and alerts.");
        if (terminalStatuses.has(payload.status)) {
          loadImpact();
        }
      })
      .catch((error: Error) => {
        const message = error.message || "Forecast nowcast submit failed.";
        setNowcastMessage(message);
        setForecastMessage(message);
      })
      .finally(() => setRunningForecast(false));
  };

  const pauseActiveJob = () => {
    if (!activeJob) return;
    setNowcastMessage("Pausing model run...");
    pauseNowcastJob(activeJob.job_id)
      .then((payload) => {
        setActiveJob(payload);
        setNowcastMessage(`Job ${payload.status}: ${payload.phase}`);
      })
      .catch((error: Error) => setNowcastMessage(error.message || "Unable to pause model run."));
  };

  const resumeActiveJob = () => {
    if (!activeJob) return;
    setNowcastMessage("Resuming model run...");
    resumeNowcastJob(activeJob.job_id)
      .then((payload) => {
        setActiveJob(payload);
        setNowcastMessage(`Job ${payload.status}: ${payload.phase}`);
      })
      .catch((error: Error) => setNowcastMessage(error.message || "Unable to resume model run."));
  };

  const stopActiveJob = () => {
    if (!activeJob) return;
    setNowcastMessage("Stopping model run...");
    cancelNowcastJob(activeJob.job_id)
      .then((payload) => {
        setActiveJob(payload);
        setNowcastMessage(`Job ${payload.status}: ${payload.phase}`);
        if (terminalStatuses.has(payload.status)) {
          loadImpact();
        }
      })
      .catch((error: Error) => setNowcastMessage(error.message || "Unable to stop model run."));
  };

  const alertMarkers = (impactSummary?.top_wards || []).slice(0, 10);

  return (
    <main className={styles.livePage}>
      <section className={styles.mapPane} aria-label="Live flood map">
        <LiveMapPanel
          ref={mapRef}
          googleMapsConfigured={googleMapsConfigured}
          refreshKey={activeJob?.run_scenario_id || activeJob?.status || impactSummary?.generated_utc}
          runId={selectedRunId}
          variant="landing"
          showAws={true}
          showHotspots={true}
          initialOptionalLayers={{ wards: true, hotspots: false, aws: false }}
          hotspotMarkers={activeTab === "hotspot" ? hotspots : []}
          alertMarkers={activeTab === "alert" ? alertMarkers : []}
        />
      </section>

      <aside className={styles.sidePane} aria-label="Live map tools">
        <header className={styles.sideHeader}>
          <div>
            <p>Live GIS</p>
            <h1>{selectedRunId ? "Run Visualization" : "Flood Map Workspace"}</h1>
            {selectedRunId ? <span>Showing {selectedRunId}</span> : null}
          </div>
          <HealthPill status={health.status} />
        </header>

        {activeTab === "hotspot" ? (
          <section className={styles.toolPanel}>
            <button type="button" className={styles.backButton} onClick={() => setActiveTab("nowcast")}>Back to Nowcast</button>
            <div className={styles.summaryGrid}>
              <StatusBlock icon={<MapPin aria-hidden="true" />} label="Active Hotspots" value={String(impactSummary?.counts.hotspots_under_alert ?? hotspots.length)} />
              <StatusBlock icon={<ShieldAlert aria-hidden="true" />} label="Incident Candidates" value={String(impactSummary?.counts.incident_candidates ?? "--")} />
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
          </section>
        ) : null}

        {activeTab === "alert" ? (
          <section className={styles.toolPanel}>
            <button type="button" className={styles.backButton} onClick={() => setActiveTab("nowcast")}>Back to Nowcast</button>
            <div className={styles.summaryGrid}>
              <StatusBlock icon={<ShieldAlert aria-hidden="true" />} label="Wards Under Alert" value={String(impactSummary?.counts.wards_under_alert ?? "--")} />
              <StatusBlock icon={<MapPin aria-hidden="true" />} label="Flooded Area" value={formatMetric(impactSummary?.ulb_summary.wet_area_km2, "km2")} />
            </div>
            <AlertTable
              wards={alertMarkers}
              onSelect={(ward) =>
                mapRef.current?.zoomToWard({
                  wardId: ward.ward_id,
                  label: `Ward ${ward.ward_id} · ${formatMetric(ward.max_depth_m, "m")} · ${formatMetric(ward.wet_area_km2, "km2")} flooded`
                })
              }
            />
          </section>
        ) : null}

        {activeTab === "nowcast" ? (
          <>
            <ForecastPanel
              forecast={tomorrowForecast}
              message={forecastMessage}
              isFetching={isFetchingForecast}
              isRunning={isRunningForecast}
              onFetch={fetchForecast}
              onRun={runForecastNowcast}
            />
            <NowcastQueue
              activeJob={activeJob}
              healthStatus={health.status}
              message={nowcastMessage || health.detail}
              options={options}
              selection={selection}
              onRefreshOptions={loadOptions}
              onSelectionChange={setSelection}
              onPause={pauseActiveJob}
              onResume={resumeActiveJob}
              onSubmit={submitNowcast}
              onStop={stopActiveJob}
              progressMode="percent"
            />
            <div className={styles.navActions}>
              <a href="/dashboard">Open Command</a>
              <button type="button" onClick={() => setActiveTab("hotspot")}>View Hotspots</button>
              <button type="button" onClick={() => setActiveTab("alert")}>View Alerts</button>
            </div>
          </>
        ) : null}
      </aside>
    </main>
  );
}

function ForecastPanel(props: {
  forecast: TomorrowForecastResponse | null;
  message: string;
  isFetching: boolean;
  isRunning: boolean;
  onFetch: () => void;
  onRun: () => void;
}) {
  const steps = props.forecast?.steps || [];
  return (
    <section className={styles.forecastPanel} aria-label="Forecast rainfall nowcast">
      <div className={styles.forecastHeader}>
        <div>
          <h2>Forecast Rainfall</h2>
          <p>{props.message}</p>
        </div>
        <div className={styles.forecastActions}>
          <button type="button" onClick={props.onFetch} disabled={props.isFetching}>
            {props.isFetching ? <LoaderCircle aria-hidden="true" className={styles.spin} /> : <CloudRain aria-hidden="true" />}
            Fetch
          </button>
          <button type="button" onClick={props.onRun} disabled={props.isRunning || props.forecast?.status !== "ready"}>
            {props.isRunning ? <LoaderCircle aria-hidden="true" className={styles.spin} /> : <PlayCircle aria-hidden="true" />}
            Run on Forecast
          </button>
        </div>
      </div>
      <div className={styles.forecastMetrics}>
        <div><span>Total</span><strong>{formatMetric(props.forecast?.total_rainfall_mm, "mm")}</strong></div>
        <div><span>Peak</span><strong>{formatMetric(props.forecast?.max_rainfall_mm_h, "mm/hr")}</strong></div>
      </div>
      <ForecastRainChart steps={steps} />
    </section>
  );
}

function ForecastRainChart(props: { steps: TomorrowForecastResponse["steps"] }) {
  const steps = props.steps.slice(0, 12);
  if (!steps.length) {
    return (
      <div className={styles.hyetograph} aria-label="12 hour forecast rainfall chart">
        <span className={styles.emptyChart}>No forecast bars loaded.</span>
      </div>
    );
  }
  const chart = {
    width: 360,
    height: 168,
    left: 36,
    right: 14,
    top: 18,
    bottom: 42
  };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const maxRate = Math.max(...steps.map((step) => step.rainfall_mm_h || 0), 1);
  const xStep = plotWidth / steps.length;
  const barWidth = Math.min(18, Math.max(8, xStep * 0.48));
  const peakIndex = steps.reduce((bestIndex, step, index) => (
    (step.rainfall_mm_h || 0) > (steps[bestIndex]?.rainfall_mm_h || 0) ? index : bestIndex
  ), 0);

  return (
    <div className={styles.hyetograph} aria-label="12 hour forecast rainfall chart">
      <svg className={styles.rainChart} role="img" viewBox={`0 0 ${chart.width} ${chart.height}`}>
        <defs>
          <linearGradient id="rainForecastGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((tick) => {
          const y = chart.top + plotHeight - tick * plotHeight;
          return (
            <g key={tick}>
              <line className={styles.chartGrid} x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} />
              <text className={styles.chartYLabel} x={chart.left - 8} y={y + 4} textAnchor="end">
                {tick === 1 ? maxRate.toFixed(1) : tick === 0 ? "0" : ""}
              </text>
            </g>
          );
        })}
        {steps.map((step, index) => {
          const rate = Math.max(0, step.rainfall_mm_h || 0);
          const height = Math.max(rate > 0 ? 4 : 0, (rate / maxRate) * plotHeight);
          const x = chart.left + index * xStep + (xStep - barWidth) / 2;
          const y = chart.top + plotHeight - height;
          const showLabel = index === 0 || index === steps.length - 1 || index % 3 === 0;
          return (
            <g key={`${step.lead_hour}-${step.forecast_time_utc}`}>
              <rect className={styles.chartBar} x={x} y={y} width={barWidth} height={height} rx={5} />
              <line className={styles.chartTick} x1={x + barWidth / 2} x2={x + barWidth / 2} y1={chart.top + plotHeight + 5} y2={chart.top + plotHeight + 9} />
              {showLabel ? (
                <text className={styles.chartXLabel} x={x + barWidth / 2} y={chart.height - 12} textAnchor="middle">
                  {formatForecastTime(step.forecast_time_utc)}
                </text>
              ) : null}
              {index === peakIndex && rate > 0 ? (
                <text className={styles.chartPeakLabel} x={x + barWidth / 2} y={Math.max(12, y - 7)} textAnchor="middle">
                  {rate.toFixed(1)}
                </text>
              ) : null}
            </g>
          );
        })}
        <text className={styles.chartUnitLabel} x={chart.left} y={12}>mm/hr</text>
      </svg>
    </div>
  );
}

function HotspotTable(props: { hotspots: HotspotImpact[]; onSelect: (hotspot: HotspotImpact) => void }) {
  if (!props.hotspots.length) {
    return <p className={styles.emptyState}>No active hotspot rows are available.</p>;
  }
  return (
    <div className={styles.dataTable} aria-label="Hotspot table">
      <div className={styles.hotspotHeader}>
        <strong>Hotspot</strong>
        <strong>Ward</strong>
        <strong>Depth</strong>
      </div>
      {props.hotspots.map((hotspot) => (
        <button type="button" className={styles.hotspotRow} key={hotspot.hotspot_id} onClick={() => props.onSelect(hotspot)}>
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
    return <p className={styles.emptyState}>No ward alert rows are available.</p>;
  }
  return (
    <div className={styles.dataTable} aria-label="Alert table">
      <div className={styles.alertHeader}>
        <strong>Ward</strong>
        <strong>Depth</strong>
        <strong>Area</strong>
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

function StatusBlock(props: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className={styles.statusBlock}>
      <div>{props.icon}</div>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

function estimatedAffectedPopulation(ward: WardImpact) {
  const urbanDensityPerKm2 = 12000;
  return Math.round(Math.max(0, ward.wet_area_km2 || 0) * urbanDensityPerKm2);
}

function formatMetric(value?: number | null, unit = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(2)} ${unit}`.trim();
}

function formatForecastTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "--";
  }
  const options: Intl.DateTimeFormatOptions = date.getMinutes()
    ? { hour: "numeric", minute: "2-digit", hour12: true }
    : { hour: "numeric", hour12: true };
  return date.toLocaleTimeString([], options).replace(/\s/g, "").toLowerCase();
}
