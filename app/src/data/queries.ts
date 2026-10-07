import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthProvider'
import type { Database, Tables, TablesInsert } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { uuid } from '@/lib/uuid'

// Every read and write the screens make. Reads go straight at the tables and the
// read functions; RLS decides what comes back (D39). Party-scoped keys all start
// with ['party', id] so one realtime event can refresh a whole party at once.

export type Profile = Tables<'profiles'>
export type Party = Tables<'parties'>
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

export type LiveBeer = { id: string; profile_id: string; added_by: string; round_id: string | null; logged_at: string }

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

// party_id, closes_at and timezone are NOT NULL with no default, so the generated
// Insert types demand them — but BEFORE triggers stamp them, and clients aren't even
// granted those columns (D39). Inserts leave them out; these say so to the compiler.
type TableName = keyof Database['public']['Tables']
type Stamped<T extends TableName, K extends string> = Omit<TablesInsert<T>, K>
const stamped = <T extends TableName>(rows: unknown) => rows as TablesInsert<T>[]

// ── me ────────────────────────────────────────────────────────

export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['me', user?.id, 'profile'],
    enabled: !!user,
    queryFn: async () => maybe(await supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle()),
  })
}

/** The party you're in. The schema allows several (D17); v0 shows one. */
export function useMyParty() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['me', user?.id, 'party'],
    enabled: !!user,
    queryFn: async () => {
      const row = maybe(
        await supabase
          .from('party_members')
          .select('role, party:parties(*)')
          .eq('profile_id', user!.id)
          .is('left_at', null)
          .order('joined_at')
          .limit(1)
          .maybeSingle(),
      )
      return row ? { role: row.role, party: row.party as Party } : null
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

// ── parties ───────────────────────────────────────────────────

export function useCreateParty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => must(await supabase.rpc('create_party', { p_name: name })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useJoinParty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => must(await supabase.rpc('join_party', { p_code: code })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useLeaveParty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (partyId: string) => must(await supabase.rpc('leave_party', { p_party: partyId })),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useRegenerateCode(partyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => must(await supabase.rpc('regenerate_invite_code', { p_party: partyId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useMembers(partyId: string | undefined) {
  return useQuery({
    queryKey: ['party', partyId, 'members'],
    enabled: !!partyId,
    queryFn: async () =>
      must(
        await supabase
          .from('party_members')
          .select('role, joined_at, profile:profiles(id, display_name, initials, avatar_color)')
          .eq('party_id', partyId!)
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

export function usePartySummary(partyId: string | undefined) {
  return useQuery({
    queryKey: ['party', partyId, 'summary'],
    enabled: !!partyId,
    queryFn: async () => must(await supabase.rpc('party_summary', { p_party: partyId! }))[0] ?? null,
  })
}

export function useProfileSummary(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile', profileId, 'summary'],
    enabled: !!profileId,
    queryFn: async () => must(await supabase.rpc('profile_summary', { p_profile: profileId! }))[0] ?? null,
  })
}

export function useLeaderboard(partyId: string | undefined) {
  return useQuery({
    queryKey: ['party', partyId, 'leaderboard'],
    enabled: !!partyId,
    queryFn: async () => must(await supabase.rpc('party_leaderboard', { p_party: partyId! })),
  })
}

export function useFeed(partyId: string | undefined) {
  return useQuery({
    queryKey: ['party', partyId, 'feed'],
    enabled: !!partyId,
    queryFn: async () =>
      must(await supabase.rpc('party_feed', { p_party: partyId!, p_limit: 40 })).map((n) => ({
        ...n,
        closed_at: n.closed_at as string | null,
        attendees: n.attendees as unknown as FeedAttendee[],
      })),
  })
}

// ── the night ─────────────────────────────────────────────────

/** The party's open night. One past its closing time counts as over (D41). */
export function useOpenNight(partyId: string | undefined) {
  return useQuery({
    queryKey: ['party', partyId, 'open-night'],
    enabled: !!partyId,
    queryFn: async () => {
      const night = maybe(
        await supabase
          .from('sessions')
          .select('*')
          .eq('party_id', partyId!)
          .eq('status', 'open')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      )
      return night && new Date(night.closes_at).getTime() > Date.now() ? night : null
    },
  })
}

export function useAttendees(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId, 'attendees'],
    enabled: !!sessionId,
    queryFn: async () =>
      must(
        await supabase
          .from('session_attendees')
          .select('profile_id, in_rounds, joined_at, profile:profiles(display_name, initials, avatar_color)')
          .eq('session_id', sessionId!)
          .order('joined_at'),
      ) as Attendee[],
  })
}

export function useLiveBeers(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId, 'beers'],
    enabled: !!sessionId,
    queryFn: async () =>
      must(
        await supabase
          .from('beers')
          .select('id, profile_id, added_by, round_id, logged_at')
          .eq('session_id', sessionId!)
          .is('voided_at', null)
          .order('logged_at'),
      ) as LiveBeer[],
  })
}

export function useKickOff(partyId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (profileIds: string[]) => {
      const night = must(
        await supabase
          .from('sessions')
          .insert(stamped<'sessions'>([{ party_id: partyId, created_by: user!.id } satisfies Stamped<'sessions', 'closes_at' | 'timezone'>]))
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['party', partyId] }),
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
export function useLogBeers(sessionId: string) {
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
    },
  })
}

export function makeBeers(profileIds: string[], addedBy: string, round = false): LiveBeer[] {
  const roundId = round ? uuid() : null
  const now = new Date().toISOString()
  return profileIds.map((profile_id) => ({ id: uuid(), profile_id, added_by: addedBy, round_id: roundId, logged_at: now }))
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

export function useCloseNight(partyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => must(await supabase.rpc('close_session', { p_session: sessionId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['party', partyId] }),
  })
}
