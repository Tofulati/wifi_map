import { rateActivities } from '../lib/activitySupport'
import type { NetworkSpeeds } from '../lib/networkReading'

export function SpeedFigures({ speeds }: { speeds: NetworkSpeeds }) {
  return (
    <span>
      <strong>{speeds.downloadMbps.toFixed(1)} Mbps</strong> down
      {speeds.uploadMbps !== undefined && ` · ${speeds.uploadMbps.toFixed(1)} up`}
      {speeds.latencyMs !== undefined && ` · ${Math.round(speeds.latencyMs)} ms ping`}
    </span>
  )
}

export function NetworkSummary({ speeds }: { speeds: NetworkSpeeds }) {
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
              🐢
            </span>
            <span
              className="network-summary-track"
              role="meter"
              aria-label={rating.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(rating.score * 100)}
              aria-valuetext={rating.verdict}
            >
              <span
                className={`network-summary-fill network-summary-${rating.tier}`}
                style={{ width: `${rating.score * 100}%` }}
              />
            </span>
            <span className="network-summary-icon" aria-hidden="true">
              🐇
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
