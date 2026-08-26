import { client } from './supabase'
import type { RequestType, ReviewRequest, Reviewer } from './types'

/**
 * Every mutation goes through a database function. Row level security denies
 * direct UPDATE/DELETE, so this module is the whole write surface.
 */

/** Postgres errors arrive with a `message`; surface it rather than swallowing. */
function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

export async function fetchReviewers(): Promise<Reviewer[]> {
  const { data, error } = await client()
    .from('reviewers')
    .select('*')
    .order('name')
  fail(error)
  return data ?? []
}

export async function fetchRequests(): Promise<ReviewRequest[]> {
  const { data, error } = await client()
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false })
  fail(error)
  return data ?? []
}

export async function createRequest(input: {
  type: RequestType
  title: string
  description: string
  createdBy: string
}): Promise<void> {
  const { error } = await client().from('requests').insert({
    type: input.type,
    title: input.title,
    description: input.description,
    created_by: input.createdBy,
  })
  fail(error)
}

export async function volunteerFirst(requestId: string, reviewerId: string): Promise<void> {
  const { error } = await client().rpc('volunteer_first', {
    p_request: requestId,
    p_reviewer: reviewerId,
  })
  fail(error)
}

export async function withdrawFirst(requestId: string, reviewerId: string): Promise<void> {
  const { error } = await client().rpc('withdraw_first', {
    p_request: requestId,
    p_reviewer: reviewerId,
  })
  fail(error)
}

export async function startReview(requestId: string): Promise<void> {
  const { error } = await client().rpc('start_review', { p_request: requestId })
  fail(error)
}

export async function removeOwnRequest(requestId: string, name: string): Promise<void> {
  const { error } = await client().rpc('remove_own_request', {
    p_request: requestId,
    p_name: name,
  })
  fail(error)
}

// ---------------------------------------------------------------- POC actions
// The password is verified server-side; sending it here is what authorises the call.

export async function verifyPoc(password: string): Promise<boolean> {
  const { data, error } = await client().rpc('verify_poc', { p_password: password })
  fail(error)
  return data === true
}

export async function pocAssign(
  requestId: string,
  slot: 'first' | 'second',
  reviewerId: string | null,
  password: string,
): Promise<void> {
  const { error } = await client().rpc('poc_assign_reviewer', {
    p_request: requestId,
    p_slot: slot,
    p_reviewer: reviewerId,
    p_password: password,
  })
  fail(error)
}

export async function pocComplete(requestId: string, password: string): Promise<void> {
  const { error } = await client().rpc('poc_complete_request', {
    p_request: requestId,
    p_password: password,
  })
  fail(error)
}

export async function pocRemove(requestId: string, password: string): Promise<void> {
  const { error } = await client().rpc('poc_remove_request', {
    p_request: requestId,
    p_password: password,
  })
  fail(error)
}

export async function pocAddReviewer(name: string, password: string): Promise<void> {
  const { error } = await client().rpc('poc_add_reviewer', {
    p_name: name,
    p_password: password,
  })
  fail(error)
}

export async function pocDeactivateReviewer(
  reviewerId: string,
  password: string,
): Promise<void> {
  const { error } = await client().rpc('poc_deactivate_reviewer', {
    p_reviewer: reviewerId,
    p_password: password,
  })
  fail(error)
}
