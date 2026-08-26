export type RequestType = 'V' | 'T'
export type RequestStatus = 'new' | 'assigned' | 'in_review' | 'completed'

export interface Reviewer {
  id: string
  name: string
  active: boolean
  created_at: string
}

export interface ReviewRequest {
  id: string
  type: RequestType
  title: string
  description: string
  /** Type-specific fields, added later without a schema migration. */
  details: Record<string, unknown>
  created_by: string
  status: RequestStatus
  first_reviewer_id: string | null
  second_reviewer_id: string | null
  created_at: string
  completed_at: string | null
}

export const REQUEST_TYPES: readonly RequestType[] = ['V', 'T']

export const TYPE_LABELS: Record<RequestType, string> = {
  V: 'V',
  T: 'T',
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_review: 'In review',
  completed: 'Completed',
}

export const STATUS_ORDER: readonly RequestStatus[] = [
  'new',
  'assigned',
  'in_review',
  'completed',
]
