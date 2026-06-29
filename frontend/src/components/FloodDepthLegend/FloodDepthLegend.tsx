import styles from "./FloodDepthLegend.module.css";

const legendStops = [
  { label: "0.01", color: "rgba(125, 214, 239, 0.76)" },
  { label: "0.05", color: "rgba(34, 201, 219, 0.82)" },
  { label: "0.15", color: "rgba(42, 108, 235, 0.9)" },
  { label: "0.30", color: "rgba(132, 60, 221, 0.92)" },
  { label: "0.60", color: "rgba(218, 28, 96, 0.94)" },
  { label: "1.20", color: "rgba(184, 28, 70, 0.96)" },
  { label: "4.00 m", color: "rgba(96, 12, 18, 0.98)" }
];

export function FloodDepthLegend(props: { label?: string; maxDepth?: number | null }) {
  return (
    <div className={styles.legend} aria-label="Flood depth legend">
      <div className={styles.header}>
        <strong>{props.label || "Maximum depth, metres"}</strong>
        <span>{props.maxDepth !== undefined && props.maxDepth !== null ? `${props.maxDepth.toFixed(2)} m max` : "model overlay"}</span>
      </div>
      <div className={styles.gradient} aria-hidden="true" />
      <div className={styles.scale}>
        {legendStops.map((stop) => (
          <span key={stop.label}>
            <i style={{ background: stop.color }} />
            {stop.label}
          </span>
        ))}
      </div>
    </div>
  );
}
