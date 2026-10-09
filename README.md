# One Campus, One Food Pass

## A Smart Pre-Order and Multi-Canteen Management Platform

### Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and secrets

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed development data
npm run prisma:seed

# Start development server
npm run dev
```

### Production Deployment

```bash
# Build for production
npm run build

# Run production server
npm start
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Yes |
| `QR_SECRET` | QR token HMAC secret (min 64 chars) | Yes |
| `NODE_ENV` | `development` or `production` | Yes |

### Test Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@campusfoodpass.com | password123 |
| Student | student@campusfoodpass.com | password123 |
| Merchant | merchant@campusfoodpass.com | password123 |

---

## Architecture Overview

### System Topology

```
Client PWA → Edge Proxy (src/proxy.ts) → API Routes → Service Layer → PostgreSQL
                    ↓
            JWT Verification
            Rate Limiting
            RBAC Guards
```

### Key Components

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Edge | `src/proxy.ts` | Auth, rate limiting, RBAC |
| API | `src/app/api/v1/` | REST endpoints with Zod validation |
| Service | `src/lib/services/` | Business logic, atomic transactions |
| State Machine | `src/lib/state-machine/` | Order lifecycle enforcement |
| QR Engine | `src/lib/qr-engine/` | HMAC-SHA256 token security |
| Recommendation | `src/lib/recommendation/` | Alternative canteen suggestions |
| Settlement | `src/lib/settlement/` | T+1 merchant payouts |
| Database | `prisma/schema.prisma` | Complete PostgreSQL schema |

---

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register student/merchant
- `POST /api/v1/auth/login` - Login, returns access + refresh tokens
- `POST /api/v1/auth/refresh` - Rotate access token

### Orders (Student)
- `POST /api/v1/orders` - Create order with atomic reservation
- `GET /api/v1/orders` - List student's orders
- `POST /api/v1/orders/alternatives` - Get alternative suggestions

### Orders (Merchant)
- `PATCH /api/v1/orders/:id/status` - Update order status
- `GET /api/v1/orders` - List canteen's orders

### Collection
- `POST /api/v1/collection/verify` - Verify QR, mark collected

### Menu & Slots (Merchant)
- `GET/POST /api/v1/menu` - Manage menu items
- `GET/POST /api/v1/pickup-slots` - Manage pickup windows

### Canteens (Public)
- `GET /api/v1/canteens` - Browse approved canteens
- `GET /api/v1/canteens/:id` - Canteen detail with menu/slots

### Food Passes
- `GET/POST /api/v1/food-passes` - Manage prepaid packages

### Settlements (Admin/Merchant)
- `GET /api/v1/merchants/:id/settlement` - Settlement report
- `GET /api/v1/merchants/:id/settlement?action=calculate` - Calculate (admin)
- `GET /api/v1/merchants/:id/settlement?action=payout` - Process payout (admin)

### Health
- `GET /api/v1/health` - Health check

---

## Core Business Rules Enforced

### Order Lifecycle (Server-Enforced)
```
PENDING → CONFIRMED → PREPARING → READY → COLLECTED
    ↓         ↓           ↓
  CANCELLED REJECTED   REJECTED
```

- **Students**: Can only cancel in `PENDING` or `CONFIRMED`
- **Merchants**: Confirm → Prepare → Ready → Collect, or Reject
- **Admins**: All transitions
- **Terminal states**: COLLECTED, CANCELLED, REJECTED (no further transitions)

### Atomic Reservations
Order creation uses Serializable transaction with `SELECT FOR UPDATE`:
1. Lock pickup slot, check capacity
2. Lock menu items, check stock
3. Lock food pass, check credits
4. Decrement all atomically
5. Create order + audit logs

### QR Collection Security
- HMAC-SHA256 signed tokens with nonce
- 30-minute TTL, single-use enforcement
- Replay prevention via database token matching
- Timing-safe HMAC verification

### Alternative Suggestions
- Ranked by distance, price, time, stock, capacity
- **Never auto-redirects** - requires explicit student consent
- Audit trail for suggestions, acceptances, declinations

### Settlement Math
```
Net Payable = Gross Sales - Platform Fees - Refund Adjustments
```
- Daily T+1 batch calculation
- Platform fees = commissionRate × collected orders
- Refund adjustments from paid cancelled/rejected orders

---

## Database Schema

Key tables with constraints:
- `users` - Authentication + roles
- `student_profiles` - Student info, verification
- `merchant_staff` - Merchant employees, canteen linkage
- `canteens` - Outlets, approval, commission, settlement info
- `menu_items` - Items with stock, categories, dietary tags
- `food_passes` - Prepaid packages with credits, validity
- `pickup_slots` - Time windows with capacity tracking
- `orders` - Full lifecycle, QR tokens, payment status
- `order_items` - Price snapshots at order time
- `payments` - Payment tracking, refunds
- `settlements` - Daily merchant payouts
- `audit_logs` - Complete immutable audit trail

---

## Development Guidelines

### Code Standards
- **TypeScript Strict Mode** - No `any`, `unknown`, or type assertions
- **Zod Validation** - Every input validated at API boundary
- **Server-Only Services** - `import "server-only"` in all services
- **Semantic Tokens** - Tailwind CSS v4 design tokens only
- **Source of Truth Headers** - Every file has keyword metadata

### Adding New Features
1. Define Zod schema in `src/lib/validators/schemas.ts`
2. Add service logic in `src/lib/services/` with `import "server-only"`
3. Create API route in `src/app/api/v1/`
4. Add state machine transitions if needed
5. Write unit tests
6. Update `ARCHITECTURE.md` if architecture changes

### Testing
```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### Database
```bash
npm run prisma:studio  # Visual database browser
npm run db:push        # Push schema changes (dev only)
npm run prisma:migrate # Create migration
```

---

## Security Checklist

- [x] JWT verification at edge proxy
- [x] Rate limiting per user/IP
- [x] RBAC on all endpoints
- [x] Tenant isolation (`assertCanteenAccess`)
- [x] Serializable transactions for orders
- [x] HMAC-SHA256 QR tokens
- [x] Timing-safe equality checks
- [x] Input validation with Zod
- [x] Audit logging for all mutations
- [x] Password hashing with bcryptjs
- [x] Secure HTTP headers
- [x] HttpOnly refresh token cookies

---

## Project Structure

```
src/
├── app/
│   └── api/v1/           # REST API routes
├── lib/
│   ├── auth/             # JWT, server auth context
│   ├── db/               # Prisma client
│   ├── qr-engine/        # QR token generation/verification
│   ├── recommendation/   # Alternative canteen engine
│   ├── settlement/       # Merchant settlement calculation
│   ├── state-machine/    # Order lifecycle state machine
│   ├── services/         # Business logic (order-service)
│   ├── types/            # Domain types
│   └── validators/       # Zod schemas
├── components/           # React components (future)
├── proxy.ts              # Edge proxy middleware
└── types/                # Global types

prisma/
├── schema.prisma         # Database schema
└── seed.ts              # Development seed data
```

---

## License

MIT License - See LICENSE file for details.