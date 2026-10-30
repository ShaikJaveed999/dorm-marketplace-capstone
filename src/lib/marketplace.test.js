import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { createSeedState } from '../data/seed'
import App from '../App'
import {
  claimItem,
  confirmPickup,
  createItem,
  expireDueClaims,
  filterItems,
  getAvailableItems,
  getItems,
  getMyClaims,
  getState,
  markAsSold,
  removeListing,
  STORAGE_KEY,
} from './marketplace'

const storage = window.localStorage
const buyer = { id: 'rahul', name: 'Rahul' }
const secondBuyer = { id: 'arjun', name: 'Arjun' }
const fixedNow = Date.parse('2026-10-30T08:00:00.000Z')

function resetStorage() {
  storage.clear()
  storage.setItem(STORAGE_KEY, JSON.stringify(createSeedState()))
}

describe('marketplace operations', () => {
  beforeEach(() => {
    resetStorage()
  })

  afterEach(() => {
    cleanup()
  })

  it('creates a validated listing and persists it', () => {
    const item = createItem({
      title: 'Desk fan',
      description: 'Quiet and clean.',
      category: 'Appliances',
      price: '12',
      isFree: false,
      sellerId: 'javid',
      sellerName: 'Javid',
      dormLocation: 'Maple Hall',
    }, { storage, now: () => fixedNow })

    expect(item).toMatchObject({ title: 'Desk fan', price: 12, status: 'available', sellerId: 'javid' })
    expect(getItems({ storage })).toContainEqual(item)
  })

  it('returns only available items from marketplace inventory', () => {
    const state = getState(storage)
    state.items[0].status = 'claimed'
    storage.setItem(STORAGE_KEY, JSON.stringify(state))

    expect(getAvailableItems({ storage }).every((item) => item.status === 'available')).toBe(true)
    expect(getAvailableItems({ storage })).toHaveLength(state.items.length - 1)
  })

  it('searches items across names, descriptions, categories, and locations', () => {
    const items = getAvailableItems({ storage })
    expect(filterItems(items, { query: 'tactile' }).map((item) => item.id)).toContain('item-keyboard')
    expect(filterItems(items, { query: 'cedar hall' }).map((item) => item.id)).toContain('item-bike')
  })

  it('filters by category and free or paid status', () => {
    const items = getAvailableItems({ storage })
    expect(filterItems(items, { category: 'Electronics' }).every((item) => item.category === 'Electronics')).toBe(true)
    expect(filterItems(items, { price: 'free' }).every((item) => item.isFree)).toBe(true)
    expect(filterItems(items, { price: 'paid' }).every((item) => !item.isFree)).toBe(true)
  })

  it('successfully claims an available item and records expiration timestamps', async () => {
    const result = await claimItem('item-lamp', buyer, { storage, now: () => fixedNow, claimDurationMs: 5000, locks: null })
    expect(result.ok).toBe(true)
    expect(Date.parse(result.claim.expiresAt) - Date.parse(result.claim.claimedAt)).toBe(5000)
    expect(getState(storage).items.find((item) => item.id === 'item-lamp').status).toBe('claimed')
  })

  it('rejects duplicate active claims at the business-logic layer', async () => {
    await claimItem('item-lamp', buyer, { storage, now: () => fixedNow, locks: null })
    const duplicate = await claimItem('item-lamp', secondBuyer, { storage, now: () => fixedNow, locks: null })

    expect(duplicate).toEqual({ ok: false, reason: 'unavailable' })
    expect(getState(storage).claims.filter((claim) => claim.itemId === 'item-lamp' && claim.status === 'active')).toHaveLength(1)
  })

  it('allows only one winner when two users compete for the same item', async () => {
    const outcomes = await Promise.all([
      claimItem('item-fridge', buyer, { storage, now: () => fixedNow, locks: null }),
      claimItem('item-fridge', secondBuyer, { storage, now: () => fixedNow, locks: null }),
    ])

    expect(outcomes.filter((result) => result.ok)).toHaveLength(1)
    expect(outcomes.filter((result) => !result.ok)).toHaveLength(1)
    expect(getState(storage).claims.filter((claim) => claim.itemId === 'item-fridge' && claim.status === 'active')).toHaveLength(1)
  })

  it('uses the Web Locks API with an item-specific exclusive lock when available', async () => {
    const request = vi.fn((_name, _options, operation) => operation())
    await claimItem('item-fridge', buyer, { storage, now: () => fixedNow, locks: { request } })

    expect(request).toHaveBeenCalledWith('commonroom-claim-item-fridge', { mode: 'exclusive' }, expect.any(Function))
  })

  it('automatically expires abandoned claims', async () => {
    await claimItem('item-lamp', buyer, { storage, now: () => fixedNow, claimDurationMs: 1000, locks: null })
    const expired = expireDueClaims({ storage, now: () => fixedNow + 1001 })

    expect(expired).toHaveLength(1)
    expect(getState(storage).claims[0].status).toBe('expired')
  })

  it('restores item availability and invalidates the expired hold', async () => {
    await claimItem('item-lamp', buyer, { storage, now: () => fixedNow, claimDurationMs: 1000, locks: null })
    expireDueClaims({ storage, now: () => fixedNow + 1001 })

    expect(getState(storage).items.find((item) => item.id === 'item-lamp').status).toBe('available')
    expect(getAvailableItems({ storage }).some((item) => item.id === 'item-lamp')).toBe(true)
    expect(getMyClaims(buyer.id, { storage })[0].status).toBe('expired')
  })

  it('confirms pickup and completes the claim and listing', async () => {
    const { claim } = await claimItem('item-lamp', buyer, { storage, now: () => fixedNow, locks: null })
    const result = confirmPickup(claim.id, buyer.id, { storage, now: () => fixedNow + 1000 })

    expect(result.ok).toBe(true)
    expect(getState(storage).claims[0].status).toBe('completed')
    expect(getState(storage).items.find((item) => item.id === 'item-lamp').status).toBe('sold')
  })

  it('lets the seller mark a claimed item sold and invalidates its active claim', async () => {
    await claimItem('item-lamp', buyer, { storage, now: () => fixedNow, locks: null })
    const result = markAsSold('item-lamp', 'javid', { storage, now: () => fixedNow + 100 })

    expect(result.ok).toBe(true)
    expect(result.invalidatedClaim.status).toBe('invalidated')
    expect(getState(storage).items.find((item) => item.id === 'item-lamp').status).toBe('sold')
    expect((await claimItem('item-lamp', secondBuyer, { storage, now: () => fixedNow + 101, locks: null })).ok).toBe(false)
  })

  it('force-removes a listing and invalidates an active claim', async () => {
    await claimItem('item-lamp', buyer, { storage, now: () => fixedNow, locks: null })
    const result = removeListing('item-lamp', 'javid', { storage, now: () => fixedNow + 100 })

    expect(result.ok).toBe(true)
    expect(result.invalidatedClaim.status).toBe('invalidated')
    expect(getItems({ storage }).some((item) => item.id === 'item-lamp')).toBe(false)
  })

  it('persists marketplace state between reads', async () => {
    await claimItem('item-lamp', buyer, { storage, now: () => fixedNow, locks: null })
    const reloaded = getState(storage)

    expect(reloaded.items.find((item) => item.id === 'item-lamp').status).toBe('claimed')
    expect(reloaded.claims[0].buyerId).toBe(buyer.id)
  })

  it('rejects invalid listing form data', () => {
    expect(() => createItem({
      title: '',
      description: '',
      category: '',
      price: '',
      isFree: false,
      sellerId: 'javid',
      sellerName: 'Javid',
      dormLocation: '',
    }, { storage })).toThrow('Please complete all required listing fields.')
    expect(getState(storage).items).toHaveLength(createSeedState().items.length)
  })

  it('rejects a paid listing when its required price is missing', () => {
    expect(() => createItem({
      title: 'Desk fan',
      description: 'Quiet and clean.',
      category: 'Appliances',
      price: '',
      isFree: false,
      sellerId: 'javid',
      sellerName: 'Javid',
      dormLocation: 'Maple Hall',
    }, { storage })).toThrow('Enter a valid price of zero or more.')
  })

  it('shows validation feedback when the listing form is submitted incomplete', async () => {
    render(createElement(App))
    fireEvent.click(screen.getByRole('button', { name: /list an item/i }))
    fireEvent.submit(screen.getByRole('button', { name: /publish listing/i }).closest('form'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Please complete all required listing fields.')
  })

  it('recovers corrupted local storage with sample data', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    storage.setItem(STORAGE_KEY, '{not json')
    expect(getState(storage).items).toHaveLength(createSeedState().items.length)
    expect(errorSpy).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })
})
