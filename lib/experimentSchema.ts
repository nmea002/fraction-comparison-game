export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ExperimentPhase = "pre" | "monster" | "post" | "meta" | null;

export type NormalizedExperimentEvent = {
  event_id: string;
  participant_id: string;
  session_id: string;
  phase: ExperimentPhase;
  task: string | null;
  step: string | null;
  question_id: string | null;
  trial_id: number | null;
  rt_ms: number | null;
  user_answer: JsonValue | null;
  correct_answer: JsonValue | null;
  is_correct: boolean | null;
  stimulus_data: JsonValue | null;
  metrics_data: JsonValue | null;
  raw_json: JsonValue;
  created_at: string;
};

export type InboundExperimentEvent = Omit<NormalizedExperimentEvent, "event_id"> & {
  event_id?: string | null;
};

export type ExperimentSavePayload = {
  participant_id: string;
  session_id: string;
  started_at: string;
  ended_at: string;
  app_version: string | null;
  summary: JsonValue | null;
  events: NormalizedExperimentEvent[];
};

export type InboundExperimentSavePayload = Omit<ExperimentSavePayload, "events"> & {
  events: InboundExperimentEvent[];
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const MAX_EVENTS_PER_BATCH = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.trim().length === 0) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function asNullableString(value: unknown): string | null {
  if (typeof value === "undefined" || value === null) return null;
  if (typeof value !== "string") return null;
  return value;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "undefined" || value === null) return null;
  return isFiniteNumber(value) ? value : null;
}

function asNullableBoolean(value: unknown): boolean | null {
  if (typeof value === "undefined" || value === null) return null;
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
    return value.map((entry) => toJsonValue(entry));
  }

  if (isRecord(value)) {
    const out: { [key: string]: JsonValue } = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === "undefined") continue;
      out[key] = toJsonValue(entry);
    }
    return out;
  }

  return String(value);
}

function isPhase(value: unknown): value is ExperimentPhase {
  return (
    value === null ||
    value === "pre" ||
    value === "monster" ||
    value === "post" ||
    value === "meta"
  );
}

export function validateExperimentSavePayload(input: unknown): ValidationResult<ExperimentSavePayload> {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: ["Body must be a JSON object."] };
  }

  const participantId = typeof input.participant_id === "string" ? input.participant_id.trim() : "";
  const sessionId = typeof input.session_id === "string" ? input.session_id.trim() : "";
  const startedAt = input.started_at;
  const endedAt = input.ended_at;

  if (!participantId) errors.push("participant_id is required.");
  if (!sessionId) errors.push("session_id is required.");
  if (!isIsoDateString(startedAt)) errors.push("started_at must be an ISO date string.");
  if (!isIsoDateString(endedAt)) errors.push("ended_at must be an ISO date string.");

  let eventsRaw: unknown[] = [];
  if (!Array.isArray(input.events)) {
    errors.push("events must be an array.");
  } else {
    eventsRaw = input.events;
    if (eventsRaw.length > MAX_EVENTS_PER_BATCH) {
      errors.push(`events exceeds max batch size (${MAX_EVENTS_PER_BATCH}).`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const normalizedEvents: NormalizedExperimentEvent[] = [];
  for (let i = 0; i < eventsRaw.length; i += 1) {
    const rawEvent = eventsRaw[i];
    if (!isRecord(rawEvent)) {
      errors.push(`events[${i}] must be an object.`);
      continue;
    }

    const eventIdRaw = asNullableString(rawEvent.event_id);
    const eventId = eventIdRaw && eventIdRaw.trim().length > 0 ? eventIdRaw : `${sessionId}_${i + 1}`;

    const phase = rawEvent.phase ?? null;
    if (!isPhase(phase)) {
      errors.push(`events[${i}].phase must be one of pre|monster|post|meta|null.`);
      continue;
    }

    const eventCreatedAt = rawEvent.created_at;
    if (!isIsoDateString(eventCreatedAt)) {
      errors.push(`events[${i}].created_at must be an ISO date string.`);
      continue;
    }

    const rowParticipantId = asNullableString(rawEvent.participant_id)?.trim() || participantId;
    const rowSessionId = asNullableString(rawEvent.session_id)?.trim() || sessionId;

    if (!rowParticipantId) {
      errors.push(`events[${i}].participant_id is required (or top-level participant_id).`);
      continue;
    }
    if (!rowSessionId) {
      errors.push(`events[${i}].session_id is required (or top-level session_id).`);
      continue;
    }

    normalizedEvents.push({
      event_id: eventId,
      participant_id: rowParticipantId,
      session_id: rowSessionId,
      phase,
      task: asNullableString(rawEvent.task),
      step: asNullableString(rawEvent.step),
      question_id: asNullableString(rawEvent.question_id),
      trial_id: asNullableNumber(rawEvent.trial_id),
      rt_ms: asNullableNumber(rawEvent.rt_ms),
      user_answer: rawEvent.user_answer === undefined ? null : toJsonValue(rawEvent.user_answer),
      correct_answer: rawEvent.correct_answer === undefined ? null : toJsonValue(rawEvent.correct_answer),
      is_correct: asNullableBoolean(rawEvent.is_correct),
      stimulus_data: rawEvent.stimulus_data === undefined ? null : toJsonValue(rawEvent.stimulus_data),
      metrics_data: rawEvent.metrics_data === undefined ? null : toJsonValue(rawEvent.metrics_data),
      raw_json:
        rawEvent.raw_json === undefined
          ? {}
          : toJsonValue(rawEvent.raw_json),
      created_at: eventCreatedAt,
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      participant_id: participantId,
      session_id: sessionId,
      started_at: startedAt as string,
      ended_at: endedAt as string,
      app_version: asNullableString(input.app_version),
      summary: input.summary === undefined ? null : toJsonValue(input.summary),
      events: normalizedEvents,
    },
  };
}
