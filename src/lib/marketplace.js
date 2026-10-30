import { createSeedState } from '../data/seed'

export const STORAGE_KEY = 'commonroom-marketplace-v1'
export const DEFAULT_CLAIM_DURATION_MS = 2 * 60 * 1000

const browserStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('LocalStorage is not available in this environment.')
  }
  return window.localStorage
}

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
const clone = (value) => JSON.parse(JSON.stringify(value))

const isValidState = (value) =>
  value &&
  value.version === 1 &&
  Array.isArray(value.items) &&
  Array.isArray(value.claims) &&
  value.items.every((item) => item && typeof item.id === 'string' && typeof item.status === 'string') &&
  value.claims.every((claim) => claim && typeof claim.id === 'string' && typeof claim.itemId === 'string')

export function getState(storage = browserStorage()) {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) {
    const initial = createSeedState()
    storage.setItem(STORAGE_KEY, JSON.stringify(initial))
    return initial
  }

  try {
    const parsed = JSON.parse(raw)
    if (!isValidState(parsed)) throw new Error('Stored marketplace data does not match the expected schema.')
    return parsed
  } catch (error) {
    console.error('Marketplace storage was invalid; restoring demo data.', error)
    const recovered = createSeedState()
    storage.setItem(STORAGE_KEY, JSON.stringify(recovered))
    return recovered
  }
}

const writeState = (state, storage) => {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent('marketplace:updated', { detail: clone(state) }))
  return state
}

const getActiveClaim = (state, itemId) =>
  state.claims.find((claim) => claim.itemId === itemId && claim.status === 'active')

const expireDueClaimsInState = (state, now) => {
  const expired = []
  for (const claim of state.claims) {
    if (claim.status !== 'active' || Date.parse(claim.expiresAt) > now) continue
    claim.status = 'expired'
    expired.push(claim)
    const item = state.items.find((candidate) => candidate.id === claim.itemId)
    if (item?.status === 'claimed') {
      item.status = 'available'
      item.updatedAt = new Date(now).toISOString()
    }
  }
  return expired
}

export function getItems({ storage } = {}) {
  return getState(storage ?? browserStorage()).items.filter((item) => item.status !== 'removed')
}

export function getAvailableItems(options = {}) {
  return getItems(options).filter((item) => item.status === 'available')
}

export function filterItems(items, { query = '', category = 'All', price = 'all', sort = 'newest' } = {}) {
  const normalizedQuery = query.trim().toLowerCase()
  return items
    .filter((item) => category === 'All' || item.category === category)
    .filter((item) => price === 'all' || (price === 'free' ? item.isFree : !item.isFree))
    .filter((item) =>
      !normalizedQuery ||
      [item.title, item.description, item.category, item.sellerName, item.dormLocation]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    )
    .sort((a, b) => {
      if (sort === 'price-low') return Number(a.price) - Number(b.price)
      if (sort === 'price-high') return Number(b.price) - Number(a.price)
      return Date.parse(b.createdAt) - Date.parse(a.createdAt)
    })
}

