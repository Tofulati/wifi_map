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

const byTier =
  (poor: string, ok: string, great: string) =>
  (tier: SupportTier): string =>
    ({ poor, ok, great })[tier]

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
  if (belowWorks) return 0.5 * (higherIsBetter ? value / works : works / value)
  return Math.min(1, 0.5 + 0.5 * ((value - works) / (great - works)))
}

function tierFor(score: number): SupportTier {
  if (score >= 1) return 'great'
  if (score >= 0.5) return 'ok'
  return 'poor'
}

function formatDuration(seconds: number): string {
  let [value, unit] = [seconds / 3600, 'hour']
  if (seconds < 90) [value, unit] = [seconds, 'second']
  else if (seconds < 90 * 60) [value, unit] = [seconds / 60, 'minute']
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
  return ACTIVITIES.map((activity) => {
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
