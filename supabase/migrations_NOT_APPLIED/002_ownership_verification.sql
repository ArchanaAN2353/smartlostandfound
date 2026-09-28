-- ============================================================
-- DATABASE CHANGES REQUIRED — NOT EXECUTED
-- ============================================================
--
-- Updated version: supports MULTIPLE mandatory verification
-- questions per found item (not just one).
--
-- This has NOT been run against your Supabase project. It is
-- additive only:
--   1. Adds two new nullable jsonb columns to the EXISTING
--      found_items table.
--   2. Creates one new table: claim_requests.
--
-- If you already ran an earlier version of this file with the
-- single-column verification_question/verification_answer
-- design, run the "DROP COLUMN" lines below first, then the
-- rest of this file.
-- ============================================================

-- Only needed if you previously ran an OLDER version of this
-- migration with single-text columns. Safe to run even if those
-- columns don't exist (IF EXISTS guards it).
alter table public.found_items
  drop column if exists verification_question,
  drop column if exists verification_answer;

-- ------------------------------------------------------------
-- 1. ADD VERIFICATION QUESTIONS/ANSWERS TO found_items
-- ------------------------------------------------------------
-- verification_questions: array of question strings, e.g.
--   ["How many keys are on the bunch?", "What color is the case?"]
-- verification_answers: array of answer strings, SAME ORDER as
--   the questions above, e.g. ["7", "Blue"]
--
-- Both default to an empty array so existing rows (reported
-- before this feature existed) don't break.

alter table public.found_items
  add column if not exists verification_questions jsonb not null default '[]'::jsonb,
  add column if not exists verification_answers   jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------------
-- 2. CLAIM REQUESTS TABLE
-- ------------------------------------------------------------

create table if not exists public.claim_requests (
  id                uuid primary key default gen_random_uuid(),

  found_item_id     uuid not null references public.found_items(id) on delete cascade,
  lost_item_id      uuid references public.lost_items(id) on delete set null,

  claimant_id       uuid not null references auth.users(id) on delete cascade,
  claimant_name     text,

  -- Array of answer strings, in the SAME order as the found
  -- item's verification_questions at the time this claim was
  -- submitted, e.g. ["7", "Blue"]
  claimant_answers  jsonb not null default '[]'::jsonb,

  status            text not null default 'pending' check (
                       status in ('pending', 'verified', 'rejected')
                     ),

  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz
);

create index if not exists claim_requests_found_item_idx on public.claim_requests(found_item_id);
create index if not exists claim_requests_claimant_idx on public.claim_requests(claimant_id);

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ------------------------------------------------------------

alter table public.claim_requests enable row level security;

create policy "Claimants can insert their own claim"
  on public.claim_requests
  for insert
  to authenticated
  with check (auth.uid() = claimant_id);

create policy "Claimants can view their own claims"
  on public.claim_requests
  for select
  to authenticated
  using (auth.uid() = claimant_id);

create policy "Founders can view claims on their found items"
  on public.claim_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.found_items
      where found_items.id = claim_requests.found_item_id
        and found_items.user_id = auth.uid()
    )
  );

create policy "Founders can update claims on their found items"
  on public.claim_requests
  for update
  to authenticated
  using (
    exists (
      select 1 from public.found_items
      where found_items.id = claim_requests.found_item_id
        and found_items.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- NOTE ON verification_answers VISIBILITY
-- ------------------------------------------------------------
-- Same caveat as before: if your existing found_items SELECT
-- policy allows any authenticated user to read full rows, then
-- verification_answers is technically fetchable by anyone who
-- queries the table directly (e.g. via browser dev tools), even
-- though ClaimItem.jsx never requests that column itself.
--
-- For a hackathon demo this is an acceptable trade-off (frontend
-- never displays it), but the fully correct fix is a Postgres
-- view or RPC function that returns found_items WITHOUT the
-- verification_answers column to non-owners. Worth mentioning in
-- your Q&A prep as a "known limitation / next step".
