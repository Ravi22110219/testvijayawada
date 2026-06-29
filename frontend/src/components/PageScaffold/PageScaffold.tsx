import type { ReactNode } from "react";
import styles from "./PageScaffold.module.css";

export function PageScaffold(props: {
  eyebrow: string;
  title: string;
  description: string;
  statusItems?: Array<{ label: string; value: string }>;
  children?: ReactNode;
}) {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p>{props.eyebrow}</p>
        <h1>{props.title}</h1>
        <span>{props.description}</span>
      </header>

      {props.statusItems?.length ? (
        <div className={styles.statusGrid}>
          {props.statusItems.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>
      ) : null}

      {props.children}
    </section>
  );
}
