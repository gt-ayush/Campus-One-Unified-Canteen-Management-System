# System Architecture Documentation

## System Topology

```mermaid
graph TB
    Client[Client PWA\nNext.js App Router] --> Edge[Edge Proxy\nsrc/proxy.ts]
    Edge --> Auth[JWT Verification\nRate Limiting\nRBAC Guard]
    Auth --> Router[TRPC/REST Router Layer\nsrc/app/api/v1/*]
    Router --> Service[Service Layer\nimport "server-only"]
    Service --> DB[(PostgreSQL\nPrisma ORM)]

    subgraph "Edge Layer"
        Edge
        Auth
    end

    subgraph "Application Layer"
        Router
        Service
    end

    subgraph "Data Layer"
        DB
    end
```

## End-to-End Atomic Order Flow

```mermaid
sequenceDiagram
    participant Student as Student Client
    participant Edge as Edge Proxy
    participant API as Order API
    participant Service as Order Service
    participant DB as PostgreSQL
    participant Merchant as Merchant Dashboard
    participant QR as QR Engine
    participant Settlement as Settlement Service

    Note over Student,Settlement: Order Submission & Atomic Reservation
    Student->>Edge: POST /api/v1/orders {items, slot, pass}
    Edge->>Edge: Verify JWT, Rate Limit, RBAC
    Edge->>API: Forward with auth headers
    API->>Service: createOrderAtomically()
    Service->>DB: BEGIN TRANSACTION (Serializable)
    Service->>DB: SELECT ... FOR UPDATE pickup_slot
    Service->>DB: SELECT ... FOR UPDATE menu_items
    Service->>DB: CHECK stock >= quantity
    Service->>DB: CHECK slot.reserved < capacity
    Service->>DB: DECREMENT menu_item.stock
    Service->>DB: INCREMENT slot.reserved_count
    Service->>DB: DECREMENT food_pass.credits
    Service->>DB: CREATE order + order_items
    Service->>DB: CREATE audit_logs
    Service->>DB: COMMIT
    DB-->>Service: Order Created (PENDING)
    Service-->>API: Return orderId, orderNumber
    API-->>Edge: 201 Created
    Edge-->>Student: Order confirmed, awaiting canteen

    Note over Merchant,QR: Merchant Confirmation & Preparation
    Merchant->>Edge: PATCH /api/v1/orders/:id/status {CONFIRMED}
    Edge->>API: Forward with merchant auth
    API->>Service: transitionOrderStatus(CONFIRMED)
    Service->>DB: UPDATE order status + audit_log
    DB-->>Service: Success
    Service-->>API: 200 OK
    API-->>Merchant: Order confirmed

    Merchant->>Edge: PATCH /api/v1/orders/:id/status {PREPARING}
    Edge->>API: Forward
    API->>Service: transitionOrderStatus(PREPARING)
    Service->>DB: UPDATE order status=PREPARING, preparingAt=now + audit_log
    Note right of Service: AUDIT: Flag PREPARING transition\nfor anti-fraud monitoring
    DB-->>Service: Success
    Service-->>API: 200 OK

    Merchant->>Edge: PATCH /api/v1/orders/:id/status {READY}
    Edge->>API: Forward
    API->>Service: transitionOrderStatus(READY)
    Service->>DB: UPDATE order status=READY, readyAt=now
    Service->>QR: generateQRToken(orderId)
    QR->>DB: STORE qrToken + qrExpiresAt
    QR->>DB: CREATE audit_log(QR_TOKEN_GENERATED)
    DB-->>QR: Token generated
    QR-->>Service: HMAC-SHA256 token
    Service-->>API: Return qrToken
    API-->>Merchant: QR code for student

    Note over Student,QR: QR Collection & Settlement
    Student->>Merchant: Shows QR code
    Merchant->>Edge: POST /api/v1/collection/verify {token}
    Edge->>API: Forward
    API->>QR: verifyQRToken(token)
    QR->>QR: Parse Base64URL payload.HMAC
    QR->>QR: Verify HMAC-SHA256 signature
    QR->>QR: Check expiry timestamp
    QR->>DB: SELECT order WHERE qrToken=token
    QR->>QR: Check order.status=READY
    QR->>QR: Check token matches DB (replay prevention)
    QR-->>API: Valid + orderId
    API->>Service: transitionOrderStatus(COLLECTED)
    Service->>DB: UPDATE order status=COLLECTED, collectedAt=now
    Service->>DB: CLEAR qrToken, qrExpiresAt
    Service->>DB: CREATE audit_log(ORDER_COLLECTED, QR_TOKEN_INVALIDATED)
    DB-->>Service: Success
    Service-->>API: 200 OK
    API-->>Merchant: Collection confirmed

    Note over Settlement: Daily T+1 Reconciliation
    Settlement->>DB: SELECT orders WHERE canteenId, period
    Settlement->>DB: CALCULATE grossSales, platformFees, refunds
    Settlement->>DB: netPayable = grossSales - platformFees - refunds
    Settlement->>DB: CREATE/UPDATE settlement record
    Settlement->>DB: CREATE audit_log(SETTLEMENT_CALCULATED)
    DB-->>Settlement: Settlement report ready
```

