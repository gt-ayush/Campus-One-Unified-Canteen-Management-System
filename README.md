# One Campus, One Food Pass

## A Smart Pre-Order and Multi-Canteen Management Platform

### 1. Project Overview
One Campus, One Food Pass is a student-centered digital platform that connects students with multiple registered campus canteens. It allows students to purchase eligible food packages, pre-order meals, select pickup time slots, and collect food using a QR code or student ID. The platform helps canteens manage orders, stock, preparation capacity, and settlements while reducing queues and potentially minimizing food waste.

### 2. Problem Statement
Students often spend a significant part of their limited lunch break travelling to canteens and waiting in queues. Food items may be unavailable, counters may be overcrowded, and students may need separate payment methods at different outlets. Canteen operators may struggle to predict demand, manage stock, and handle peak-time orders. A unified pre-ordering and food-pass platform can address these problems.

### 3. Project Objectives
- Reduce waiting time and make food collection more predictable.
- Provide one digital food pass across participating canteens.
- Enable advance ordering and scheduled pickup.
- Prevent orders from exceeding stock or preparation capacity.
- Provide fair cancellation rules and accountability.
- Help canteens track sales and receive transparent settlements.
- Support demand planning and food-waste reduction.

### 4. User Roles
**Students:** Register, browse menus, buy food passes, pre-order, choose pickup slots, view order status, collect food by QR code, and submit feedback.

**Canteen operators:** Register and manage their outlet, update menus and stock, configure pickup capacity, accept orders, update preparation status, verify collection, and view sales and settlement reports.

**Platform administrators:** Verify accounts and canteens, manage packages, review complaints, monitor transactions, configure platform fees, and investigate unusual activity.

### 5. Core Features
#### Student food pass
- Semester or annual prepaid packages.
- Defined meal credits, eligible items, validity, and daily limits.
- One pass usable at multiple registered canteens.
- Remaining credits, transaction history, and digital receipts.
- Clearly defined refund and expiry rules.

#### Menu and pre-ordering
- Browse canteens, menus, prices, and item availability.
- Select meals, quantities, and pickup time slots.
- Receive an order confirmation and unique order ID.
- View order progress and pickup instructions.

#### Scheduled pickup
- Canteens configure pickup windows, such as 12:30–12:45 PM.
- Each time slot has an order limit based on staff and preparation capacity.
- The system prevents overbooking and stops accepting orders for full slots.
- Students receive a notification when the order is ready.

#### Stock management
- Canteens maintain item availability and quantity.
- Accepted orders reserve the relevant stock.
- Stock is released if an order is cancelled under the allowed policy.
- The system prevents sales beyond available stock.

#### Alternative canteen suggestions
- If an item is unavailable or a slot is full, show suitable alternatives.
- Consider availability, price, distance, and pickup time where data is available.
- Obtain student confirmation before changing the canteen or order.
- Never silently redirect an order to a different outlet.

#### QR-based collection
- Generate a unique, hard-to-guess token for each order.
- Verify the order and its canteen before collection.
- Mark an order collected only once.
- Prevent duplicate scans and unauthorized collection.
- Provide an alternative identity-verification process when a student cannot access their phone.

### 6. Order Status Lifecycle
1. **Pending:** The order has been submitted and awaits acceptance if required.
2. **Confirmed:** The canteen has accepted the order; cancellation may be allowed.
3. **Preparing:** Preparation has genuinely started; ordinary cancellation is locked.
4. **Ready:** The food is ready for pickup.
5. **Collected:** The student has collected the order and the transaction can be finalized.
6. **Cancelled:** The order was cancelled under the applicable policy.
7. **Rejected or Unable to Fulfil:** The canteen cannot complete the order; the student is notified and eligible credits or payment are restored according to policy.

Invalid status transitions must be rejected by the server. A client interface alone must not determine whether an order can be cancelled or collected.

