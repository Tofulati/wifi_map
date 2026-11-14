const STORAGE_KEY = 'wifi-map-contribution-progress'
const DAILY_STREAK_BONUS = 5
const MEASUREMENT_REWARD = 10
export const PASSWORD_UNLOCK_COST = 25
const PASSWORD_REWARD = 25

export type ContributionProgress = {
  balance: number
  contributionCount: number
  streak: number
  lastContributionDate?: string
}

export type ContributionReward = {
  progress: ContributionProgress
  earned: number
  streakBonus: number
}

const EMPTY_PROGRESS: ContributionProgress = {
  balance: 0,
  contributionCount: 0,
  streak: 0,
}

function isProgress(value: unknown): value is ContributionProgress {
  if (!value || typeof value !== 'object') return false
  const progress = value as Partial<ContributionProgress>
  return (
    typeof progress.balance === 'number' &&
    typeof progress.contributionCount === 'number' &&
    typeof progress.streak === 'number' &&
    (progress.lastContributionDate === undefined ||
      typeof progress.lastContributionDate === 'string')
  )
}

function todayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysBetween(first: string, second: string): number {
  const firstDate = new Date(`${first}T00:00:00`)
  const secondDate = new Date(`${second}T00:00:00`)
  return Math.round((secondDate.getTime() - firstDate.getTime()) / 86_400_000)
}

export function loadContributionProgress(): ContributionProgress {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return EMPTY_PROGRESS

  try {
    const parsed: unknown = JSON.parse(stored)
    return isProgress(parsed) ? parsed : EMPTY_PROGRESS
  } catch {
    return EMPTY_PROGRESS
  }
}

export function spendSignalPoints(amount: number): ContributionProgress | null {
  if (!Number.isInteger(amount) || amount < 0) return null
  const previous = loadContributionProgress()
  if (previous.balance < amount) return null
  const progress = { ...previous, balance: previous.balance - amount }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  return progress
}

export function recordContribution(
  options: { passwordAdded?: boolean; date?: Date } = {},
): ContributionReward {
  const { passwordAdded = false, date = new Date() } = options
  const previous = loadContributionProgress()
  const contributionDate = todayKey(date)
  const daysSinceLastContribution = previous.lastContributionDate
    ? daysBetween(previous.lastContributionDate, contributionDate)
    : null
  const isNewDay = previous.lastContributionDate !== contributionDate
  const streak = !isNewDay
    ? previous.streak
    : daysSinceLastContribution === 1
      ? previous.streak + 1
      : 1
  const streakBonus = isNewDay ? DAILY_STREAK_BONUS : 0
  const earned = MEASUREMENT_REWARD + streakBonus + (passwordAdded ? PASSWORD_REWARD : 0)
  const progress: ContributionProgress = {
    balance: previous.balance + earned,
    contributionCount: previous.contributionCount + 1,
    streak,
    lastContributionDate: contributionDate,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  return { progress, earned, streakBonus }
}
