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
| Push | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (generate with `npm run vapid:generate`), `PUSH_EXTRA_ALLOWED_HOSTS`. Without keys push is disabled and nothing else is affected |
| Delivery OTP | `DELIVERY_OTP_MAX_ATTEMPTS` (default 5 wrong guesses per order) |
| Storage | `STORAGE_PROVIDER` (`cloudinary` default \| `s3`), `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` (S3_* only if `s3`). The server boots without them; uploads then fail with `UPLOAD_FAILED` |
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
  utils/        ApiError, ApiResponse, jwt, money (paise helpers), mongoose plugins, s3 (legacy provider)
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
| GET | `/products/suggest?q=` | Type-ahead: top 8 prefix matches (`{ id, slug, title, price, image }`) — "att" finds "atta" |
| GET | `/products/:slug` | Product detail |
| GET | `/products/:id/related` | Related products (same category) |
| GET | `/products/:id/reviews` | List reviews for a product |
| POST | `/products/:id/reviews` 🔒 | Review a product (requires a delivered order containing it) |

### Cart

| Method | Path | Description |
|---|---|---|
| GET | `/cart` 🔒 | Get cart with full pricing breakdown. Optional `?pincode=` previews that area's delivery-fee override so the total matches checkout |
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
| GET | `/serviceability?pincode=` | Serviceability from the admin-managed pincode list → `{ pincode, serviceable, etaDays, areaName, deliveryFee }` |
| GET | `/settings` | Public store settings **and store info** (`storeName`, `phone`, `whatsapp`, `email`, `address`, `fssaiNumber`, `gstin` — for legal pages / invoices / contact): `deliveryFee`, `freeDeliveryThreshold`, `handlingFee`, `minOrderValue`, `storeOpen`, `storeTimings` (paise) — for "add ₹X more for free delivery" |

### Checkout & Orders

| Method | Path | Description |
|---|---|---|
| POST | `/orders` 🔒 | Place order from cart (rejected with `STORE_CLOSED` / `MIN_ORDER_VALUE` / `NOT_SERVICEABLE` per store settings; online methods also return a `payment` block `{ provider, keyId, providerOrderId, amount, currency }`). **Requires `Idempotency-Key` header.** Re-validates stock/price/coupon in a transaction; decrements stock; clears cart |
| GET | `/orders` 🔒 | List current user's orders (paginated) |
| GET | `/orders/:id` 🔒 | Order detail with `statusHistory` for tracking |
| POST | `/orders/:id/cancel` 🔒 | Cancel (only while `placed`/`confirmed`/`packed`); restores stock |
| POST | `/orders/:id/payment` 🔒 | **Pay again** after a failed/abandoned online payment → `{ payment: { provider, keyId, providerOrderId, amount, currency } }` (fresh gateway order). `400 PAYMENT_NOT_RETRYABLE` unless it's your unpaid, non-cancelled upi/card/netbanking order |
| PATCH | `/orders/:id/payment-method` 🔒 | `{ paymentMethod: "cod" }` — give up on online payment and pay cash on delivery (only while pending/failed). `400 PAYMENT_METHOD_NOT_CHANGEABLE` otherwise |
| POST | `/orders/:id/reorder` 🔒 | **Buy again**: adds the order's items to your cart at today's prices, capped by stock → `{ cart, skipped: [{ productId, title, reason: inactive \| out_of_stock \| qty_reduced, requested, added }] }` |
| POST | `/payments/verify` 🔒 | After Razorpay checkout succeeds: `{ orderId, razorpay_payment_id, razorpay_signature }` → signature verified, `paymentStatus = paid` |
| POST | `/payments/webhook` | Razorpay payment webhook (raw body, HMAC signature verified) |

