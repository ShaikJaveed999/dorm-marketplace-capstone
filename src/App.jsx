import { useEffect, useMemo, useState } from 'react'
import {
  confirmPickup,
  createItem,
  expireDueClaims,
  filterItems,
  getState,
  markAsSold,
  claimItem,
  removeListing,
  subscribeToMarketplace,
} from './lib/marketplace'
import { demoUsers } from './data/seed'
import './App.css'

const categories = ['All', 'Books', 'Appliances', 'Furniture', 'Electronics', 'Sports & Outdoors', 'Other']

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h14V9M9 21v-7h6v7" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    bookmark: <><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    sliders: <><path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4" /></>,
    leaf: <><path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-7 10-16Z" /><path d="M5 19c2-4 5-7 10-10" /></>,
    bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  }
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>
}

function money(item) {
  return item.isFree ? 'Free' : `$${Number(item.price).toFixed(0)}`
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function ItemImage({ item, className = '' }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`item-image ${className}`}>
      {item.imageUrl && !failed
        ? <img src={item.imageUrl} alt={item.title} onError={() => setFailed(true)} />
        : <div className="image-fallback"><Icon name="bag" size={30} /><span>{item.category}</span></div>}
      {item.isFree && <span className="free-ribbon">Free find</span>}
    </div>
  )
}

function StatusBadge({ status }) {
  const labels = { available: 'Available', claimed: 'On hold', sold: 'Completed', expired: 'Expired', completed: 'Picked up', invalidated: 'Claim ended', removed: 'Removed' }
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>
}

function ItemCard({ item, onOpen, compact = false }) {
  return (
    <article className={`item-card ${compact ? 'compact-card' : ''}`} role="button" tabIndex={0} onClick={() => onOpen(item)} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onOpen(item)
      }
    }}>
      <ItemImage item={item} />
      <div className="item-card-content">
        <div className="item-card-top"><span className="eyebrow">{item.category}</span><strong className={`price ${item.isFree ? 'price-free' : ''}`}>{money(item)}</strong></div>
        <h3>{item.title}</h3>
        {!compact && <p className="item-description">{item.description}</p>}
        <div className="item-meta"><span><span className="avatar avatar-small">{item.sellerName.charAt(0)}</span>{item.sellerName}</span><span><Icon name="pin" size={14} />{item.dormLocation.split('·')[0].trim()}</span></div>
      </div>
    </article>
  )
}

