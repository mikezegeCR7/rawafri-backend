# RawAfri — Backend Architecture

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 10 (TypeScript) |
| Database | PostgreSQL 15 |
| ORM | Prisma 5 |
| Auth | JWT (Access + Refresh Tokens) |
| File Uploads | Multer (local disk) |
| Rate Limiting | @nestjs/throttler |
| API Docs | Swagger (OpenAPI 3) |
| Containerisation | Docker Compose |

---

## Folder Structure

```
rawafri-api/
├── prisma/
│   ├── schema.prisma          # All models, enums, relations
│   └── seed.ts                # Admin, categories, products, delivery zones seed
│
├── src/
│   ├── main.ts                # Bootstrap: Swagger, helmet, CORS, pipes
│   ├── app.module.ts          # Root module — global guards & interceptors
│   │
│   ├── config/
│   │   ├── app.config.ts      # Port, env, CORS origins
│   │   ├── jwt.config.ts      # JWT secrets & expiry
│   │   └── index.ts
│   │
│   ├── prisma/
│   │   ├── prisma.service.ts  # PrismaClient singleton
│   │   └── prisma.module.ts   # @Global() — available everywhere
│   │
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── get-user.decorator.ts   # @GetUser() param decorator
│   │   │   ├── roles.decorator.ts      # @Roles(Role.ADMIN)
│   │   │   └── public.decorator.ts     # @Public() — skips JWT guard
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts       # Global JWT guard
│   │   │   └── roles.guard.ts          # RBAC enforcement
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts # Handles HTTP + Prisma errors
│   │   ├── interceptors/
│   │   │   └── transform.interceptor.ts # Wraps all responses in envelope
│   │   └── pipes/
│   │       └── pagination.dto.ts        # Shared pagination DTO + helper
│   │
│   ├── auth/
│   │   ├── dto/
│   │   │   ├── register.dto.ts         # Nigerian phone validation
│   │   │   └── login.dto.ts            # Login, refresh, change-password, OTP DTOs
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts         # Passport JWT strategy
│   │   ├── auth.service.ts             # register, login, refresh, logout, OTP
│   │   ├── auth.controller.ts
│   │   └── auth.module.ts
│   │
│   ├── users/
│   │   ├── dto/user.dto.ts
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   └── users.module.ts
│   │
│   ├── addresses/                      # NEW
│   │   ├── dto/address.dto.ts
│   │   ├── addresses.service.ts
│   │   ├── addresses.controller.ts
│   │   └── addresses.module.ts
│   │
│   ├── delivery-zones/                 # NEW
│   │   ├── dto/delivery-zone.dto.ts
│   │   ├── delivery-zones.service.ts
│   │   ├── delivery-zones.controller.ts
│   │   └── delivery-zones.module.ts
│   │
│   ├── promo-codes/                    # NEW
│   │   ├── dto/promo-code.dto.ts
│   │   ├── promo-codes.service.ts
│   │   ├── promo-codes.controller.ts
│   │   └── promo-codes.module.ts
│   │
│   ├── products/
│   │   ├── dto/
│   │   │   ├── product.dto.ts          # Create, update, filter, inventory DTOs
│   │   │   └── category.dto.ts
│   │   ├── products.service.ts
│   │   ├── products.controller.ts
│   │   ├── categories.service.ts
│   │   ├── categories.controller.ts
│   │   └── products.module.ts
│   │
│   ├── orders/
│   │   ├── dto/order.dto.ts            # Updated: addressId, deliveryZoneId, promoCode
│   │   ├── orders.service.ts           # Updated: zone fee lookup, promo validation
│   │   ├── orders.controller.ts
│   │   └── orders.module.ts
│   │
│   ├── payments/
│   │   ├── dto/payment.dto.ts
│   │   ├── payments.service.ts         # Upload proof, verify, reject
│   │   ├── payments.controller.ts
│   │   └── payments.module.ts
│   │
│   ├── admin/
│   │   ├── admin.service.ts            # Dashboard stats, revenue report
│   │   ├── admin.controller.ts
│   │   └── admin.module.ts
│   │
│   └── notifications/
│       ├── notifications.service.ts
│       ├── notifications.controller.ts
│       └── notifications.module.ts
│
├── uploads/                   # Local file storage (swap for S3 in prod)
├── docker-compose.yml
├── .env.example
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## Database Schema & Relationships

```
User ──────────────────────── Address (1:N)
  │                               │
  │                               └── isDefault (one per user)
  │
  └─────────────────────────── Order (1:N)
                                   │
                                   ├── addressId ──────────── Address (N:1)
                                   ├── deliveryZoneId ──────── DeliveryZone (N:1)
                                   ├── promoCodeId ─────────── PromoCode (N:1, nullable)
                                   ├── discountAmount
                                   │
                                   ├── OrderItem (1:N) ──── Product ── Inventory (1:1)
                                   │                            │
                                   │                         Category (N:1)
                                   ├── Payment (1:1)
                                   ├── OrderStatusHistory (1:N)
                                   └── Notification (1:N)

