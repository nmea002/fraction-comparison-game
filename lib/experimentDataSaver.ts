"use client";

import type {
  ExperimentPhase,
  ExperimentSavePayload,
  JsonValue,
  NormalizedExperimentEvent,
} from "@/lib/experimentSchema";

export type DataSaverProvider = "datapipe" | "custom" | "none";

export type SaveOutcome = {
  ok: boolean;
  provider: DataSaverProvider;
  queued: boolean;
  flushed_before_save: number;
  error?: string;
};

export type BuildPayloadInput = {
  participantId: string;
  sessionId: string;
  startedAt: string;
  endedAt: string;
  summary: unknown;
  rawRows: unknown[];
  appVersion?: string | null;
};

type DataSaverConfig = {
  provider: DataSaverProvider;
  dataPipeBaseUrl: string;
  dataPipeExperimentId: string;
  customEndpoint: string;
  customApiKey: string | null;
};

type QueuedSave = {
  payload: ExperimentSavePayload;
  queued_at: string;
  attempt_count: number;
  last_error: string;
};

type SaveAdapter = {
  provider: DataSaverProvider;
  save: (payload: ExperimentSavePayload) => Promise<void>;
};

const DATAPIPE_DEFAULT_BASE = "https://pipe.jspsych.org";
const DEFAULT_NUMBER_LINE_PAE_THRESHOLD = 10;
const MAX_QUEUE_ITEMS = 5;
const QUEUE_KEY = "numeracy_data_save_queue_v1";
const DEFAULT_CUSTOM_ENDPOINT = "/api/experiment/events/batch";

const STIMULUS_KEYS = [
  "left",
  "right",
  "left_value",
  "right_value",
  "relation",
  "block",
  "distance",
  "stimulus",
  "notation",
  "problem",
  "choices",
  "choice_values",
  "target_value",
  "target_label",
  "target_value_01",
  "true_value_01",
  "difficulty",
] as const;

const METRIC_KEYS = [
  "correct",
  "correct_side",
  "correct_choice_index",
  "chosen_side",
  "chosen_index",
  "estimate_value_01",
  "pae",
  "directional_error",
  "timeout",
  "time_elapsed",
] as const;

const CSV_HEADERS = [
  "event_id",
  "participant_id",
  "session_id",
  "phase",
  "task",
  "step",
  "question_id",
  "trial_id",
  "rt_ms",
  "user_answer_json",
  "correct_answer_json",
  "is_correct",
  "stimulus_data_json",
  "metrics_data_json",
  "raw_json",
  "created_at",
] as const;

type CsvHeader = (typeof CSV_HEADERS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => toJsonValue(v));
  }

  if (isRecord(value)) {
    const out: { [key: string]: JsonValue } = {};
    for (const [key, val] of Object.entries(value)) {
      if (typeof val === "undefined") continue;
      out[key] = toJsonValue(val);
    }
    return out;
  }

  return String(value);
}

function pickDefined(
  row: Record<string, unknown>,
  keys: readonly string[]
): { [key: string]: JsonValue } {
  const out: { [key: string]: JsonValue } = {};
  for (const key of keys) {
    if (typeof row[key] === "undefined") continue;
    out[key] = toJsonValue(row[key]);
  }
  return out;
}

function inferPhase(row: Record<string, unknown>): ExperimentPhase {
  const phase = asString(row.phase);
  if (phase === "pre" || phase === "monster" || phase === "post") return phase;

  const task = asString(row.task);
  if (!task) return null;

  if (task === "monster_math" || task === "monster_stop") return "monster";
  if (task === "consent" || task === "demographics" || task === "id_entry" || task === "resume_choice") {
    return "meta";
  }

  return null;
}

