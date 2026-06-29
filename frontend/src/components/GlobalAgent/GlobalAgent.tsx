import React from "react";
import { BotMessageSquare, LoaderCircle, MessageSquareText, PlayCircle, Send, X } from "lucide-react";
import { askAgent, fetchAgentSuggestions, runNarrativeNowcast } from "../../services/api";
import type { AgentAskResponse, AgentSuggestion } from "../../types/api";
import styles from "./GlobalAgent.module.css";

type ChatTurn = {
  id: string;
  role: "operator" | "agent";
  text: string;
  response?: AgentAskResponse;
};

export function GlobalAgent(props: { currentPath: string }) {
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<AgentSuggestion[]>([]);
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [launching, setLaunching] = React.useState(false);

  React.useEffect(() => {
    fetchAgentSuggestions(props.currentPath)
      .then((payload) => setSuggestions(payload.suggestions || []))
      .catch(() => setSuggestions([]));
  }, [props.currentPath]);

  const submitPrompt = React.useCallback(
    (prompt: string) => {
      const text = prompt.trim();
      if (!text || loading) {
        return;
      }
      const operatorTurn: ChatTurn = { id: crypto.randomUUID(), role: "operator", text };
      setTurns((current) => [...current, operatorTurn]);
      setMessage("");
      setLoading(true);
      askAgent({ question: text, route: props.currentPath })
        .then((payload) => {
          setTurns((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "agent",
              text: payload.answer,
              response: payload
            }
          ]);
        })
        .catch((error: Error) => {
          setTurns((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "agent",
              text: error.message || "Agent API is unavailable."
            }
          ]);
        })
        .finally(() => setLoading(false));
    },
    [loading, props.currentPath]
  );

  const latestAction = [...turns].reverse().find((turn) => turn.response?.action?.type === "nowcast_preview")?.response?.action;

  const launchNowcast = () => {
    const narrative = [...turns].reverse().find((turn) => turn.role === "operator")?.text || "";
    if (!narrative || launching) {
      return;
    }
    setLaunching(true);
    runNarrativeNowcast(narrative)
      .then((payload) => {
        setTurns((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "agent",
            text: `Nowcast job submitted: ${payload.job.job_id}. Status: ${payload.job.status}.`
          }
        ]);
      })
      .catch((error: Error) => {
        setTurns((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "agent",
            text: error.message || "Unable to submit nowcast."
          }
        ]);
      })
      .finally(() => setLaunching(false));
  };

  return (
    <>
      <button className={styles.floatingButton} type="button" onClick={() => setOpen(true)} aria-label="Open FloodAstra agent">
        <BotMessageSquare aria-hidden="true" />
      </button>
      {open ? (
        <aside className={styles.drawer} aria-label="FloodAstra operations agent">
          <div className={styles.header}>
            <div>
              <strong>FloodAstra Agent</strong>
              <span>{props.currentPath}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close FloodAstra agent">
              <X aria-hidden="true" />
            </button>
          </div>

          <div className={styles.suggestions}>
            {suggestions.slice(0, 4).map((item) => (
              <button type="button" key={`${item.label}-${item.prompt}`} onClick={() => submitPrompt(item.prompt)}>
                <MessageSquareText aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.thread}>
            {turns.length ? (
              turns.map((turn) => (
                <article className={turn.role === "operator" ? styles.operatorTurn : styles.agentTurn} key={turn.id}>
                  <span>{turn.role === "operator" ? "You" : "Agent"}</span>
                  <p>{turn.text}</p>
                  {turn.response?.cards?.length ? (
                    <div className={styles.cardGrid}>
                      {turn.response.cards.slice(0, 6).map((card, index) => (
                        <div key={`${turn.id}-${index}`}>
                          <span>{String(card.label || "Metric")}</span>
                          <strong>{String(card.value ?? "--")}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {turn.response?.evidence?.length ? (
                    <div className={styles.evidenceRow}>
                      {turn.response.evidence.slice(0, 3).map((item) => (
                        <small key={`${turn.id}-${item.value}`}>{item.value}</small>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <article className={styles.agentTurn}>
                <span>Agent</span>
                <p>Ask about current risk, model runs, hotspots, reports, downloads, or write a nowcast request.</p>
              </article>
            )}
            {loading ? (
              <article className={styles.agentTurn}>
                <span>Agent</span>
                <p className={styles.loadingText}>
                  <LoaderCircle aria-hidden="true" />
                  Checking verified evidence...
                </p>
              </article>
            ) : null}
          </div>

          {latestAction?.selection ? (
            <div className={styles.actionBar}>
              <div>
                <strong>Nowcast Draft</strong>
                <span>{latestAction.selection.rainfall} · {latestAction.selection.run_length}</span>
              </div>
              <button type="button" onClick={launchNowcast} disabled={launching}>
                {launching ? <LoaderCircle aria-hidden="true" className={styles.spin} /> : <PlayCircle aria-hidden="true" />}
                Launch
              </button>
            </div>
          ) : null}

          <form
            className={styles.inputRow}
            onSubmit={(event) => {
              event.preventDefault();
              submitPrompt(message);
            }}
          >
            <textarea
              aria-label="Ask FloodAstra agent"
              value={message}
              rows={2}
              onChange={(event) => setMessage(event.currentTarget.value)}
              placeholder="Ask or draft a nowcast..."
            />
            <button type="submit" disabled={loading || !message.trim()} aria-label="Send to FloodAstra agent">
              <Send aria-hidden="true" />
            </button>
          </form>
        </aside>
      ) : null}
    </>
  );
}
