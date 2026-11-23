import { describe, expect, it } from "vitest";
import type { LocalAiSnapshot, LocalModel } from "../../services/ipc";
import { formatBytes, localAiHeadline, modelDetail, pickModel } from "./localAi";

const qwen: LocalModel = { name: "qwen3:4b", sizeBytes: 2_497_281_474, family: "qwen3", parameterSize: "4.0B", quantization: "Q4_K_M" };
const llama: LocalModel = { name: "llama3:8b", sizeBytes: 500 * 1024 ** 2, family: null, parameterSize: null, quantization: null };
const snapshot: LocalAiSnapshot = { running: true, models: [qwen, llama], loaded: [], error: null, checkedAt: 0 };

describe("local AI model", () => {
  it("formats sizes in plain units", () => {
    expect(formatBytes(2_497_281_474)).toBe("2.3 GB");
    expect(formatBytes(12 * 1024 ** 3)).toBe("12 GB");
    expect(formatBytes(500 * 1024 ** 2)).toBe("500 MB");
    expect(formatBytes(0)).toBe("0 MB");
  });

  it("keeps the saved model while Ollama has it", () => {
    expect(pickModel("llama3:8b", [qwen, llama])).toBe("llama3:8b");
    expect(pickModel("gone:1b", [qwen, llama])).toBe("qwen3:4b");
    expect(pickModel("", [])).toBeNull();
  });

  it("describes models and status", () => {
    expect(modelDetail(qwen)).toBe("4.0B · Q4_K_M · 2.3 GB");
    expect(modelDetail(llama)).toBe("500 MB");
    expect(localAiHeadline(snapshot)).toBe("Running");
    expect(localAiHeadline({ ...snapshot, loaded: [{ name: "qwen3:4b", sizeVramBytes: 1, expiresAt: null }] })).toBe("1 loaded");
    expect(localAiHeadline({ ...snapshot, running: false })).toBe("Ollama stopped");
    expect(localAiHeadline({ ...snapshot, models: [] })).toBe("No models");
  });
});
