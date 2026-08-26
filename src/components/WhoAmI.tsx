import type { Reviewer } from '../lib/types'

interface Props {
  reviewers: Reviewer[]
  name: string
  onChange: (name: string) => void
}

/**
 * Identity is honour-system: you say who you are, nothing verifies it. Good
 * enough for a small trusted team; see README for what that does and doesn't buy.
 */
export function WhoAmI({ reviewers, name, onChange }: Props) {
  return (
    <label className="whoami">
      <span>You are</span>
      <input
        list="reviewer-names"
        value={name}
        placeholder="your name"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id="reviewer-names">
        {reviewers.filter((r) => r.active).map((r) => (
          <option key={r.id} value={r.name} />
        ))}
      </datalist>
    </label>
  )
}