function userAnswerForTask(task: string | null, row: Record<string, unknown>): JsonValue | null {
  if (task === "demographics") {
    const demo = pickDefined(row, [
      "role_type",
      "role_desc",
      "grade_levels",
      "years_in_position",
      "math_expertise",
      "email",
    ]);
    return Object.keys(demo).length > 0 ? demo : null;
  }

  if (task === "id_entry") {
    return toJsonValue(row.participant_id ?? null);
  }

  if (task === "consent") {
    return toJsonValue(row.decision ?? null);
  }

  if (task === "pck") {
    if (typeof row.choice !== "undefined") return toJsonValue(row.choice);
    if (typeof row.choices !== "undefined") return toJsonValue(row.choices);
    const ranked = pickDefined(row, ["rank_most", "rank_second", "rank_third", "rank_least"]);
    if (Object.keys(ranked).length > 0) return ranked;
  }

  if (typeof row.chosen_side !== "undefined") return toJsonValue(row.chosen_side);
  if (typeof row.chosen_index !== "undefined") return toJsonValue(row.chosen_index);
  if (typeof row.choice !== "undefined") return toJsonValue(row.choice);
  if (typeof row.choices !== "undefined") return toJsonValue(row.choices);
  if (typeof row.response !== "undefined") return toJsonValue(row.response);

  return null;
}

function correctAnswerForTask(task: string | null, row: Record<string, unknown>): JsonValue | null {
  if (typeof row.correct_side !== "undefined") return toJsonValue(row.correct_side);
  if (typeof row.correct_choice_index !== "undefined") return toJsonValue(row.correct_choice_index);

  if (task === "number_line_estimation" && typeof row.true_value_01 !== "undefined") {
    return toJsonValue(row.true_value_01);
  }

  if (task === "monster_math" && typeof row.target_value_01 !== "undefined") {
    return toJsonValue(row.target_value_01);
  }

  return null;
}

function computeIsCorrect(task: string | null, row: Record<string, unknown>): boolean | null {
  const explicitCorrect = asBoolean(row.correct);
  if (explicitCorrect !== null) return explicitCorrect;

  if (task === "number_line_estimation") {
    const pae = asNumber(row.pae);
    if (pae !== null) return pae <= DEFAULT_NUMBER_LINE_PAE_THRESHOLD;
  }

  return null;
}

function computeCreatedAt(startedAt: string, endedAt: string, row: Record<string, unknown>): string {
  const elapsed = asNumber(row.time_elapsed);
  const startedMs = Date.parse(startedAt);
  if (elapsed === null || !Number.isFinite(startedMs)) return endedAt;

  const absoluteMs = startedMs + elapsed;
  if (!Number.isFinite(absoluteMs)) return endedAt;
  return new Date(absoluteMs).toISOString();
}

function escapeCsv(cell: string): string {
  return `"${cell.replace(/"/g, "\"\"")}"`;
}

function stringifyCsvValue(value: unknown): string {
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function toSafeFilenamePart(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned.length > 0 ? cleaned : "value";
}

function buildFileStem(payload: ExperimentSavePayload): string {
  const participant = toSafeFilenamePart(payload.participant_id);
  const session = toSafeFilenamePart(payload.session_id);
  const ended = toSafeFilenamePart(payload.ended_at);
  return `${participant}_${session}_${ended}`;
}

function getConfig(): DataSaverConfig {
  const providerEnv = (process.env.NEXT_PUBLIC_DATA_SAVER_PROVIDER ?? "custom").toLowerCase();
  const provider: DataSaverProvider =
    providerEnv === "custom" || providerEnv === "none" ? providerEnv : "datapipe";

  return {
    provider,
    dataPipeBaseUrl: process.env.NEXT_PUBLIC_DATAPIPE_BASE_URL ?? DATAPIPE_DEFAULT_BASE,
    dataPipeExperimentId: process.env.NEXT_PUBLIC_DATAPIPE_EXPERIMENT_ID ?? "",
    customEndpoint: process.env.NEXT_PUBLIC_DATA_SAVER_CUSTOM_ENDPOINT ?? DEFAULT_CUSTOM_ENDPOINT,
    customApiKey: process.env.NEXT_PUBLIC_DATA_SAVER_CUSTOM_API_KEY ?? null,
  };
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readQueue(): QueuedSave[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueuedSave[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedSave[]) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE_ITEMS)));
  } catch {
    // Ignore storage failures. Save attempt has already failed at this point.
  }
}

