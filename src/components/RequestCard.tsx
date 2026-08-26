import { useState } from 'react'

import {
  pocAssign,
  pocComplete,
  pocRemove,
  removeOwnRequest,
  startReview,
  volunteerFirst,
  withdrawFirst,
} from '../lib/api'
import {
  canRemove,
  canStartReview,
  canVolunteerFirst,
  canWithdrawFirst,
  eligibleReviewers,
  reviewerName,
} from '../lib/rules'
import { STATUS_LABELS, type ReviewRequest, type Reviewer } from '../lib/types'

interface Props {
  request: ReviewRequest
  reviewers: Reviewer[]
  name: string
  pocPassword: string | null
  onChanged: () => void
}

export function RequestCard({ request, reviewers, name, pocPassword, onChanged }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const me = reviewers.find((r) => r.name === name.trim() && r.active) ?? null
  const isPoc = pocPassword !== null

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  const volunteerRefusal = canVolunteerFirst(request, me?.id ?? null)
  const withdrawRefusal = canWithdrawFirst(request, me?.id ?? null)
  const startRefusal = canStartReview(request)
  const removeRefusal = canRemove(request, name.trim() || null)

  return (
    <li className={`card req req--${request.status}`}>
      <div className="req__head">
        <span className={`type type--${request.type}`}>{request.type}</span>
        <h3>{request.title}</h3>
        <span className={`status status--${request.status}`}>
          {STATUS_LABELS[request.status]}
        </span>
      </div>

      {request.description && <p className="req__desc">{request.description}</p>}

      <p className="req__meta">
        Filed by <strong>{request.created_by}</strong>
      </p>

      <div className="slots">
        <div className="slot">
          <span className="slot__label">1st reviewer</span>
          <span className="slot__value">
            {reviewerName(reviewers, request.first_reviewer_id)}
          </span>
          {!request.first_reviewer_id && !volunteerRefusal && (
            <button
              disabled={busy}
              onClick={() => run(() => volunteerFirst(request.id, me!.id))}
            >
              Volunteer
            </button>
          )}
          {request.first_reviewer_id === me?.id && !withdrawRefusal && (
            <button
              className="ghost"
              disabled={busy}
              onClick={() => run(() => withdrawFirst(request.id, me.id))}
            >
              Step down
            </button>
          )}
          {isPoc && request.status !== 'completed' && (
            <SlotPicker
              reviewers={eligibleReviewers(reviewers, request, 'first')}
              current={request.first_reviewer_id}
              disabled={busy}
              onPick={(id) => run(() => pocAssign(request.id, 'first', id, pocPassword))}
            />
          )}
        </div>

        <div className="slot">
          <span className="slot__label">2nd reviewer</span>
          <span className="slot__value">
            {reviewerName(reviewers, request.second_reviewer_id)}
          </span>
          {isPoc && request.status !== 'completed' ? (
            <SlotPicker
              reviewers={eligibleReviewers(reviewers, request, 'second')}
              current={request.second_reviewer_id}
              disabled={busy}
              onPick={(id) => run(() => pocAssign(request.id, 'second', id, pocPassword))}
            />
          ) : (
            !request.second_reviewer_id && <span className="hint">POC assigns this</span>
          )}
        </div>
      </div>

      <div className="req__actions">
        {!startRefusal && (
          <button disabled={busy} onClick={() => run(() => startReview(request.id))}>
            Start review
          </button>
        )}
        {!removeRefusal && (
          <button
            className="ghost danger"
            disabled={busy}
            onClick={() => run(() => removeOwnRequest(request.id, name.trim()))}
          >
            Remove
          </button>
        )}
        {isPoc && request.status !== 'completed' && (
          <button disabled={busy} onClick={() => run(() => pocComplete(request.id, pocPassword))}>
            Mark completed
          </button>
        )}
        {isPoc && (
          <button
            className="ghost danger"
            disabled={busy}
            onClick={() => run(() => pocRemove(request.id, pocPassword))}
          >
            Remove (POC)
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
    </li>
  )
}

function SlotPicker({
  reviewers,
  current,
  disabled,
  onPick,
}: {
  reviewers: Reviewer[]
  current: string | null
  disabled: boolean
  onPick: (id: string | null) => void
}) {
  return (
    <select
      className="poc-pick"
      value={current ?? ''}
      disabled={disabled}
      onChange={(e) => onPick(e.target.value || null)}
    >
      <option value="">— unassigned —</option>
      {reviewers.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  )
}