BankAccount     (standalone — admin-managed transfer targets)
DeliveryZone    (standalone — admin-managed zones and fees)
PromoCode       (standalone — admin-managed discount codes)
OtpToken        (standalone — password reset tokens, TTL-bound)
```

**Key design decisions:**
- `Inventory` is a separate 1:1 table from `Product` — enables granular stock management without touching product fields on every restock
- `OrderStatusHistory` records every transition with timestamp, actor, and note — full audit trail
- `Payment` is created automatically when an order is placed (status: `PENDING`) so the proof upload endpoint just updates it
- `refreshToken` stored as a bcrypt hash in the `User` row — single-device session model
- `deliveryFee` on `Order` is always populated server-side from `DeliveryZone.fee` — the client never sends this value
- `discountAmount` on `Order` is computed server-side from the validated `PromoCode` — the client sends only the promo code string
- `OtpToken` records are single-use and expire; used tokens are marked with `usedAt` and never re-validated

---

## New Models — Prisma Schema Additions

### Address
```prisma
model Address {
  id          String      @id @default(uuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id])
  label       String                          // e.g. "Home", "Office"
  type        AddressType @default(OTHER)
  contactName String
  phone       String
  line1       String
  city        String
  state       String
  landmark    String?
  isDefault   Boolean     @default(false)

  orders      Order[]

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([userId])
  @@map("addresses")
}

