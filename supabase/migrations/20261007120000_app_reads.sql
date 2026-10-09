-- ONE MILLION BEERS — reads for the app (C6, C7, C11)
--
-- Two functions the screens call, and the Realtime publication.
--
-- Both functions are SECURITY INVOKER: they read through the caller's RLS like any
-- other query (D39), so an outsider simply gets no rows. They exist because the
-- answers are aggregates — counting beers per person or per night in the database
-- beats shipping every beer row to a phone.

-- C6: everyone who has been in the party, with their beers in it. Departed members
-- stay on the board (history is never rewritten) with is_current = false.
-- "This week" means the same as in party_summary(): sessions bucketed by the week
-- they started, in their own timezone; the current week is the viewer's.
create or replace function public.party_leaderboard(p_party uuid)
returns table (
  profile_id uuid,
  display_name text,
  initials text,
  avatar_color text,
  total_beers bigint,
  beers_this_week bigint,
  is_current boolean
)
language sql
stable
set search_path = ''
as $$
  with viewer as (
    select public.week_start(now(), p.timezone) as this_week
    from public.profiles p where p.id = (select auth.uid())
  )
  select
    pr.id,
    pr.display_name,
    pr.initials,
    pr.avatar_color,
    count(b.id),
    count(b.id) filter (
      where public.week_start(s.started_at, s.timezone) = (select this_week from viewer)
    ),
    pm.left_at is null
  from public.party_members pm
  join public.profiles pr on pr.id = pm.profile_id
  left join public.beers b
    on b.party_id = pm.party_id and b.profile_id = pm.profile_id and b.voided_at is null
  left join public.sessions s on s.id = b.session_id
  where pm.party_id = p_party
  group by pr.id, pm.left_at
  order by count(b.id) desc, pr.display_name;
$$;

-- C7: the party's nights, newest first, the live one included. Each row carries its
-- live beer count and who was there with their own count — one call per feed page.
-- Page backwards with p_before = the oldest started_at already shown.
create or replace function public.party_feed(
  p_party uuid,
  p_limit int default 20,
  p_before timestamptz default null
)
returns table (
  session_id uuid,
  status text,
  started_at timestamptz,
  closed_at timestamptz,
  closes_at timestamptz,
  note text,
  total_beers bigint,
  attendees jsonb
)
language sql
stable
set search_path = ''
as $$
  select
    s.id,
    s.status,
    s.started_at,
    s.closed_at,
    s.closes_at,
    s.note,
    (select count(*) from public.beers b
      where b.session_id = s.id and b.voided_at is null),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'profile_id', p.id,
               'display_name', p.display_name,
               'initials', p.initials,
               'avatar_color', p.avatar_color,
               'beers', (select count(*) from public.beers b
                          where b.session_id = s.id and b.profile_id = p.id
                            and b.voided_at is null)
             ) order by a.joined_at)
      from public.session_attendees a
      join public.profiles p on p.id = a.profile_id
      where a.session_id = s.id
    ), '[]'::jsonb)
  from public.sessions s
  where s.party_id = p_party
    and (p_before is null or s.started_at < p_before)
  order by s.started_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function
  public.party_leaderboard(uuid), public.party_feed(uuid, int, timestamptz)
  from public, anon;
grant execute on function
  public.party_leaderboard(uuid), public.party_feed(uuid, int, timestamptz)
  to authenticated;

-- C11: the tally climbs on every phone at the table, and the million ticks for
-- everyone. Realtime applies each subscriber's RLS to every change it forwards.
alter publication supabase_realtime add table
  public.beers, public.session_attendees, public.sessions,
  public.global_stats, public.party_stats;
