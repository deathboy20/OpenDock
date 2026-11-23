import { useState } from "react";
import { askLocalAi, errorText, refreshLocalAi } from "../../services/ipc";
import { useLive, useNow } from "../../services/liveContext";
import { useSettings } from "../../services/settingsContext";
import { IconButton, PanelHeader } from "../flyout/panels/PanelHeader";
import { formatAgo } from "../widgets/format";
import { PanelState } from "../widgets/visuals";
import { formatBytes, modelDetail, pickModel } from "./localAi";
import { plural } from "./projects";
import "./developer.css";

const MAX_PROMPT = 2000;

export function LocalAiPanel() {
  const { localAi } = useLive();
  const { settings, update } = useSettings();
  const now = useNow(30_000);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snapshot = localAi.status === "ready" ? localAi.data : null;
  const header = (
    <PanelHeader
      icon="chip"
      title="Local AI"
      subtitle={
        snapshot
          ? `Ollama on this PC · checked ${formatAgo(snapshot.checkedAt, now)}`
          : "Ollama on this PC"
      }
      actions={<IconButton icon="refresh" label="Check again" onClick={() => void refreshLocalAi()} />}
    />
  );

  if (localAi.status === "error") {
    return (
      <>
        {header}
        <PanelState kind="error" title="Couldn't check Ollama" detail={localAi.error} />
      </>
    );
  }
  if (!snapshot) {
    return (
      <>
        {header}
        <PanelState kind="loading" title="Checking Ollama" />
      </>
    );
  }
  if (!snapshot.running) {
    return (
      <>
        {header}
        <PanelState
          kind="empty"
          title="Ollama isn't running"
          detail="Start Ollama, then check again. OpenDock looks for it at 127.0.0.1:11434."
        />
      </>
    );
  }
  if (snapshot.error) {
    return (
      <>
        {header}
        <PanelState kind="error" title="Ollama answered with an error" detail={snapshot.error} />
      </>
    );
  }
  if (snapshot.models.length === 0) {
    return (
      <>
        {header}
        <PanelState kind="empty" title="No models yet" detail="Pull one in a terminal, for example: ollama pull qwen3:4b" />
      </>
    );
  }

  const model = pickModel(settings.widgets.localAi.model, snapshot.models) ?? "";
  const loadedNames = new Set(snapshot.loaded.map((m) => m.name));
  const ask = () => {
    if (!prompt.trim() || asking) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    askLocalAi(model, prompt)
      .then(setAnswer)
      .catch((e) => setError(errorText(e)))
      .finally(() => setAsking(false));
  };

  return (
    <>
      {header}
      <form
        className="ai-ask"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <div className="ai-ask-row">
          <select
            className="select"
            aria-label="Model"
            value={model}
            onChange={(e) => {
              const next = e.target.value;
              void update((s) => ({ ...s, widgets: { ...s.widgets, localAi: { ...s.widgets.localAi, model: next } } }));
            }}
          >
            {snapshot.models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ai-ask-row">
          <input
            className="text-input"
            aria-label="Ask the model"
            placeholder="Ask a quick question"
            value={prompt}
            maxLength={MAX_PROMPT}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button type="submit" className="button is-primary" disabled={!prompt.trim() || asking}>
            {asking ? "Thinking…" : "Ask"}
          </button>
        </div>
        {asking ? (
          <p className="muted small" role="status">
            {loadedNames.has(model) ? "Answering…" : `Loading ${model}. The first answer takes longer.`}
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {answer !== null ? (
          <pre className="ai-answer" aria-live="polite">
            {answer || "The model sent an empty answer."}
          </pre>
        ) : null}
      </form>

      <section className="panel-section">
        <h2>In memory · {snapshot.loaded.length}</h2>
        {snapshot.loaded.length === 0 ? (
          <p className="muted small">No model is loaded. Asking a question loads one.</p>
        ) : (
          <ul className="ai-list">
            {snapshot.loaded.map((m) => (
              <li key={m.name} className="is-loaded">
                <span className="mono">{m.name}</span>
                <span className="muted small">{m.sizeVramBytes > 0 ? `${formatBytes(m.sizeVramBytes)} on the GPU` : "Running on the CPU"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel-section">
        <h2>Installed · {plural(snapshot.models.length, "model")}</h2>
        <ul className="ai-list is-scroll">
          {snapshot.models.map((m) => (
            <li key={m.name}>
              <span className="mono">{m.name}</span>
              <span className="muted small">{modelDetail(m)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
