import { useState } from 'react'

import { pocAddReviewer, pocDeactivateReviewer, verifyPoc } from '../lib/api'
import type { Reviewer } from '../lib/types'

interface Props {
  reviewers: Reviewer[]
  pocPassword: string | null
  onUnlock: (password: string | null) => void
  onChanged: () => void
}

/**
 * The password is verified server-side by verify_poc, and sent again with every
 * POC action. It is kept in memory only — never localStorage — so closing the
 * tab drops it.
 */
export function PocPanel({ reviewers, pocPassword, onUnlock, onChanged }: Props) {
  const [password, setPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function unlock(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (await verifyPoc(password)) {
        onUnlock(password)
        setPassword('')
      } else {
        setError('Incorrect POC password')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function addReviewer(event: React.FormEvent) {
    event.preventDefault()
    if (!pocPassword || newName.trim() === '') return
    setBusy(true)
    setError(null)
    try {
      await pocAddReviewer(newName.trim(), pocPassword)
      setNewName('')
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function deactivate(id: string) {
    if (!pocPassword) return
    setBusy(true)
    setError(null)
    try {
      await pocDeactivateReviewer(id, pocPassword)
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  if (!pocPassword) {
    return (
      <form className="card poc" onSubmit={unlock}>
        <h2>POC</h2>
        <div className="row">
          <input
            className="grow"
            type="password"
            value={password}
            placeholder="POC password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={busy || password === ''}>
            Unlock
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
    )
  }

  const active = reviewers.filter((r) => r.active)
  const inactive = reviewers.filter((r) => !r.active)

  return (
    <section className="card poc poc--on">
      <div className="row row--between">
        <h2>POC · unlocked</h2>
        <button className="ghost" onClick={() => onUnlock(null)}>
          Lock
        </button>
      </div>

      <p className="hint">
        You can assign the 2nd reviewer, mark requests completed, and remove any
        request. Controls appear on each card.
      </p>

      <h3>Reviewers ({active.length})</h3>
      <ul className="roster">
        {active.map((r) => (
          <li key={r.id}>
            <span>{r.name}</span>
            <button className="ghost danger" disabled={busy} onClick={() => deactivate(r.id)}>
              Remove
            </button>
          </li>
        ))}
        {active.length === 0 && <li className="hint">No reviewers yet — add some below.</li>}
      </ul>

      {inactive.length > 0 && (
        <p className="hint">
          {inactive.length} removed reviewer(s) kept for history: {' '}
          {inactive.map((r) => r.name).join(', ')}
        </p>
      )}

      <form className="row" onSubmit={addReviewer}>
        <input
          className="grow"
          value={newName}
          placeholder="Add a reviewer"
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" disabled={busy || newName.trim() === ''}>
          Add
        </button>
      </form>

      {error && <p className="error">{error}</p>}
    </section>
  )
}
