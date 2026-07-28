# Aali Market API

Production-ready REST API for **Aali Market** — a price-first mobile shopping app for small-town India.

- **Stack:** Node.js (ESM) + Express + MongoDB/Mongoose + JWT
- **Currency:** ₹ — all money is handled as **integer paise** internally, end to end
- **Bilingual:** every user-facing text field is stored as `{ en, hi }`
- **Response shape:** every endpoint returns `{ success, data, error }`

## Getting started

### Prerequisites

- Node.js ≥ 18
- MongoDB ≥ 6 running as a **replica set** (required for the multi-document transaction used at checkout — see below)

> **Local MongoDB as a single-node replica set** (one-time setup):
> ```bash
> mongod --replSet rs0 --dbpath /path/to/data
> # in a separate mongosh session, once:
> mongosh --eval "rs.initiate()"
> ```
> Then point `MONGO_URI` at it, e.g. `mongodb://localhost:27017/aali_market?replicaSet=rs0`.

### Install & run

```bash
npm install
cp .env.example .env   # then fill in real secrets
npm run seed            # categories, ~40 products, AALI50 coupon, admin user
npm run dev              # http://localhost:4000
```

```bash
npm test                 # Jest + Supertest, using an in-memory Mongo replica set (no real DB needed)
```

### Logging in during development

OTPs are never returned in the API response. In development (`SMS_PROVIDER=console`, the default), the code is printed to the server console instead of being sent via a real SMS gateway:

```
[SMS:console-stub] OTP for 9999999999 is 482913
```

The seeded admin mobile number is set by `SEED_ADMIN_MOBILE` in `.env` (default `9999999999`) — log in with `POST /auth/otp/send` → check the console → `POST /auth/otp/verify`.

## Environment variables

See [`.env.example`](.env.example) for the full list with defaults. Key groups:

| Group | Purpose |
|---|---|
| Server | `PORT`, `API_BASE_PATH` |
| Database | `MONGO_URI` |
| JWT | access/refresh secrets + expiry |
| OTP | length, TTL, max attempts, send rate limit, `SMS_PROVIDER` |
| S3 | S3-compatible object storage for product/category/banner images |
| Payments | `PAYMENT_PROVIDER` (`mock` or `razorpay`-shaped), webhook secret |
| Pricing | default delivery fee, free-delivery threshold, handling fee (all in paise) |
| Seed | admin user identity created by `npm run seed` |

## Project structure

```
src/
  config/       env, db (Mongoose connection), logger (winston)
  models/       Mongoose schemas
  routes/       Express routers (thin — validate then delegate to controllers)
  controllers/  HTTP glue: parse req, call services, shape the response
  services/     business logic — pricing, cart, coupons, otp, auth, orders, payments, reviews
  middleware/   auth, validate (zod), errorHandler, rateLimit, upload (multer)
  validations/  zod schemas per resource, `.strict()` so unknown fields are rejected
  utils/        ApiError, ApiResponse, jwt, money (paise helpers), mongoose plugins, s3
  seed/         seed script + fixture data
tests/          Jest + Supertest, mongodb-memory-server (replica set)
docs/openapi.yaml
```

### Design notes

