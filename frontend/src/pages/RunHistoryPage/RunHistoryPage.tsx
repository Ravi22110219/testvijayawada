import React from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { PageScaffold } from "../../components/PageScaffold/PageScaffold";
import { fetchNowcastJobs, terminalStatuses } from "../../services/api";
import type { NowcastJob } from "../../types/api";
import styles from "./RunHistoryPage.module.css";

export function RunHistoryPage() {
  const [jobs, setJobs] = React.useState<NowcastJob[]>([]);
  const [message, setMessage] = React.useState("Loading model run history...");

  const load = React.useCallback(() => {
    setMessage("Loading model run history...");
    fetchNowcastJobs()
      .then((payload) => {
        setJobs(payload.jobs || []);
        setMessage(`${payload.jobs?.length || 0} model jobs loaded.`);
      })
      .catch((error: Error) => setMessage(error.message || "Unable to load run history."));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const completedJobs = jobs.filter((job) => terminalStatuses.has(job.status));
  const visualJobs = jobs.filter((job) => canVisualize(job));

  return (
    <PageScaffold
      eyebrow="Model Archive"
      title="Run History"
      description="Open previous model runs and visualize their flood-map layers on the live map."
      statusItems={[
        { label: "Jobs", value: String(jobs.length) },
        { label: "Completed", value: String(completedJobs.length) },
        { label: "Visualizations", value: String(visualJobs.length) },
        { label: "Latest", value: jobs[0]?.status || "--" }
      ]}
    >
      <section className={styles.toolbar}>
        <div>
          <strong>{message}</strong>
          <span>Completed runs with a run id can be opened as map visualizations.</span>
        </div>
        <button type="button" onClick={load}>
          <RefreshCw aria-hidden="true" />
          Refresh
        </button>
      </section>

      <section className={styles.historyPanel}>
        <div className={styles.tableHeader}>
          <span>Created</span>
          <span>Status</span>
          <span>Run Type</span>
          <span>Runtime</span>
          <span>Max Depth</span>
          <span>Flood Map</span>
        </div>
        {jobs.map((job) => (
          <article className={styles.historyRow} key={job.job_id}>
            <div>
              <strong>{formatTime(job.created_utc)}</strong>
              <small>{job.job_id}</small>
            </div>
            <span className={styles[statusClass(job.status)]}>{job.status.replace(/_/g, " ")}</span>
            <span>{formatRunType(job)}</span>
            <span>{formatDuration(job.started_utc, job.completed_utc)}</span>
            <span>{formatMetric(job.result?.max_depth_m, "m")}</span>
            <div>
              {canVisualize(job) ? (
                <a href={`/map?run=${encodeURIComponent(job.run_scenario_id || "")}`}>
                  <ExternalLink aria-hidden="true" />
                  View Map
                </a>
              ) : (
                <small>{visualReason(job)}</small>
              )}
            </div>
          </article>
        ))}
        {!jobs.length ? <p className={styles.emptyState}>No model jobs are stored yet.</p> : null}
      </section>
    </PageScaffold>
  );
}

function canVisualize(job: NowcastJob) {
  if (!job.run_scenario_id || !terminalStatuses.has(job.status)) {
    return false;
  }
  if (job.status === "failed" || job.status === "cancelled") {
    return false;
  }
  const maxDepth = job.result?.max_depth_m;
  if (maxDepth !== undefined && maxDepth !== null && maxDepth > 20) {
    return false;
  }
  return true;
}

function visualReason(job: NowcastJob) {
  if (!terminalStatuses.has(job.status)) return "Run not complete";
  if (!job.run_scenario_id) return "No run id";
  if (job.status === "failed" || job.status === "cancelled") return "No visualization";
  if ((job.result?.max_depth_m || 0) > 20) return "Depth safety limit";
  return "No flood layer";
}

function statusClass(status: string) {
  if (status === "completed_with_warnings") return "warning";
  if (status === "completed") return "success";
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "running") return "running";
  return "pending";
}

function formatRunType(job: NowcastJob) {
  const runLength = String(job.request?.run_length || "").replace(/_/g, " ");
  const rainfall = String(job.request?.rainfall || "").replace(/_/g, " ");
  return [runLength, rainfall].filter(Boolean).join(" / ") || "--";
}

function formatTime(value?: string | null) {
  if (!value) return "--";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return "--";
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return "--";
  const totalSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatMetric(value?: number | null, unit = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(2)} ${unit}`.trim();
}