## Database Locking Strategy

```mermaid
graph LR
    subgraph "Concurrency Control"
        A[Serializable Isolation] --> B[SELECT FOR UPDATE]
        B --> C[Row-Level Locks]
        C --> D[stock_quantity]
        C --> E[slot.reserved_count]
        C --> F[food_pass.remaining_credits]
    end

    subgraph "Deadlock Prevention"
        G[Consistent Lock Order] --> H[1. pickup_slots]
        H --> I[2. menu_items]
        I --> J[3. food_passes]
        J --> K[4. orders]
    end

    subgraph "Timeout Handling"
        L[maxWait: 5s] --> M[timeout: 10s]
        M --> N[Retry with Backoff]
    end
```

## Multi-Tenant Data Isolation

```mermaid
graph TD
    A[Authenticated Request] --> B{Role?}
    B -->|STUDENT| C[Filter by studentId]
    B -->|MERCHANT_STAFF| D[assertCanteenAccess]
    B -->|ADMIN| E[No Filter]
    C --> F[Student Scoped Queries]
    D --> G[Canteen Scoped Queries]
    E --> H[Global Queries]
    F --> I[Prisma Where Clauses]
    G --> I
    H --> I
    I --> J[PostgreSQL RLS Ready]
```

## Key Architectural Decisions

### 1. Edge-First Authentication
- JWT verification at edge (`src/proxy.ts`) before request reaches App Router
- Rate limiting per user/IP at edge
- RBAC guards prevent unauthorized route access
- User context injected via headers for downstream use

### 2. Service Layer Isolation
- All services use `import "server-only"` - cannot be imported in client components
- Database access only through service layer
- Business logic encapsulated in services, not in route handlers

### 3. Atomic Order Processing
- Serializable transactions for order creation
- `SELECT ... FOR UPDATE` on critical resources (slots, stock, passes)
- Consistent lock ordering prevents deadlocks
- All mutations create audit logs

### 4. State Machine Enforcement
- `OrderStateMachine` class validates all transitions
- Server-side only - client cannot bypass
- Role-based transition permissions
- Complete audit trail for every transition

### 5. Cryptographic QR Security
- HMAC-SHA256 signed tokens with nonce
- Single-use enforcement via database token matching
- Time-limited validity (30 minutes default)
- Replay attack prevention via token invalidation

### 6. Settlement Mathematics
```
Net Payable = Gross Sales - Platform Fees - Refund Adjustments
```
- Daily T+1 batch calculation
- Platform fees = commissionRate × collected order totals
- Refund adjustments from cancelled/rejected paid orders
- Audit trail for every settlement calculation

### 7. Alternative Suggestions (Consent-Based)
- Algorithm considers: distance, price, time, stock, capacity
- Ranked by match score (100 = perfect)
- **Never auto-redirects** - requires explicit student acceptance
- Audit logs track suggestions, acceptances, declinations

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production"
        LB[Load Balancer] --> Edge1[Next.js Instance 1]
        LB --> Edge2[Next.js Instance 2]
        LB --> EdgeN[Next.js Instance N]
        
        Edge1 --> PG[(PostgreSQL Primary)]
        Edge2 --> PG
        EdgeN --> PG
        
        PG --> PGReplica[(Read Replicas)]
        
        Edge1 --> Redis[(Redis Cache)]
        Edge2 --> Redis
        EdgeN --> Redis
    end
```

## Scaling Considerations

| Component | Strategy |
|-----------|----------|
| API Layer | Horizontal scaling (stateless Next.js) |
| Database | Read replicas for queries, primary for writes |
| Connection Pool | 20 connections per instance (configurable) |
| Rate Limiting | Distributed via Redis in production |
| QR Tokens | Short TTL reduces storage pressure |
| Audit Logs | Partitioned by month, archived yearly |
| Settlements | Async batch job, not real-time |