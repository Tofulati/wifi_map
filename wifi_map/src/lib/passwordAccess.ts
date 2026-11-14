const UNLOCKED_NETWORKS_COOKIE = 'wifi-map-unlocked-networks'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function readCookieValue(): string | null {
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${UNLOCKED_NETWORKS_COOKIE}=`))
  return cookie ? cookie.slice(UNLOCKED_NETWORKS_COOKIE.length + 1) : null
}

export function loadUnlockedNetworks(): string[] {
  const value = readCookieValue()
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value))
    return Array.isArray(parsed) && parsed.every((network) => typeof network === 'string')
      ? parsed
      : []
  } catch {
    return []
  }
}

export function rememberUnlockedNetwork(networkName: string): string[] {
  const networks = [...new Set([...loadUnlockedNetworks(), networkName])]
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${UNLOCKED_NETWORKS_COOKIE}=${encodeURIComponent(
    JSON.stringify(networks),
  )}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
  return networks
}

export function clearUnlockedNetworks(): void {
  document.cookie = `${UNLOCKED_NETWORKS_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}
