import { Radio } from "lucide-react";
import type { HealthState } from "../../types/api";
import styles from "./HealthPill.module.css";

export function HealthPill(props: { status: HealthState["status"] }) {
  return (
    <div className={`${styles.healthPill} ${styles[props.status]}`}>
      <Radio aria-hidden="true" />
      <span>{props.status}</span>
    </div>
  );
}
