-- ONE MILLION BEERS — row level security (F5, D39)
--
-- ⚠ DRAFT, NOT YET APPLIED TO ANY HOSTED PROJECT. Only ever run against throwaway
--   local databases, so editing it in place is still free.
--
-- How access works (D39):
--   * Clients READ tables directly; the policies below decide which rows they see.
--   * Clients WRITE directly only where "may I?" is a fact about the row itself:
--     your own profile, starting a session, joining one, logging a beer, voiding one,
--     skipping yourself on rounds, renaming a party you captain.
--   * Anything that has to compare before with after — creating or joining a party,
--     leaving, removing or promoting members, closing a session — goes through a
--     SECURITY DEFINER function at the bottom. Clients get no direct write there.
--
-- Column grants back the policies up: a policy says WHICH rows, a grant says WHICH
-- columns. No client can write `global_seq`, `party_id`, `status` or `max_members`.
--
-- `anon` gets nothing. There is no public surface until the counter page (P2).

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER so a policy can ask about party_members without recursing into
-- party_members' own policy. Each one only ever answers about the caller.

create or replace function public.is_party_member(p_party uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.party_members
    where party_id = p_party
      and profile_id = (select auth.uid())
      and left_at is null
  );
$$;

create or replace function public.is_party_captain(p_party uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.party_members
    where party_id = p_party
      and profile_id = (select auth.uid())
      and left_at is null
      and role = 'captain'
  );
$$;

create or replace function public.is_session_attendee(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.session_attendees
    where session_id = p_session
      and profile_id = (select auth.uid())
  );
$$;

-- Has p_profile ever been in a party the caller is in now? `left_at` is only checked
-- on the caller's side, so someone who left keeps their name in the party's history.
create or replace function public.shares_party_with(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.party_members me
    join public.party_members them on them.party_id = me.party_id
    where me.profile_id = (select auth.uid())
      and me.left_at is null
      and them.profile_id = p_profile
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Grants — start from nothing, give back what the policies expect
-- ─────────────────────────────────────────────────────────────
-- Supabase grants everything on public tables to anon and authenticated by default.
revoke all on public.profiles, public.beer_types, public.parties, public.party_members,
              public.sessions, public.session_attendees, public.beers
  from anon, authenticated;
revoke all on sequence public.beers_global_seq from anon;
grant usage on sequence public.beers_global_seq to authenticated;

grant select on public.profiles, public.beer_types, public.parties, public.party_members,
                public.sessions, public.session_attendees, public.beers
  to authenticated;

grant insert (id, display_name, initials, avatar_color, home_city, timezone),
      update (display_name, initials, avatar_color, home_city, timezone)
  on public.profiles to authenticated;

grant update (name, accent_color) on public.parties to authenticated;

grant insert (id, party_id, venue_name, note, started_at, timezone, created_by)
  on public.sessions to authenticated;

grant insert (session_id, profile_id, in_rounds),
      update (in_rounds)
  on public.session_attendees to authenticated;

-- `logged_at` is writable so an offline tap (C8) keeps the time it was tapped.
grant insert (id, session_id, profile_id, added_by, round_id, beer_type, volume_ml, abv,
              is_alcohol_free, logged_at, client_uuid),
      update (voided_at, voided_by)
  on public.beers to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Policies
-- ─────────────────────────────────────────────────────────────

-- Profiles: yourself, plus anyone who is or was in a party you're in now.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_party_with(id));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Beer types: reference data, readable by everyone signed in.
create policy beer_types_select on public.beer_types
  for select to authenticated
  using (true);

-- Parties: members see their party; captains rename it (B4). Creating and joining
-- go through create_party() / join_party(), so a party can't be found by browsing.
create policy parties_select on public.parties
  for select to authenticated
  using (public.is_party_member(id));

create policy parties_update on public.parties
  for update to authenticated
  using (public.is_party_captain(id))
  with check (public.is_party_captain(id));

-- Party members: everyone in your party, past members included (history), plus your
-- own rows in parties you've left. All writes go through the functions below.
create policy party_members_select on public.party_members
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_party_member(party_id));

-- Sessions: the party watches; any current member can start one. Closing goes
-- through close_session() so a closed night can never be reopened.
create policy sessions_select on public.sessions
  for select to authenticated
  using (public.is_party_member(party_id) or public.is_session_attendee(id));

create policy sessions_insert on public.sessions
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_party_member(party_id));

-- Attendees: check yourself in, or add a party-mate once you're there yourself
-- (Q17 / D22a — joining the party is the consent). party_id is stamped by the
-- BEFORE trigger, which runs before this check, so it can't be spoofed.
-- No deletes in v0: a mistaken attendee stays, having drunk nothing.
create policy session_attendees_select on public.session_attendees
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_party_member(party_id));

create policy session_attendees_insert on public.session_attendees
  for insert to authenticated
  with check (
    public.is_party_member(party_id)
    and (profile_id = (select auth.uid()) or public.is_session_attendee(session_id))
  );

create policy session_attendees_update on public.session_attendees
  for update to authenticated
  using (public.is_session_attendee(session_id))
  with check (public.is_session_attendee(session_id));

-- Beers: the party sees them; you always see your own, even after leaving.
-- Anyone at the session logs for anyone there (D26), but only in their own name.
create policy beers_select on public.beers
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_party_member(party_id));

