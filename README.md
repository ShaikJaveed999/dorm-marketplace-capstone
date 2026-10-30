# Commonroom — Dorm Marketplace

Commonroom is a responsive, student-to-student marketplace for passing useful things along between dorms. Students can list an item, find something nearby, hold it while arranging a pickup, and confirm the in-person handoff. This capstone prototype runs entirely in the browser and uses LocalStorage; it has no backend and does not process payments.

## Problem statement

Students routinely need affordable dorm essentials while other students have useful items they no longer need. Existing general marketplaces are not designed around campus locations, quick handoffs, or the short-lived nature of student housing. Commonroom makes it easier to find local items and coordinate a simple campus pickup.

## Technology stack

- React 19 and JavaScript
- Vite for development and production builds
- Modern CSS with responsive layouts and an accessible component structure
- Browser LocalStorage for marketplace persistence
- Web Locks API for same-origin tab coordination where supported
- Vitest, jsdom, and Testing Library tooling for automated validation

## MVP features

1. Create and manage marketplace listings.
2. Browse available items and claim them.
3. Complete or resolve claims through pickup confirmation.

### Intentionally excluded

- Online payments — Payment processing is unnecessary for the Day 1 prototype.
- Live chat — Direct messaging is outside the essential marketplace workflow.
- Delivery tracking — All exchanges happen through in-person campus handoffs.

## Application structure

```text
src/
  data/seed.js              Demo users and sample listings
  lib/marketplace.js        LocalStorage model and centralized marketplace operations
  lib/marketplace.test.js   Business logic and scenario tests
  App.jsx                   Dashboard, navigation, listing, claim, and detail views
  App.css                   Responsive product design system
  index.css                 Global typography and base styles
  testSetup.js              Testing Library matchers
```

## Data model

The application stores one versioned snapshot at `commonroom-marketplace-v1`:

- **Item:** `id`, `title`, `description`, `category`, `price`, `isFree`, `sellerId`, `sellerName`, `dormLocation`, `imageUrl`, `status`, `createdAt`, and `updatedAt`.
- **Claim:** `id`, `itemId`, `buyerId`, `buyerName`, `claimedAt`, `expiresAt`, and `status`.
- Item statuses are `available`, `claimed`, `sold`, or `removed`.
- Claim statuses are `active`, `expired`, `completed`, or `invalidated`.

Writing items and claims together as one snapshot preserves their relationships during each browser-local state transition. Invalid or incompatible stored JSON is reported to the console and recovered to the demo seed data.

## Claim lifecycle

`available` → `claimed` → `completed` is the normal lifecycle. The student holding an item confirms pickup after meeting the seller, completing the claim and marking the item sold. If a buyer does not confirm before the two-minute demonstration hold expires, the claim becomes `expired` and the item returns to `available`. A seller's sold/remove override changes an active claim to `invalidated`.

## Concurrency collision

All item claims go through `claimItem()`. It re-reads the latest snapshot, expires due holds, checks item status and active claims, and writes the new item-plus-claim state together. When available, the Web Locks API serializes claims across same-origin tabs using an item-specific exclusive lock. The losing student receives an unavailable result, regardless of whether the UI still showed a Claim button.

**Concurrency limitation:** LocalStorage and Web Locks are browser-local. The fallback (when Web Locks is unavailable) re-reads the latest stored state before a synchronous check-and-write, which protects ordinary repeated actions in one browser context but cannot guarantee atomic coordination between competing tabs on browsers without Web Locks. Neither mechanism provides distributed locking across devices, profiles, or browsers. A production multi-device marketplace needs a server-side database transaction or equivalent atomic claim operation.

## Ghost buyer expiration

The default hold lasts two minutes for demonstration. Each active claim records `claimedAt` and `expiresAt`; the UI shows a countdown and checks expiration every second. Expiration also runs on page initialization, so overdue holds are released after a reload. `claimItem()` accepts an injectable `claimDurationMs` option to make shorter deterministic tests possible.

## Hallway sale override

The listing owner can mark an item sold or force-remove it while a buyer's hold is active. The centralized seller operation invalidates the active claim and changes the item's status before the updated snapshot refreshes the marketplace, listing, and claim views. Confirmation dialogs explain the effect before either override.

## LocalStorage implementation

LocalStorage is intentionally used to keep this assignment easy to run without a backend. The persisted state is initialized with demo listings on first use and updated through operations in `src/lib/marketplace.js`. Updates notify views in the current tab and listen to browser `storage` events for other same-origin tabs. Browser storage can be cleared or edited by the user, has limited capacity, and is not synchronized to a server.

## Demo accounts

Use the account selector in the sidebar to switch among:

- **Javid** — Seller for the seeded listings.
- **Rahul** — Buyer account.
- **Arjun** — A second buyer account for the claim collision demonstration.

There is no reset button in the demo UI. To restore the initial seed, clear the `commonroom-marketplace-v1` and `commonroom-demo-user` keys in browser storage, then reload.

## Setup and run

Requirements: Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The app starts with sample listings and works without a database or payment service.

## Testing and production build

```bash
npm test
npm run build
npm run lint
```

The test suite covers listing creation, marketplace availability/search/category filtering, claims and competing buyers, expiration and item restoration, pickup confirmation, seller overrides, persistence, invalid listing data, and corrupt storage recovery.

## Known limitations

- Data is local to the current browser profile and is not shared with other devices.
- Web Locks coordinate only tabs on the same origin when the API is supported; the LocalStorage fallback is not a distributed lock and cannot guarantee cross-device atomicity.
- Demo users are a selector, not authenticated accounts; anyone using the browser can change identities or stored data.
- Pickups and any payment are coordinated by students in person; payments are not processed.
- Demo listings use remote image URLs and the app falls back to a category illustration if an image cannot load.
- The two-minute claim duration is intentionally short for classroom demonstrations.
