import { LoaderCircle, PauseCircle, PlayCircle, RefreshCw, RotateCcw, Square } from "lucide-react";
import { terminalStatuses } from "../../services/api";
import type { HealthState, NowcastJob, NowcastOptions, NowcastSelection } from "../../types/api";
import { SelectField } from "../SelectField/SelectField";
import styles from "./NowcastQueue.module.css";

export function NowcastQueue(props: {
  activeJob: NowcastJob | null;
  healthStatus: HealthState["status"];
  message: string;
  options: NowcastOptions | null;
  selection: NowcastSelection;
  onRefreshOptions: () => void;
  onSelectionChange: (selection: NowcastSelection) => void;
  onSubmit: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  progressMode?: "bar" | "percent";
}) {
  const isRunning = Boolean(props.activeJob && !terminalStatuses.has(props.activeJob.status));
  const isPaused = props.activeJob?.status === "paused";
  const elapsedLabel = formatElapsed(props.activeJob?.started_utc || props.activeJob?.created_utc, props.activeJob?.completed_utc);
  const progressLabel = props.activeJob
    ? isRunning
      ? `In progress · ${props.activeJob.phase.replace(/_/g, " ")}`
      : `${props.activeJob.status.replace(/_/g, " ")} · ${props.activeJob.phase.replace(/_/g, " ")}`
    : "Ready for next nowcast run";
  const progressPercent = props.activeJob ? progressForPhase(props.activeJob.status, props.activeJob.phase) : 8;

  return (
    <article className={styles.panel} id="model">
      <div className={styles.panelHeading}>
        <h2>Nowcast Queue</h2>
        <button className={styles.iconButton} type="button" onClick={props.onRefreshOptions} aria-label="Refresh nowcast options">
          <RefreshCw aria-hidden="true" />
        </button>
      </div>
      <div className={styles.form}>
        <SelectField
          label="Rainfall"
          value={props.selection.rainfall}
          options={props.options?.rainfall_scenarios}
          onChange={(rainfall) => props.onSelectionChange({ ...props.selection, rainfall })}
        />
        <SelectField
          label="Budameru"
          value={props.selection.hydrograph}
          options={props.options?.hydrograph_scenarios}
          onChange={(hydrograph) => props.onSelectionChange({ ...props.selection, hydrograph })}
        />
        <SelectField
          label="Backwater"
          value={props.selection.stage}
          options={props.options?.stage_scenarios}
          onChange={(stage) => props.onSelectionChange({ ...props.selection, stage })}
        />
        <SelectField
          label="Duration"
          value={props.selection.run_length}
          options={props.options?.run_lengths}
          onChange={(run_length) => props.onSelectionChange({ ...props.selection, run_length })}
        />
        <label className={styles.checkRow}>
          <input
            checked={props.selection.build_animation}
            type="checkbox"
            onChange={(event) =>
              props.onSelectionChange({ ...props.selection, build_animation: event.currentTarget.checked })
            }
          />
          <span>Build animation</span>
        </label>
        <button className={styles.primaryButton} type="button" onClick={props.onSubmit} disabled={!props.options || isRunning}>
          {isRunning ? (
            <LoaderCircle aria-hidden="true" className={styles.spin} />
          ) : (
            <PlayCircle aria-hidden="true" />
          )}
          <span>Run Nowcast</span>
        </button>
        <div className={styles.controlRow} aria-label="Model run controls">
          <button
            className={styles.controlButton}
            type="button"
            onClick={isPaused ? props.onResume : props.onPause}
            disabled={!props.activeJob || terminalStatuses.has(props.activeJob.status) || props.activeJob.status === "cancel_requested"}
          >
            {isPaused ? <RotateCcw aria-hidden="true" /> : <PauseCircle aria-hidden="true" />}
            <span>{isPaused ? "Resume" : "Pause"}</span>
          </button>
          <button
            className={styles.stopButton}
            type="button"
            onClick={props.onStop}
            disabled={!props.activeJob || terminalStatuses.has(props.activeJob.status) || props.activeJob.status === "cancel_requested"}
          >
            <Square aria-hidden="true" />
            <span>Stop</span>
          </button>
        </div>
      </div>
      <div className={styles.progressPanel} data-state={props.activeJob?.status || "idle"}>
        <div className={styles.progressHeader}>
          <span>{isRunning ? "Run progress" : "Queue status"}</span>
          <strong>{props.progressMode === "percent" ? `${progressPercent}%` : elapsedLabel}</strong>
        </div>
        {props.progressMode === "percent" ? (
          <div className={styles.progressPercent} aria-label={progressLabel}>
            <strong>{progressLabel}</strong>
            <span>{elapsedLabel}</span>
          </div>
        ) : (
          <div className={styles.progressTrack} aria-label={progressLabel}>
            <i style={{ width: `${progressPercent}%` }} />
          </div>
        )}
        <div className={styles.progressFeed}>
          {buildFeed(props.activeJob, props.healthStatus, props.message).map((item) => (
            <span className={item.active ? styles.feedActive : undefined} key={item.label}>
              {item.label}
            </span>
          ))}
        </div>
      </div>
      {props.activeJob ? (
        <div className={styles.runSummary}>
          <span>{props.activeJob.job_id}</span>
          <strong>{props.activeJob.run_scenario_id || props.activeJob.phase}</strong>
          {props.activeJob.process_id ? <small>Process {props.activeJob.process_id}</small> : null}
          {props.activeJob.result?.max_depth_m !== undefined ? (
            <small>
              Max depth {props.activeJob.result.max_depth_m.toFixed(2)} m · Wet area{" "}
              {(props.activeJob.result.wet_area_km2 || 0).toFixed(2)} km2
            </small>
          ) : null}
          {props.activeJob.error ? <small className={styles.errorText}>{props.activeJob.error}</small> : null}
        </div>
      ) : null}
      <p className={styles.muted}>{props.message}</p>
    </article>
  );
}