- **Money.** All amounts are integer paise. `src/services/pricing.service.js` is the *only* place cart/order totals are computed — both `cart.service.js` and `order.service.js` call into it. Client-supplied prices are never trusted; every total is recomputed server-side from the live `Product.price`.
- **Bilingual content.** Reusable `{ en, hi }` sub-schema in `models/shared/bilingual.js`, and `bilingualText`/`bilingualTextPartial` zod helpers in `utils/zodHelpers.js`.
- **Serialization.** A shared `toJSON` mongoose plugin (`utils/mongoosePlugins.js`) renames `_id` → `id`, strips `__v`, and strips any field marked `{ private: true }` in its schema definition (e.g. OTP code hashes, refresh token hashes) — raw Mongo internals never leak into API responses.
- **Validation.** Every route validates `body`/`query`/`params` with zod via the `validate()` middleware. Schemas use `.strict()` so unknown fields are rejected with `VALIDATION_ERROR`.
- **Errors.** A single `errorHandler` middleware normalizes Mongoose/JWT/multer errors into the same `{ success:false, data:null, error:{ code, message, details? } }` shape, using stable machine-readable codes from `utils/errorCodes.js` (e.g. `OTP_EXPIRED`, `COUPON_MIN_ORDER`, `OUT_OF_STOCK`) so the client can pick the right bilingual message.
- **Idempotent checkout.** `POST /orders` requires an `Idempotency-Key` header. `Order.idempotencyKey` has a unique index; a retried request with the same key returns the original order instead of creating a duplicate or double-decrementing stock. Stock validation + decrement + coupon redemption + order creation + cart clearing all happen inside one MongoDB transaction (`mongoose.startSession()` + `withTransaction()`).
- **Payments.** `services/payment.service.js` exposes a `PaymentProvider` interface (`createOrder`, `verifySignature`) with a `mock` implementation and a Razorpay-shaped implementation (HMAC-SHA256 webhook signature verification). `POST /payments/webhook` is mounted with `express.raw()` (before the JSON body parser) so the exact bytes are available for signature verification.
- **SMS.** `services/sms.provider.js` exposes a pluggable interface; the `console` provider (default in dev) logs the OTP instead of sending a real SMS. Swap `SMS_PROVIDER` and add a case to wire in MSG91/Twilio/Gupshup etc.

## Endpoints

