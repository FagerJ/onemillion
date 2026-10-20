import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import type { Database, Tables, TablesInsert } from '@/lib/database.types'
import type { MilestoneEvent } from '@/lib/milestones'
import { apiOrigin, publishableKey, supabase } from '@/lib/supabase'
import { uuid } from '@/lib/uuid'

// Every read and write the screens make. Reads go straight at the tables and the
// read functions; RLS decides what comes back (D39). Crew-scoped keys all start
// with ['crew', id] so one realtime event can refresh a whole crew at once.

export type Profile = Tables<'profiles'>
export type Crew = Tables<'crews'>
export type Session = Tables<'sessions'>

export type Member = {
  role: string
  joined_at: string
  profile: Pick<Profile, 'id' | 'display_name' | 'initials' | 'avatar_color'>
}

export type Attendee = {
  profile_id: string
  in_rounds: boolean
  joined_at: string
  profile: Pick<Profile, 'display_name' | 'initials' | 'avatar_color'>
}

export type LiveBeer = {
  id: string
  profile_id: string
  added_by: string
  round_id: string | null
  logged_at: string
  is_alcohol_free: boolean
}

export type FeedAttendee = { profile_id: string; display_name: string; initials: string; avatar_color: string; beers: number }

type Response = { data: unknown; error: unknown }

/** A query that must answer. Throws on error. */
function must<R extends Response>(result: R): NonNullable<R['data']> {
  if (result.error) throw result.error
  return result.data as NonNullable<R['data']>
}

/** A query where "no row" is a fine answer. */
function maybe<R extends Response>(result: R): R['data'] {
  if (result.error) throw result.error
  return result.data
}

// crew_id, closes_at and timezone are NOT NULL with no default, so the generated
// Insert types demand them — but BEFORE triggers stamp them, and clients aren't even
// granted those columns (D39). Inserts leave them out; these say so to the compiler.
type TableName = keyof Database['public']['Tables']
type Stamped<T extends TableName, K extends string> = Omit<TablesInsert<T>, K>
const stamped = <T extends TableName>(rows: unknown) => rows as TablesInsert<T>[]

// ── auth ──────────────────────────────────────────────────────

/** What the auth server offers: which sign-in providers are switched on, and whether
 *  a new account must confirm its email first. Public, like the sign-in screen. */
export type AuthSettings = {
  external: Record<string, boolean>
  disable_signup: boolean
  mailer_autoconfirm: boolean
}

// The welcome screen shows "Continue with Google" only once the provider is switched
// on in Supabase, so the button can't appear before it works.
export function useAuthSettings() {
  return useQuery({
    queryKey: ['auth', 'settings'],
    staleTime: Infinity,
    queryFn: async (): Promise<AuthSettings> => {
      const res = await fetch(`${apiOrigin}/auth/v1/settings`, { headers: { apikey: publishableKey } })
      if (!res.ok) throw new Error(`auth settings: ${res.status}`)
      return res.json()
    },
  })
}

// ── me ────────────────────────────────────────────────────────

export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['me', user?.id, 'profile'],
    enabled: !!user,
    queryFn: async () => maybe(await supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle()),
  })
}

/** The crew you're in. The schema allows several (D17); v0 shows one. */
export function useMyCrew() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['me', user?.id, 'crew'],
    enabled: !!user,
    queryFn: async () => {
      const row = maybe(
        await supabase
          .from('crew_members')
          .select('role, crew:crews(*)')
          .eq('profile_id', user!.id)
          .is('left_at', null)
          .order('joined_at')
          .limit(1)
          .maybeSingle(),
      )
      return row ? { role: row.role, crew: row.crew as Crew } : null
    },
  })
}