### 7. Smart Cancellation Policy
- Students can cancel before preparation begins, subject to the published cutoff and package rules.
- When preparation genuinely starts, the canteen records the status and the server timestamps the transition.
- Once the order enters Preparing, ordinary cancellation is disabled.
- A canteen cannot mark an order Preparing merely to block cancellation; unusual patterns can trigger review.
- Preparation-status changes must be logged with the staff account and timestamp.
- If the canteen cannot fulfil an order, the student receives the applicable refund or restored meal credits.
- Admins can review disputed cases and correct errors with an audit trail.
- Any preparation-capacity limits must reflect real operational capacity rather than arbitrary universal numbers.

### 8. Capacity and Rush-Hour Management
- Configure capacity separately for each canteen and pickup slot.
- Limit accepted orders by kitchen workload and item availability.
- Reserve capacity atomically when an order is accepted to prevent overbooking.
- Stop accepting orders when a slot reaches capacity.
- Offer another slot or an alternative canteen when available.
- Track late preparation, rejected orders, and no-shows to improve future scheduling.

### 9. Merchant Registration
- Canteens submit outlet information, menus, prices, and settlement details.
- The platform verifies the outlet before activation.
- Approved outlets can manage orders through a merchant dashboard.
- Registration fees and subscriptions, if any, are disclosed before onboarding.
- Merchant access can be suspended following documented review of serious misuse.

### 10. Payments and Settlement
For the initial prototype, payment can be simulated or verified manually by an administrator. A production platform may integrate a suitable payment gateway after its commercial and compliance requirements are assessed.

The platform should separately record:
- Student payments and food-pass purchases.
- Eligible meal-credit deductions.
- Completed individual orders.
- Refunds and restored credits.
- Merchant gross sales.
- Platform fees and other disclosed deductions.
- Net merchant settlement and payout status.

A merchant settlement report should show the period, completed orders, adjustments, fees, and net amount payable. Prepaid funds must not be treated automatically as platform revenue. Unused credits, refunds, and payout rules must be defined in advance.

### 11. Revenue Model
- A disclosed fee on eligible completed transactions.
- Optional merchant subscription plans.
- A reasonable onboarding fee where justified.
- Optional premium merchant analytics.
- Clearly labelled sponsored listings.

The model should be tested for fairness to students and canteen owners. Revenue assumptions must be validated before launch.

### 12. Analytics and Food-Waste Reduction
- Daily and monthly order volumes.
- Popular items and peak pickup periods.
- Item-level stock and stockout frequency.
- Preparation time and order fulfilment rates.
- Cancellation and no-show rates.
- Estimated demand based on historical orders.
- Optional surplus tracking to support better preparation planning.

Demand forecasts are estimates, not guaranteed customer counts. Start with simple historical averages before introducing more advanced prediction models.

### 13. Suggested Main Screens
**Student:** Sign in, dashboard, canteen list, menu, cart, pickup-slot selection, food pass, order tracking, QR collection code, history, and feedback.

**Canteen:** Merchant dashboard, menu editor, stock manager, incoming orders, pickup schedule, preparation status, QR verification, reports, and settlements.

**Administrator:** Student verification, merchant approval, package management, transaction records, dispute review, fee configuration, audit logs, and analytics.

### 14. Suggested Technical Architecture
A web application or mobile-friendly progressive web app can be used for the initial release.

- **Frontend:** TypeScript or another suitable component-based web framework.
- **Backend:** Node.js with Express, or another API framework.
- **Database:** PostgreSQL for structured records and transactions.
- **Authentication:** Secure sessions or token-based authentication with role-based access control.
- **QR verification:** Server-generated, unique, short-lived or single-use collection tokens.
- **Notifications:** Email or push notifications, with in-app status updates as a baseline.
- **Payments:** Simulated/manual approval for the prototype; a payment gateway for a later production release.

These are suggested technologies, not mandatory requirements.

