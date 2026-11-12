import type { ContributionProgress } from '../../../lib/contributionRewards'
import './ContributionStatus.css'

type ContributionStatusProps = {
  progress: ContributionProgress
  lastEarned: number | null
  onTestContribution?: () => void
}

export function ContributionStatus({
  progress,
  lastEarned,
  onTestContribution,
}: ContributionStatusProps) {
  return (
    <section className="contribution-status" aria-label="Your contribution rewards">
      <div className="contribution-status-balance">
        <span className="contribution-status-label">Signal</span>
        <strong>{progress.balance}</strong>
        {lastEarned !== null && (
          <span className="contribution-status-earned" role="status">
            +{lastEarned}
          </span>
        )}
      </div>
      <div className="contribution-status-streak">
        <strong>{progress.streak}</strong>
        <span>day streak</span>
      </div>
      <div className="contribution-status-count">
        <strong>{progress.contributionCount}</strong>
        <span>contributions</span>
      </div>
      {onTestContribution && (
        <button type="button" className="contribution-status-test" onClick={onTestContribution}>
          Test reward
        </button>
      )}
    </section>
  )
}
