import type { LocalAiSnapshot, LocalModel } from "../../services/ipc";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

/** The saved model if Ollama still has it, otherwise the first installed one. */
export function pickModel(saved: string, models: LocalModel[]): string | null {
  if (models.some((m) => m.name === saved)) return saved;
  return models[0]?.name ?? null;
}

export function modelDetail(model: LocalModel): string {
  return [model.parameterSize, model.quantization, formatBytes(model.sizeBytes)].filter(Boolean).join(" · ");
}

export function localAiHeadline(snapshot: LocalAiSnapshot): string {
  if (!snapshot.running) return "Ollama stopped";
  if (snapshot.loaded.length > 0) return `${snapshot.loaded.length} loaded`;
  return snapshot.models.length === 0 ? "No models" : "Running";
}
