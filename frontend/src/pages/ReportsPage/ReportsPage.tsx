import React from "react";
import { Download, FileText, RefreshCw } from "lucide-react";
import { PageScaffold } from "../../components/PageScaffold/PageScaffold";
import { fetchDownloadCenter, fetchImpactSummary, fetchReportSummary, generateReport, toApiUrl } from "../../services/api";
import type {
  ArtifactRecord,
  OperationalImpactSummary,
  ParityDownloadCenter,
  ReportSummary,
  ReportTypeDescriptor,
  ReportTypeId
} from "../../types/api";
import styles from "./ReportsPage.module.css";

export function ReportsPage() {
  const [summary, setSummary] = React.useState<ReportSummary | null>(null);
  const [impact, setImpact] = React.useState<OperationalImpactSummary | null>(null);
  const [downloadCenter, setDownloadCenter] = React.useState<ParityDownloadCenter | null>(null);
  const [message, setMessage] = React.useState("Loading Phase 14 report catalog...");
  const [generating, setGenerating] = React.useState<ReportTypeId | null>(null);

  const loadSummary = React.useCallback(() => {
    setMessage("Loading Phase 14 report catalog...");
    fetchReportSummary()
      .then((payload) => {
        setSummary(payload);
        setMessage(payload.message);
      })
      .catch((error: Error) => setMessage(error.message || "Report APIs are unavailable."));
    fetchImpactSummary()
      .then(setImpact)
      .catch(() => setImpact(null));
    fetchDownloadCenter()
      .then(setDownloadCenter)
      .catch(() => setDownloadCenter(null));
  }, []);

  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const runReport = (reportType: ReportTypeId) => {
    setGenerating(reportType);
    setMessage(`Generating ${reportType.replace(/_/g, " ")} report...`);
    generateReport({
      report_type: reportType,
      actor: "operator",
      note: "Generated from Phase 14 reports workspace."
    })
      .then((payload) => {
        setSummary((current) => mergeGeneratedArtifact(current, payload.report_type, payload.artifact));
        setMessage(payload.message);
      })
      .catch((error: Error) => setMessage(error.message || "Report generation failed."))
      .finally(() => setGenerating(null));
  };

  return (
    <PageScaffold
      eyebrow="Official Reports"
      title="Reports and PDFs"
      description="Phase 14 official PDF generation for ward alerts, ULB summary, daily executive review, model runs, and incident actions."
      statusItems={[
        { label: "Run", value: summary?.run_scenario_id || "--" },
        { label: "Reports", value: String(summary?.report_types.length || 0) },
        { label: "Latest PDFs", value: String(summary?.latest_artifacts.length || 0) },
        { label: "Downloads", value: String(downloadCenter?.total || 0) },
        { label: "Status", value: summary?.status || "loading" }
      ]}
    >
      <section className={styles.toolbar}>
        <div>
          <strong>{message}</strong>
          <span>{summary?.generated_utc || "waiting for backend"}</span>
        </div>
        <button type="button" onClick={loadSummary}>
          <RefreshCw aria-hidden="true" />
          Refresh
        </button>
      </section>

      <section className={styles.reportHero}>
        <div>
          <span>Official reporting package</span>
          <h2>{summary?.run_scenario_id || "Awaiting latest completed model run"}</h2>
          <p>
            Ward alerts, ULB summaries, executive review, model run appendix, incident actions, road restrictions, and
            downloadable artifacts are assembled here for operational review.
          </p>
        </div>
        <dl>
          <div>
            <dt>PDF Types</dt>
            <dd>{summary?.report_types.length || 0}</dd>
          </div>
          <div>
            <dt>Latest Files</dt>
            <dd>{summary?.latest_artifacts.length || 0}</dd>
          </div>
          <div>
            <dt>Downloads</dt>
            <dd>{downloadCenter?.total || 0}</dd>
          </div>
          <div>
            <dt>Readiness</dt>
            <dd>{summary?.status || "loading"}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.sectionTitle}>
        <div>
          <span>Generate</span>
          <h2>Official PDF Templates</h2>
        </div>
        <p>Choose a report type, generate the latest PDF, or open the most recent artifact.</p>
      </div>
      <section className={styles.reportGrid}>
        {(summary?.report_types || []).map((item) => (
          <ReportCard
            descriptor={item}
            isGenerating={generating === item.report_type}
            key={item.report_type}
            onGenerate={() => runReport(item.report_type)}
          />
        ))}
      </section>

      <div className={styles.sectionTitle}>
        <div>
          <span>Checks</span>
          <h2>Readiness and Operational Inputs</h2>
        </div>
        <p>These values are carried into the report package and should be reviewed before dissemination.</p>
      </div>
      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Report Readiness</h2>
            <span>operator checks</span>
          </div>
          <div className={styles.readinessGrid}>
            {readinessItems(summary).map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Operational Metrics</h2>
            <span>included in PDFs</span>
          </div>
          <div className={styles.metricGrid}>
            {Object.entries(summary?.metrics || {}).map(([key, value]) => (
              <div key={key}>
                <span>{key.replace(/_/g, " ")}</span>
                <strong>{formatValue(value)}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <div className={styles.sectionTitle}>
        <div>
          <span>Artifacts</span>
          <h2>Latest Report Files</h2>
        </div>
        <p>Open generated PDFs and supporting files directly from the artifact registry.</p>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Latest Report Artifacts</h2>
          <span>{summary?.latest_artifacts.length || 0} files</span>
        </div>
        <div className={styles.artifactTable}>
          <div className={styles.artifactHeader}>
            <span>Report</span>
            <span>File</span>
            <span>Size</span>
            <span>Generated</span>
            <span>Open</span>
          </div>
          {(summary?.latest_artifacts || []).slice(0, 12).map((artifact) => (
            <div className={styles.artifactRow} key={artifact.artifact_id}>
              <span>{String(artifact.metadata?.report_title || artifact.metadata?.report_type || "Report")}</span>
              <span>{artifact.filename}</span>
              <span>{formatBytes(artifact.size_bytes)}</span>
              <span>{artifact.modified_utc}</span>
              <a href={toApiUrl(artifact.artifact_url)} target="_blank" rel="noreferrer" aria-label={`Open ${artifact.filename}`}>
                <Download aria-hidden="true" />
              </a>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.sectionTitle}>
        <div>
          <span>Download</span>
          <h2>Release Download Center</h2>
        </div>
        <p>Operational outputs and release files grouped for quick access.</p>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Download Center</h2>
          <span>{downloadCenter?.total || 0} release/report files</span>
        </div>
        <div className={styles.downloadGrid}>
          {(downloadCenter?.downloads || []).slice(0, 12).map((item) => (
            <article key={item.download_id}>
              <span>{item.category.replace(/_/g, " ")}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <a href={toApiUrl(item.artifact.artifact_url)} target="_blank" rel="noreferrer">
                <Download aria-hidden="true" />
                Open
              </a>
            </article>
          ))}
        </div>
      </section>

      <div className={styles.sectionTitle}>
        <div>
          <span>Preview</span>
          <h2>Impact Tables Included in Reports</h2>
        </div>
        <p>Top ward and road-restriction records are shown as report preview tables.</p>
      </div>
      <section className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Top Ward Preview</h2>
            <span>carried forward from impact report</span>
          </div>
          <div className={styles.previewTable}>
            <div className={styles.wardHeader}>
              <span>Ward</span>
              <span>Depth</span>
              <span>Wet Area</span>
              <span>Roads</span>
              <span>Alert</span>
            </div>
            {(impact?.top_wards || []).slice(0, 8).map((ward) => (
              <div className={styles.wardRow} key={ward.ward_id}>
                <span>{ward.ward_id}</span>
                <span>{formatMetric(ward.max_depth_m)} m</span>
                <span>{formatMetric(ward.wet_area_km2)} km2</span>
                <span>{formatMetric(ward.flooded_road_length_km)} km</span>
                <span className={styles[ward.alert_level]}>{ward.alert_level}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Road Restriction Preview</h2>
            <span>top priority roads</span>
          </div>
          <div className={styles.previewTable}>
            <div className={styles.roadHeader}>
              <span>Road</span>
              <span>Ward</span>
              <span>Depth</span>
              <span>Passability</span>
            </div>
            {(impact?.top_roads || []).slice(0, 8).map((road) => (
              <div className={styles.roadRow} key={`${road.road_id}-${road.road_index}`}>
                <span>
                  <strong>{road.road_id}</strong>
                  <small>{road.locality || "locality pending"}</small>
                </span>
                <span>{road.ward_id || "--"}</span>
                <span>{formatMetric(road.max_depth_m)} m</span>
                <span className={styles[road.alert_level]}>{road.passability}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </PageScaffold>
  );
}

function ReportCard(props: {
  descriptor: ReportTypeDescriptor;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  const artifact = props.descriptor.latest_artifact;
  return (
    <article className={styles.reportCard}>
      <div>
        <FileText aria-hidden="true" />
        <span>{props.descriptor.cadence}</span>
      </div>
      <h2>{props.descriptor.title}</h2>
      <p>{props.descriptor.description}</p>
      <div className={styles.reportActions}>
        <button type="button" disabled={props.isGenerating} onClick={props.onGenerate}>
          <FileText aria-hidden="true" />
          {props.isGenerating ? "Generating" : "Generate"}
        </button>
        {artifact ? (
          <a href={toApiUrl(artifact.artifact_url)} target="_blank" rel="noreferrer">
            <Download aria-hidden="true" />
            PDF
          </a>
        ) : (
          <span>No PDF yet</span>
        )}
      </div>
    </article>
  );
}

function mergeGeneratedArtifact(summary: ReportSummary | null, reportType: ReportTypeId, artifact: ArtifactRecord) {
  if (!summary) {
    return summary;
  }
  return {
    ...summary,
    report_types: summary.report_types.map((item) =>
      item.report_type === reportType ? { ...item, latest_artifact: artifact } : item
    ),
    latest_artifacts: [artifact, ...summary.latest_artifacts.filter((item) => item.artifact_id !== artifact.artifact_id)]
  };
}

function readinessItems(summary: ReportSummary | null) {
  const flags = summary?.quality_flags || {};
  return [
    {
      label: "Model Run",
      value: flags.model_status === "completed" ? "Completed" : formatStatus(flags.model_status)
    },
    {
      label: "Impact Data",
      value: flags.impact_status === "ready" ? "Ready" : formatStatus(flags.impact_status)
    },
    {
      label: "Rainfall Check",
      value: flags.rainfall_quality_flag ? "Checked" : "Pending"
    },
    {
      label: "Forecast Check",
      value: flags.aware_quality_flag ? "Checked" : "Pending"
    }
  ];
}

function formatStatus(value?: string) {
  if (!value) {
    return "Pending";
  }
  return value.replace(/_/g, " ");
}

function formatValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (value === null || value === undefined || value === "") {
    return "--";
  }
  return String(value);
}

function formatMetric(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(2);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  return `${(value / 1024).toFixed(1)} KB`;
}
