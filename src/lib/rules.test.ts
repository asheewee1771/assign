import { describe, expect, it } from 'vitest'

import {
  canAssign,
  canRemove,
  canStartReview,
  canVolunteerFirst,
  canWithdrawFirst,
  derivedStatus,
  eligibleReviewers,
  reviewerName,
} from './rules'
import type { ReviewRequest, Reviewer } from './types'

const ALICE = 'r-alice'
const BOB = 'r-bob'
const CARA = 'r-cara'

const reviewers: Reviewer[] = [
  { id: ALICE, name: 'Alice', active: true, created_at: '' },
  { id: BOB, name: 'Bob', active: true, created_at: '' },
  { id: CARA, name: 'Cara', active: false, created_at: '' },
]

function request(over: Partial<ReviewRequest> = {}): ReviewRequest {
  return {
    id: 'req-1',
    type: 'V',
    title: 'Check the thing',
    description: '',
    details: {},
    created_by: 'Alice',
    status: 'new',
    first_reviewer_id: null,
    second_reviewer_id: null,
    created_at: '',
    completed_at: null,
    ...over,
  }
}

describe('volunteering for 1st reviewer', () => {
  it('is allowed on an open request', () => {
    expect(canVolunteerFirst(request(), ALICE)).toBeNull()
  })

  it('needs you to say who you are', () => {
    expect(canVolunteerFirst(request(), null)).toMatch(/name/i)
  })

  it('is refused once someone else has the slot', () => {
    expect(canVolunteerFirst(request({ first_reviewer_id: BOB }), ALICE)).toMatch(
      /already taken/i,
    )
  })

  it('is refused if you are already the 2nd reviewer', () => {
    expect(canVolunteerFirst(request({ second_reviewer_id: ALICE }), ALICE)).toMatch(
      /2nd reviewer/i,
    )
  })

  it('is refused on a completed request', () => {
    expect(canVolunteerFirst(request({ status: 'completed' }), ALICE)).toMatch(
      /completed/i,
    )
  })
})

describe('the 1st and 2nd reviewer must differ', () => {
  it('refuses assigning the 1st reviewer into the 2nd slot', () => {
    const r = request({ first_reviewer_id: ALICE })
    expect(canAssign(r, 'second', ALICE)).toMatch(/different people/i)
  })

  it('refuses assigning the 2nd reviewer into the 1st slot', () => {
    const r = request({ second_reviewer_id: BOB })
    expect(canAssign(r, 'first', BOB)).toMatch(/different people/i)
  })

  it('allows two different people', () => {
    const r = request({ first_reviewer_id: ALICE })
    expect(canAssign(r, 'second', BOB)).toBeNull()
  })

  it('excludes the other slot holder from the eligible list', () => {
    const r = request({ first_reviewer_id: ALICE })
    const ids = eligibleReviewers(reviewers, r, 'second').map((x) => x.id)
    expect(ids).toEqual([BOB])
  })

  it('excludes inactive reviewers', () => {
    const ids = eligibleReviewers(reviewers, request(), 'first').map((x) => x.id)
    expect(ids).not.toContain(CARA)
  })
})

describe('withdrawing from 1st reviewer', () => {
  it('is allowed for the person holding the slot', () => {
    expect(canWithdrawFirst(request({ first_reviewer_id: ALICE }), ALICE)).toBeNull()
  })

  it('is refused for anyone else', () => {
    expect(canWithdrawFirst(request({ first_reviewer_id: ALICE }), BOB)).toMatch(
      /not the 1st/i,
    )
  })
})

describe('starting review', () => {
  it('needs both reviewers', () => {
    expect(canStartReview(request({ first_reviewer_id: ALICE }))).toMatch(/both/i)
  })

  it('is allowed once both slots are filled', () => {
    const r = request({
      first_reviewer_id: ALICE,
      second_reviewer_id: BOB,
      status: 'assigned',
    })
    expect(canStartReview(r)).toBeNull()
  })
})

describe('removing a request', () => {
  it('is allowed for the person who filed it', () => {
    expect(canRemove(request({ created_by: 'Alice' }), 'Alice')).toBeNull()
  })

  it('is refused for anyone else', () => {
    expect(canRemove(request({ created_by: 'Alice' }), 'Bob')).toMatch(/only the person/i)
  })
})

describe('derivedStatus', () => {
  it('is new with no reviewers', () => {
    expect(derivedStatus(request())).toBe('new')
  })

  it('is still new with only the 1st reviewer', () => {
    expect(derivedStatus(request({ first_reviewer_id: ALICE }))).toBe('new')
  })

  it('is assigned once both slots are filled', () => {
    const r = request({ first_reviewer_id: ALICE, second_reviewer_id: BOB })
    expect(derivedStatus(r)).toBe('assigned')
  })

  it('leaves in_review and completed alone', () => {
    expect(derivedStatus(request({ status: 'in_review' }))).toBe('in_review')
    expect(derivedStatus(request({ status: 'completed' }))).toBe('completed')
  })
})

describe('reviewerName', () => {
  it('reads Unassigned for an empty slot', () => {
    expect(reviewerName(reviewers, null)).toBe('Unassigned')
  })

  it('resolves a known id', () => {
    expect(reviewerName(reviewers, BOB)).toBe('Bob')
  })
})
