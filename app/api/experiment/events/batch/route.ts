import { NextResponse } from "next/server";

import { validateExperimentSavePayload } from "@/lib/experimentSchema";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_EVENTS_PER_INSERT = 500;

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function isAuthorized(request: Request): boolean {
  const configuredKey = process.env.EXPERIMENT_API_KEY ?? "";
  if (!configuredKey) return true;
  const inboundKey = request.headers.get("x-api-key") ?? "";
  return inboundKey === configuredKey;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/experiment/events/batch",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = validateExperimentSavePayload(body);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Payload validation failed.",
        details: parsed.errors,
      },
      { status: 400 }
    );
  }

  const payload = parsed.value;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Supabase admin client init failed.",
      },
      { status: 500 }
    );
  }

  const sessionRow = {
    session_id: payload.session_id,
    participant_id: payload.participant_id,
    started_at: payload.started_at,
    ended_at: payload.ended_at,
    app_version: payload.app_version,
    summary: payload.summary,
    event_count: payload.events.length,
    raw_payload: payload,
  };

  const { error: sessionError } = await supabase
    .from("experiment_sessions")
    .upsert(sessionRow, { onConflict: "session_id" });

  if (sessionError) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to upsert experiment_sessions row.",
        details: sessionError.message,
      },
      { status: 500 }
    );
  }

  const eventRows = payload.events.map((event) => ({
    event_id: event.event_id,
    session_id: event.session_id,
    participant_id: event.participant_id,
    phase: event.phase,
    task: event.task,
    step: event.step,
    question_id: event.question_id,
    trial_id: event.trial_id,
    rt_ms: event.rt_ms,
    user_answer: event.user_answer,
    correct_answer: event.correct_answer,
    is_correct: event.is_correct,
    stimulus_data: event.stimulus_data,
    metrics_data: event.metrics_data,
    raw_json: event.raw_json,
    created_at: event.created_at,
  }));

  for (const chunk of chunkArray(eventRows, MAX_EVENTS_PER_INSERT)) {
    const { error: eventError } = await supabase
      .from("experiment_events")
      .upsert(chunk, { onConflict: "event_id" });

    if (eventError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to upsert experiment_events rows.",
          details: eventError.message,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    session_id: payload.session_id,
    participant_id: payload.participant_id,
    saved_events: eventRows.length,
  });
}

