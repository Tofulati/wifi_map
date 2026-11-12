// 802.11 caps an SSID at 32 bytes, so anything longer can't be a real network name.
const MAX_NETWORK_NAME_BYTES = 32

export const UNNAMED_NETWORK = 'Unnamed network'

// Invisible characters that sneak in through copy-paste. The zero-width joiner (U+200D) is left
// alone because removing it would split emoji sequences, which do appear in network names.
const INVISIBLE_CHARACTERS = /[\p{Cc}\u00AD\u200B\u200C\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu
// Phone keyboards auto-curl quotes, so the same typed name would otherwise differ by device.
const CURLY_SINGLE_QUOTES = /[\u2018\u2019\u201A\u201B]/g
const CURLY_DOUBLE_QUOTES = /[\u201C\u201D\u201E\u201F]/g

// The display form of a name. Case is kept; only differences a person can't see or didn't mean
// are removed. Whitespace is collapsed before invisible characters are stripped so a tab or
// newline between words becomes a space instead of joining them.
export function cleanNetworkName(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(CURLY_SINGLE_QUOTES, "'")
    .replace(CURLY_DOUBLE_QUOTES, '"')
    .trim()
}

// Two names refer to the same network exactly when their keys match.
export function networkNameKey(name: string): string {
  return cleanNetworkName(name).toLowerCase()
}

export function networkNameError(raw: string): string | null {
  const cleaned = cleanNetworkName(raw)
  if (cleaned === '') return 'Enter the network name'
  if (new TextEncoder().encode(cleaned).length > MAX_NETWORK_NAME_BYTES) {
    return 'Too long for a Wi-Fi network name (32-byte limit)'
  }
  return null
}

// Snaps a typed name to the existing spelling of the same network, so "cafenet" joins "CafeNet".
export function resolveNetworkName(raw: string, knownNames: Iterable<string>): string {
  const cleaned = cleanNetworkName(raw)
  const key = networkNameKey(cleaned)
  for (const known of knownNames) {
    if (networkNameKey(known) === key) return known
  }
  return cleaned
}

// Names are canonical once they've passed through this module, so grouping by exact name is safe.
export function groupByNetworkName<T extends { networkName: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const group = groups.get(item.networkName)
    if (group) group.push(item)
    else groups.set(item.networkName, [item])
  }
  return groups
}

// Applies the same rules to a whole list: the first spelling seen for each network wins.
export function canonicalizeNetworkNames<T extends { networkName: string }>(items: T[]): T[] {
  const displayNameByKey = new Map<string, string>()
  return items.map((item) => {
    const cleaned = cleanNetworkName(item.networkName) || UNNAMED_NETWORK
    const key = networkNameKey(cleaned)
    const displayName = displayNameByKey.get(key) ?? cleaned
    displayNameByKey.set(key, displayName)
    return { ...item, networkName: displayName }
  })
}
