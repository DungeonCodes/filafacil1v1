# Database Schema

## Versioned SQL in repository
- `supabase/auth.sql`

This file creates:
- `public.app_users`
  - `id`
  - `auth_user_id`
  - `username`
  - `role` in (`attendant`, `doctor`, `admin`)
  - `is_active`
  - `created_at`
  - `updated_at`
- `set_app_users_updated_at()` trigger function
- RLS policy allowing authenticated users to read their own profile row

## Database objects required by current app but not versioned in repo

### Tables referenced by code
- `queues`
  - fields used: `id`, `name`, `prefix`
- `tickets`
  - fields used: `id`, `queue_id`, `prefix`, `ticket_number`, `current_stage`, `created_at`, `called_at`, `current_consulting_room`, `finished_at`
- `calls`
  - fields used: `id`, `ticket_id`, `stage`, `destination_type`, `destination_label`, `called_by`, `called_at`

### RPC functions referenced by code
- `create_next_ticket(p_queue_prefix text)`
- `call_next_attendant(p_queue_prefix text, p_destination_label text, p_called_by text)`
- `forward_ticket_to_doctor(p_ticket_id bigint, p_destination_label text, p_called_by text)`
- `call_next_doctor(p_queue_prefix text, p_consulting_room text, p_called_by text)`

## Current schema risk
- The base queue/ticket/call schema and RPC SQL are external project state today.
- Future Codex sessions should not assume these objects are fully reproducible from the repo.
- Before making DB-affecting feature changes, extract and version the missing base Supabase SQL as a first-class repository artifact.

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Operational note
- Local auth bootstrap depends on `SUPABASE_SERVICE_ROLE_KEY` being available server-side.
- The browser must never receive the service role key.
