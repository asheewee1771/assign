import { useState } from 'react'

import { createRequest } from '../lib/api'
import { REQUEST_TYPES, type RequestType } from '../lib/types'

interface Props {
  name: string
  onCreated: () => void
}

export function NewRequestForm({ name, onCreated }: Props) {
  const [type, setType] = useState<RequestType>('V')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim() !== '' && title.trim() !== '' && !busy

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await createRequest({
        type,
        title: title.trim(),
        description: description.trim(),
        createdBy: name.trim(),
      })
      setTitle('')
      setDescription('')
      onCreated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card newreq" onSubmit={submit}>
      <h2>File a request</h2>
      <div className="row">
        <div className="types">
          {REQUEST_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={t === type ? 'chip chip--on' : 'chip'}
              onClick={() => setType(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          className="grow"
          value={title}
          placeholder="What needs reviewing?"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <textarea
        value={description}
        placeholder="Any detail reviewers will need (optional)"
        rows={2}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="row row--end">
        {name.trim() === '' && <span className="hint">Enter your name above first</span>}
        <button type="submit" disabled={!canSubmit}>
          {busy ? 'Filing…' : 'File request'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
