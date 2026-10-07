// Product pages a logged-in shopper opened, newest first, kept in this browser per user.
// Home uses it for the "Still thinking about…?" welcome-back card. Guests aren't tracked,
// and a user's list is deleted when they log out, so nothing carries over to the next
// person on a shared computer.
const MAX_ITEMS = 10
const LEGACY_GUEST_KEY = 'campus-customs-recent:guest' // written by an earlier version

function key(userId: number) {
  return `campus-customs-recent:${userId}`
}

export function getRecentlyViewed(userId: number): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key(userId)) ?? '[]')
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function addRecentlyViewed(productId: string, userId: number) {
  const ids = [productId, ...getRecentlyViewed(userId).filter((id) => id !== productId)].slice(0, MAX_ITEMS)
  localStorage.setItem(key(userId), JSON.stringify(ids))
}

export function clearRecentlyViewed(userId: number) {
  localStorage.removeItem(key(userId))
  localStorage.removeItem(LEGACY_GUEST_KEY)
}
