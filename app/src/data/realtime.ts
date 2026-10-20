import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { celebrate } from '@/components/celebrate/bus'
import { queue } from '@/data/queue'
import type { ComboRow, UnlockRow } from '@/data/queries'
import { supabase } from '@/lib/supabase'

// C11: when anyone at the table taps, every phone in the crew refreshes. Realtime
// applies each subscriber's RLS to every change, so a crew only hears itself.
// Rather than patching caches event by event, an event just marks the crew's
// queries stale — the refetch is small and can never drift from the database.
export function useCrewRealtime(crewId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!crewId) return
    // A replayed batch from the queue is many events at once: one refetch for all of them.
    let t: ReturnType<typeof setTimeout> | undefined
    const refreshCrew = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['crew', crewId] })
        void queryClient.invalidateQueries({ queryKey: ['session'] })
        void queryClient.invalidateQueries({ queryKey: ['profile'] })
      }, 150)
    }
    // Events from before the channel joined are never sent: the crew may have changed since
    // its data was fetched, or since the snapshot the app opened on (D76). So every join
    // refetches the crew once, and a rejoin after a drop also nudges the queue: it is the
    // surest sign the signal is back (C8).
    let joined = false
    let dropped = false
    const filter = `crew_id=eq.${crewId}`
    const channel = supabase
      .channel(`crew:${crewId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beers', filter }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_attendees', filter }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_stats' }, () =>
        queryClient.invalidateQueries({ queryKey: ['global'] }),
      )
      // A Golden Goal at this table (G5). The beer in the same transaction already
      // refreshes the crew; this is belt and braces.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'milestone_events', filter }, refreshCrew)
      // Global rungs come from every crew, so they can't be filtered by this one.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'milestone_events', filter: 'scope=eq.global' },
        () => queryClient.invalidateQueries({ queryKey: ['milestones', 'global'] }),
      )
      // G4: a night reaching a rung, and badges unlocking. Only live unlocks celebrate (D65);
      // a sweep or backfill row just refreshes the grids.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_combos', filter }, (p) => {
        const row = p.new as ComboRow
        void queryClient.invalidateQueries({ queryKey: ['session', row.session_id, 'combos'] })
        void queryClient.invalidateQueries({ queryKey: ['crew', crewId, 'combos'] })
        celebrate({ kind: 'combo', row })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'achievement_unlocks', filter }, (p) => {
        const row = p.new as UnlockRow
        void queryClient.invalidateQueries({ queryKey: ['badges'] }) // a secret may now be revealed
        void queryClient.invalidateQueries({
          queryKey: row.tier === 'crew' ? ['crew', crewId, 'badges'] : ['profile', row.profile_id, 'badges'],
        })
        if (row.source === 'live') celebrate({ kind: 'unlock', row })
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          refreshCrew()
          if (joined && dropped) void queue.kick(true)
          joined = true
          dropped = false
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') dropped = true
      })
    return () => {
      clearTimeout(t)
      void supabase.removeChannel(channel)
    }
  }, [crewId, queryClient])
}