function enqueuePayload(payload: ExperimentSavePayload, error: string) {
  const queue = readQueue();
  queue.push({
    payload,
    queued_at: new Date().toISOString(),
    attempt_count: 1,
    last_error: error,
  });
  writeQueue(queue);
}

async function flushQueue(adapter: SaveAdapter): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedSave[] = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      await adapter.save(item.payload);
      flushed += 1;
    } catch (err) {
      remaining.push({
        ...item,
        attempt_count: item.attempt_count + 1,
        last_error: err instanceof Error ? err.message : "Unknown queue flush error",
      });
    }
  }

  writeQueue(remaining);
  return flushed;
}

async function uploadToDataPipe(config: DataSaverConfig, filename: string, data: string): Promise<void> {
  if (!config.dataPipeExperimentId) {
    throw new Error("NEXT_PUBLIC_DATAPIPE_EXPERIMENT_ID is missing.");
  }

  const endpoint = `${config.dataPipeBaseUrl.replace(/\/+$/, "")}/api/data`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      experimentID: config.dataPipeExperimentId,
      filename,
      data,
    }),
  });

  const parsed = (await response.json().catch(() => null)) as unknown;
  const apiError = isRecord(parsed) ? asString(parsed.error) : null;

  if (!response.ok) {
    throw new Error(apiError ?? `DataPipe request failed with status ${response.status}.`);
  }
  if (apiError) {
    throw new Error(apiError);
  }
}

function createDataPipeAdapter(config: DataSaverConfig): SaveAdapter {
  return {
    provider: "datapipe",
    save: async (payload: ExperimentSavePayload) => {
      const stem = buildFileStem(payload);
      const csv = normalizedEventsToCsv(payload.events);
      const bundleJson = JSON.stringify(payload);

      await uploadToDataPipe(config, `${stem}_events.csv`, csv);
      await uploadToDataPipe(config, `${stem}_bundle.json`, bundleJson);
    },
  };
}

function createCustomAdapter(config: DataSaverConfig): SaveAdapter {
  return {
    provider: "custom",
    save: async (payload: ExperimentSavePayload) => {
      if (!config.customEndpoint) {
        throw new Error("NEXT_PUBLIC_DATA_SAVER_CUSTOM_ENDPOINT is missing.");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.customApiKey) {
        headers["x-api-key"] = config.customApiKey;
      }

      const response = await fetch(config.customEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const parsed = (await response.json().catch(() => null)) as unknown;
      const apiError = isRecord(parsed) ? asString(parsed.error) : null;

      if (!response.ok) {
        throw new Error(apiError ?? `Custom backend request failed with status ${response.status}.`);
      }
      if (apiError) {
        throw new Error(apiError);
      }
    },
  };
}

function createNoopAdapter(): SaveAdapter {
  return {
    provider: "none",
    save: async () => {
      throw new Error("Data saving is disabled (provider=none).");
    },
  };
}

function buildAdapter(config: DataSaverConfig): SaveAdapter {
  if (config.provider === "custom") return createCustomAdapter(config);
  if (config.provider === "none") return createNoopAdapter();
  return createDataPipeAdapter(config);
}

export function createSessionId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = Math.random().toString(36).slice(2, 10);
  return `sess_${stamp}_${random}`;
}