function EmptyState({ icon = 'leaf', title, message, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={25} /></span><h3>{title}</h3><p>{message}</p>{action}</div>
}

function Modal({ title, eyebrow, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  )
}

function App() {
  const [snapshot, setSnapshot] = useState(() => getState())
  const [activePage, setActivePage] = useState('dashboard')
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('commonroom-demo-user') || 'javid')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [priceFilter, setPriceFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [selectedItem, setSelectedItem] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [toast, setToast] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [listingForm, setListingForm] = useState({ title: '', description: '', category: '', price: '', isFree: false, dormLocation: '', imageUrl: '' })
  const [formError, setFormError] = useState('')

  const currentUser = demoUsers.find((user) => user.id === currentUserId) ?? demoUsers[0]
  const items = snapshot.items.filter((item) => item.status !== 'removed')
  const availableItems = items.filter((item) => item.status === 'available')
  const userListings = items.filter((item) => item.sellerId === currentUser.id)
  const userClaims = snapshot.claims.filter((claim) => claim.buyerId === currentUser.id)

  useEffect(() => {
    const unsubscribe = subscribeToMarketplace(setSnapshot)
    const timer = window.setInterval(() => {
      setNow(Date.now())
      const expired = expireDueClaims()
      if (expired.length) showToast(`${expired.length === 1 ? 'A claim has' : 'Claims have'} expired. The item${expired.length === 1 ? ' is' : 's are'} available again.`, 'info')
    }, 1000)
    const expiredOnLoad = expireDueClaims()
    if (expiredOnLoad.length) showToast('An expired claim was released and is available again.', 'info')
    return () => { unsubscribe(); window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const filteredItems = useMemo(
    () => filterItems(availableItems, { query, category, price: priceFilter, sort }),
    [availableItems, query, category, priceFilter, sort],
  )

  function showToast(message, type = 'success') {
    setToast({ message, type, id: Date.now() })
  }

  function navigate(page) {
    setActivePage(page)
    setSelectedItem(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleClaim(item) {
    try {
      const result = await claimItem(item.id, currentUser)
      setSelectedItem(null)
      if (!result.ok) {
        showToast(result.reason === 'own-listing' ? 'You cannot claim your own listing.' : 'This item was just claimed by another student.', 'error')
        return
      }
      showToast(`${item.title} is on hold for you for 2 minutes.`)
      navigate('claims')
    } catch (error) {
      showToast(error.message || 'Could not claim this item.', 'error')
    }
  }

  function confirmAction(title, message, action, confirmLabel, tone = 'danger') {
    setConfirmDialog({ title, message, action, confirmLabel, tone })
  }

  function submitListing(event) {
    event.preventDefault()
    setFormError('')
    try {
      const item = createItem({ ...listingForm, sellerId: currentUser.id, sellerName: currentUser.name })
      setListingForm({ title: '', description: '', category: '', price: '', isFree: false, dormLocation: '', imageUrl: '' })
      showToast(`${item.title} is live in the marketplace.`)
      navigate('listings')
    } catch (error) {
      setFormError(error.message)
    }
  }

  function saveUser(userId) {
    setCurrentUserId(userId)
    localStorage.setItem('commonroom-demo-user', userId)
    showToast(`You're now browsing as ${demoUsers.find((user) => user.id === userId)?.name}.`, 'info')
  }

  function renderDashboard() {
    const recentItems = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3)
    const activeClaims = snapshot.claims.filter((claim) => claim.status === 'active').length
    const completed = snapshot.claims.filter((claim) => claim.status === 'completed').length
    return (
      <>
        <section className="welcome-panel">
          <div className="welcome-copy">
            <span className="welcome-kicker"><span className="live-dot" /> YOUR CAMPUS, SHARED</span>
            <h1>Good things find<br />a <em>second home.</em></h1>
            <p>Pass along what you don't need. Find what makes dorm life better.</p>
            <div className="welcome-actions"><button className="button button-dark" onClick={() => navigate('marketplace')}>Explore the market <Icon name="arrow" size={16} /></button><button className="button button-light" onClick={() => navigate('new-listing')}><Icon name="plus" size={16} /> List an item</button></div>
          </div>
          <div className="welcome-art" aria-label="Illustration of a student sharing a plant">
            <div className="art-sun" /><div className="art-plant"><div className="plant-leaf leaf-one" /><div className="plant-leaf leaf-two" /><div className="plant-leaf leaf-three" /><div className="plant-pot" /></div>
            <div className="art-card art-note"><span className="note-spark">✳</span><strong>Good stuff,<br />going places.</strong></div>
            <span className="art-caption">a little more community<br />in every handoff</span>
          </div>
        </section>
        <section className="stats-grid" aria-label="Marketplace overview">
          <StatCard label="Total listings" value={items.length} hint="things to pass along" icon="grid" />
          <StatCard label="Available now" value={availableItems.length} hint="ready for a new home" icon="tag" accent />
          <StatCard label="Active claims" value={activeClaims} hint="pickup in progress" icon="clock" />
          <StatCard label="Handed off" value={completed} hint="happy new owners" icon="check" />
        </section>
        <section className="section-block">
          <div className="section-heading"><div><span className="eyebrow">FRESH FINDS</span><h2>Recently listed</h2></div><button className="text-button" onClick={() => navigate('marketplace')}>See everything <Icon name="arrow" size={15} /></button></div>
          <div className="item-grid">{recentItems.map((item) => <ItemCard key={item.id} item={item} onOpen={setSelectedItem} compact />)}</div>
        </section>
        <section className="community-strip"><span className="community-icon"><Icon name="leaf" size={21} /></span><p><strong>Good for your room. Better for your community.</strong><br />Every exchange keeps useful things on campus and out of storage.</p><span className="community-avatars"><span>J</span><span>R</span><span>A</span><small>and your neighbors</small></span></section>
      </>
    )
  }

  function renderMarketplace() {
    return (
      <>
        <PageIntro eyebrow="THE CAMPUS MARKET" title="Find your next favorite thing." description="Pre-loved, passed along, and waiting just down the hall." />
        <div className="market-tools">
          <label className="search-field"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search finds, categories, or dorms..." aria-label="Search marketplace" /><kbd>⌘ K</kbd></label>
          <label className="select-wrap"><Icon name="sliders" size={16} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort items"><option value="newest">Recently added</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
        </div>
        <div className="filter-row"><div className="category-pills" aria-label="Filter by category">{categories.map((name) => <button key={name} className={`filter-pill ${category === name ? 'selected' : ''}`} onClick={() => setCategory(name)}>{name}</button>)}</div>        <div className="price-pills"><button className={priceFilter === 'all' ? 'selected' : ''} onClick={() => setPriceFilter('all')}>All finds</button><button className={priceFilter === 'free' ? 'selected' : ''} onClick={() => setPriceFilter(priceFilter === 'free' ? 'all' : 'free')}>Free only</button><button className={priceFilter === 'paid' ? 'selected' : ''} onClick={() => setPriceFilter(priceFilter === 'paid' ? 'all' : 'paid')}>Paid only</button></div></div>
        <div className="results-caption"><span>{filteredItems.length} {filteredItems.length === 1 ? 'find' : 'finds'} around campus</span><span className="results-note"><span className="live-dot" /> Updated just now</span></div>
        {filteredItems.length
          ? <div className="item-grid marketplace-grid">{filteredItems.map((item) => <ItemCard key={item.id} item={item} onOpen={setSelectedItem} />)}</div>
          : <EmptyState icon="search" title="No finds match just yet" message="Try a different search or clear some filters to see what's around." action={<button className="button button-outline" onClick={() => { setQuery(''); setCategory('All'); setPriceFilter('all') }}>Clear filters</button>} />}
      </>
    )
  }

  function renderListings() {
    const activeFor = (itemId) => snapshot.claims.find((claim) => claim.itemId === itemId && claim.status === 'active')
    const completedFor = (itemId) => snapshot.claims.filter((claim) => claim.itemId === itemId && claim.status === 'completed').length
    return (
      <>
        <PageIntro eyebrow="YOUR LITTLE CORNER" title="My listings." description="Keep an eye on what's finding a new home." action={<button className="button button-dark" onClick={() => navigate('new-listing')}><Icon name="plus" size={16} /> Add a listing</button>} />
        {userListings.length
          ? <div className="listing-stack">{userListings.map((item) => {
            const claim = activeFor(item.id)
            return <article className="listing-row" key={item.id}>
              <ItemImage item={item} className="listing-thumb" />
              <div className="listing-main"><div className="listing-title-line"><h3>{item.title}</h3><StatusBadge status={item.status} /></div><p>{item.category} <span>·</span> {money(item)} <span>·</span> {item.dormLocation}</p>{claim && <div className="claim-note"><Icon name="clock" size={15} /> Held by <strong>{claim.buyerName}</strong> · {formatTime(Date.parse(claim.expiresAt) - now)} left</div>}{completedFor(item.id) > 0 && <div className="claim-note completed-note"><Icon name="check" size={15} /> {completedFor(item.id)} completed handoff{completedFor(item.id) > 1 ? 's' : ''}</div>}</div>
              <div className="listing-actions">{item.status !== 'sold' && <button className="button button-outline button-small" onClick={() => confirmAction('Mark this item as sold?', 'This ends any active claim and removes the item from the available marketplace.', () => { const result = markAsSold(item.id, currentUser.id); showToast(result.invalidatedClaim ? 'Marked sold. The active claim was ended.' : 'Marked sold and removed from available finds.'); }, 'Mark as sold')}>Mark as sold</button>}<button className="icon-button remove-button" aria-label={`Remove ${item.title}`} onClick={() => confirmAction('Remove this listing?', 'The item will disappear from the marketplace and any active claim will be invalidated.', () => { const result = removeListing(item.id, currentUser.id); showToast(result.invalidatedClaim ? 'Listing removed. The active claim was ended.' : 'Listing removed from the marketplace.'); }, 'Force remove')}><Icon name="close" size={17} /></button></div>
            </article>
          })}</div>
          : <EmptyState icon="tag" title="Your shelf is still empty" message="List a useful thing and give it a second life with someone nearby." action={<button className="button button-dark" onClick={() => navigate('new-listing')}><Icon name="plus" size={16} /> Create a listing</button>} />}
      </>
    )
  }

  function renderClaims() {
    const claims = [...userClaims].sort((a, b) => Date.parse(b.claimedAt) - Date.parse(a.claimedAt))
    const itemMap = new Map(snapshot.items.map((item) => [item.id, item]))
    return (
      <>
        <PageIntro eyebrow="PICKUP PLANS" title="My claims." description="Your holds, pickup details, and happy handoffs in one place." />
        {claims.length
          ? <div className="claim-stack">{claims.map((claim) => {
            const item = itemMap.get(claim.itemId)
            const remaining = Date.parse(claim.expiresAt) - now
            return <article className={`claim-row ${claim.status !== 'active' ? 'claim-row-inactive' : ''}`} key={claim.id}>
              <ItemImage item={item} className="claim-thumb" />
              <div className="claim-main"><div className="listing-title-line"><h3>{item.title}</h3><StatusBadge status={claim.status} /></div><p>From <strong>{item.sellerName}</strong> <span>·</span> <Icon name="pin" size={14} /> {item.dormLocation}</p>{claim.status === 'active' && <div className={`countdown ${remaining < 30000 ? 'countdown-urgent' : ''}`}><Icon name="clock" size={15} /> Pickup hold expires in <strong>{formatTime(remaining)}</strong></div>}{claim.status === 'expired' && <div className="claim-note">This hold expired. The item is available again.</div>}{claim.status === 'invalidated' && <div className="claim-note">The seller ended this hold because the item was sold or removed.</div>}{claim.status === 'completed' && <div className="claim-note completed-note"><Icon name="check" size={15} /> Pickup confirmed · {new Date(claim.claimedAt).toLocaleDateString()}</div>}</div>
              {claim.status === 'active' && <button className="button button-dark button-small" onClick={() => confirmAction('Confirm your pickup?', 'This completes the handoff and marks the item as sold. Confirm only after you have met the seller.', () => { const result = confirmPickup(claim.id, currentUser.id); showToast(result.ok ? 'Pickup confirmed. Enjoy your find!' : 'This claim is no longer active.', result.ok ? 'success' : 'error'); }, 'Confirm pickup', 'dark')}>Confirm pickup <Icon name="check" size={15} /></button>}
            </article>
          })}</div>
          : <EmptyState icon="bookmark" title="Nothing on hold yet" message="When you find something you love, claim it and make a pickup plan with your neighbor." action={<button className="button button-dark" onClick={() => navigate('marketplace')}>Explore the marketplace <Icon name="arrow" size={15} /></button>} />}
      </>
    )
  }

  function renderNewListing() {
    return (
      <>
        <PageIntro eyebrow="PASS IT ALONG" title="List something lovely." description="A clear description helps the right neighbor find it." />
        <form className="listing-form" onSubmit={submitListing}>
          <div className="form-section"><span className="form-step">01</span><div className="form-section-content"><h2>The item</h2><p>Give your find a name and a little story.</p><label className="form-label">Item title <span>*</span><input value={listingForm.title} onChange={(event) => setListingForm({ ...listingForm, title: event.target.value })} placeholder="e.g. Warm glow study lamp" required maxLength={70} /></label><label className="form-label">Description <span>*</span><textarea value={listingForm.description} onChange={(event) => setListingForm({ ...listingForm, description: event.target.value })} placeholder="Share the details a neighbor would want to know..." rows="4" required maxLength={500} /></label><div className="form-two-col"><label className="form-label">Category <span>*</span><select value={listingForm.category} onChange={(event) => setListingForm({ ...listingForm, category: event.target.value })} required><option value="">Choose a category</option>{categories.slice(1).map((value) => <option key={value}>{value}</option>)}</select></label><label className="form-label">Photo URL <small>optional</small><input type="url" value={listingForm.imageUrl} onChange={(event) => setListingForm({ ...listingForm, imageUrl: event.target.value })} placeholder="https://..." /></label></div></div></div>
          <div className="form-section"><span className="form-step">02</span><div className="form-section-content"><h2>Price & pickup</h2><p>Set a fair price and an easy campus handoff spot.</p><div className="price-choice"><button type="button" className={!listingForm.isFree ? 'active' : ''} onClick={() => setListingForm({ ...listingForm, isFree: false })}><Icon name="tag" size={16} /> Set a price</button><button type="button" className={listingForm.isFree ? 'active' : ''} onClick={() => setListingForm({ ...listingForm, isFree: true, price: '' })}><Icon name="leaf" size={16} /> Give it away</button></div>{!listingForm.isFree && <label className="form-label price-input">Price (USD) <span>*</span><div className="input-prefix"><span>$</span><input type="number" min="0" step="1" value={listingForm.price} onChange={(event) => setListingForm({ ...listingForm, price: event.target.value })} placeholder="0" required /></div></label>}<label className="form-label">Dorm / pickup location <span>*</span><input value={listingForm.dormLocation} onChange={(event) => setListingForm({ ...listingForm, dormLocation: event.target.value })} placeholder="e.g. Maple Hall · Lobby" required maxLength={90} /></label></div></div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-footer"><span><span className="live-dot" /> Listed for your campus community</span><button className="button button-dark" type="submit">Publish listing <Icon name="arrow" size={16} /></button></div>
        </form>
      </>
    )
  }

  const pageTitles = { dashboard: 'Overview', marketplace: 'Marketplace', listings: 'My listings', claims: 'My claims', 'new-listing': 'New listing' }
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: 'home' },
    { id: 'marketplace', label: 'Marketplace', icon: 'grid', count: availableItems.length },
    { id: 'listings', label: 'My listings', icon: 'tag' },
    { id: 'claims', label: 'My claims', icon: 'bookmark', count: userClaims.filter((claim) => claim.status === 'active').length },
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('dashboard')} aria-label="Commonroom home"><span className="brand-mark"><span /><span /><span /></span><span>commonroom<small>THE CAMPUS MARKET</small></span></button>
        <div className="side-label">YOUR SPACE</div>
        <nav className="side-nav" aria-label="Main navigation">{navItems.map((item) => <button key={item.id} className={activePage === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.count > 0 && <small>{item.count}</small>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="campus-card"><span className="campus-illustration"><Icon name="leaf" size={20} /></span><strong>A kinder kind<br />of campus.</strong><p>Small exchanges.<br />Big community energy.</p><span className="campus-spark">✳</span></div><div className="user-switcher"><label htmlFor="demo-user">DEMO ACCOUNT</label><div className="user-select"><span className="avatar">{currentUser.name.charAt(0)}</span><select id="demo-user" value={currentUser.id} onChange={(event) => saveUser(event.target.value)}>{demoUsers.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</select><span className="online-dot" /></div></div><span className="sidebar-foot">Made for neighbors, by neighbors <span>✳</span></span></div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="breadcrumb"><span>COMMONROOM</span><Icon name="chevron" size={14} /><strong>{pageTitles[activePage]}</strong></div><div className="topbar-right"><span className="campus-status"><span className="live-dot" /> North Campus</span><div className="top-user"><span className="avatar">{currentUser.name.charAt(0)}</span><span><strong>{currentUser.name}</strong><small>Student account</small></span></div><label className="mobile-user-label"><span className="sr-only">Switch demo account</span><select className="mobile-user-switch" value={currentUser.id} onChange={(event) => saveUser(event.target.value)} aria-label="Switch demo account">{demoUsers.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</select></label><button className="mobile-menu" onClick={() => navigate('marketplace')} aria-label="Go to marketplace"><Icon name="menu" /></button></div></header>
        <div className="page-content">
          {activePage === 'dashboard' && renderDashboard()}
          {activePage === 'marketplace' && renderMarketplace()}
          {activePage === 'listings' && renderListings()}
          {activePage === 'claims' && renderClaims()}
          {activePage === 'new-listing' && renderNewListing()}
          <footer className="page-footer"><span>COMMONROOM <span>✳</span> A better way to pass it on.</span><span>Campus life, shared.</span></footer>
        </div>
      </main>
      {selectedItem && <Modal title={selectedItem.title} eyebrow={selectedItem.category} onClose={() => setSelectedItem(null)} wide><div className="detail-layout"><ItemImage item={selectedItem} className="detail-image" /><div className="detail-copy"><div className="detail-price">{money(selectedItem)} <StatusBadge status={selectedItem.status} /></div><p>{selectedItem.description}</p><div className="detail-info"><span className="avatar">{selectedItem.sellerName.charAt(0)}</span><span><small>LISTED BY</small><strong>{selectedItem.sellerName}</strong></span></div><div className="detail-info"><span className="detail-icon"><Icon name="pin" /></span><span><small>MEET UP AT</small><strong>{selectedItem.dormLocation}</strong></span></div>{selectedItem.status === 'available' ? <button className="button button-dark detail-claim" onClick={() => handleClaim(selectedItem)}>Claim item <Icon name="arrow" size={16} /></button> : selectedItem.status === 'claimed' ? <p className="detail-unavailable"><Icon name="clock" size={16} /> This item is on hold for another student.</p> : <p className="detail-unavailable">This item is no longer available.</p>}<small className="no-payment-note">No online payment here — coordinate a simple campus handoff.</small></div></div></Modal>}
      {confirmDialog && <Modal title={confirmDialog.title} eyebrow="QUICK CHECK" onClose={() => setConfirmDialog(null)}><p className="confirm-copy">{confirmDialog.message}</p><div className="confirm-actions"><button className="button button-outline" onClick={() => setConfirmDialog(null)}>Keep it</button><button className={`button ${confirmDialog.tone === 'dark' ? 'button-dark' : 'button-danger'}`} onClick={() => { confirmDialog.action(); setConfirmDialog(null) }}>{confirmDialog.confirmLabel}</button></div></Modal>}
      {toast && <div className={`toast toast-${toast.type}`} role="status"><span className="toast-mark">{toast.type === 'error' ? '!' : toast.type === 'info' ? 'i' : '✓'}</span><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><Icon name="close" size={15} /></button></div>}
      <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.slice(0, 4).map((item) => <button key={item.id} className={activePage === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><Icon name={item.icon} size={19} /><span>{item.label}</span></button>)}</nav>
    </div>
  )
}

function StatCard({ label, value, hint, icon, accent = false }) {
  return <article className={`stat-card ${accent ? 'stat-accent' : ''}`}><span className="stat-icon"><Icon name={icon} size={18} /></span><span className="stat-label">{label}</span><strong>{value}</strong><small>{hint}</small></article>
}

function PageIntro({ eyebrow, title, description, action }) {
  return <div className="page-intro"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

export default App
