## Plan A Backend Setup (Own API + Supabase)

### 1) Create tables
Run `docs/supabase-experiment-schema.sql` in Supabase SQL Editor.

### 2) Required environment variables
Set these in `.env.local` and in Vercel Project Settings:

```bash
# Existing public vars can stay as-is
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Server-side only (must NOT be exposed to client)
SUPABASE_SERVICE_ROLE_KEY=...

# Data saver mode (frontend)
NEXT_PUBLIC_DATA_SAVER_PROVIDER=custom
# Optional (defaults to /api/experiment/events/batch)
NEXT_PUBLIC_DATA_SAVER_CUSTOM_ENDPOINT=/api/experiment/events/batch

# Optional API route protection
EXPERIMENT_API_KEY=some-long-random-string
# If you set EXPERIMENT_API_KEY, also set this for frontend upload header
NEXT_PUBLIC_DATA_SAVER_CUSTOM_API_KEY=some-long-random-string
```

### 3) Route to test

- Health check: `GET /api/experiment/events/batch`
- Upload: `POST /api/experiment/events/batch`

### 4) Payload contract (accepted)

Top-level:

- `participant_id: string`
- `session_id: string`
- `started_at: ISO string`
- `ended_at: ISO string`
- `app_version: string | null`
- `summary: json | null`
- `events: EventRow[]`

Event row:

- `event_id?: string | null` (optional inbound, generated if missing)
- `participant_id: string` (falls back to top-level if missing)
- `session_id: string` (falls back to top-level if missing)
- `phase: "pre" | "monster" | "post" | "meta" | null`
- `task: string | null`
- `step: string | null`
- `question_id: string | null`
- `trial_id: number | null`
- `rt_ms: number | null`
- `user_answer: json | null`
- `correct_answer: json | null`
- `is_correct: boolean | null`
- `stimulus_data: json | null`
- `metrics_data: json | null`
- `raw_json: json`
- `created_at: ISO string`

### 5) Why this is conference-safe

- Upload path is first-party (`/api/...`) so no third-party dependency.
- Session and events are upserted (retry-safe).
- Client queue/retry remains active if network blips happen.
- Full `raw_payload` backup is stored per session for recovery.

