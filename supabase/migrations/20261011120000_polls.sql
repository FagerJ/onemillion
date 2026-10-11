-- ONE MILLION BEERS — polls on the news site (D47)
--
-- The news site asks the crew questions, and its polls need somewhere to keep the
-- votes. Voting needs no account: the site is public, and half the crew hasn't signed
-- up yet. So this is the one place a signed-out visitor (`anon`) may do anything —
-- and only through two functions:
--
--   * cast_vote()    — vote, or change your vote, in an open poll
--   * poll_results() — every vote's choice, name and comment, never the voter id
--
-- The tables themselves stay shut (RLS on, no policies, no grants), like everything
-- else here (D39). A voter is a random id the voter's browser keeps: one vote per
-- browser, changeable. That stops accidents, not someone determined to stuff the
-- ballot — fine for a crew of friends, and capped at 500 votes a poll.

create table polls (
  id          text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  -- the keys a vote may choose; the site's post holds the labels
  options     text[] not null check (cardinality(options) between 2 and 12),
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

create table poll_votes (
  poll_id     text not null references polls on delete cascade,
  voter       uuid not null,
  choice      text not null,
  name        text not null check (length(trim(name)) between 1 and 30),
  comment     text check (comment is null or length(comment) <= 280),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (poll_id, voter)
);

comment on column poll_votes.voter is
  'A random id the voter''s browser keeps. Never returned by poll_results(): whoever holds it can change that vote.';

alter table polls      enable row level security;
alter table poll_votes enable row level security;
revoke all on public.polls, public.poll_votes from anon, authenticated;

create function public.cast_vote(
  p_poll text,
  p_voter uuid,
  p_choice text,
  p_name text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  poll public.polls;
begin
  select * into poll from public.polls where id = p_poll;
  if not found or not poll.is_open then
    raise exception 'That poll is closed' using errcode = 'check_violation';
  end if;
  if not (p_choice = any (poll.options)) then
    raise exception 'That is not an option in this poll' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.poll_votes where poll_id = p_poll and voter = p_voter)
     and (select count(*) from public.poll_votes where poll_id = p_poll) >= 500 then
    raise exception 'This poll is full' using errcode = 'check_violation';
  end if;

  insert into public.poll_votes (poll_id, voter, choice, name, comment)
  values (p_poll, p_voter, p_choice, trim(p_name), nullif(trim(p_comment), ''))
  on conflict (poll_id, voter) do update
     set choice = excluded.choice,
         name = excluded.name,
         comment = excluded.comment,
         updated_at = now();
end;
$$;

-- Everything the results need, newest first. No voter ids: holding one is what lets you
-- change a vote.
create function public.poll_results(p_poll text)
returns table (choice text, name text, comment text, voted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.choice, v.name, v.comment, v.updated_at
  from public.poll_votes v
  where v.poll_id = p_poll
  order by v.updated_at desc
  limit 500;
$$;

revoke execute on function
  public.cast_vote(text, uuid, text, text, text), public.poll_results(text)
  from public;
grant execute on function
  public.cast_vote(text, uuid, text, text, text), public.poll_results(text)
  to anon, authenticated;

-- The first two polls. A new poll is a row here, in a new migration, plus a post on the
-- site naming the same id and options.
insert into polls (id, options) values
  ('guilds', array['team', 'supporter', 'matchday', 'hybrid', 'other']),
  ('address', array['ombpls-beer', 'ombpls-se', 'onemillionbeers-se', '1000000-beer', 'fager-tech']);
