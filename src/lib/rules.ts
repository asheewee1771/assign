import type { ReviewRequest, RequestStatus, Reviewer } from './types'

/**
 * The rules, as pure functions.
 *
 * These drive the UI (enabling buttons, explaining refusals). They are NOT the
 * enforcement point: the database holds the same constraints independently, so
 * a bug here cannot corrupt data. See supabase/schema.sql.
 */

export type Refusal = string | null

/** null means allowed; a string is the reason it isn't. */
export function canVolunteerFirst(
  request: ReviewRequest,
  reviewerId: string | null,
): Refusal {
  if (!reviewerId) return 'Pick your name first'
  if (request.status === 'completed') return 'This request is completed'
  if (request.first_reviewer_id) return '1st reviewer is already taken'
  if (request.second_reviewer_id === reviewerId) {
    return 'You are already the 2nd reviewer'
  }
  return null
}

export function canWithdrawFirst(
  request: ReviewRequest,
  reviewerId: string | null,
): Refusal {
  if (!reviewerId) return 'Pick your name first'
  if (request.status === 'completed') return 'This request is completed'
  if (request.first_reviewer_id !== reviewerId) return 'You are not the 1st reviewer'
  return null
}

/** POC-only. The same-person rule applies whichever slot is being filled. */
export function canAssign(
  request: ReviewRequest,
  slot: 'first' | 'second',
  reviewerId: string,
): Refusal {
  if (request.status === 'completed') return 'This request is completed'
  const other =
    slot === 'first' ? request.second_reviewer_id : request.first_reviewer_id
  if (other === reviewerId) return '1st and 2nd reviewer must be different people'
  return null
}

export function canStartReview(request: ReviewRequest): Refusal {
  if (request.status === 'completed') return 'This request is completed'
  if (request.status === 'in_review') return 'Review already started'
  if (!request.first_reviewer_id || !request.second_reviewer_id) {
    return 'Both reviewers must be assigned first'
  }
  return null
}

/** Honour-system ownership — a convention for a trusted team, not a control. */
export function canRemove(request: ReviewRequest, name: string | null): Refusal {
  if (!name) return 'Pick your name first'
  if (request.created_by !== name) return 'Only the person who filed it can remove it'
  return null
}

/** Status implied by the reviewer slots. Mirrors what the RPCs set server-side. */
export function derivedStatus(request: ReviewRequest): RequestStatus {
  if (request.status === 'completed' || request.status === 'in_review') {
    return request.status
  }
  return request.first_reviewer_id && request.second_reviewer_id ? 'assigned' : 'new'
}

/** Reviewers eligible for a slot: active, and not already in the other slot. */
export function eligibleReviewers(
  reviewers: readonly Reviewer[],
  request: ReviewRequest,
  slot: 'first' | 'second',
): Reviewer[] {
  const other =
    slot === 'first' ? request.second_reviewer_id : request.first_reviewer_id
  return reviewers.filter((r) => r.active && r.id !== other)
}

export function reviewerName(
  reviewers: readonly Reviewer[],
  id: string | null,
): string {
  if (!id) return 'Unassigned'
  return reviewers.find((r) => r.id === id)?.name ?? 'Unknown'
}
