# Video explanation script (3–5 minutes)

**Target length:** approximately 4 minutes. This is a recording script and demonstration guide; no video has been recorded or uploaded.

## 0:00–0:25 — Introduction

“Hi, this is Commonroom, my Dorm Marketplace capstone. It helps students pass useful dorm essentials along to neighbors nearby. Instead of browsing a general marketplace, students can find campus items, arrange an in-person pickup, and confirm the handoff.”

## 0:25–0:50 — MVP and scope

“The MVP has three things: create and manage listings, browse and claim available items, and complete or resolve a claim through pickup confirmation. I intentionally cut online payments because the Day 1 prototype does not need payment processing, live chat because messaging is outside the essential flow, and delivery tracking because all exchanges happen through campus handoffs.”

## 0:50–1:15 — Claim acceptance criteria

“A successful claim creates one active hold and gives the student a countdown. If two students compete for one available item, only one claim can succeed and the other sees that the item is unavailable. If a claim expires, the claim is invalidated as expired and the item becomes available again.”

## 1:15–2:00 — Application demonstration

1. Show the Commonroom dashboard, summary cards, fresh finds, and responsive navigation.
2. Open Marketplace; search for a keyboard, switch categories, try the free filter, and sort by price.
3. Open an item to show its description, seller, price, dorm location, status, and claim action.
4. As Javid, open My Listings and publish a sample listing. Show the required form fields and the new listing.
5. Switch to Rahul and claim an available item. Open My Claims and point out the seller, pickup location, and countdown.

## 2:00–2:45 — Concurrency collision

“Claims are routed through one centralized operation. It re-reads the stored state and checks for an active claim before changing the item. On browsers with Web Locks, same-origin tabs use an exclusive per-item lock.”

1. Open the marketplace in two browser tabs on the same origin.
2. Select Rahul in one tab and Arjun in the other.
3. Reload both tabs, quickly attempt to claim the same available item in each, and show that only one claim succeeds while the other gets an unavailable message.
4. Explain: “This is a browser-local prototype. Web Locks do not coordinate across devices, and the LocalStorage fallback cannot guarantee distributed atomicity.”

## 2:45–3:25 — Ghost buyer

“A hold lasts two minutes by default. The claim stores both claimed-at and expires-at timestamps. The countdown checks every second and overdue claims are also checked when the app loads.”

1. Claim a fresh item and show its countdown.
2. Leave it unconfirmed until the timer runs out, or temporarily use a short test duration when running the automated tests.
3. Show the expired claim in My Claims and the item back in Marketplace as available.

## 3:25–3:50 — Hallway sale and engineering

“If Javid sells an item in the hallway while a claim is active, the seller can mark it sold or force-remove it. The confirmation explains that the active hold will end. The operation invalidates that claim and updates the item in the same persisted snapshot, so it disappears from the market and the buyer sees that the hold ended.”

“The app uses React and Vite, JavaScript, responsive CSS, LocalStorage for a backend-free demo, and Vitest for repeatable business-logic tests. In production, a server transaction would be required for reliable multi-device claims.”

## Demonstration preparation

- Start with `npm run dev`, then open the printed local URL.
- Keep the dashboard and one other page ready for a quick feature tour.
- Use separate same-origin tabs and the Rahul and Arjun demo accounts for the collision.
- For a faster expiration demonstration, use the test suite as supporting evidence or temporarily configure a shorter claim duration in development; the demo default is two minutes.
- To restore seeded data between takes, remove the `commonroom-marketplace-v1` and `commonroom-demo-user` LocalStorage keys, then reload.