### Admin (👑 `role: admin`)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/stats` | Dashboard: `todayOrders`, `todayRevenue` (paise), `pendingOrders`, `outForDelivery`, `lowStockCount`, `totalCustomers` ("today" = IST day) |
| GET | `/admin/orders?page&limit&status&from&to&q` | All orders; `q` = orderNumber or customer mobile; `from`/`to` = `YYYY-MM-DD` (whole IST day, inclusive) or ISO datetime; `user` populated as `{ id, name, mobile }` |
| GET | `/admin/orders/:id` | One order + full customer card |
| PATCH | `/admin/orders/:id/status` | Transition order status |
| GET | `/admin/users?page&limit&q` | Customers with `ordersCount` |
| GET | `/admin/products?page&limit&q&category&isActive&lowStock` | Products incl. inactive (soft-deleted can be re-activated with `PATCH { isActive: true }`) |
| POST/PATCH/DELETE | `/admin/products`, `/admin/products/:id` | Product CRUD (DELETE = soft) |
| GET | `/admin/categories`, `/admin/banners` | All rows incl. inactive |
| POST/PATCH/DELETE | `/admin/categories`, `/admin/categories/:id` | Category CRUD |
| GET/POST/PATCH/DELETE | `/admin/coupons`, `/admin/coupons/:id` | Coupon CRUD |
| POST/PATCH/DELETE | `/admin/banners`, `/admin/banners/:id` | Banner CRUD |
| GET/PATCH | `/admin/settings` | Delivery fee, free-delivery threshold, handling fee, min order value, store open/closed, timings |
| GET/POST/PATCH/DELETE | `/admin/pincodes`, `/admin/pincodes/:id` | Serviceable areas `{ pincode, areaName{en,hi}, isActive, deliveryFee?, etaDays }` (DELETE = hard) |
| POST | `/admin/uploads` | Upload images (multipart field `images`, max 6, 5 MB each, jpeg/png/webp/avif) → `201 { data: { urls: ["https://res.cloudinary.com/..."] } }` |
| GET | `/admin/orders/latest?since=<ISO datetime>` | New-order alert for polling: `{ count, orders: [{ id, orderNumber, total, createdAt }] }` (newest 10; `since` is exclusive, needs a zone) |
| PATCH | `/admin/orders/:id/assign` | `{ riderId }` (or `null` to unassign) → order with `rider { id, name, mobile }`. The order never exposes `deliveryOtp` here |
| GET/POST | `/admin/riders` | List / create delivery riders `{ name, mobile, isActive }` (`activeOrders` count included). Riders sign in with the normal OTP flow |
| PATCH | `/admin/riders/:id` | Change `name`, `mobile`, `isActive` (inactive = cannot log in, tokens stop working) |
| GET | `/admin/reports/sales?from&to&groupBy=day\|week\|month` | `[{ period, orders, revenue, avgOrderValue }]` (IST periods; week = Monday date; default last 30 days) |
| GET | `/admin/reports/top-products?from&to&limit=10` | `[{ productId, title, qtySold, revenue }]` |
| GET | `/admin/reports/cod?date=YYYY-MM-DD` | Cash reconciliation: `{ totalExpected, totalCollected, byRider: [{ rider, orders, expected, collected }] }` |
| PATCH | `/admin/products/bulk` | Body `[{ id, price?, mrp?, stock?, isActive? }]` (max 200) → `{ updated, failed: [{ id, error }] }`; `price <= mrp` checked per row |
| GET | `/admin/products/export` | All products as CSV (`id, slug, title_en, title_hi, category_slug, brand, unit, mrp, price, stock, isActive`; money in paise; UTF-8 BOM for Excel) |
| POST | `/admin/products/import?dryRun=true\|false` | Multipart field `file` (.csv, ≤ 2 MB, ≤ 2000 rows) → `{ created, updated, errors: [{ row, error }], dryRun }` |
| GET | `/admin/reviews?page&limit&productId&rating` | Reviews with `user { name, mobile }` and `product { title, slug }` |
| DELETE | `/admin/reviews/:id` | Removes the review and recalculates the product's `ratingAvg` / `ratingCount` |

### Rider app (`role: rider`)

| Method | Path | Description |
|---|---|---|
| GET | `/rider/orders?status=&page&limit` | Only the orders assigned to me (customer name/mobile, address with optional `location {lat,lng}`, `deliveryNote`, payment info; never the OTP) |
| PATCH | `/rider/orders/:id/out-for-delivery` | From confirmed / packed / shipped |
| POST | `/rider/orders/:id/deliver` | `{ otp: "1234", cashCollected: <paise> }` — OTP is a **string**. Wrong OTP → `400 INVALID_DELIVERY_OTP` (with `attemptsLeft`); after 5 wrong tries `429 DELIVERY_OTP_LOCKED` (an admin can still close the order). Unpaid COD requires `cashCollected` and becomes `paid` |

### Push notifications (PWA)

| Method | Path | Description |
|---|---|---|
| GET | `/push/vapid-public-key` | Public key for `pushManager.subscribe()` (`503 PUSH_NOT_CONFIGURED` without keys) |
| POST | `/me/push-subscriptions` 🔒 | The browser's `PushSubscription` JSON (`endpoint`, `expirationTime`, `keys {p256dh, auth}`). Only browser vendors' push services are accepted (SSRF guard); max 10 devices per user |
| DELETE | `/me/push-subscriptions` 🔒 | `{ endpoint }` |

On an order status change (admin, rider, confirmed payment) every device of the customer gets `{ title, body, url: "/orders/<id>" }` (English + Hindi). A `404`/`410` from the push service deletes that subscription. Failures never affect the API call.

#### Store settings & serviceable areas — behaviour worth knowing

