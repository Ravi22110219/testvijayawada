import React from "react";
import { BarChart3, CloudRain, History, LoaderCircle, PlayCircle, RefreshCw } from "lucide-react";
import { LiveMapPanel } from "../../components/LiveMapPanel/LiveMapPanel";
import { PageScaffold } from "../../components/PageScaffold/PageScaffold";
import {
  fetchLatestTomorrowForecast,
  fetchLatestNowcast,
  fetchNowcastJob,
  fetchNowcastJobs,
  fetchOfficialScenarios,
  fetchTomorrow12hForecast,
  googleMapsConfigured,
  previewNarrativeNowcast,
  runNarrativeNowcast,
  submitNowcastRun,
  terminalStatuses,
  toApiUrl
} from "../../services/api";
import type { NarrativeNowcastPreview, NowcastJob, OfficialScenarioGallery, TomorrowForecastResponse } from "../../types/api";
import styles from "./NowcastPage.module.css";

export function NowcastPage() {
  const [gallery, setGallery] = React.useState<OfficialScenarioGallery | null>(null);
  const [latest, setLatest] = React.useState<NowcastJob | null>(null);
  const [jobs, setJobs] = React.useState<NowcastJob[]>([]);
  const [tomorrowForecast, setTomorrowForecast] = React.useState<TomorrowForecastResponse | null>(null);
  const [activeTab, setActiveTab] = React.useState<"run" | "history">("run");
  const [narrative, setNarrative] = React.useState(
    "Run a quick 10 minute check with severe rainfall, elevated stage, and Budameru at 60 percent."
  );
  const [preview, setPreview] = React.useState<NarrativeNowcastPreview | null>(null);
  const [message, setMessage] = React.useState("Loading nowcast parity features...");
  const [isPreviewing, setPreviewing] = React.useState(false);
  const [isLaunching, setLaunching] = React.useState(false);
  const [isFetchingTomorrow, setFetchingTomorrow] = React.useState(false);
  const [isRunningTomorrow, setRunningTomorrow] = React.useState(false);

  const trackJob = React.useCallback((job: NowcastJob) => {
    setLatest(job);
    if (!job.job_id || terminalStatuses.has(job.status)) {
      if (terminalStatuses.has(job.status)) {
        setMessage(`Nowcast ${job.status.replace(/_/g, " ")}. Flood maps refresh from this run when outputs are ready.`);
      }
      return;
    }
    window.setTimeout(() => {
      fetchNowcastJob(job.job_id)
        .then(trackJob)
        .catch((error: Error) => setMessage(error.message || "Unable to refresh nowcast job status."));
    }, 3000);
  }, []);

  const load = React.useCallback(() => {
    setMessage("Loading official scenarios and latest nowcast...");
    Promise.all([
      fetchOfficialScenarios(),
      fetchLatestNowcast(),
      fetchNowcastJobs().catch(() => ({ jobs: [] })),
      fetchLatestTomorrowForecast().catch(() => null)
    ])
      .then(([scenarioPayload, latestPayload, jobsPayload, forecastPayload]) => {
        setGallery(scenarioPayload);
        setLatest(latestPayload.latest || null);
        setJobs(jobsPayload.jobs || []);
        if (forecastPayload) setTomorrowForecast(forecastPayload);
        setMessage(scenarioPayload.message);
      })
      .catch((error: Error) => setMessage(error.message || "Nowcast parity APIs are unavailable."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const previewRun = () => {
    setPreviewing(true);
    setMessage("Parsing nowcast narrative...");
    previewNarrativeNowcast(narrative)
      .then((payload) => {
        setPreview(payload);
        setMessage(payload.summary);
      })
      .catch((error: Error) => setMessage(error.message || "Narrative preview failed."))
      .finally(() => setPreviewing(false));
  };

  const fetchTomorrowForecast = () => {
    setFetchingTomorrow(true);
    setMessage("Fetching Tomorrow.io 12-hour rainfall forecast...");
    fetchTomorrow12hForecast()
      .then((payload) => {
        setTomorrowForecast(payload);
        setMessage(payload.message);
      })
      .catch((error: Error) => setMessage(error.message || "Tomorrow.io forecast fetch failed."))
      .finally(() => setFetchingTomorrow(false));
  };

  const runTomorrowForecast = () => {
    if (!tomorrowForecast || tomorrowForecast.status !== "ready") {
      setMessage("Fetch a ready Tomorrow.io 12-hour rainfall forecast before running.");
      return;
    }
    setRunningTomorrow(true);
    setMessage("Submitting 12-hour nowcast using Tomorrow.io rainfall hyetograph...");
    submitNowcastRun({
      rainfall: "design_peak_6h",
      hydrograph: "budameru_supplied_peak",
      stage: "high_stage",
      run_length: "forecast_12h",
      use_tomorrow_latest: true,
      tomorrow_forecast_id: tomorrowForecast.forecast_id,
      build_animation: false
    })
      .then((job) => {
        setMessage(`Tomorrow.io forecast nowcast submitted: ${job.job_id}`);
        setJobs((current) => [job, ...current.filter((item) => item.job_id !== job.job_id)]);
        trackJob(job);
      })
      .catch((error: Error) => setMessage(error.message || "Tomorrow.io nowcast submit failed."))
      .finally(() => setRunningTomorrow(false));
  };

  const launchRun = () => {
    setLaunching(true);
    setMessage("Submitting narrative nowcast...");
    runNarrativeNowcast(narrative)
      .then((payload) => {
        setPreview(payload.preview);
        trackJob(payload.job);
        setMessage(`Job submitted: ${payload.job.job_id}`);
      })
      .catch((error: Error) => setMessage(error.message || "Narrative nowcast submit failed."))
      .finally(() => setLaunching(false));
  };

  return (
    <PageScaffold
      eyebrow="Model Operations"
      title="Nowcast Run Center"
      description="Scenario animation gallery, narrative nowcast drafting, latest job status, and model acceptance context."
      statusItems={[
        { label: "Latest", value: latest?.status || "--" },
        { label: "Run", value: latest?.run_scenario_id || latest?.phase || "--" },
        { label: "12h Rain", value: formatMetric(tomorrowForecast?.total_rainfall_mm, "mm") },
        { label: "Scenarios", value: String(gallery?.scenario_count || 0) },
        { label: "Agent", value: "global" }
      ]}
    >
      <section className={styles.toolbar}>
        <div>
          <strong>{message}</strong>
          <span>{gallery?.release_label || "waiting for backend"}</span>
        </div>
        <button type="button" onClick={load}>
          <RefreshCw aria-hidden="true" />
          Refresh
        </button>
      </section>

      <section className={styles.tabs} aria-label="Nowcast workspace tabs">
        <button
          type="button"
          className={activeTab === "run" ? styles.activeTab : undefined}
          onClick={() => setActiveTab("run")}
        >
          <PlayCircle aria-hidden="true" />
          Run Center
        </button>
        <button
          type="button"
          className={activeTab === "history" ? styles.activeTab : undefined}
          onClick={() => setActiveTab("history")}
        >
          <History aria-hidden="true" />
          Run History
        </button>
      </section>

      {activeTab === "history" ? (
        <section className={styles.historyPanel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Previous Runs</h2>
              <span>{jobs.length} local job records</span>
            </div>
            <button type="button" onClick={load}>
              <RefreshCw aria-hidden="true" />
              Refresh
            </button>
          </div>
          <div className={styles.historyTable}>
            <div className={styles.historyHeader}>
              <span>Created</span>
              <span>Status</span>
              <span>Run Type</span>
              <span>Duration</span>
              <span>Depth</span>
              <span>Run</span>
            </div>
            {jobs.map((job) => (
              <button
                type="button"
                className={styles.historyRow}
                key={job.job_id}
                onClick={() => {
                  setLatest(job);
                  setActiveTab("run");
                }}
              >
                <span>
                  <strong>{formatTime(job.created_utc)}</strong>
                  <small>{job.job_id}</small>
                </span>
                <span className={styles[job.status] || undefined}>{job.status.replace(/_/g, " ")}</span>
                <span>{String(job.request?.run_length || "--").replace(/_/g, " ")}</span>
                <span>{formatDuration(job.started_utc, job.completed_utc)}</span>
                <span>{formatMetric(job.result?.max_depth_m, "m")}</span>
                <span>{job.run_scenario_id || job.phase || "--"}</span>
              </button>
            ))}
            {!jobs.length ? (
              <p className={styles.emptyHistory}>No nowcast jobs are stored yet.</p>
            ) : null}
          </div>
        </section>
      ) : (
        <>
      <section className={styles.forecastPanel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Tomorrow.io 12h Rainfall</h2>
            <span>{tomorrowForecast?.quality_flag || "fetch forecast first"}</span>
          </div>
          <div className={styles.forecastActions}>
            <button type="button" onClick={fetchTomorrowForecast} disabled={isFetchingTomorrow}>
              {isFetchingTomorrow ? <LoaderCircle aria-hidden="true" className={styles.spin} /> : <CloudRain aria-hidden="true" />}
              Fetch 12h
            </button>
            <button
              type="button"
              onClick={runTomorrowForecast}
              disabled={isRunningTomorrow || tomorrowForecast?.status !== "ready"}
            >
              {isRunningTomorrow ? <LoaderCircle aria-hidden="true" className={styles.spin} /> : <PlayCircle aria-hidden="true" />}
              Run on Rainfall
            </button>
          </div>
        </div>
        {tomorrowForecast?.steps.length ? (
          <>
            <div className={styles.forecastSummary}>
              <div><span>Total</span><strong>{formatMetric(tomorrowForecast.total_rainfall_mm, "mm")}</strong></div>
              <div><span>Peak</span><strong>{formatMetric(tomorrowForecast.max_rainfall_mm_h, "mm/hr")}</strong></div>
              <div><span>Location</span><strong>{tomorrowForecast.location_name}</strong></div>
              <div><span>Updated</span><strong>{formatTime(tomorrowForecast.generated_utc)}</strong></div>
            </div>
            <div className={styles.hyetograph} aria-label="Tomorrow.io 12 hour rainfall hyetograph">
              {tomorrowForecast.steps.map((step) => {
                const maxRate = Math.max(tomorrowForecast.max_rainfall_mm_h || 1, 1);
                const height = Math.max(6, Math.round((step.rainfall_mm_h / maxRate) * 116));
                return (
                  <div className={styles.rainBar} key={`${step.lead_hour}-${step.forecast_time_utc}`}>
                    <span>{step.rainfall_mm_h.toFixed(1)}</span>
                    <i style={{ height: `${height}px` }} />
                    <small>+{step.lead_hour}h</small>
                  </div>
                );
              })}
            </div>
            <p className={styles.muted}>
              <BarChart3 aria-hidden="true" />
              This hyetograph is converted to the model rainfall CSV before the 12-hour nowcast run.
            </p>
          </>
        ) : (
          <p className={styles.muted}>
            Fetch the latest Tomorrow.io forecast to preview the 12-hour rainfall graph before running the model.
          </p>
        )}
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Narrative Nowcast</h2>
            <span>verified parser</span>
          </div>
          <textarea
            value={narrative}
            rows={4}
            onChange={(event) => setNarrative(event.currentTarget.value)}
            aria-label="Narrative nowcast request"
          />
          <div className={styles.actions}>
            <button type="button" onClick={previewRun} disabled={isPreviewing || !narrative.trim()}>
              {isPreviewing ? <LoaderCircle aria-hidden="true" className={styles.spin} /> : <RefreshCw aria-hidden="true" />}
              Preview
            </button>
            <button type="button" onClick={launchRun} disabled={isLaunching || !narrative.trim()}>
              {isLaunching ? <LoaderCircle aria-hidden="true" className={styles.spin} /> : <PlayCircle aria-hidden="true" />}
              Launch
            </button>
          </div>
          {preview ? (
            <div className={styles.previewGrid}>
              <div><span>Rainfall</span><strong>{preview.selection.rainfall}</strong></div>
              <div><span>Budameru</span><strong>{preview.selection.hydrograph}</strong></div>
              <div><span>Stage</span><strong>{preview.selection.stage}</strong></div>
              <div><span>Duration</span><strong>{preview.selection.run_length}</strong></div>
              <div><span>Confidence</span><strong>{preview.confidence}</strong></div>
              <div><span>Parser</span><strong>{preview.parser}</strong></div>
            </div>
          ) : null}
          {preview?.reasons.length ? (
            <ul className={styles.reasonList}>
              {preview.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Latest Job</h2>
            <span>{latest?.created_utc || "no local job"}</span>
          </div>
          <div className={styles.latestJob}>
            <div><span>Status</span><strong>{latest?.status || "--"}</strong></div>
            <div><span>Phase</span><strong>{latest?.phase || "--"}</strong></div>
            <div><span>Max Depth</span><strong>{formatMetric(latest?.result?.max_depth_m, "m")}</strong></div>
            <div><span>Wet Area</span><strong>{formatMetric(latest?.result?.wet_area_km2, "km2")}</strong></div>
          </div>
          <p>{latest?.run_scenario_id || "Submit a nowcast to populate the latest run."}</p>
        </article>
      </section>

      <section className={styles.mapSection}>
        <LiveMapPanel googleMapsConfigured={googleMapsConfigured} refreshKey={latest?.run_scenario_id || latest?.status} />
      </section>

      <section className={styles.scenarioGrid}>
        {(gallery?.scenarios || []).map((scenario) => {
          const mediaArtifact = scenario.gif_artifact || scenario.poster_artifact;
          const mediaLabel = scenario.gif_artifact ? "Animation" : "Poster";
          return (
            <article className={styles.scenarioCard} key={scenario.run_id}>
              {mediaArtifact ? (
                <div className={styles.scenarioMedia}>
                  <img
                    src={toApiUrl(mediaArtifact.artifact_url)}
                    alt={`${scenario.label} ${mediaLabel.toLowerCase()}`}
                  />
                  <span>{mediaLabel}</span>
                </div>
              ) : null}
              <div>
                <span>{scenario.public_role}</span>
                <h2>{scenario.label}</h2>
                <p>{scenario.description}</p>
              </div>
              <div className={styles.metrics}>
                <div><span>Depth</span><strong>{formatMetric(scenario.max_depth_m, "m")}</strong></div>
                <div><span>Wet Area</span><strong>{formatMetric(scenario.wet_area_km2, "km2")}</strong></div>
                <div><span>Rainfall</span><strong>{formatMetric(scenario.rainfall_peak_mm_h, "mm/hr")}</strong></div>
                <div><span>Frames</span><strong>{scenario.frame_count || "--"}</strong></div>
              </div>
              <div className={styles.scenarioActions}>
                {scenario.gif_artifact ? (
                  <a href={toApiUrl(scenario.gif_artifact.artifact_url)} target="_blank" rel="noreferrer">
                    Animation
                  </a>
                ) : null}
                {scenario.poster_artifact ? (
                  <a href={toApiUrl(scenario.poster_artifact.artifact_url)} target="_blank" rel="noreferrer">
                    Poster
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
        </>
      )}
    </PageScaffold>
  );
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

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "--";
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return "--";
  const seconds = Math.round((endMs - startMs) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}
