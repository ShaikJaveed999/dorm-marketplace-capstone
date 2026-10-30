# Dorm Marketplace — Product Requirements

## 1. Scope Cut

1. Online payments – Payment processing is unnecessary for the Day 1 prototype.
2. Live chat – Direct messaging is outside the essential marketplace workflow.
3. Delivery tracking – All exchanges happen through in-person campus handoffs.

## 2. MVP Features

1. Create and manage marketplace listings.
2. Browse available items and claim them.
3. Complete or resolve claims through pickup confirmation.

## 3. Acceptance Criteria

1. **Successful claim** — Given an item is available and a student is signed in, when the student selects Claim Item, then exactly one active claim is created for that student, the item changes to claimed, and the student sees the pickup countdown.
2. **Competing claims** — Given an item is available and two students attempt to claim it at nearly the same time, when both claim operations are processed, then one succeeds, the other receives an item-unavailable result, and the item has no more than one active claim.
3. **Expired claim** — Given an item has an active claim whose expiration time has passed, when the marketplace checks claim expiration after the timer or a page reload, then the claim becomes expired and the item becomes available for another student to claim.