- **Settings** live in one DB document (created from the `DEFAULT_*` env values on first read). Cart totals and checkout read it on every request, so changes apply immediately. `storeOpen = false` → `POST /orders` returns `503 STORE_CLOSED` (retries of an already-placed order via the same `Idempotency-Key` still succeed). `minOrderValue` is checked against the pre-discount subtotal (`400 MIN_ORDER_VALUE`). `storeTimings` is display-only.
- **Pincodes**: with **no** pincode documents the API serves every pincode (so a fresh install works); as soon as one exists, only active listed pincodes are serviceable and checkout rejects others with `400 NOT_SERVICEABLE`. A pincode's `deliveryFee` replaces the store delivery fee for that area (the free-delivery threshold still applies); `etaDays` drives `expectedDeliveryAt`. `npm run seed` adds three sample areas — delete or edit them to match your real coverage.
- **Store info** (`storeName`, `phone`, `whatsapp`, `email`, `address {line1, city, state, pincode}`, `fssaiNumber` (14 digits), `gstin` (15 chars, upper-cased)) is public via `GET /settings` and edited with `PATCH /admin/settings`; nested `address` merges field by field and any value can be cleared with `""`.
- **Delivery OTP**: every order gets a random 4-digit code, visible only to the customer who owns it (`GET /orders/:id`, `POST /orders` response) — never in admin or rider responses or in push messages.
- **Online payments**: set `PAYMENT_PROVIDER=razorpay` plus `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Orders paid online call the real Razorpay Orders API. The `mock` provider only verifies outside production. Flow: `POST /orders` → open Razorpay checkout with `payment.keyId` + `payment.providerOrderId` → `POST /payments/verify` with the three values Razorpay returns (the webhook confirms independently; whichever lands first wins, both are idempotent).

### Wishlist (bonus — simple, per the data model)

| Method | Path | Description |
|---|---|---|
| GET | `/wishlist` 🔒 | Get wishlist |
| POST | `/wishlist/:productId` 🔒 | Add product |
| DELETE | `/wishlist/:productId` 🔒 | Remove product |

## Error codes

Every error response is `{ success: false, data: null, error: { code, message, details? } }`. Stable codes (non-exhaustive — see `src/utils/errorCodes.js` for the full list) so the client can render the right bilingual copy:

`OTP_EXPIRED`, `OTP_INVALID`, `OTP_MAX_ATTEMPTS`, `OTP_SEND_RATE_LIMITED`, `TOKEN_EXPIRED`, `REFRESH_TOKEN_INVALID`, `VALIDATION_ERROR`, `PRODUCT_NOT_FOUND`, `OUT_OF_STOCK`, `INSUFFICIENT_STOCK`, `COUPON_NOT_FOUND`, `COUPON_EXPIRED`, `COUPON_MIN_ORDER`, `COUPON_USAGE_LIMIT_REACHED`, `COUPON_PER_USER_LIMIT_REACHED`, `ADDRESS_NOT_FOUND`, `ORDER_NOT_FOUND`, `ORDER_NOT_CANCELLABLE`, `IDEMPOTENCY_KEY_REQUIRED`, `REVIEW_REQUIRES_DELIVERED_ORDER`, `REVIEW_ALREADY_EXISTS`, `PAYMENT_SIGNATURE_INVALID`, `FORBIDDEN`, `RATE_LIMITED`, `STORE_CLOSED`, `MIN_ORDER_VALUE`, `NOT_SERVICEABLE`, `PINCODE_NOT_FOUND`, `PAYMENT_NOT_REQUIRED`, `ORDER_NOT_PAYABLE`, `PAYMENT_PROVIDER_ERROR`, `PAYMENT_NOT_RETRYABLE`, `PAYMENT_METHOD_NOT_CHANGEABLE`, `INVALID_DELIVERY_OTP`, `DELIVERY_OTP_LOCKED`, `INVALID_ORDER_STATE`, `ORDER_NOT_ASSIGNABLE`, `RIDER_NOT_FOUND`, `MOBILE_ALREADY_REGISTERED`, `ACCOUNT_DISABLED`, `REVIEW_NOT_FOUND`, `PUSH_NOT_CONFIGURED`, `UPLOAD_FAILED`, `FILE_TOO_LARGE`.

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

## Image uploads (Cloudinary)

`POST /admin/uploads` streams the in-memory multer buffers to Cloudinary (`upload_stream`, nothing is written to disk) into the `aali-market/products` folder, in parallel, and returns the URLs in the same order as the files.

- **Stored original:** capped at 1000×1000 (`c_limit`, never upscaled) and recompressed with `q_auto`, so large camera photos shrink.
- **Returned URL:** `https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v<version>/<public_id>` — `f_auto` lives in the *delivery URL*, so browsers automatically get AVIF/WebP/JPEG. (Cloudinary documents that `f_auto` must not be used in an incoming/upload transformation; format selection happens per request at the CDN.) Use the URL exactly as returned; resizing for thumbnails is just another URL segment, e.g. `/image/upload/w_300,c_fill,f_auto,q_auto/...`.
- **Errors:** wrong type → `400 VALIDATION_ERROR`; file over 5 MB → `413 FILE_TOO_LARGE`; more than 6 files / wrong field name → `400 VALIDATION_ERROR`; Cloudinary rejects the file → `400 UPLOAD_FAILED`; Cloudinary down/misconfigured → `502`/`503 UPLOAD_FAILED`. Uploads are all-or-nothing: if one file of several fails, the ones that succeeded are deleted again.
- **S3:** the old provider is still available with `STORAGE_PROVIDER=s3` (+ the `S3_*` variables). The AWS SDK is only loaded in that mode.
- **Switching:** `STORAGE_PROVIDER` defaults to `cloudinary`, so a deployment that still relies on S3 must set `STORAGE_PROVIDER=s3`. URLs already stored in products/banners keep working — they're plain URLs.