function buildFeed(job: NowcastJob | null, healthStatus: HealthState["status"], message: string) {
  if (!job) {
    return [
      { label: healthStatus === "online" ? "Backend online" : "Checking backend", active: healthStatus !== "online" },
      { label: "Queue waiting", active: true },
      { label: message || "Select options and run nowcast", active: false }
    ];
  }
  const phase = job.phase.replace(/_/g, " ");
  if (job.status === "failed") {
    return [
      { label: "Job submitted", active: false },
      { label: phase || "worker failed", active: true },
      { label: job.error || "Worker stopped before output logs were written", active: true }
    ];
  }
  if (job.status === "paused") {
    return [
      { label: "Job paused", active: true },
      { label: job.phase.replace(/_/g, " ") || "operator pause", active: true },
      { label: "Use Resume to continue or Stop to cancel", active: false }
    ];
  }
  if (terminalStatuses.has(job.status)) {
    return [
      { label: "Model complete", active: false },
      { label: "Artifacts registered", active: false },
      { label: job.run_scenario_id || "Outputs ready", active: true }
    ];
  }
  return [
    { label: "Job submitted", active: false },
    { label: phase || "worker running", active: true },
    { label: "Live status refresh every 3 seconds", active: true }
  ];
}

function progressForPhase(status: string, phase: string) {
  if (status === "failed" || status === "cancelled") return 100;
  if (terminalStatuses.has(status)) return 100;
  if (phase.includes("queued")) return 14;
  if (status === "paused" || phase.includes("paused")) return 44;
  if (phase.includes("started")) return 32;
  if (phase.includes("subprocess")) return 64;
  if (phase.includes("artifact")) return 88;
  return 46;
}

function formatElapsed(start?: string | null, end?: string | null) {
  if (!start) {
    return "00:00";
  }
  const startMs = Date.parse(start);
  const endMs = end ? Date.parse(end) : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return "00:00";
  }
  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