enum AddressType {
  HOME
  WORK
  OTHER
}
```

**Business rules:**
- A user may have many addresses; only one may be `isDefault = true` at a time
- Setting a new default atomically clears the previous default in a single transaction
- An address cannot be deleted if it is referenced by any existing order — soft-delete by adding `isActive` flag instead
- When an order references `addressId`, delivery fields (`line1`, `city`, `state`, `landmark`) are copied onto the order at creation time so the order snapshot is immutable even if the address is later edited

---

### DeliveryZone
```prisma
model DeliveryZone {
  id            String   @id @default(uuid())
  name          String   @unique                // e.g. "Lekki / Ajah"
  fee           Decimal  @db.Decimal(10, 2)     // in NGN
  estimatedTime String                          // e.g. "45–60 mins"
  isActive      Boolean  @default(true)

  orders        Order[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("delivery_zones")
}
```

**Business rules:**
- Only active zones are returned to customers at checkout
- When an order is created, the server looks up `DeliveryZone.fee` by `deliveryZoneId` and writes it to `Order.deliveryFee` — the client cannot override this value
- Deactivating a zone does not affect existing orders that reference it

---

### PromoCode
```prisma
model PromoCode {
  id              String    @id @default(uuid())
  code            String    @unique             // uppercase, e.g. "RAWAFRI10"
  discountPercent Decimal   @db.Decimal(5, 2)   // e.g. 10.00 for 10%
  label           String                        // display name
  maxUses         Int                           // total redemption cap
  usedCount       Int       @default(0)
  expiresAt       DateTime
  isActive        Boolean   @default(true)

  orders          Order[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@map("promo_codes")
}
```

**Business rules:**
- Code lookup is case-insensitive (normalised to uppercase before query)
- A code is invalid if: `isActive = false`, `expiresAt < now()`, or `usedCount >= maxUses`
- `discountAmount` on the order is computed as `floor(subtotal * discountPercent / 100)` server-side
- `usedCount` is incremented atomically inside the order-creation transaction
- If the promo validation fails after the customer submits the order, the entire order creation is rolled back

---

### OtpToken
```prisma
model OtpToken {
  id          String      @id @default(uuid())
  identifier  String                            // email address
  code        String                            // 6-digit hashed code
  purpose     OtpPurpose
  expiresAt   DateTime
  usedAt      DateTime?                         // null = unused

  createdAt   DateTime    @default(now())

  @@index([identifier, purpose])
  @@map("otp_tokens")
}

enum OtpPurpose {
  PASSWORD_RESET
}
```

**Business rules:**
- OTP code is a random 6-digit number, stored as a bcrypt hash
- Expires 10 minutes after creation
- On verify: hash-compare the submitted code against the stored hash; if matched and `usedAt` is null and `expiresAt > now()`, mark `usedAt = now()`
- A used or expired token always returns `401 Unauthorized` — no information about why
- A new OTP request for the same email invalidates all prior unused tokens for that identifier + purpose by setting their `expiresAt` to now

---

### Updated Order Model Fields
```prisma
model Order {
  // ... all existing fields unchanged ...

  // NEW fields
  addressId        String?
  address          Address?      @relation(fields: [addressId], references: [id])

  deliveryZoneId   String
  deliveryZone     DeliveryZone  @relation(fields: [deliveryZoneId], references: [id])

  promoCodeId      String?
  promoCode        PromoCode?    @relation(fields: [promoCodeId], references: [id])
  discountAmount   Decimal       @default(0) @db.Decimal(12, 2)

  // deliveryFee already exists — now server-populated from DeliveryZone
  // deliveryAddress, deliveryCity, deliveryState already exist
  // — copied from Address snapshot at order creation if addressId is provided
}
```

---

## Order Status Flow

```
ORDER_RECEIVED
    │  (auto — set on order creation)
    ▼
AWAITING_PAYMENT
    │  (customer uploads payment proof)
    ▼
PAYMENT_CONFIRMED
    │  (admin verifies payment proof)
    ▼
PREPARING_ORDER
    │  (admin action)
    ▼
OUT_FOR_DELIVERY
    │  (admin action)
    ▼
AWAITING_CUSTOMER_CONFIRMATION
    │  (customer confirms receipt)
    ▼
DELIVERED

─────────── At any stage before PAYMENT_CONFIRMED ───────────
                          CANCELLED
```

Transitions are enforced via a `STATUS_TRANSITIONS` map in `orders.service.ts`. Invalid jumps return `400 Bad Request`.

---

## Checkout Workflow

The checkout is a single `POST /orders` call from the client. All fee and discount calculations happen server-side.

```
Client sends:
  {
    items:           [{ productId, quantity }],
    deliveryZoneId:  "uuid",
    addressId:       "uuid"  (optional — can send inline address instead),

    // If no saved address:
    deliveryAddress: "14B Admiralty Way",
    deliveryCity:    "Lagos",
    deliveryState:   "Lagos",
    deliveryNotes:   "Near Shoprite" (optional),

    promoCode:       "RAWAFRI10" (optional),
    proofFile:       multipart file (optional)
  }

Server executes (inside a single $transaction):
  1. Validate all products are active and in stock
  2. Validate minimum order quantities
  3. Look up DeliveryZone by deliveryZoneId → read fee server-side
  4. If addressId provided → copy address snapshot to order delivery fields
  5. If promoCode provided → validate code (active, not expired, under usage cap)
                          → compute discountAmount = floor(subtotal × discountPercent / 100)
                          → increment promoCode.usedCount
  6. Compute totals:
       subtotal      = sum(item.price × item.quantity)
       deliveryFee   = deliveryZone.fee  (from DB, not from client)
       discountAmount = computed above (0 if no promo)
       totalAmount   = subtotal + deliveryFee - discountAmount
  7. Create Order (status: ORDER_RECEIVED)
  8. Create OrderItems
  9. Deduct inventory for each item
  10. Create Payment record (status: PENDING, amount: totalAmount)
  11. If proofFile attached → save file, update Payment (status: UPLOADED, proofImageUrl)
                            → advance Order to AWAITING_PAYMENT

Returns:
  { order, payment, deliveryZone, promoApplied }
```

**Notes:**
- If no proof is uploaded at order creation, the order stays at `ORDER_RECEIVED`. The customer uploads proof separately via `POST /payments/upload-proof`, which advances the order to `AWAITING_PAYMENT`.
- The client must never send `deliveryFee`, `discountAmount`, or `totalAmount` — these are rejected by the DTO whitelist.
- If any validation step fails, the entire transaction rolls back and no order, payment, or inventory change is persisted.

---

## Authentication Flow

```
POST /auth/register
  → hash password (bcrypt 12 rounds)
  → create user (role: CUSTOMER)
  → issue accessToken (15m) + refreshToken (7d)
  → store hashed refreshToken in DB

POST /auth/login
  → find user by email
  → compare password hash
  → issue tokens, update stored refresh hash

POST /auth/refresh
  → verify refreshToken signature
  → compare against stored hash
  → issue new token pair

POST /auth/logout
  → set user.refreshToken = null

POST /auth/forgot-password          NEW
  → find user by email (always return 200 to prevent enumeration)
  → invalidate prior unused OTPs for this email + PURPOSE
  → generate 6-digit code, hash it, store OtpToken (expires 10 min)
  → send code to user's email

POST /auth/verify-otp               NEW
  → find OtpToken by identifier + purpose
  → compare submitted code against stored hash
  → if valid: mark usedAt, return a short-lived reset token (JWT, 15 min)
  → if invalid or expired: return 401

POST /auth/reset-password           NEW
  → verify the reset token (JWT signed with JWT_RESET_SECRET)
  → hash new password
  → update user.passwordHash
  → invalidate all existing refresh tokens (set refreshToken = null)
```

**Access Token** — short-lived (15 min), validated on every request by `JwtStrategy`.
**Refresh Token** — long-lived (7 days), stored as bcrypt hash. Hash comparison prevents token reuse after logout.
**OTP Code** — 6 digits, expires in 10 minutes, single-use, stored as bcrypt hash.
**Reset Token** — short-lived JWT (15 min) issued after OTP verification; used only for the password reset call.

---

## RBAC Strategy

Guards are registered **globally** in `app.module.ts`:

```
Request → ThrottlerGuard → JwtAuthGuard → RolesGuard → Controller
```

- `@Public()` — sets `isPublic` metadata; `JwtAuthGuard` skips JWT verification
- `@Roles(Role.ADMIN)` — restricts endpoint to admins only
- No decorator needed for authenticated routes accessible by both roles
- Routes only customers can access use `@Roles(Role.CUSTOMER)`

---

## API Endpoint Reference

### Auth — `/api/v1/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /register | Public | Register customer |
| POST | /login | Public | Login |
| POST | /refresh | Public | Refresh access token |
| POST | /logout | JWT | Logout |
| POST | /change-password | JWT | Change password |
| POST | /forgot-password | Public | Send OTP to email for password reset |
| POST | /verify-otp | Public | Verify OTP, receive reset token |
| POST | /reset-password | Public | Set new password using reset token |

### Addresses — `/api/v1/addresses`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | Customer | List my saved addresses |
| POST | / | Customer | Create a new address |
| PUT | /:id | Customer | Edit an address |
| DELETE | /:id | Customer | Remove an address (blocked if used on an order) |
| PATCH | /:id/set-default | Customer | Set as default delivery address |

### Delivery Zones — `/api/v1/delivery-zones`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | Public | List all active zones with fees and ETAs |
| POST | / | Admin | Create a delivery zone |
| PUT | /:id | Admin | Update zone name, fee, or ETA |
| PATCH | /:id/toggle | Admin | Activate or deactivate a zone |

### Promo Codes — `/api/v1/promo-codes`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /validate | Customer | Validate a code and return discount preview |
| POST | / | Admin | Create a promo code |
| GET | / | Admin | List all promo codes |
| PATCH | /:id | Admin | Update or deactivate a promo code |

### Products — `/api/v1/products`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | Public | Browse products (filter, search, paginate) |
| GET | /:id | Public | Get product by ID |
| GET | /slug/:slug | Public | Get product by slug |
| POST | / | Admin | Create product |
| PUT | /:id | Admin | Update product |
| PATCH | /:id/inventory | Admin | Update stock |
| DELETE | /:id | Admin | Soft-delete product |
| GET | /admin/low-stock | Admin | Products below threshold |

### Categories — `/api/v1/categories`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | Public | List all active categories |
| GET | /:id | Public | Get category with products |
| GET | /admin/all | Admin | List all including inactive |
| POST | / | Admin | Create category |
| PUT | /:id | Admin | Update category |
| DELETE | /:id | Admin | Deactivate category |

### Orders — `/api/v1/orders`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | / | Customer | Place order (with zone, address, optional promo + proof) |
| GET | /my-orders | Customer | My order history |
| GET | /my-orders/:id | Customer | View single order |
| PATCH | /my-orders/:id/confirm-delivery | Customer | Confirm receipt |
| PATCH | /my-orders/:id/cancel | Customer | Cancel order |
| GET | / | Admin | All orders |
| GET | /:id | Admin | Order detail |
| PATCH | /:id/status | Admin | Update order status |

### Payments — `/api/v1/payments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /bank-accounts | Public | Get bank accounts for transfer |
| POST | /upload-proof | Customer | Upload payment proof (multipart) |
| GET | /order/:orderId | Customer | My payment for an order |
| GET | / | Admin | All payments |
| GET | /:id | Admin | Payment detail |
| PATCH | /:id/verify | Admin | Verify payment and advance order |
| PATCH | /reject | Admin | Reject payment proof |
| POST | /bank-accounts | Admin | Add a bank account |
| PATCH | /bank-accounts/:id/toggle | Admin | Toggle bank account active status |

### Users — `/api/v1/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /me | JWT | Get my profile |
| PATCH | /me | JWT | Update my profile |
| GET | / | Admin | List all customers |
| GET | /:id | Admin | Customer detail + recent orders |
| PATCH | /:id/toggle-status | Admin | Activate/deactivate customer |

### Admin — `/api/v1/admin`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /dashboard | Admin | Stats overview |
| GET | /revenue | Admin | Revenue report (?year=&month=) |
| GET | /activity | Admin | Recent orders + pending payments |

### Notifications — `/api/v1/notifications`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | / | JWT | My notifications |
| GET | /unread-count | JWT | Unread badge count |
| PATCH | /:id/read | JWT | Mark one as read |
| PATCH | /read-all | JWT | Mark all as read |

---

## Response Envelope

Every response is wrapped by `TransformInterceptor`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": { ... },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Errors (from `GlobalExceptionFilter`):

```json
{
  "success": false,
  "statusCode": 404,
  "error": "NotFound",
  "message": "Order not found",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "path": "/api/v1/orders/abc-123"
}
```

---

## DTO Validation Highlights

- **Nigerian phone** — regex `^(\+234|0)[789][01]\d{8}$` on register and profile update
- **Password strength** — must contain uppercase + lowercase + number/special char
- **Whitelist mode** — `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` strips and rejects unknown fields
- **Auto-transform** — `transform: true` converts query params to typed values (e.g. `?page=2` → `number`)
- **deliveryFee / discountAmount / totalAmount** — excluded from all customer-facing DTOs; computed server-side only
- **promoCode** — accepted as a plain string in the order DTO; validated and resolved to a `PromoCode` record inside the service

---

## Getting Started

```bash
# 1. Clone and install
npm install

# 2. Start database
docker-compose up -d

# 3. Environment
cp .env.example .env
# Edit .env with your values

# 4. Migrate and seed
npx prisma migrate dev --name init
npm run prisma:seed

# 5. Run dev server
npm run start:dev

# API:   http://localhost:3000/api/v1
# Docs:  http://localhost:3000/docs
```

---

## Production Readiness Checklist

- [ ] Replace `./uploads` disk storage with **AWS S3 / Cloudinary**
- [ ] Add email service (Nodemailer / SendGrid) for order confirmations and OTP delivery
- [ ] Integrate **Redis** for token blacklisting and rate-limit state
- [ ] Add **Winston** structured logging with request correlation IDs
- [ ] Set up **Sentry** error tracking
- [ ] Configure **PM2** or **Docker** for process management
- [ ] Enable **SSL/TLS** (terminate at load balancer or Nginx)
- [ ] Restrict `CORS_ORIGINS` to your frontend domains
- [ ] Rotate `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `JWT_RESET_SECRET` to strong random strings
- [ ] Set `NODE_ENV=production` (disables Swagger, dev logs)
- [ ] Add database connection pooling (PgBouncer)
- [ ] Run `prisma migrate deploy` (not `dev`) in production
- [ ] Add OTP rate limiting — max 3 requests per email per 15 minutes

---

## Scalability Recommendations

**Short-term (V1)**
- Index `orders.customerId`, `orders.status`, `orders.deliveryZoneId`, `products.categoryId`, `payments.status`, `addresses.userId`, `promo_codes.code` in Prisma schema (`@@index`)
- Use `$transaction` for all multi-step writes (already implemented — order creation, payment verify, promo redemption)
- Paginate all list endpoints (already implemented)

**Medium-term (V2)**
- Add Redis caching for product catalog and delivery zones (TTL 5–10 min)
- Implement background jobs (Bull/BullMQ) for: sending OTP emails, order confirmation emails, inventory alerts
- Separate read replicas for heavy analytics queries

**Long-term (V3)**
- Extract `NotificationsModule` to a microservice with WebSocket / push notification support
- Move file uploads to object storage with CDN (Cloudflare R2, AWS S3 + CloudFront)
- Add full-text search with Meilisearch or Typesense for product search
- Event sourcing for order status history (replace status history table with event log)
