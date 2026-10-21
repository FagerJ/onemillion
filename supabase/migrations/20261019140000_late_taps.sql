-- ONE MILLION BEERS — late taps (C8, D74)
--
-- The offline queue (C8) sends taps when a phone gets its signal back, and that can be
-- after the night has closed: somebody blew the full-time whistle while this phone was in
-- the cellar, or its battery died at midnight and it came back after 09:00. Until now such
-- a tap was refused like a beer from the next day (D41's cost).
--
-- From here a closed night still takes a beer that was tapped before the night ended, for
-- 24 hours after the end — the same day D16 gives for taking one back. Nothing tapped
-- after the end goes in, a live night behaves exactly as before, and nobody new joins
-- (stamp_attendee_crew is untouched). The end is the whistle if it came before 09:00,
-- else 09:00 (D32): a whistle after 09:00 doesn't stretch the night.
--
-- A replay of a beer that already landed (the answer was lost, not the request) needs
-- this too: BEFORE triggers run before ON CONFLICT DO NOTHING looks for the duplicate,
-- so a refused replay could hide a beer that is in fact saved. Within the day it is now a
-- no-op; after that, the queue checks before it believes a refusal (D72).
--
-- A refusal carries hint 'session_closed', which PostgREST passes through, so the app can
-- say why without matching the message.
--
-- A late tap can be taken back too. D16's day to void a beer ran from logged_at, so a tap
-- from 21:00 that lands the next evening arrived already past it — and its "−" may be
-- queued right behind it. The day now runs from when the beer was tapped or arrived,
-- whichever is later. created_at is stamped by the server and isn't in the insert grant, so
-- a phone can't stretch it.
--
-- stamp_beer_from_session() is replaced in place: its trigger, beers_01_stamp_parents,
-- stays attached and still runs first. Not SECURITY DEFINER, as before — the lookup runs
-- under the caller's RLS, and a night they can't see is "not open".

create or replace function public.stamp_beer_from_session()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  s record;
  ended_at timestamptz;
begin
  select crew_id, guild_id, status, closes_at, closed_at into s
    from sessions where id = new.session_id;

  if not found then
    raise exception 'Session % is not open', new.session_id
      using errcode = 'check_violation', hint = 'session_closed';
  end if;

  -- Live: open and before 09:00. Exactly the old rule.
  if not (s.status = 'open' and now() < s.closes_at) then
    -- Over — by the whistle, by 09:00, or past 09:00 before the job got there (D41).
    ended_at := least(coalesce(s.closed_at, s.closes_at), s.closes_at);

    -- C8: a tap from before the end, arriving within a day of it.
    if not (new.logged_at < ended_at and now() < ended_at + interval '24 hours') then
      raise exception 'Session % is not open', new.session_id
        using errcode = 'check_violation', hint = 'session_closed';
    end if;
  end if;

  new.crew_id := s.crew_id;
  new.guild_id := s.guild_id;
  return new;
end;
$$;

-- "−" (D16, D28): any attendee voids a live beer within a day of it being tapped or arriving.
drop policy beers_void on public.beers;
create policy beers_void on public.beers
  for update to authenticated
  using (
    voided_at is null
    and greatest(logged_at, created_at) > now() - interval '24 hours'
    and public.is_session_attendee(session_id)
  )
  with check (voided_at is not null and voided_by = (select auth.uid()));
