# One Campus, One Food Pass

A smart pre-order and multi-canteen management platform: students buy food passes, pre-order meals into capacity-limited pickup slots, and collect with single-use QR codes. Canteens manage menus, slots, and orders; admins approve merchants and reconcile settlements.

## Quick Start

```bash
npm install
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, QR_SECRET
npx prisma db push             # sync schema (no migrations dir in repo)
npx prisma db seed             # load demo users, canteens, menus, slots
npm run dev                    # http://localhost:3000
```

```bash
npm run build && npm start     # production
npx prisma studio              # visual DB browser
```

### Environment

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 32 chars |
| `QR_SECRET` | Yes | Min 64 chars, HMAC signing for QR tokens |

### Test Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@campusfoodpass.com | password123 |
| Student | student@campusfoodpass.com | password123 |
| Merchant | merchant@campusfoodpass.com | password123 |

## Architecture

```
Client (Next.js App Router)
  → src/middleware.ts (thin delegate, no logic)
    → src/proxy.ts edge guards: JWT verify, rate limit, method-aware RBAC, auth header injection
      → API routes (src/app/api/v1/) — Zod validation, role/ownership checks
        → Service layer (import "server-only") — transactions, state machine, QR, settlement
          → PostgreSQL via Prisma
```

Method-aware RBAC: students may `GET` menus/slots/orders and `POST` orders, but not write menus/slots or touch `/merchants/*`; merchants are scoped to their own canteen; admin-only routes return 403 otherwise. Public browsing (`GET /api/v1/canteens*`) is rate-limited but token-free.

| Layer | Location |
|-------|----------|
| Edge auth | `src/middleware.ts` → `src/proxy.ts` |
| API | `src/app/api/v1/` (REST, Zod-validated) |
| Frontend | `src/app/(student|merchant|admin)/` + `src/components/global/` (React Query) |
| Order lifecycle | `src/lib/state-machine/` (server-enforced transitions) |
| QR engine | `src/lib/qr-engine/` (HMAC-SHA256, single-use, replay-proof) |
| Recommendations | `src/lib/recommendation/` (consent-gated alternatives) |
| Settlement | `src/lib/settlement/` (`Net = Gross − Fees − Refunds`) |
| DB | `prisma/schema.prisma` (14 models) |

## API Endpoints

Auth: `POST /auth/register`, `POST /auth/login` (access + HttpOnly refresh), `POST /auth/refresh`.
Health: `GET /api/v1/health`.

| Method | Path | Who |
|--------|------|-----|
| POST | `/orders` (atomic stock/slot/credit reservation) | Student |
| GET | `/orders`, `/orders/:id` | Student (own), Merchant (own canteen), Admin |
| PATCH | `/orders/:id/status` (state-machine guarded) | Per transition rules |
| POST | `/orders/alternatives` | Student |
| POST | `/collection/verify` (single-use QR, marks collected) | Merchant, Admin |
| GET/POST | `/menu`, `/pickup-slots` | Authenticated read; merchant/admin writes |
| GET/PATCH/DELETE | `/menu/:id`, `/pickup-slots/:id` (deactivate-not-delete when referenced) | Merchant (own), Admin |
| GET | `/canteens`, `/canteens/:id` (menu + slots included) | Public |
| PATCH | `/canteens/:id` (`{action: approve\|reject, notes?}`) | Admin |
| GET/POST | `/food-passes`, `GET /food-passes/:id` | Student (own), Admin |
| GET | `/merchants/:id/settlement` (report, `?action=calculate`, `?action=payout`) | Merchant (own), Admin |

## Business Rules (server-enforced)

```
PENDING → CONFIRMED → PREPARING → READY → COLLECTED
    ↓         ↓           ↓
CANCELLED  REJECTED    REJECTED
```

- Students cancel only in `PENDING`/`CONFIRMED`; cancellation locks at `PREPARING`.
- Capacity/stock/credits reserved atomically (serializable transaction); overbooking and sub-zero stock impossible.
- QR tokens are server-issued, 30-min TTL, single-scan; replays rejected.
- Alternatives never auto-redirect — explicit student confirmation required.
- Prices snapshotted onto the order; live menu edits never re-price history.
- Payments are simulated in the prototype; only `COMPLETED`-payment orders settle.

## Frontend Routes

| URL | View |
|-----|------|
| `/canteens` | Student canteen explorer, menu, cart with credit preview |
| `/orders` | Student order history + live tracker (QR collect at `READY`) |
| `/dashboard` | Merchant real-time order kanban |
| `/verify` | Merchant QR scanner (camera + manual entry) |
| `/slots` | Merchant pickup-slot capacity manager |
| `/merchants` | Admin merchant approval queue |
| `/settlements` | Admin settlement reconciliation + CSV export |

## Database Notes

- `audit_logs.actorId`/`entityId` are **plain data columns, not foreign keys** — one column cannot reference the User, StudentProfile, MerchantStaff, and Order tables at once, and the previous FKs rejected every legitimate audit write (which rolled back entire order transactions). Only `canteenId` keeps its FK.
- `qrToken` is `VarChar(512)` — base64url HMAC tokens exceed 128 chars.
- Unique guards: `menu_items(canteenId, name)`, `food_passes(studentId, packageName)`, `canteens(name)`, `pickup_slots(canteenId, startTime, endTime)`.

## Development Guidelines

- Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no unused locals) — `npm run build` must stay green.
- Zod-validate every API input; server is the sole authority for money, stock, capacity, and state.
- Services live in `src/lib/` with `import "server-only"`; no DB access from route handlers beyond thin calls.
- UI uses Tailwind v4 semantic tokens only (`bg-card`, `text-muted-foreground`, …) — no hex colors.
- Every file starts with a `SOURCE OF TRUTH KEYWORDS` header.

## Known Limitations (verified)

- `npm test` has no transform configured — the `*.test.ts` files exist but Jest cannot execute TypeScript as-is, and they are excluded from typechecking.
- Food-pass credits are integers while order totals are decimals — a $3.29 order deducts 3 credits (truncation). Store credits as cents to fix.
- Merchant rejection is session-local (no persisted rejected state in the schema); rejections don't survive reload.
- Unit-test typechecking is disabled via tsconfig exclude (`**/*.test.ts`) until `@types/jest` is added.

## Project Structure

```
src/
├── middleware.ts               # thin edge delegate → proxy.ts
├── proxy.ts                    # JWT, rate limit, RBAC, auth headers
├── app/
│   ├── (student)/canteens|orders|pass/
│   ├── (merchant)/dashboard|verify|slots/
│   ├── (admin)/merchants|settlements/
│   └── api/v1/                 # REST routes
├── components/global/          # status-badge, canteen-card, qr-code-modal, pickup-slot-picker
└── lib/
    ├── api/ auth/ db/ hooks/   # typed client, JWT, Prisma singleton, React Query hooks
    ├── qr-engine/ recommendation/ settlement/ state-machine/
    ├── services/ types/ validators/
prisma/
├── schema.prisma
└── seed.ts
```

## License

MIT License - See LICENSE file for details.