export function normalizeJsPsychRows(
  participantId: string,
  sessionId: string,
  startedAt: string,
  endedAt: string,
  rawRows: unknown[]
): NormalizedExperimentEvent[] {
  return rawRows.map((entry, index) => {
    const row = isRecord(entry) ? entry : { value: entry };
    const task = asString(row.task);

    const stimulusData = pickDefined(row, STIMULUS_KEYS);
    const metricsData = pickDefined(row, METRIC_KEYS);

    return {
      event_id: `${sessionId}_${index + 1}`,
      participant_id: participantId,
      session_id: sessionId,
      phase: inferPhase(row),
      task,
      step: asString(row.step),
      question_id: asString(row.question_id),
      trial_id: asNumber(row.trial_id),
      rt_ms: asNumber(row.rt),
      user_answer: userAnswerForTask(task, row),
      correct_answer: correctAnswerForTask(task, row),
      is_correct: computeIsCorrect(task, row),
      stimulus_data: Object.keys(stimulusData).length > 0 ? stimulusData : null,
      metrics_data: Object.keys(metricsData).length > 0 ? metricsData : null,
      raw_json: toJsonValue(row),
      created_at: computeCreatedAt(startedAt, endedAt, row),
    };
  });
}

export function normalizedEventsToCsv(events: NormalizedExperimentEvent[]): string {
  const headerLine = CSV_HEADERS.map((h) => escapeCsv(h)).join(",");
  const lines = [headerLine];

  for (const event of events) {
    const row: Record<CsvHeader, unknown> = {
      event_id: event.event_id,
      participant_id: event.participant_id,
      session_id: event.session_id,
      phase: event.phase,
      task: event.task,
      step: event.step,
      question_id: event.question_id,
      trial_id: event.trial_id,
      rt_ms: event.rt_ms,
      user_answer_json: event.user_answer,
      correct_answer_json: event.correct_answer,
      is_correct: event.is_correct,
      stimulus_data_json: event.stimulus_data,
      metrics_data_json: event.metrics_data,
      raw_json: event.raw_json,
      created_at: event.created_at,
    };

    const line = CSV_HEADERS.map((header) => escapeCsv(stringifyCsvValue(row[header]))).join(",");
    lines.push(line);
  }

  return `${lines.join("\r\n")}\r\n`;
}

export function buildExperimentPayload(input: BuildPayloadInput): ExperimentSavePayload {
  const normalizedEvents = normalizeJsPsychRows(
    input.participantId,
    input.sessionId,
    input.startedAt,
    input.endedAt,
    input.rawRows
  );

  const summaryJson = toJsonValue(input.summary);
  const appVersionEnv = asString(process.env.NEXT_PUBLIC_APP_VERSION ?? null);

  return {
    participant_id: input.participantId,
    session_id: input.sessionId,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    app_version: input.appVersion ?? appVersionEnv,
    summary: summaryJson,
    events: normalizedEvents,
  };
}

export async function flushPendingExperimentSaves(): Promise<number> {
  const config = getConfig();
  if (config.provider === "none") return 0;
  const adapter = buildAdapter(config);
  return flushQueue(adapter);
}

export async function saveExperimentPayload(payload: ExperimentSavePayload): Promise<SaveOutcome> {
  const config = getConfig();
  const adapter = buildAdapter(config);

  if (config.provider === "none") {
    return {
      ok: false,
      provider: "none",
      queued: false,
      flushed_before_save: 0,
      error: "Data saving disabled (NEXT_PUBLIC_DATA_SAVER_PROVIDER=none).",
    };
  }

  const flushedBeforeSave = await flushQueue(adapter).catch(() => 0);

  try {
    await adapter.save(payload);
    return {
      ok: true,
      provider: adapter.provider,
      queued: false,
      flushed_before_save: flushedBeforeSave,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown data save error";
    enqueuePayload(payload, message);
    return {
      ok: false,
      provider: adapter.provider,
      queued: true,
      flushed_before_save: flushedBeforeSave,
      error: message,
    };
  }
}

export async function saveJsPsychData(input: BuildPayloadInput): Promise<SaveOutcome> {
  const payload = buildExperimentPayload(input);
  return saveExperimentPayload(payload);
}
