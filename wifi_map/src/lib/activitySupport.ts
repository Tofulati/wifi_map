import type { NetworkSpeeds } from './networkReading'

export type SupportTier = 'poor' | 'ok' | 'great'

// `works` is the published minimum for the activity, `great` is roughly where more speed stops
// being noticeable. For latency lower is better, so there `great` is the smaller number.
type Threshold = { works: number; great: number }

type Activity = {
  label: string
  downloadMbps: Threshold
  uploadMbps?: Threshold
  latencyMs?: Threshold
  verdict: (tier: SupportTier, speeds: NetworkSpeeds) => string
}

export type ActivityRating = {
  label: string
  // 0–1: 0.5 means the activity just works, 1 means it's great.
  score: number
  tier: SupportTier
  verdict: string
}

const MEGABITS_PER_GIGABYTE = 8_000
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3_600
// Units switch at 90 rather than 60, so 70 seconds reads as "70 seconds" instead of rounding
// to "1 minute".
const MAX_SECONDS_SHOWN_AS_SECONDS = 90
const MAX_SECONDS_SHOWN_AS_MINUTES = 90 * SECONDS_PER_MINUTE

const WORKS_SCORE = 0.5
const GREAT_SCORE = 1

function byTier(poor: string, ok: string, great: string) {
  return function verdictForTier(tier: SupportTier): string {
    return { poor, ok, great }[tier]
  }
}

// Sources: Netflix (3 Mbps HD, 15 Mbps 4K), FCC broadband guide (student 5–25 Mbps, browsing
// 1 Mbps, file downloads 10 Mbps, gaming 3–4 Mbps), Zoom group video (1.0 Mbps up for high
// quality, 3.8 Mbps up for 1080p), Xbox (0.5 Mbps up). The `great` values for gaming, browsing
// and downloads and all latency values are common rules of thumb, not published minimums.
const ACTIVITIES: Activity[] = [
  {
    label: 'Streaming video',
    downloadMbps: { works: 3, great: 15 },
    verdict: byTier('Buffering likely', 'HD video', '4K video'),
  },
  {
    label: 'Gaming',
    downloadMbps: { works: 3, great: 10 },
    uploadMbps: { works: 0.5, great: 3 },
    latencyMs: { works: 100, great: 50 },
    verdict: byTier('Laggy', 'Playable', 'Smooth'),
  },
  {
    label: 'Studying & video classes',
    downloadMbps: { works: 5, great: 25 },
    uploadMbps: { works: 1, great: 3.8 },
    verdict: byTier('Choppy calls', 'Good enough', 'Smooth calls'),
  },
  {
    label: 'Browsing & social media',
    downloadMbps: { works: 1, great: 10 },
    latencyMs: { works: 200, great: 100 },
    verdict: byTier('Slow pages', 'Fine', 'Snappy'),
  },
  {
    label: 'Downloading files',
    downloadMbps: { works: 10, great: 100 },
    verdict: (_tier, { downloadMbps }) =>
      `1 GB in ~${formatDuration(MEGABITS_PER_GIGABYTE / downloadMbps)}`,
  },
]

// Puts `works` at the bar's midpoint and `great` at its end, so "just works" always looks
// half full whatever the activity's numbers are. Below `works` the bar shrinks in proportion.
function scoreAgainst(value: number, { works, great }: Threshold): number {
  const higherIsBetter = great > works
  const belowWorks = higherIsBetter ? value < works : value > works
  if (belowWorks) return WORKS_SCORE * (higherIsBetter ? value / works : works / value)
  const progressTowardGreat = (value - works) / (great - works)
  return Math.min(GREAT_SCORE, WORKS_SCORE + (GREAT_SCORE - WORKS_SCORE) * progressTowardGreat)
}

function tierFor(score: number): SupportTier {
  if (score >= GREAT_SCORE) return 'great'
  if (score >= WORKS_SCORE) return 'ok'
  return 'poor'
}

function formatDuration(seconds: number): string {
  let [value, unit] = [seconds / SECONDS_PER_HOUR, 'hour']
  if (seconds < MAX_SECONDS_SHOWN_AS_SECONDS) [value, unit] = [seconds, 'second']
  else if (seconds < MAX_SECONDS_SHOWN_AS_MINUTES) [value, unit] = [seconds / SECONDS_PER_MINUTE, 'minute']
  return new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit,
    unitDisplay: 'long',
    maximumFractionDigits: 0,
  }).format(value)
}

// An activity is only as good as its weakest requirement, e.g. a video call with fast download
// but slow upload still freezes for everyone else. Unmeasured values are left out.
export function rateActivities(speeds: NetworkSpeeds): ActivityRating[] {
  return ACTIVITIES.map(function rateActivity(activity) {
    const scores = [scoreAgainst(speeds.downloadMbps, activity.downloadMbps)]
    if (activity.uploadMbps && speeds.uploadMbps !== undefined) {
      scores.push(scoreAgainst(speeds.uploadMbps, activity.uploadMbps))
    }
    if (activity.latencyMs && speeds.latencyMs !== undefined) {
      scores.push(scoreAgainst(speeds.latencyMs, activity.latencyMs))
    }
    const score = Math.min(...scores)
    const tier = tierFor(score)
    return { label: activity.label, score, tier, verdict: activity.verdict(tier, speeds) }
  })
}
