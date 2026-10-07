import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// C11: when anyone at the table taps, every phone in the party refreshes. Realtime
// applies each subscriber's RLS to every change, so a party only hears itself.
// Rather than patching caches event by event, an event just marks the party's
// queries stale — the refetch is small and can never drift from the database.
export function usePartyRealtime(partyId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!partyId) return
    const refreshParty = () => {
      void queryClient.invalidateQueries({ queryKey: ['party', partyId] })
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    }
    const filter = `party_id=eq.${partyId}`
    const channel = supabase
      .channel(`party:${partyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beers', filter }, refreshParty)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_attendees', filter }, refreshParty)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter }, refreshParty)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_stats' }, () =>
        queryClient.invalidateQueries({ queryKey: ['global'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [partyId, queryClient])
}
