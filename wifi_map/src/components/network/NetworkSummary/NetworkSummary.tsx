import { rateActivities } from '../../../lib/activitySupport'
import type { NetworkSpeeds } from '../../../lib/networkReading'
import './NetworkSummary.css'

const PERCENT = 100

type NetworkSummaryProps = {
  speeds: NetworkSpeeds
}

export function NetworkSummary({ speeds }: NetworkSummaryProps) {
  const missing = [
    speeds.uploadMbps === undefined && 'upload',
    speeds.latencyMs === undefined && 'ping',
  ].filter(Boolean)

  return (
    <div className="network-summary">
      <ul>
        {rateActivities(speeds).map((rating) => (
          <li key={rating.label} className="network-summary-row">
            <div className="network-summary-heading">
              <span>{rating.label}</span>
              <span className="network-summary-verdict">{rating.verdict}</span>
            </div>
            <span className="network-summary-icon" aria-hidden="true">
              {rating.icon}
            </span>
            <span
              className="network-summary-track"
              role="meter"
              aria-label={rating.label}
              aria-valuemin={0}
              aria-valuemax={PERCENT}
              aria-valuenow={Math.round(rating.score * PERCENT)}
              aria-valuetext={rating.verdict}
            >
              {/* The fill width is a continuous runtime value, which a class can't express. */}
              <span
                className={`network-summary-fill network-summary-${rating.tier}`}
                style={{ width: `${rating.score * PERCENT}%` }}
              />
            </span>
            <span className="network-summary-icon" aria-hidden="true">
              {rating.greatIcon}
            </span>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <div className="network-summary-note">
          No {missing.join(' or ')} data here, so ratings leave {missing.length > 1 ? 'them' : 'it'}{' '}
          out.
        </div>
      )}
    </div>
  )
}
