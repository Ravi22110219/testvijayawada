import styles from "./KpiCard.module.css";

export function KpiCard(props: {
  label: string;
  value: string;
  hint: string;
  tone: "red" | "orange" | "yellow" | "amber" | "green";
  href?: string;
}) {
  const content = (
    <>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.hint}</small>
    </>
  );

  if (props.href) {
    return (
      <a className={`${styles.kpi} ${styles[props.tone]} ${styles.linked}`} href={props.href}>
        {content}
      </a>
    );
  }

  return (
    <article className={`${styles.kpi} ${styles[props.tone]}`}>
      {content}
    </article>
  );
}