export function useSaveProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (p: { display_name: string; initials: string; avatar_color: string; isNew: boolean }) => {
      const fields = { display_name: p.display_name, initials: p.initials, avatar_color: p.avatar_color }
      if (p.isNew) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Stockholm'
        must(await supabase.from('profiles').insert({ id: user!.id, timezone, ...fields }))
      } else {
        must(await supabase.from('profiles').update(fields).eq('id', user!.id))
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

// ── crews ───────────────────────────────────────────────────

export function useCreateCrew() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => must(await supabase.rpc('create_crew', { p_name: name })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useJoinCrew() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => must(await supabase.rpc('join_crew', { p_code: code })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useLeaveCrew() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (crewId: string) => must(await supabase.rpc('leave_crew', { p_crew: crewId })),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useRegenerateCode(crewId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => must(await supabase.rpc('regenerate_invite_code', { p_crew: crewId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useMembers(crewId: string | undefined) {
  return useQuery({
    queryKey: ['crew', crewId, 'members'],
    enabled: !!crewId,
    queryFn: async () =>
      must(
        await supabase
          .from('crew_members')
          .select('role, joined_at, profile:profiles(id, display_name, initials, avatar_color)')
          .eq('crew_id', crewId!)
          .is('left_at', null)
          .order('joined_at'),
      ) as Member[],
  })
}

// ── numbers ───────────────────────────────────────────────────

export function useGlobalTotal() {
  return useQuery({
    queryKey: ['global'],
    queryFn: async () => must(await supabase.from('global_stats').select('total_beers').eq('id', 1).single()).total_beers,
  })
}

export function useCrewSummary(crewId: string | undefined) {
  return useQuery({
    queryKey: ['crew', crewId, 'summary'],
    enabled: !!crewId,
    queryFn: async () => must(await supabase.rpc('crew_summary', { p_crew: crewId! }))[0] ?? null,
  })
}

export function useProfileSummary(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile', profileId, 'summary'],
    enabled: !!profileId,
    queryFn: async () => must(await supabase.rpc('profile_summary', { p_profile: profileId! }))[0] ?? null,
  })
}

export function useLeaderboard(crewId: string | undefined) {
  return useQuery({
    queryKey: ['crew', crewId, 'leaderboard'],
    enabled: !!crewId,
    queryFn: async () => must(await supabase.rpc('crew_leaderboard', { p_crew: crewId! })),
  })
}

export function useFeed(crewId: string | undefined) {
  return useQuery({
    queryKey: ['crew', crewId, 'feed'],
    enabled: !!crewId,
    queryFn: async () =>
      must(await supabase.rpc('crew_feed', { p_crew: crewId!, p_limit: 40 })).map((n) => ({
        ...n,
        closed_at: n.closed_at as string | null,
        attendees: n.attendees as unknown as FeedAttendee[],
      })),
  })
}

// ── the night ─────────────────────────────────────────────────

/** The crew's open night. One past its closing time counts as over (D41). */
export function useOpenNight(crewId: string | undefined) {
  return useQuery({
    queryKey: ['crew', crewId, 'open-night'],
    enabled: !!crewId,
    queryFn: async () => {
      const night = maybe(
        await supabase
          .from('sessions')
          .select('*')
          .eq('crew_id', crewId!)
          .eq('status', 'open')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      )
      return night && new Date(night.closes_at).getTime() > Date.now() ? night : null
    },
  })
}

// Shared with the celebration host, which fetches a night's table to name who got what.
export const attendeesQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ['session', sessionId, 'attendees'],
    queryFn: async () =>
      must(
        await supabase
          .from('session_attendees')
          .select('profile_id, in_rounds, joined_at, profile:profiles(display_name, initials, avatar_color)')
          .eq('session_id', sessionId)
          .order('joined_at'),
      ) as Attendee[],
  })

export function useAttendees(sessionId: string | undefined) {
  return useQuery({ ...attendeesQuery(sessionId!), enabled: !!sessionId })
}

export function useLiveBeers(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId, 'beers'],
    enabled: !!sessionId,
    queryFn: async () =>
      must(
        await supabase
          .from('beers')
          .select('id, profile_id, added_by, round_id, logged_at, is_alcohol_free')
          .eq('session_id', sessionId!)
          .is('voided_at', null)
          .order('logged_at'),
      ) as LiveBeer[],
  })
}

export function useKickOff(crewId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (profileIds: string[]) => {
      const night = must(
        await supabase
          .from('sessions')
          .insert(stamped<'sessions'>([{ crew_id: crewId, created_by: user!.id } satisfies Stamped<'sessions', 'closes_at' | 'timezone'>]))
          .select('id')
          .single(),
      )
      // Whoever starts the night can set the table in one go (D41).
      const everyone = [user!.id, ...profileIds.filter((id) => id !== user!.id)]
      must(
        await supabase
          .from('session_attendees')
          .insert(stamped<'session_attendees'>(everyone.map((profile_id) => ({ session_id: night.id, profile_id })))),
      )
      return night.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crew', crewId] }),
  })
}

export function useAddAttendees(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (profileIds: string[]) =>
      must(
        await supabase
          .from('session_attendees')
          .insert(stamped<'session_attendees'>(profileIds.map((profile_id) => ({ session_id: sessionId, profile_id })))),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session', sessionId] }),
  })
}

export function useSetInRounds(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: { profileId: string; inRounds: boolean }) =>
      must(
        await supabase
          .from('session_attendees')
          .update({ in_rounds: v.inRounds })
          .eq('session_id', sessionId)
          .eq('profile_id', v.profileId),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['session', sessionId, 'attendees'] }),
  })
}