create policy beers_insert on public.beers
  for insert to authenticated
  with check (added_by = (select auth.uid()) and public.is_session_attendee(session_id));

-- "−" (D28): any attendee voids a live beer within 24 hours (D16), in their own name.
-- USING sees the old row and WITH CHECK the new one, so a void can't be undone.
create policy beers_void on public.beers
  for update to authenticated
  using (
    voided_at is null
    and logged_at > now() - interval '24 hours'
    and public.is_session_attendee(session_id)
  )
  with check (voided_at is not null and voided_by = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Membership and lifecycle — functions only
-- ─────────────────────────────────────────────────────────────

create or replace function public.create_party(p_name text)
returns public.parties
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := auth.uid();
  p public.parties;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege';
  end if;

  insert into public.parties (name, created_by) values (p_name, me) returning * into p;
  insert into public.party_members (party_id, profile_id, role) values (p.id, me, 'captain');
  return p;
end;
$$;

-- Codes are case-insensitive. Someone who left can rejoin with the current code and
-- keeps their original joined_at; the cap trigger checks the seat either way.
create or replace function public.join_party(p_code text)
returns public.parties
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := auth.uid();
  p public.parties;
  was_left timestamptz;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege';
  end if;

  select * into p from public.parties where invite_code = upper(trim(p_code));
  if not found then
    raise exception 'No party has that code' using errcode = 'no_data_found';
  end if;

  select left_at into was_left
  from public.party_members
  where party_id = p.id and profile_id = me;

  if not found then
    insert into public.party_members (party_id, profile_id) values (p.id, me);
  elsif was_left is not null then
    update public.party_members set left_at = null
    where party_id = p.id and profile_id = me;
  end if;

  return p;
end;
$$;

-- B4: leaving sets left_at and keeps all history. If the last captain leaves, the
-- longest-standing member gets the armband so the party is never captainless.
create or replace function public.leave_party(p_party uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := auth.uid();
begin
  update public.party_members
     set left_at = now(), role = 'member'
   where party_id = p_party and profile_id = me and left_at is null;

  if not found then
    raise exception 'You are not in that party' using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1 from public.party_members
    where party_id = p_party and role = 'captain' and left_at is null
  ) then
    update public.party_members set role = 'captain'
    where (party_id, profile_id) = (
      select party_id, profile_id from public.party_members
      where party_id = p_party and left_at is null
      order by joined_at, profile_id
      limit 1
    );
  end if;
end;
$$;

-- B4: a captain removes a member. Same effect as them leaving: history stays.
-- They can rejoin with the code, so pair this with regenerate_invite_code().
create or replace function public.remove_member(p_party uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_party_captain(p_party) then
    raise exception 'Only a captain can remove members' using errcode = 'insufficient_privilege';
  end if;
  if p_profile = auth.uid() then
    raise exception 'Use leave_party() to leave' using errcode = 'invalid_parameter_value';
  end if;

  update public.party_members
     set left_at = now(), role = 'member'
   where party_id = p_party and profile_id = p_profile and left_at is null;

  if not found then
    raise exception 'Not a current member' using errcode = 'no_data_found';
  end if;
end;
$$;

-- B4: the founder is captain and can promote others; captains are equals.
create or replace function public.promote_member(p_party uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_party_captain(p_party) then
    raise exception 'Only a captain can promote members' using errcode = 'insufficient_privilege';
  end if;

  update public.party_members set role = 'captain'
   where party_id = p_party and profile_id = p_profile and left_at is null;

  if not found then
    raise exception 'Not a current member' using errcode = 'no_data_found';
  end if;
end;
$$;

create or replace function public.regenerate_invite_code(p_party uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not public.is_party_captain(p_party) then
    raise exception 'Only a captain can change the invite code' using errcode = 'insufficient_privilege';
  end if;

  update public.parties set invite_code = public.generate_invite_code()
   where id = p_party
  returning invite_code into code;
  return code;
end;
$$;

-- D32: any attendee may close the night early. One way only.
create or replace function public.close_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_session_attendee(p_session) then
    raise exception 'Only someone at the session can close it' using errcode = 'insufficient_privilege';
  end if;

  update public.sessions set status = 'closed', closed_at = now()
   where id = p_session and status = 'open';

  if not found then
    raise exception 'Session % is not open', p_session using errcode = 'check_violation';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Function grants
-- ─────────────────────────────────────────────────────────────
-- Supabase also grants execute on new functions to anon by default.
revoke execute on function
  public.is_party_member(uuid), public.is_party_captain(uuid),
  public.is_session_attendee(uuid), public.shares_party_with(uuid),
  public.create_party(text), public.join_party(text), public.leave_party(uuid),
  public.remove_member(uuid, uuid), public.promote_member(uuid, uuid),
  public.regenerate_invite_code(uuid), public.close_session(uuid)
  from public, anon;

grant execute on function
  public.is_party_member(uuid), public.is_party_captain(uuid),
  public.is_session_attendee(uuid), public.shares_party_with(uuid),
  public.create_party(text), public.join_party(text), public.leave_party(uuid),
  public.remove_member(uuid, uuid), public.promote_member(uuid, uuid),
  public.regenerate_invite_code(uuid), public.close_session(uuid)
  to authenticated;

-- Internal: only the parties.invite_code default and regenerate_invite_code() call it.
revoke execute on function public.generate_invite_code() from public, anon, authenticated;