### 15. Core Data Entities
- **User:** Student, merchant staff, or administrator identity and role.
- **StudentProfile:** Student identifier and verification status.
- **Canteen:** Outlet details, approval status, and operating hours.
- **MenuItem:** Name, price, availability, and stock quantity.
- **FoodPass:** Package, validity, credits, and status.
- **Order:** Student, canteen, items, pickup slot, amount, and status.
- **OrderItem:** Item, quantity, and price snapshot at order time.
- **PickupSlot:** Time window, capacity, and reserved order count.
- **Payment:** Payment reference, amount, and status.
- **Settlement:** Merchant, period, completed sales, fees, adjustments, and payout status.
- **AuditLog:** Actor, action, timestamp, and relevant record identifier.
- **Feedback:** Rating, complaint category, and resolution status.

### 16. Security and Reliability
- Enforce role-based permissions on the server.
- Validate all prices, credits, stock, and order transitions on the server.
- Use database transactions for stock reservations, credit deductions, and settlement calculations.
- Make payment callbacks idempotent to avoid duplicate crediting.
- Protect personal and payment-related information.
- Rate-limit sensitive endpoints and monitor suspicious activity.
- Store audit logs for preparation changes, refunds, and collection scans.
- Back up important data and define recovery procedures.
- Never store raw payment-card details unless the applicable secure payment architecture explicitly supports it.

### 17. Design Thinking Process
**Empathize:** Interview students about queues, lunch breaks, food availability, and payment habits. Interview canteen operators about capacity, stock, and preparation workflows.

**Define:** Frame the central problem as reducing waiting and uncertainty while preserving realistic kitchen capacity.

**Ideate:** Compare pre-ordering, pickup slots, QR collection, food passes, stock controls, and cancellation policies.

**Prototype:** Build clickable student screens, a merchant order dashboard, and a simulated QR collection workflow.

**Test:** Observe users completing realistic tasks. Record completion time, errors, confusion, and feedback. Revise the design based on evidence.

### 18. Suggested Development Roadmap
**Phase 1 — Research:** Conduct interviews and map current student and canteen journeys.

**Phase 2 — UI prototype:** Build student, merchant, and administrator screens using sample data.

**Phase 3 — Core ordering:** Implement menus, orders, pickup slots, stock controls, and status transitions.

**Phase 4 — Pass and QR:** Add meal-credit accounting and single-use collection verification.

**Phase 5 — Merchant operations:** Add registration approval, settlement reports, and audit logs.

**Phase 6 — Pilot testing:** Test with a small group of students and one or two canteens before expanding.

**Phase 7 — Advanced features:** Add demand prediction, group orders, subscriptions, and payment integration if justified.

### 19. Success Metrics
- Average time from arrival to food collection.
- Percentage of orders collected within the chosen pickup window.
- Order cancellation and no-show rates.
- Stockout and overbooking incidents.
- Order fulfilment and preparation delay rates.
- Student satisfaction and repeat usage.
- Merchant satisfaction and settlement accuracy.
- Estimated food waste compared with an appropriate baseline.

### 20. Prototype Acceptance Criteria
- A student can register and browse approved canteens.
- A student can choose an available item and pickup slot.
- The system rejects an order when stock or capacity is insufficient.
- A confirmed order follows valid status transitions.
- Cancellation is blocked after preparation begins, except for authorized exception handling.
- A QR collection token cannot be used twice.
- A canteen can view its own orders and reports but not another canteen's private records.
- An administrator can approve merchants and review logged actions.
- Settlement calculations can be reconciled against completed orders and documented adjustments.

### 21. Limitations and Future Scope
The first prototype may use simulated payments, manually approved passes, and a limited number of canteens. Live payments, automatic settlements, forecasting, and multi-campus operations can be added after user testing and operational validation.

### 22. Conclusion
One Campus, One Food Pass aims to make campus food access more convenient through advance ordering, scheduled pickup, QR-based collection, and a shared student food pass. Stock controls, realistic preparation capacity, fair cancellation rules, and transparent merchant settlements help create a more reliable system for both students and canteen operators.

**Project Title:** One Campus, One Food Pass: A Smart Pre-Order and Multi-Canteen Management System.
