import React from "react";
import styles from "./LoginPage.module.css";

export function LoginPage(props: {
  error: string;
  isLoading: boolean;
  onLogin: (email: string, password: string) => void;
}) {
  const [email, setEmail] = React.useState("operator@example.com");
  const [password, setPassword] = React.useState("dev");

  return (
    <main className={styles.loginShell}>
      <section className={styles.loginPanel}>
        <div className={styles.brand}>
          <img src="/brand/floodresq-logo.png" alt="FloodReSQ" />
          <div>
            <strong>FloodAstra</strong>
            <span>Vijayawada Command Center</span>
          </div>
        </div>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            props.onLogin(email, password);
          }}
        >
          <header>
            <p>Phase 6 Access</p>
            <h1>Sign in to operations</h1>
          </header>

          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </label>

          {props.error ? <div className={styles.error}>{props.error}</div> : null}

          <button type="submit" disabled={props.isLoading}>
            {props.isLoading ? "Signing in..." : "Enter Command Center"}
          </button>
        </form>
      </section>
    </main>
  );
}
