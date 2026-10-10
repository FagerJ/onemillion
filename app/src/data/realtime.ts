import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// C11: when anyone at the table taps, every phone in the crew refreshes. Realtime
// applies each subscriber's RLS to every change, so a crew only hears itself.
// Rather than patching caches event by event, an event just marks the crew's
// queries stale — the refetch is small and can never drift from the database.
export function useCrewRealtime(crewId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!crewId) return
    const refreshCrew = () => {
      void queryClient.invalidateQueries({ queryKey: ['crew', crewId] })
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    }
    const filter = `crew_id=eq.${crewId}`
    const channel = supabase
      .channel(`crew:${crewId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'beers', filter }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_attendees', filter }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter }, refreshCrew)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_stats' }, () =>
        queryClient.invalidateQueries({ queryKey: ['global'] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [crewId, queryClient])
}