/**
 * Logs one beer per profile id — one for `+`, everyone at once for `+ ROUND` (a
 * shared round_id). The tally moves before the network answers; a refusal puts it
 * back. client_uuid makes a retried tap count once (D8).
 */
export function useLogBeers(sessionId: string, crewId: string) {
  const queryClient = useQueryClient()
  const key = ['session', sessionId, 'beers']
  return useMutation({
    mutationFn: async (v: { profileIds: string[]; rows: LiveBeer[] }) =>
      must(
        await supabase.from('beers').insert(
          stamped<'beers'>(v.rows.map((b) => ({
            session_id: sessionId,
            profile_id: b.profile_id,
            added_by: b.added_by,
            round_id: b.round_id,
            is_alcohol_free: b.is_alcohol_free,
            client_uuid: b.id,
          }))),
        ),
      ),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<LiveBeer[]>(key)
      queryClient.setQueryData<LiveBeer[]>(key, (old = []) => [...old, ...v.rows])
      return { before }
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(key, ctx?.before),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      void queryClient.invalidateQueries({ queryKey: ['global'] })
      // the tapper's own phone sees a Golden Goal even when Realtime is slow (D59)
      void queryClient.invalidateQueries({ queryKey: ['crew', crewId, 'milestones'] })
      void queryClient.invalidateQueries({ queryKey: ['milestones', 'global'] })
    },
  })
}

export function makeBeers(profileIds: string[], addedBy: string, round = false, alcoholFree = false): LiveBeer[] {
  const roundId = round ? uuid() : null
  const now = new Date().toISOString()
  return profileIds.map((profile_id) => ({
    id: uuid(),
    profile_id,
    added_by: addedBy,
    round_id: roundId,
    logged_at: now,
    is_alcohol_free: alcoholFree,
  }))
}

/** "−": voids that person's most recent live beer tonight (D28). */
export function useTakeBack(sessionId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = ['session', sessionId, 'beers']
  return useMutation({
    mutationFn: async (beer: LiveBeer) => {
      // A beer still in flight has only its client_uuid; match on that too.
      const updated = must(
        await supabase
          .from('beers')
          .update({ voided_at: new Date().toISOString(), voided_by: user!.id })
          .or(`id.eq.${beer.id},client_uuid.eq.${beer.id}`)
          .select('id'),
      )
      if (updated.length === 0) throw new Error('nothing to take back')
    },
    onMutate: async (beer) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<LiveBeer[]>(key)
      queryClient.setQueryData<LiveBeer[]>(key, (old = []) => old.filter((b) => b.id !== beer.id))
      return { before }
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(key, ctx?.before),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      void queryClient.invalidateQueries({ queryKey: ['global'] })
    },
  })
}

export function useCloseNight(crewId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => must(await supabase.rpc('close_session', { p_session: sessionId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crew', crewId] }),
  })
}

// ── milestones (C9, C12, G5) ──────────────────────────────────

// Who scored and who assisted come through the profiles embed, which RLS limits to
// crew-mates: a global rung scored by another crew arrives without names (D61).
const EVENT_COLUMNS = `id, scope, scope_id, threshold, crew_id, session_id, round_id, profile_id,
  added_by, crossed_at, backfilled, rung:milestones(tier),
  scorer:profiles!milestone_events_profile_id_fkey(display_name, initials, avatar_color),
  assist:profiles!milestone_events_added_by_fkey(display_name, initials, avatar_color)`

type LadderRow = { threshold: number; kind: string; scopes: string[] }
const crewRungs = (rows: LadderRow[]) =>
  rows.filter((m) => m.kind === 'rung' && m.scopes.includes('crew')).map((m) => m.threshold)

/** The crew's rungs (D54). The whole ladder is 18 rows, fetched once a session. */
export function useCrewRungs() {
  return useQuery({
    queryKey: ['milestones', 'ladder'],
    staleTime: Infinity,
    queryFn: async () => must(await supabase.from('milestones').select('threshold, kind, scopes').order('threshold')),
    select: crewRungs,
  })
}

/** The crew's rungs crossed, plus the global ones its members scored. Newest first. */
export function useCrewMilestones(crewId: string | undefined) {
  return useQuery({
    queryKey: ['crew', crewId, 'milestones'],
    enabled: !!crewId,
    queryFn: async () =>
      must(
        await supabase
          .from('milestone_events')
          .select(EVENT_COLUMNS)
          .eq('crew_id', crewId!)
          .in('scope', ['crew', 'global'])
          .order('crossed_at', { ascending: false })
          .order('threshold', { ascending: false }),
      ) as unknown as MilestoneEvent[],
  })
}

/** The latest global rungs, whoever scored them. */
export function useGlobalMilestones() {
  return useQuery({
    queryKey: ['milestones', 'global'],
    queryFn: async () =>
      must(
        await supabase
          .from('milestone_events')
          .select(EVENT_COLUMNS)
          .eq('scope', 'global')
          .order('crossed_at', { ascending: false })
          .limit(20),
      ) as unknown as MilestoneEvent[],
  })
}

/** A person's own rungs, the 67 and 69 eggs included. Lowest first. */
export function useMyMilestones(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile', profileId, 'milestones'],
    enabled: !!profileId,
    queryFn: async () =>
      must(
        await supabase
          .from('milestone_events')
          .select(EVENT_COLUMNS)
          .eq('scope', 'profile')
          .eq('scope_id', profileId!)
          .order('threshold'),
      ) as unknown as MilestoneEvent[],
  })
}

