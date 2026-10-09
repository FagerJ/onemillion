-- ONE MILLION BEERS — session lifecycle jobs (C10, D41)
--
-- Two scheduled jobs and one safety net:
--
--   * every 5 minutes, close sessions whose closes_at has passed (D32)
--   * every night, delete single-attendee sessions over a week old (D36)
--   * when a party opens a new night, close its stale one first — so a party is
--     never stuck behind a job that hasn't run (one open session per party)
--
-- Beers and attendees are already refused once closes_at has passed, job or no job
-- (the BEFORE triggers in the schema). The jobs only make the status say so.

create extension if not exists pg_cron with schema pg_catalog;

-- D32: closed at the scheduled time, not whenever the job happened to run.
create or replace function public.close_stale_sessions()
returns int
language sql
security definer
set search_path = ''
as $$
  with closed as (
    update public.sessions
       set status = 'closed', closed_at = closes_at
     where status = 'open' and closes_at <= now()
    returning 1
  )
  select count(*)::int from closed;
$$;

-- D36: a session that never got a second attendee can't hold a beer, so deleting it
-- a week after it closed loses nothing. The beer check is belt and braces — this
-- must never cascade into a real beer.
create or replace function public.purge_lonely_sessions()
returns int
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.sessions s
     where s.status = 'closed'
       and s.closed_at < now() - interval '7 days'
       and (select count(*) from public.session_attendees a where a.session_id = s.id) < 2
       and not exists (select 1 from public.beers b where b.session_id = s.id)
    returning 1
  )
  select count(*)::int from gone;
$$;

-- The safety net. SECURITY DEFINER because clients can't update sessions; if the
-- insert that fired it is then refused by RLS, this update rolls back with it.
create or replace function public.close_stale_session_of_party()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sessions
     set status = 'closed', closed_at = closes_at
   where party_id = new.party_id and status = 'open' and closes_at <= now();
  return new;
end;
$$;

create trigger sessions_00_close_stale
  before insert on sessions
  for each row execute function public.close_stale_session_of_party();

revoke execute on function
  public.close_stale_sessions(), public.purge_lonely_sessions(),
  public.close_stale_session_of_party()
  from public, anon, authenticated;

-- cron.schedule() upserts by job name, so re-running this is harmless.
select cron.schedule('close-stale-sessions', '*/5 * * * *',
                     $$select public.close_stale_sessions()$$);
select cron.schedule('purge-lonely-sessions', '17 4 * * *',
                     $$select public.purge_lonely_sessions()$$);