export function createItem(input, { storage = browserStorage(), now = Date.now } = {}) {
  const required = ['title', 'description', 'category', 'sellerId', 'sellerName', 'dormLocation']
  if (required.some((field) => !String(input[field] ?? '').trim())) {
    throw new Error('Please complete all required listing fields.')
  }
  const numericPrice = Number(input.price)
  if (!input.isFree && (String(input.price ?? '').trim() === '' || !Number.isFinite(numericPrice) || numericPrice < 0)) {
    throw new Error('Enter a valid price of zero or more.')
  }

  const state = getState(storage)
  const timestamp = new Date(now()).toISOString()
  const item = {
    id: makeId(),
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    price: input.isFree ? 0 : numericPrice,
    isFree: Boolean(input.isFree),
    sellerId: input.sellerId,
    sellerName: input.sellerName.trim(),
    dormLocation: input.dormLocation.trim(),
    imageUrl: input.imageUrl?.trim() || '',
    status: 'available',
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  writeState({ ...state, items: [item, ...state.items] }, storage)
  return item
}

export async function claimItem(itemId, buyer, {
  storage = browserStorage(),
  now = Date.now,
  claimDurationMs = DEFAULT_CLAIM_DURATION_MS,
  locks = globalThis.navigator?.locks,
} = {}) {
  if (!buyer?.id || !buyer?.name) throw new Error('A student account is required to claim an item.')

  const attempt = () => {
    const state = getState(storage)
    expireDueClaimsInState(state, now())
    const item = state.items.find((candidate) => candidate.id === itemId)
    if (!item || item.status !== 'available' || getActiveClaim(state, itemId)) {
      writeState(state, storage)
      return { ok: false, reason: 'unavailable' }
    }
    if (item.sellerId === buyer.id) {
      writeState(state, storage)
      return { ok: false, reason: 'own-listing' }
    }

    const claimedAt = now()
    const claim = {
      id: makeId(),
      itemId,
      buyerId: buyer.id,
      buyerName: buyer.name,
      claimedAt: new Date(claimedAt).toISOString(),
      expiresAt: new Date(claimedAt + claimDurationMs).toISOString(),
      status: 'active',
    }
    item.status = 'claimed'
    item.updatedAt = new Date(claimedAt).toISOString()
    state.claims.push(claim)
    writeState(state, storage)
    return { ok: true, claim }
  }

  if (locks?.request) {
    return locks.request(`commonroom-claim-${itemId}`, { mode: 'exclusive' }, attempt)
  }
  return attempt()
}

export function expireClaim(claimId, { storage = browserStorage(), now = Date.now } = {}) {
  const state = getState(storage)
  const claim = state.claims.find((candidate) => candidate.id === claimId)
  if (!claim || claim.status !== 'active' || Date.parse(claim.expiresAt) > now()) return false
  const expired = expireDueClaimsInState(state, now())
  if (expired.length) writeState(state, storage)
  return expired.some((candidate) => candidate.id === claimId)
}

export function expireDueClaims({ storage = browserStorage(), now = Date.now } = {}) {
  const state = getState(storage)
  const expiredClaims = expireDueClaimsInState(state, now())
  if (expiredClaims.length) writeState(state, storage)
  return expiredClaims
}

export function confirmPickup(claimId, buyerId, { storage = browserStorage(), now = Date.now } = {}) {
  const state = getState(storage)
  const claim = state.claims.find((candidate) => candidate.id === claimId)
  if (!claim || claim.status !== 'active' || claim.buyerId !== buyerId) {
    return { ok: false, reason: 'inactive' }
  }
  if (Date.parse(claim.expiresAt) <= now()) {
    expireDueClaimsInState(state, now())
    writeState(state, storage)
    return { ok: false, reason: 'expired' }
  }
  claim.status = 'completed'
  const item = state.items.find((candidate) => candidate.id === claim.itemId)
  if (item) {
    item.status = 'sold'
    item.updatedAt = new Date(now()).toISOString()
  }
  writeState(state, storage)
  return { ok: true, claim }
}

const sellerOverride = (itemId, sellerId, nextStatus, { storage = browserStorage(), now = Date.now } = {}) => {
  const state = getState(storage)
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item || item.sellerId !== sellerId || item.status === 'removed') {
    return { ok: false, reason: 'not-found' }
  }
  const claim = getActiveClaim(state, itemId)
  if (claim) claim.status = 'invalidated'
  item.status = nextStatus
  item.updatedAt = new Date(now()).toISOString()
  writeState(state, storage)
  return { ok: true, item, invalidatedClaim: claim ?? null }
}

export function markAsSold(itemId, sellerId, options = {}) {
  return sellerOverride(itemId, sellerId, 'sold', options)
}

export function removeListing(itemId, sellerId, options = {}) {
  return sellerOverride(itemId, sellerId, 'removed', options)
}

export function getMyListings(sellerId, { storage } = {}) {
  return getState(storage ?? browserStorage()).items.filter(
    (item) => item.sellerId === sellerId && item.status !== 'removed',
  )
}

export function getMyClaims(buyerId, { storage } = {}) {
  const state = getState(storage ?? browserStorage())
  return state.claims
    .filter((claim) => claim.buyerId === buyerId)
    .map((claim) => ({
      ...claim,
      item: state.items.find((item) => item.id === claim.itemId),
    }))
    .filter((claim) => claim.item)
}

export function resetDemoData({ storage = browserStorage() } = {}) {
  const state = createSeedState()
  writeState(state, storage)
  return state
}

export function subscribeToMarketplace(callback) {
  const onUpdate = () => callback(getState())
  window.addEventListener('marketplace:updated', onUpdate)
  window.addEventListener('storage', onUpdate)
  return () => {
    window.removeEventListener('marketplace:updated', onUpdate)
    window.removeEventListener('storage', onUpdate)
  }
}
