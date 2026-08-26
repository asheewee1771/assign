import { useMemo, useState } from 'react'

import { NewRequestForm } from './components/NewRequestForm'
import { PocPanel } from './components/PocPanel'
import { RequestCard } from './components/RequestCard'
import { SetupNotice } from './components/SetupNotice'
import { WhoAmI } from './components/WhoAmI'
import { useTracker } from './hooks/useTracker'
import { isConfigured } from './lib/supabase'
import { REQUEST_TYPES, STATUS_LABELS, STATUS_ORDER } from './lib/types'
import type { RequestStatus, RequestType } from './lib/types'
import './App.css'

const NAME_KEY = 'assign.name'

function storedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function App() {
  const { requests, reviewers, loading, error, reload } = useTracker()
  const [name, setName] = useState(storedName)
  // Kept in memory only, so closing the tab drops POC access.
  const [pocPassword, setPocPassword] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<RequestType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'open'>('open')

  function changeName(next: string) {
    setName(next)
    try {
      localStorage.setItem(NAME_KEY, next)
    } catch {
      // Private browsing — the name just won't persist.
    }
  }

  const visible = useMemo(
    () =>
      requests.filter((r) => {
        if (typeFilter !== 'all' && r.type !== typeFilter) return false
        if (statusFilter === 'open') return r.status !== 'completed'
        return r.status === statusFilter
      }),
    [requests, typeFilter, statusFilter],
  )

  if (!isConfigured) {
    return (
      <main>
        <header>
          <h1>assign</h1>
        </header>
        <SetupNotice />
      </main>
    )
  }

  return (
    <main>
      <header>
        <h1>assign</h1>
        <WhoAmI reviewers={reviewers} name={name} onChange={changeName} />
      </header>

      {error && <p className="error card">{error}</p>}

      <NewRequestForm name={name} onCreated={reload} />

      <div className="filters">
        <div className="types">
          <button
            className={typeFilter === 'all' ? 'chip chip--on' : 'chip'}
            onClick={() => setTypeFilter('all')}
          >
            All
          </button>
          {REQUEST_TYPES.map((t) => (
            <button
              key={t}
              className={typeFilter === t ? 'chip chip--on' : 'chip'}
              onClick={() => setTypeFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'open')}
        >
          <option value="open">Open</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="hint">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="hint card">No requests here yet.</p>
      ) : (
        <ul className="requests">
          {visible.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              reviewers={reviewers}
              name={name}
              pocPassword={pocPassword}
              onChanged={reload}
            />
          ))}
        </ul>
      )}

      <PocPanel
        reviewers={reviewers}
        pocPassword={pocPassword}
        onUnlock={setPocPassword}
        onChanged={reload}
      />
    </main>
  )
}
