import { useCallback, useEffect, useState } from 'react'

import { fetchRequests, fetchReviewers } from '../lib/api'
import { isConfigured, supabase } from '../lib/supabase'
import type { ReviewRequest, Reviewer } from '../lib/types'

/**
 * A bad URL, a paused free-tier project, or no connection all surface as an
 * opaque "Failed to fetch". Say something the reader can act on instead.
 */
function describeLoadFailure(cause: unknown): string {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  if (offline) return 'You appear to be offline.'
  if (cause instanceof Error) {
    if (cause.name === 'TimeoutError' || cause.name === 'AbortError') {
      return 'Supabase did not respond. If the project is on the free tier it may be paused — open the dashboard to wake it.'
    }
    if (cause.message.includes('Failed to fetch')) {
      return 'Could not reach Supabase. Check VITE_SUPABASE_URL in .env, and that the project is running.'
    }
    return cause.message
  }
  return String(cause)
}

interface TrackerState {
  requests: ReviewRequest[]
  reviewers: Reviewer[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Loads requests and reviewers, and subscribes to changes so the POC assigning
 * someone shows up on everyone else's screen without a refresh.
 */
export function useTracker(): TrackerState {
  const [requests, setRequests] = useState<ReviewRequest[]>([])
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [loading, setLoading] = useState(isConfigured)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!isConfigured) return
    try {
      const [nextRequests, nextReviewers] = await Promise.all([
        fetchRequests(),
        fetchReviewers(),
      ])
      setRequests(nextRequests)
      setReviewers(nextReviewers)
      setError(null)
    } catch (cause) {
      setError(describeLoadFailure(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetching from an external system is exactly what effects are for; the
    // setState calls inside reload() happen after an await, not synchronously.
    // eslint-disable-next-line react/set-state-in-effect
    void reload()
  }, [reload])

  useEffect(() => {
    // Capture the module binding so it stays narrowed inside the cleanup closure.
    const sb = supabase
    if (!sb) return
    const channel = sb
      .channel('tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        void reload()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviewers' }, () => {
        void reload()
      })
      .subscribe()
    return () => {
      void sb.removeChannel(channel)
    }
  }, [reload])

  return { requests, reviewers, loading, error, reload }
}