All routes are prefixed with `API_BASE_PATH` (default `/api/v1`). 🔒 = requires `Authorization: Bearer <accessToken>`. 👑 = admin role required.

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/otp/send` | Send a 6-digit OTP (rate-limited: 3 / 15 min / mobile) |
| POST | `/auth/otp/verify` | Verify OTP → creates user if new, returns access + refresh tokens |
| POST | `/auth/refresh` | Exchange refresh token for a new pair (rotates + revokes the old one) |
| POST | `/auth/logout` | Revoke a refresh token |
| GET | `/me` 🔒 | Get current user profile |
| PATCH | `/me` 🔒 | Update name/email |

### Catalog

| Method | Path | Description |
|---|---|---|
| GET | `/categories` | List active categories |
| GET | `/banners` | List active home-carousel banners |
| GET | `/products` | Filter/sort/search/paginate products (`meta.total` = "N products") |
| GET | `/products/:slug` | Product detail |
| GET | `/products/:id/related` | Related products (same category) |
| GET | `/products/:id/reviews` | List reviews for a product |
| POST | `/products/:id/reviews` 🔒 | Review a product (requires a delivered order containing it) |

### Cart

| Method | Path | Description |
|---|---|---|
| GET | `/cart` 🔒 | Get cart with full pricing breakdown |
| POST | `/cart/items` 🔒 | Add item `{ productId, qty }` |
| PATCH | `/cart/items/:productId` 🔒 | Update qty (`qty: 0` removes it) |
| DELETE | `/cart/items/:productId` 🔒 | Remove item |
| DELETE | `/cart` 🔒 | Clear cart |
| POST | `/cart/coupon` 🔒 | Apply coupon `{ code }` |
| DELETE | `/cart/coupon` 🔒 | Remove applied coupon |

### Addresses

| Method | Path | Description |
|---|---|---|
| GET | `/addresses` 🔒 | List saved addresses |
| POST | `/addresses` 🔒 | Add address |
| PATCH | `/addresses/:id` 🔒 | Update address |
| DELETE | `/addresses/:id` 🔒 | Delete address |
| POST | `/addresses/:id/default` 🔒 | Set as default |
| GET | `/serviceability?pincode=` | Check pincode serviceability |

### Checkout & Orders

| Method | Path | Description |
|---|---|---|
| POST | `/orders` 🔒 | Place order from cart. **Requires `Idempotency-Key` header.** Re-validates stock/price/coupon in a transaction; decrements stock; clears cart |
| GET | `/orders` 🔒 | List current user's orders (paginated) |
| GET | `/orders/:id` 🔒 | Order detail with `statusHistory` for tracking |
| POST | `/orders/:id/cancel` 🔒 | Cancel (only while `placed`/`confirmed`/`packed`); restores stock |
| POST | `/payments/webhook` | Razorpay-shaped payment webhook (raw body, HMAC signature verified) |

### Admin (👑 `role: admin`)

| Method | Path | Description |
|---|---|---|
| POST/PATCH/DELETE | `/admin/products`, `/admin/products/:id` | Product CRUD |
| POST/PATCH/DELETE | `/admin/categories`, `/admin/categories/:id` | Category CRUD |
| GET/POST/PATCH/DELETE | `/admin/coupons`, `/admin/coupons/:id` | Coupon CRUD |
| POST/PATCH/DELETE | `/admin/banners`, `/admin/banners/:id` | Banner CRUD |
| PATCH | `/admin/orders/:id/status` | Transition order status |
| POST | `/admin/uploads` | Upload images (multipart field `images`, max 6, 5 MB each) → S3 URLs |

### Wishlist (bonus — simple, per the data model)

| Method | Path | Description |
|---|---|---|
| GET | `/wishlist` 🔒 | Get wishlist |
| POST | `/wishlist/:productId` 🔒 | Add product |
| DELETE | `/wishlist/:productId` 🔒 | Remove product |

## Error codes

Every error response is `{ success: false, data: null, error: { code, message, details? } }`. Stable codes (non-exhaustive — see `src/utils/errorCodes.js` for the full list) so the client can render the right bilingual copy:

`OTP_EXPIRED`, `OTP_INVALID`, `OTP_MAX_ATTEMPTS`, `OTP_SEND_RATE_LIMITED`, `TOKEN_EXPIRED`, `REFRESH_TOKEN_INVALID`, `VALIDATION_ERROR`, `PRODUCT_NOT_FOUND`, `OUT_OF_STOCK`, `INSUFFICIENT_STOCK`, `COUPON_NOT_FOUND`, `COUPON_EXPIRED`, `COUPON_MIN_ORDER`, `COUPON_USAGE_LIMIT_REACHED`, `COUPON_PER_USER_LIMIT_REACHED`, `ADDRESS_NOT_FOUND`, `ORDER_NOT_FOUND`, `ORDER_NOT_CANCELLABLE`, `IDEMPOTENCY_KEY_REQUIRED`, `REVIEW_REQUIRES_DELIVERED_ORDER`, `REVIEW_ALREADY_EXISTS`, `PAYMENT_SIGNATURE_INVALID`, `FORBIDDEN`, `RATE_LIMITED`.

## API spec

Full OpenAPI 3.0 spec: [`docs/openapi.yaml`](docs/openapi.yaml). Import it directly into Postman (`File → Import`) or Swagger UI.

## Postman collection

A ready-to-run collection is at [`docs/postman/Aali-Market.postman_collection.json`](docs/postman/Aali-Market.postman_collection.json), with a matching environment at [`docs/postman/Aali-Market.postman_environment.json`](docs/postman/Aali-Market.postman_environment.json).

Import both in Postman (`File → Import`), select the **Aali Market — Local** environment, then:

1. **Auth → Send OTP** → check the server console for the printed code → set the `otpCode` variable → **Auth → Verify OTP** (auto-saves `accessToken`/`refreshToken`).
2. **Catalog → List Categories** / **List Products** (auto-saves `categoryId`/`productId`/`productSlug`).
3. **Cart → Add Item**, **Apply Coupon** (`AALI50`, needs subtotal ≥ ₹199).
4. **Addresses → Create Address** (auto-saves `addressId`).
5. **Orders → Create Order** (auto-saves `orderId`) — the `Idempotency-Key` header uses Postman's `{{$guid}}` dynamic variable per send.
6. **Admin** folder uses its own `adminAccessToken` — run **Admin → Send OTP** / **Admin → Verify OTP** with the seeded admin mobile (`9999999999` by default) first.