// ── badges and combos (G1–G4) ─────────────────────────────────

export type BadgeTier = 'person' | 'crew'
export type BadgeArt = {
  glyph?: string
  text?: string
  metal?: 'tin' | 'brass' | 'gold' | 'foil'
  finish?: 'print' | 'emboss' | 'foil' | 'framed'
  accent?: 'gold' | 'fire' | 'hop'
}
type CatalogueRow = Database['public']['Functions']['achievement_catalogue']['Returns'][number]
/** A catalogue entry. A secret's title, description, flavor, target and art come back
 *  empty until you can see someone's unlock of it (D66). */
export type Badge = Omit<CatalogueRow, 'art' | 'tier'> & { tier: BadgeTier; art: BadgeArt }
export type Unlock = Pick<Tables<'achievement_unlocks'>, 'achievement_code' | 'unlocked_at' | 'created_at' | 'session_id' | 'crew_id'>
export type UnlockRow = Tables<'achievement_unlocks'>
export type ComboRow = Tables<'session_combos'>
export type BadgeProgress = { code: string; progress: number; target: number }

// Invalidated by every unlock: a crew-mate's unlock can reveal a secret's name.
export const catalogueQuery = queryOptions({
  queryKey: ['badges', 'catalogue'],
  staleTime: 5 * 60_000,
  queryFn: async () => must(await supabase.rpc('achievement_catalogue')) as unknown as Badge[],
})

export const useBadgeCatalogue = () => useQuery(catalogueQuery)

const UNLOCK_COLUMNS = 'achievement_code, unlocked_at, created_at, session_id, crew_id'

export function useProfileBadges(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile', profileId, 'badges'],
    enabled: !!profileId,
    queryFn: async () =>
      must(
        await supabase.from('achievement_unlocks').select(UNLOCK_COLUMNS).eq('tier', 'person').eq('profile_id', profileId!),
      ) as Unlock[],
  })
}

export function useCrewBadges(crewId: string | undefined) {
  return useQuery({
    queryKey: ['crew', crewId, 'badges'],
    enabled: !!crewId,
    queryFn: async () =>
      must(await supabase.from('achievement_unlocks').select(UNLOCK_COLUMNS).eq('tier', 'crew').eq('crew_id', crewId!)) as Unlock[],
  })
}

/** Progress for showing up, giving, driving, streaks and the squad only; never toward a
 *  beer count or a night's total (D68). */
export function useProfileBadgeProgress(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile', profileId, 'badge-progress'],
    enabled: !!profileId,
    queryFn: async () =>
      must(await supabase.rpc('profile_achievement_progress', { p_profile: profileId! })) as BadgeProgress[],
  })
}

export function useCrewBadgeProgress(crewId: string | undefined) {
  return useQuery({
    queryKey: ['crew', crewId, 'badge-progress'],
    enabled: !!crewId,
    queryFn: async () => must(await supabase.rpc('crew_achievement_progress', { p_crew: crewId! })) as BadgeProgress[],
  })
}

/** The rungs tonight has reached: the stamps under the tally. */
export function useSessionCombos(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId, 'combos'],
    enabled: !!sessionId,
    queryFn: async () =>
      must(
        await supabase
          .from('session_combos')
          .select('achievement_code, reached_at')
          .eq('session_id', sessionId!)
          .order('reached_at'),
      ),
  })
}

/** Every rung every night of the crew has reached: the feed's stamps. */
export function useCrewCombos(crewId: string | undefined) {
  return useQuery({
    queryKey: ['crew', crewId, 'combos'],
    enabled: !!crewId,
    queryFn: async () =>
      must(await supabase.from('session_combos').select('session_id, achievement_code').eq('crew_id', crewId!)),
  })
}
