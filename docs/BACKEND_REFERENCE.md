# Aali Market API — backend reference (exact code)

Everything below the overview is copied verbatim from the repo by `npm run reference` — not retyped. Real response JSON for every endpoint is in [SAMPLE_RESPONSES.md](SAMPLE_RESPONSES.md) (`npm run samples`).

## 0. Quick answers

| Question | Answer |
|---|---|
| Port | `PORT` env, default **4000** |
| Base path | `API_BASE_PATH` env, default **/api/v1**. `/health` is at the server root. |
| CORS | `cors({ origin: env.cors.origin })`; `CORS_ORIGIN` default `*`. One string only — a comma-separated list is **not** split into several origins. |
| Uploaded images | No `/uploads` path, no static serving. `POST /admin/uploads` (multipart field `images`, max 6, 5 MB each) → Cloudinary (`STORAGE_PROVIDER=cloudinary`, default; `s3` still available) → `201 { success, data: { urls: ["https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v<n>/aali-market/products/<id>"] }, error: null }`. Errors: `VALIDATION_ERROR`, `FILE_TOO_LARGE` (413), `UPLOAD_FAILED` (400/502/503). |
| User roles | `User.role` ∈ `customer` \| `admin` \| `rider` (default `customer`). **Customers sign in with the OTP; admin and rider sign in with username + password** (`POST /auth/staff/login`) — the OTP endpoints answer 403 `USE_PASSWORD_LOGIN` for their mobiles. |
| Admin check | `authenticate` verifies the JWT and loads the user from the DB each request; `requireRole('admin')` compares the DB role (not the token claim). |
| Money | integer **paise** everywhere (₹1 = 100) |
| Envelope | `{ success, data, error, meta? }`; errors `{ code, message, details? }` |

### Customer-facing endpoints

```
POST /auth/otp/send            POST /auth/otp/verify        POST /auth/refresh       POST /auth/logout      (customers: OTP)
POST /auth/staff/login         PATCH /me/password           (admin + rider: username / password)
GET  /geo/reverse?lat=&lng=    GET /coupons/available       (public; the coupons list takes an optional token)
GET  /me                       PATCH /me
GET  /categories               GET /banners                 GET /settings            (public)
GET  /products                 GET /products/suggest?q=     GET /products/:slug      GET /products/:id/related
GET  /products/:id/reviews     POST /products/:id/reviews   GET /products/:id/reviews/mine
GET  /cart[?pincode=]          POST /cart/items             PATCH|DELETE /cart/items/:productId[?variantId=]
DELETE /cart                   POST|DELETE /cart/coupon
GET|POST /addresses            PATCH|DELETE /addresses/:id  POST /addresses/:id/default
GET  /serviceability?pincode=
POST /orders                   GET /orders                  GET /orders/:id          POST /orders/:id/cancel
POST /orders/:id/payment       PATCH /orders/:id/payment-method   POST /orders/:id/reorder
POST /payments/verify          POST /payments/webhook       (webhook: raw body + HMAC, no JWT)
GET  /push/vapid-public-key    POST|DELETE /me/push-subscriptions
GET  /wishlist                 POST|DELETE /wishlist/:productId
```

### `GET /products` query params

All optional; unknown params → 400. `page` (default 1), `limit` (1–100, default 20), `sort` (`popular|price_asc|price_desc|newest|discount`, default `newest`), `category` (category **id**, not slug), `minPrice`/`maxPrice` (paise), `brand`, `rating`, `inStock` (`"true"|"false"`), `q` ($text search — whole words only; use `/products/suggest` for type-ahead). Response `meta: { total, page, limit, pages }`.

### `GET /products/suggest?q=`

Prefix search for type-ahead, top 8 → `[{ id, slug, title:{en,hi}, price, image }]`. Matches the start of any word in the English/Hindi title or brand, or the start of a tag ("att" → "Aata" via its "atta" tag). Active products only. `q` is required (1–60 chars).

### Store settings (`GET /settings`, admin `GET|PATCH /admin/settings`)

`{ deliveryFee, freeDeliveryThreshold, handlingFee, minOrderValue, storeOpen, storeTimings: { open, close } }` — money in paise, times `HH:mm`. One DB document, created from the `DEFAULT_*` env values on first read; edits apply to the next cart/checkout. `storeOpen=false` → `POST /orders` = **503 `STORE_CLOSED`**; subtotal < `minOrderValue` → **400 `MIN_ORDER_VALUE`**; `storeTimings` is display-only; `freeDeliveryThreshold: 0` = delivery always free.

### Serviceable areas (`/admin/pincodes`, `GET /serviceability`)

`{ pincode, areaName:{en,hi}, isActive, deliveryFee (paise|null), etaDays, etaMinutes (5–1440|null) }`. **No pincodes configured → every pincode is served.** Once any exists, only active listed pincodes are serviceable and `POST /orders` rejects others with **400 `NOT_SERVICEABLE`**. `deliveryFee` overrides the store fee for that area (free threshold still applies); `etaDays` sets `expectedDeliveryAt`. `etaMinutes` (5–1440, `null` by default) is for quick-delivery areas: when set, `expectedDeliveryAt` = order time + `etaMinutes` instead, and `GET /serviceability` returns it next to `etaDays`. `GET /cart?pincode=` previews the override.

### Online payments

`POST /orders` with `paymentMethod` upi/card/netbanking returns, besides the order, `data.payment = { provider, keyId, providerOrderId, amount, currency }` (null for COD). Open Razorpay checkout with `keyId` + `providerOrderId`, then `POST /payments/verify { orderId, razorpay_payment_id, razorpay_signature, razorpay_order_id? }` (`orderId` is OUR order id). Signature = HMAC-SHA256(`<razorpay_order_id>|<razorpay_payment_id>`, `RAZORPAY_KEY_SECRET`). The webhook confirms independently; both paths are idempotent. `PAYMENT_PROVIDER=mock` (default) never verifies in production.

### Store info

`GET /settings` (public) and admin `GET|PATCH /admin/settings` also carry `storeName`, `phone`, `whatsapp`, `email`, `address { line1, city, state, pincode }`, `fssaiNumber` (14 digits), `gstin` (15 chars) for legal pages / invoices / contact. Every value can be cleared with `""`; `address` merges field by field.

### Delivery: notes, location, riders, OTP

- `POST /orders` accepts `deliveryNote` (≤ 200 chars). Addresses accept an optional `location { lat, lng }` (copied into the order snapshot; `null` on PATCH clears it).
- Every order gets a random 4-digit `deliveryOtp`. **Only the owner sees it** (`POST /orders`, `GET /orders/:id`); it is stripped from every other serialisation — admin, rider, push.
- Admins manage riders (`/admin/riders`, `role: rider`, username + password login) and assign orders (`PATCH /admin/orders/:id/assign { riderId | null }`).
- Rider app (`/rider/*`, rider token only): `GET /orders` (mine only), `PATCH /orders/:id/out-for-delivery`, `POST /orders/:id/deliver { otp: "1234", cashCollected }`. Wrong OTP = 400 `INVALID_DELIVERY_OTP` (`details.attemptsLeft`); after `DELIVERY_OTP_MAX_ATTEMPTS` (5) wrong tries = 429 `DELIVERY_OTP_LOCKED`. Unpaid COD needs `cashCollected` (paise) and becomes paid.

### Payment retry, COD switch, reorder

- `POST /orders/:id/payment` → `{ payment: {...} }` with a fresh gateway order (else 400 `PAYMENT_NOT_RETRYABLE`). Abandoned gateway orders are remembered, so a late webhook still pays the order.
- `PATCH /orders/:id/payment-method { paymentMethod: "cod" }` (else 400 `PAYMENT_METHOD_NOT_CHANGEABLE`).
- `POST /orders/:id/reorder` → `{ cart, skipped: [{ productId, title, reason: inactive|out_of_stock|qty_reduced, requested, added }] }`.

### Push notifications (PWA)

`GET /push/vapid-public-key` → `POST /me/push-subscriptions` (the browser's PushSubscription JSON; only browser vendors' push services are accepted) → on order status changes (admin, rider, confirmed payment) the customer gets `{ title, body, url: "/orders/<id>" }` (English + Hindi). 404/410 removes the subscription. Needs `VAPID_*` (`npm run vapid:generate`).

**Riders** use the same `POST|DELETE /me/push-subscriptions` with their rider token. `PATCH /admin/orders/:id/assign` pushes the new rider `{ title: "New delivery / नई डिलीवरी", body: "#<last 6 of orderNumber>, <area or city>", url: "/rider" }`; taking the order from a rider (given to someone else, or `riderId: null`) pushes the previous rider `{ title: "Order reassigned / ऑर्डर बदला गया", … }`. Assigning the same rider again sends nothing. These pushes never contain the customer's phone, the delivery OTP or the door number (area = address line 2, else the city).

### Product variants (Aata 1 kg / 5 kg / 10 kg)

A product either sells as before (no variants) or **only through its variants**. Product JSON now always has `optionName` (`{ en, hi }` or `null`) and `variants: [{ id, label:{en,hi}, sku, mrp, price, stock, images, isDefault, isActive, discountPercent, inStock }]` (`[]` for a plain product). With variants the top-level fields are **derived by the backend** on every save: `price` / `mrp` / `unit` = the default variant's (unit = its English label), `stock` = total of the **active** variants. So listing, `sort`, `minPrice`/`maxPrice`, `inStock`, suggest and the wishlist work unchanged. Customers never receive an inactive variant; admin endpoints return all of them.

- **Admin create / PATCH** `/admin/products`: `optionName` + `variants` (max 20; labels unique in English and Hindi; sku unique; exactly one `isDefault`, and it must be active; each `price ≤ mrp`). `mrp`/`price`/`unit`/`stock` are optional (and ignored) when variants are sent. On PATCH `variants` is the **complete list**: with `id` = update that variant (unknown id = 404 `VARIANT_NOT_FOUND`), without `id` = create, **left out = deleted** (hard delete: orders keep their own snapshot, carts show the line as unavailable, reorder skips it as `inactive`; use `isActive: false` to just hide a variant). `variants: []` turns the product back into a plain one; omit the key to leave variants alone.
- **Cart**: `POST /cart/items { productId, variantId?, qty }` — `variantId` is required for a product with variants (**400 `VARIANT_REQUIRED`**, `details.options` lists the choices; unknown / inactive variant = 404 `VARIANT_NOT_FOUND`). A line is (product, variant): `PATCH|DELETE /cart/items/:productId?variantId=`. `GET /cart` items add `variantId`, `variantLabel { en, hi }` (both `null` for plain products) and show that variant's `price`/`mrp`/`stock`/`image`/`unit`. A line from before the product got variants is shown as unavailable and can be removed.
- **Orders**: each item snapshots `variantId` + `variantLabel`; stock is taken (atomically, no oversell) from that variant and returned to it on cancel. `POST /orders/:id/reorder` keeps the variant (gone/inactive = `skipped` with reason `inactive`; `skipped` entries also carry `variantId`, `variantLabel`).
- **Admin**: `PATCH /admin/products/bulk` rows take an optional `variantId` (that variant's price/mrp/stock/isActive; a row without it on a variant product may only send `isActive`). `lowStock=true` and `lowStockCount` count a product when **any active variant** is at or below the threshold. `GET /admin/reports/top-products` has one row per variant (`variantId`, `variantLabel`; `null` for plain products).
- **CSV**: columns `id, variant_id, variant_label_en, variant_label_hi, sku, slug, title_en, title_hi, option_name_en, option_name_hi, category_slug, brand, unit, mrp, price, stock, isActive`. Export writes one row per variant (product columns repeated; `unit` = the variant's English label; `isActive` = the variant's). Import: a row with `variant_id` (or `variant_label_en`/`_hi`) targets one variant — found by id, else by English label, else created (needs both labels, mrp, price, stock and the option names); the first variant of a new product is the default; the CSV never deletes variants. Old files without the variant columns still import.
- **Existing data** needs no migration for this: products without `variants`/`optionName`, cart lines and order items without `variantId` read as plain.

### Review approval

`Review.status` ∈ `pending` (default) | `approved` | `rejected`, plus `moderatedAt`, `moderationNote`. `POST /products/:id/reviews` returns the review as `pending` (it does not change the rating). `GET /products/:id/reviews` (public) lists **approved only** and never shows moderation fields. `ratingAvg`/`ratingCount` are computed from approved reviews and recomputed on approve / reject / delete. `GET /products/:id/reviews/mine` (auth) returns the caller's own review in any status (`status` only, never the admin's note) or `null`. Admin: `GET /admin/reviews?status=pending|approved|rejected` (default every status; + `productId`, `rating`), `PATCH /admin/reviews/:id/status { status: "approved" | "rejected", note? }` → `{ review, product: { id, ratingAvg, ratingCount } }` (can be changed again later), `GET /admin/stats` → `pendingReviews`. **Migration**: reviews from before moderation are set to `approved` automatically at server start (`src/migrations`, idempotent; also `npm run migrate`). A customer still has one review per product, whatever its status.

### Staff login (admin + rider)

`POST /auth/staff/login { username, password }` → `{ user, accessToken, refreshToken, isNewUser: false }` (same shape as `/auth/otp/verify`). `User` has `username` (unique, a–z 0–9 . _, 3–30, lower-cased), `passwordHash` (bcrypt cost 12, never returned), `passwordChangedAt`, `failedLoginAttempts` / `lockUntil` (private).
- A wrong password, an unknown username and a **customer** account all answer the same **401 `INVALID_CREDENTIALS`** (and take the same time).
- **5 wrong passwords lock the account for 15 minutes** → **429 `ACCOUNT_LOCKED`** with `details.retryAfterSeconds` (the 5th wrong try is the one that answers it; even the right password is refused until the lock ends). The counter is **atomic**: every attempt first reserves a slot with one conditional update, so parallel guesses never get more than 5 tries. A correct login resets it. Inactive account (after the password was right) → 403 `ACCOUNT_DISABLED`.
- Rate limiters on top, counting only failed attempts: per IP (`STAFF_LOGIN_IP_LIMIT`, default 20 / 15 min) and per username (`STAFF_LOGIN_USER_LIMIT`, default 10 / 15 min) → 429 `RATE_LIMITED`.
- `POST /auth/otp/send` and `/auth/otp/verify` for a mobile that belongs to an admin or rider → **403 `USE_PASSWORD_LOGIN`** (no OTP is generated or sent). The OTP `code` is echoed in the `/auth/otp/send` response **only when `NODE_ENV != production` and `SMS_PROVIDER=console`**.
- `PATCH /me/password { currentPassword, newPassword }` (staff only; new password ≥ 8 chars with a letter and a number, ≤ 72 bytes, different from the old one; wrong current = 400 `INVALID_CURRENT_PASSWORD`, which also counts towards the lock). All refresh tokens are revoked and access tokens issued before the change stop working; the response is `{ accessToken, refreshToken, passwordChangedAt }` — a fresh pair for the current session.
- **Riders**: `POST /admin/riders { name, mobile, username, password }` (the mobile stays — for calls and push); `PATCH /admin/riders/:id` also takes `username` / `password` (a reset ends that rider's sessions); `GET /admin/riders` shows `username` (null for riders created before this existed — give them one with PATCH); duplicate username = 409 `USERNAME_TAKEN`.
- **Seed**: `SEED_ADMIN_USERNAME` (default `admin`) + `SEED_ADMIN_PASSWORD`. There is no default password: with `NODE_ENV=production` the seed refuses to run without it. The seed never overwrites an existing password.
- **Recovery**: `npm run admin:set-password -- <username>` asks for the new password in the terminal (hidden). For an older admin without a username: `npm run admin:set-password -- <new-username> --mobile <their mobile>`. It clears a lock and signs the account out everywhere.

### Location → area + pincode (`GET /geo/reverse`)

Public. `?lat=&lng=` → `{ pincode, area, city, state }` — `area` is the mohalla / sector (e.g. "G Block, Sector 63") for "Delivering to …". India only: outside it, or with no pincode there → **404 `GEO_NOT_FOUND`**; provider trouble → 502 `GEO_PROVIDER_ERROR`; `GEO_PROVIDER=google` without `GOOGLE_MAPS_API_KEY` → 503 `GEO_NOT_CONFIGURED`. `GEO_PROVIDER` = `nominatim` (OpenStreetMap, free, default) or `google`. Nominatim's policy is followed: an identifying `GEO_USER_AGENT` (put a contact in it) and at most 1 request/second (outbound calls are queued and spaced). Coordinates are rounded to 3 decimals (~110 m) and answers are cached for 24 hours (also "nothing here"; provider errors are not cached). Per-IP rate limit `GEO_RATE_LIMIT_PER_MINUTE` (default 30).

### Cancellation and refunds

Every cancellation — customer `POST /orders/:id/cancel` **and** admin `PATCH /admin/orders/:id/status { status: "cancelled" }` — runs the same transaction: the order is **claimed atomically** (so it is idempotent: a second or simultaneous cancel changes nothing), stock goes back to the **same variant**, and the coupon redemption is given back (`usedCount` − 1, the user's per-user limit is free again). A cancelled order cannot be re-opened (400 `INVALID_ORDER_STATE`).

**Refunds** (online-paid orders): `Order.refundStatus` (`null` | `pending` | `processed` | `failed`), `refundId`, `refundedAmount` (paise, processed only), `refundedAt`, plus `refunds[]` (one entry per refund: `refundId, amount, status, reason, source: cancel|admin|gateway, failureReason, createdAt, processedAt`) — all in `GET /orders/:id` and the admin order. Cancelling a **paid online** order (customer or admin) starts a Razorpay refund for everything still refundable; `paymentStatus` becomes `refunded` **only when processed refunds cover the whole paid amount**. A gateway failure never undoes the cancellation: the refund is marked `failed` and an admin retries with `POST /admin/orders/:id/refund`. The mock provider processes refunds at once; Razorpay answers `pending` and finishes through the **webhook** `refund.processed` / `refund.failed` (same signature as the payment webhook; idempotent; a refund made in the Razorpay dashboard is recorded as `source: gateway`).
- `POST /admin/orders/:id/refund { amount?, reason }` — partial or full refund of a paid online order (`amount` in paise, default = everything still refundable). The amount is reserved with one conditional update, so refunds can never add up to more than was paid (pending refunds count): **400 `REFUND_AMOUNT_EXCEEDED`** (`details.maxRefundable`); COD / unpaid / fully refunded = 400 `REFUND_NOT_ALLOWED`; gateway error = 502 `REFUND_PROVIDER_ERROR`. Returns the order the way `GET /admin/orders/:id` does. A partial refund leaves the order `paid` (and still counted in revenue reports).
- Cancelling a COD order that was already paid in cash only sets `paymentStatus: refunded` (the shop returns cash by hand). A payment that arrives for an already cancelled order is logged for manual refund.

### Offers (`GET /coupons/available`)

Public; with a token, coupons whose per-user limit that user has already used up are removed (an invalid token is 401, not a guest). Returns `[{ code, type, value, minOrderValue, maxDiscount, expiresAt, description: { en, hi } | null }]` of coupons that are active, inside their dates and not used up (`usageLimit`), soonest-expiring first. `minOrderValue` is shown, not filtered (the app can say "add ₹50 more"). `Coupon.description { en, hi }` is optional and set in `POST|PATCH /admin/coupons` (`null` removes it).

### Admin endpoints (`/admin/*`, admin token)

| | |
|---|---|
| `GET /stats` | `{ todayOrders, todayRevenue, pendingOrders, outForDelivery, lowStockCount, totalCustomers, pendingReviews }` — "today" is the IST day (`STORE_UTC_OFFSET_MINUTES`); revenue excludes cancelled / payment-failed / refunded orders; low stock = active products at or below `LOW_STOCK_THRESHOLD` (variant products: any active variant); `pendingReviews` = reviews waiting for approval |
| `GET /orders?page&limit&status&from&to&q` | all orders; `q` = orderNumber or customer mobile; `from`/`to` = `YYYY-MM-DD` (whole IST day, `to` inclusive) or ISO datetime; `user` populated `{ id, name, mobile }` |
| `GET /orders/:id`, `PATCH /orders/:id/status` | full order + customer card; status transition. `cancelled` restores stock + coupon and refunds a paid online order (idempotent) |
| `GET /users?page&limit&q` | customers: `{ id, name, mobile, email, isVerified, ordersCount, createdAt }` |
| `GET /products?page&limit&q&category&isActive&lowStock` | incl. inactive (and inactive variants); `POST`, `PATCH /:id` (both take `optionName` + `variants`), `DELETE /:id` (soft; re-activate with `PATCH { isActive: true }`) |
| `GET|POST /categories`, `PATCH|DELETE /categories/:id` | list includes inactive |
| `GET|POST /banners`, `PATCH|DELETE /banners/:id` | list includes inactive |
| `GET|POST /coupons`, `PATCH|DELETE /coupons/:id` | optional `description { en, hi }` |
| `GET|PATCH /settings` | see above |
| `GET|POST /pincodes`, `PATCH|DELETE /pincodes/:id` | `etaMinutes` (5–1440 or null) for quick-delivery areas; DELETE is a hard delete |
| `POST /uploads` | multipart field `images` |
| `GET /orders/latest?since=<ISO>` | new-order alert: `{ count, orders: [{ id, orderNumber, total, createdAt }] }` (newest 10; `since` exclusive) |
| `POST /orders/:id/refund` | `{ amount?, reason }` partial / full refund of a paid online order → the order with `refunds[]` (see Cancellation and refunds) |
| `PATCH /orders/:id/assign` | `{ riderId }` (null unassigns) → order with `rider { id, name, mobile }` |
| `GET|POST /riders`, `PATCH /riders/:id` | delivery riders `{ name, mobile, username, isActive }` (+ `activeOrders`); create needs `username` + `password`, PATCH can reset them |
| `GET /reports/sales?from&to&groupBy=day` (or week, month) | `[{ period, orders, revenue, avgOrderValue }]` |
| `GET /reports/top-products?from&to&limit` | `[{ productId, variantId, variantLabel, title, qtySold, revenue }]` (one row per variant; variant fields `null` for plain products) |
| `GET /reports/cod?date=YYYY-MM-DD` | `{ totalExpected, totalCollected, byRider: [{ rider, orders, expected, collected }] }` |
| `PATCH /products/bulk` | `[{ id, variantId?, price?, mrp?, stock?, isActive? }]` (≤ 200; `variantId` = change that variant) → `{ updated, failed: [{ id, variantId?, error }] }` |
| `GET /products/export` | CSV of all products, one row per variant (paise; UTF-8 BOM) |
| `POST /products/import?dryRun=` | multipart `file` (.csv ≤ 2 MB, ≤ 2000 rows) → `{ created, updated, errors: [{ row, error }], dryRun }` |
| `GET /reviews?page&limit&productId&rating&status` | moderation list; `status` = `pending` \| `approved` \| `rejected` (default every status) |
| `PATCH /reviews/:id/status` | `{ status: "approved" \| "rejected", note? }` → `{ review, product: { id, ratingAvg, ratingCount } }` |
| `DELETE /reviews/:id` | removes it; recalculates the product rating |

Not available: promoting an existing customer to admin/rider (admins come from `npm run seed` or the DB; riders are created with `POST /admin/riders` for a NEW mobile and username).

---

## 1. Routes (mounted by `src/routes/index.js`)

### `src/routes/address.routes.js`

```js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as addressController from '../controllers/address.controller.js';
import {
  createAddressSchema,
  updateAddressSchema,
  addressIdParamSchema,
  serviceabilitySchema,
} from '../validations/address.validation.js';

const router = Router();

router.get('/serviceability', validate(serviceabilitySchema), addressController.checkServiceability);

// authenticate is applied per route, NOT with router.use(): this router is mounted at the API root, so a
// router-level guard would also demand a token for every public route mounted after it (/settings,
// /payments/webhook, ...) and answer 401 instead of reaching them.
router.get('/addresses', authenticate, addressController.listAddresses);
router.post('/addresses', authenticate, validate(createAddressSchema), addressController.createAddress);
router.patch('/addresses/:id', authenticate, validate(updateAddressSchema), addressController.updateAddress);
router.delete('/addresses/:id', authenticate, validate(addressIdParamSchema), addressController.deleteAddress);
router.post('/addresses/:id/default', authenticate, validate(addressIdParamSchema), addressController.setDefaultAddress);

export default router;
```

### `src/routes/admin.routes.js`

```js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { upload, uploadCsv } from '../middleware/upload.js';

import * as categoryController from '../controllers/category.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as couponController from '../controllers/coupon.controller.js';
import * as bannerController from '../controllers/banner.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as uploadController from '../controllers/upload.controller.js';
import * as adminController from '../controllers/admin.controller.js';
import * as settingsController from '../controllers/settings.controller.js';
import * as pincodeController from '../controllers/pincode.controller.js';
import * as riderController from '../controllers/rider.controller.js';
import * as reportController from '../controllers/report.controller.js';

import { createCategorySchema, updateCategorySchema, categoryIdParamSchema } from '../validations/category.validation.js';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  bulkUpdateProductsSchema,
  importProductsSchema,
} from '../validations/product.validation.js';
import { createCouponSchema, updateCouponSchema, couponIdParamSchema } from '../validations/coupon.validation.js';
import { createBannerSchema, updateBannerSchema, bannerIdParamSchema } from '../validations/banner.validation.js';
import { adminListProductsSchema, adminListUsersSchema } from '../validations/admin.validation.js';
import { adminListRidersSchema, createRiderSchema, updateRiderSchema } from '../validations/rider.validation.js';
import { salesReportSchema, topProductsSchema, codReportSchema } from '../validations/report.validation.js';
import { adminListReviewsSchema, reviewIdParamSchema, moderateReviewSchema } from '../validations/review.validation.js';
import { updateSettingsSchema } from '../validations/settings.validation.js';
import {
  listPincodesSchema,
  createPincodeSchema,
  updatePincodeSchema,
  pincodeIdParamSchema,
} from '../validations/pincode.validation.js';
import {
  updateOrderStatusSchema,
  adminListOrdersSchema,
  orderIdParamSchema,
  assignRiderSchema,
  latestOrdersSchema,
  refundOrderSchema,
} from '../validations/order.validation.js';

const router = Router();

// Every /admin/* route requires an authenticated admin.
router.use(authenticate, requireRole('admin'));

// Dashboard + customers
router.get('/stats', adminController.getStats);
router.get('/users', validate(adminListUsersSchema), adminController.listUsers);

// Store settings (delivery fee, free-delivery threshold, handling fee, min order, open/closed, timings)
router.get('/settings', settingsController.getAdminSettings);
router.patch('/settings', validate(updateSettingsSchema), settingsController.updateAdminSettings);

// Serviceable areas
router.get('/pincodes', validate(listPincodesSchema), pincodeController.listPincodes);
router.post('/pincodes', validate(createPincodeSchema), pincodeController.createPincode);
router.patch('/pincodes/:id', validate(updatePincodeSchema), pincodeController.updatePincode);
router.delete('/pincodes/:id', validate(pincodeIdParamSchema), pincodeController.deletePincode);

// Products
router.get('/products', validate(adminListProductsSchema), adminController.listProducts);
// bulk / export / import MUST be registered before '/products/:id', which would treat them as an id.
router.patch('/products/bulk', validate(bulkUpdateProductsSchema), adminController.bulkUpdateProducts);
router.get('/products/export', adminController.exportProducts);
router.post('/products/import', uploadCsv, validate(importProductsSchema), adminController.importProducts);
router.post('/products', validate(createProductSchema), productController.createProduct);
router.patch('/products/:id', validate(updateProductSchema), productController.updateProduct);
router.delete('/products/:id', validate(productIdParamSchema), productController.deleteProduct);

// Categories
router.get('/categories', categoryController.adminListCategories);
router.post('/categories', validate(createCategorySchema), categoryController.createCategory);
router.patch('/categories/:id', validate(updateCategorySchema), categoryController.updateCategory);
router.delete('/categories/:id', validate(categoryIdParamSchema), categoryController.deleteCategory);

// Coupons
router.get('/coupons', couponController.listCoupons);
router.post('/coupons', validate(createCouponSchema), couponController.createCoupon);
router.patch('/coupons/:id', validate(updateCouponSchema), couponController.updateCoupon);
router.delete('/coupons/:id', validate(couponIdParamSchema), couponController.deleteCoupon);

// Banners
router.get('/banners', bannerController.adminListBanners);
router.post('/banners', validate(createBannerSchema), bannerController.createBanner);
router.patch('/banners/:id', validate(updateBannerSchema), bannerController.updateBanner);
router.delete('/banners/:id', validate(bannerIdParamSchema), bannerController.deleteBanner);

// Orders
router.get('/orders', validate(adminListOrdersSchema), orderController.adminListOrders);
router.get('/orders/latest', validate(latestOrdersSchema), orderController.adminLatestOrders); // before '/orders/:id'
router.get('/orders/:id', validate(orderIdParamSchema), orderController.adminGetOrder);
router.patch('/orders/:id/assign', validate(assignRiderSchema), orderController.adminAssignRider);
router.post('/orders/:id/refund', validate(refundOrderSchema), orderController.adminRefundOrder);
router.patch('/orders/:id/status', validate(updateOrderStatusSchema), orderController.adminUpdateOrderStatus);

// Delivery riders (they log in through the normal OTP flow; role = rider)
router.get('/riders', validate(adminListRidersSchema), riderController.listRiders);
router.post('/riders', validate(createRiderSchema), riderController.createRider);
router.patch('/riders/:id', validate(updateRiderSchema), riderController.updateRider);

// Reports
router.get('/reports/sales', validate(salesReportSchema), reportController.sales);
router.get('/reports/top-products', validate(topProductsSchema), reportController.topProducts);
router.get('/reports/cod', validate(codReportSchema), reportController.cod);

// Reviews moderation
router.get('/reviews', validate(adminListReviewsSchema), adminController.listReviews);
router.patch('/reviews/:id/status', validate(moderateReviewSchema), adminController.moderateReview);
router.delete('/reviews/:id', validate(reviewIdParamSchema), adminController.deleteReview);

// Media uploads (product/category/banner images)
router.post('/uploads', upload.array('images', 6), uploadController.uploadImages);

export default router;
```

### `src/routes/auth.routes.js`

```js
import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { otpSendLimiter, authLimiter, staffLoginIpLimiter, staffLoginUserLimiter } from '../middleware/rateLimit.js';
import {
  sendOtpSchema,
  verifyOtpSchema,
  refreshSchema,
  logoutSchema,
  updateMeSchema,
  staffLoginSchema,
  changePasswordSchema,
} from '../validations/auth.validation.js';

const router = Router();

router.post('/auth/otp/send', otpSendLimiter, validate(sendOtpSchema), authController.sendOtp);
router.post('/auth/otp/verify', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/auth/staff/login', staffLoginIpLimiter, staffLoginUserLimiter, validate(staffLoginSchema), authController.staffLogin);
router.post('/auth/refresh', authLimiter, validate(refreshSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);

router.get('/me', authenticate, authController.getMe);
router.patch('/me/password', authenticate, requireRole('admin', 'rider'), validate(changePasswordSchema), authController.changePassword);
router.patch('/me', authenticate, validate(updateMeSchema), authController.updateMe);

export default router;
```

### `src/routes/cart.routes.js`

```js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as cartController from '../controllers/cart.controller.js';
import {
  getCartSchema,
  addCartItemSchema,
  updateCartItemSchema,
  removeCartItemSchema,
  applyCouponSchema,
} from '../validations/cart.validation.js';

const router = Router();
router.use(authenticate);

router.get('/', validate(getCartSchema), cartController.getCart);
router.post('/items', validate(addCartItemSchema), cartController.addItem);
router.patch('/items/:productId', validate(updateCartItemSchema), cartController.updateItem);
router.delete('/items/:productId', validate(removeCartItemSchema), cartController.removeItem);
router.delete('/', cartController.clearCart);
router.post('/coupon', validate(applyCouponSchema), cartController.applyCoupon);
router.delete('/coupon', cartController.removeCoupon);

export default router;
```

### `src/routes/catalog.routes.js`

```js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import * as categoryController from '../controllers/category.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as bannerController from '../controllers/banner.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import { authenticate } from '../middleware/auth.js';
import {
  listProductsSchema,
  productSlugParamSchema,
  productIdParamSchema,
  relatedProductsSchema,
  suggestProductsSchema,
} from '../validations/product.validation.js';
import { createReviewSchema, listReviewsSchema, myReviewSchema } from '../validations/review.validation.js';

const router = Router();

router.get('/categories', categoryController.listCategories);
router.get('/banners', bannerController.listBanners);

router.get('/products', validate(listProductsSchema), productController.listProducts);
// Must be registered before '/products/:slug', which would otherwise swallow "suggest" as a slug.
router.get('/products/suggest', validate(suggestProductsSchema), productController.suggestProducts);
router.get('/products/:slug', validate(productSlugParamSchema), productController.getProductBySlug);
router.get('/products/:id/related', validate(relatedProductsSchema), productController.getRelatedProducts);

router.get('/products/:id/reviews', validate(listReviewsSchema), reviewController.listReviews);
router.get('/products/:id/reviews/mine', authenticate, validate(myReviewSchema), reviewController.getMyReview);
router.post('/products/:id/reviews', authenticate, validate(createReviewSchema), reviewController.createReview);

export default router;
```

### `src/routes/coupon.routes.js`

```js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { listAvailableCoupons } from '../services/coupon.service.js';
import { availableCouponsSchema } from '../validations/coupon.validation.js';

const router = Router();

/**
 * GET /coupons/available - public; with a token, coupons this user has already used up are left out.
 * (A request with an invalid / expired token is answered 401 so the app can refresh it, not silently treated as a guest.)
 */
router.get(
  '/available',
  optionalAuthenticate,
  validate(availableCouponsSchema),
  catchAsync(async (req, res) => {
    sendSuccess(res, { data: await listAvailableCoupons(req.user?.id ?? null) });
  })
);

export default router;
```

### `src/routes/geo.routes.js`

```js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { geoLimiter } from '../middleware/rateLimit.js';
import * as geoController from '../controllers/geo.controller.js';
import { reverseGeocodeSchema } from '../validations/geo.validation.js';

const router = Router();

// Public (no login needed to see "Delivering to ..."), so it has its own per-IP limit.
router.get('/reverse', geoLimiter, validate(reverseGeocodeSchema), geoController.reverse);

export default router;
```

### `src/routes/index.js`

```js
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import catalogRoutes from './catalog.routes.js';
import cartRoutes from './cart.routes.js';
import addressRoutes from './address.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import adminRoutes from './admin.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import settingsRoutes from './settings.routes.js';
import riderRoutes from './rider.routes.js';
import pushRoutes from './push.routes.js';
import geoRoutes from './geo.routes.js';
import couponRoutes from './coupon.routes.js';

const router = Router();

router.use(authRoutes);
router.use(catalogRoutes);
router.use(addressRoutes);
router.use(pushRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/settings', settingsRoutes);
router.use('/rider', riderRoutes);
router.use('/geo', geoRoutes);
router.use('/coupons', couponRoutes);

export default router;
```

### `src/routes/order.routes.js`

```js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as orderController from '../controllers/order.controller.js';
import {
  createOrderSchema,
  listOrdersSchema,
  orderIdParamSchema,
  cancelOrderSchema,
  retryPaymentSchema,
  changePaymentMethodSchema,
  reorderSchema,
} from '../validations/order.validation.js';

const router = Router();
router.use(authenticate);

router.post('/', validate(createOrderSchema), orderController.createOrder);
router.get('/', validate(listOrdersSchema), orderController.listOrders);
router.get('/:id', validate(orderIdParamSchema), orderController.getOrder);
router.post('/:id/cancel', validate(cancelOrderSchema), orderController.cancelOrder);
router.post('/:id/payment', validate(retryPaymentSchema), orderController.retryPayment);
router.patch('/:id/payment-method', validate(changePaymentMethodSchema), orderController.changePaymentMethod);
router.post('/:id/reorder', validate(reorderSchema), orderController.reorder);

export default router;
```

### `src/routes/payment.routes.js`

```js
import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { verifyPaymentSchema } from '../validations/payment.validation.js';

const router = Router();

// NOTE: raw body parsing for this route is configured in app.js (must run
// before express.json() so the signature can be verified against raw bytes).
router.post('/webhook', paymentController.handleWebhook);

router.post('/verify', authenticate, validate(verifyPaymentSchema), paymentController.verifyPayment);

export default router;
```

### `src/routes/push.routes.js`

```js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as pushController from '../controllers/push.controller.js';
import { pushSubscriptionSchema, removePushSubscriptionSchema } from '../validations/push.validation.js';

const router = Router();

// Mounted at the API root, so authenticate is applied per route (a router-level guard would capture later public routes).
router.get('/push/vapid-public-key', pushController.getVapidPublicKey);
router.post('/me/push-subscriptions', authenticate, validate(pushSubscriptionSchema), pushController.subscribe);
router.delete('/me/push-subscriptions', authenticate, validate(removePushSubscriptionSchema), pushController.unsubscribe);

export default router;
```

### `src/routes/rider.routes.js`

```js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as riderController from '../controllers/rider.controller.js';
import { riderOrdersSchema, riderOrderIdSchema, deliverOrderSchema } from '../validations/rider.validation.js';

const router = Router();

// Everything under /rider/* is for delivery riders only (they sign in with the normal OTP flow).
router.use(authenticate, requireRole('rider'));

router.get('/orders', validate(riderOrdersSchema), riderController.listMyOrders);
router.patch('/orders/:id/out-for-delivery', validate(riderOrderIdSchema), riderController.markOutForDelivery);
router.post('/orders/:id/deliver', validate(deliverOrderSchema), riderController.deliverOrder);

export default router;
```

### `src/routes/settings.routes.js`

```js
import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller.js';

const router = Router();

router.get('/', settingsController.getPublicSettings);

export default router;
```

### `src/routes/wishlist.routes.js`

```js
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdSchema } from '../utils/zodHelpers.js';
import * as wishlistController from '../controllers/wishlist.controller.js';

const productIdParam = { params: z.object({ productId: objectIdSchema }).strict() };

const router = Router();
router.use(authenticate);

router.get('/', wishlistController.getWishlist);
router.post('/:productId', validate(productIdParam), wishlistController.addToWishlist);
router.delete('/:productId', validate(productIdParam), wishlistController.removeFromWishlist);

export default router;
```

### `src/app.js`

```js
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env.js';
import { morganStream } from './config/logger.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: env.cors.origin }));
  app.use(compression());
  if (!env.isTest) {
    app.use(morgan(env.isProd ? 'combined' : 'dev', { stream: morganStream }));
  }

  // Payment webhook needs the exact raw bytes for HMAC signature verification.
  // Must be registered before express.json() and scoped to this path only —
  // body-parser skips re-parsing a body that's already been consumed.
  app.use(`${env.apiBasePath}/payments/webhook`, express.raw({ type: '*/*', limit: '1mb' }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(globalLimiter);

  app.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() }, error: null });
  });

  app.use(env.apiBasePath, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
```

## 2. Models

### `src/models/Banner.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

const bannerSchema = new mongoose.Schema(
  {
    title: { type: bilingualSchema, required: true },
    image: { type: String, required: true },
    // Deep link target inside the app, e.g. "/products/atta-5kg" or "/category/dairy"
    link: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bannerSchema.index({ isActive: 1, sortOrder: 1 });

toJSONPlugin(bannerSchema);

export const Banner = mongoose.model('Banner', bannerSchema);
```

### `src/models/Cart.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Which variant of the product (null = the product has none / a line from before variants existed).
    // A cart line is identified by (product, variantId): two variants of one product are two lines.
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    qty: { type: Number, required: true, min: 1 },
    // Price (paise) captured when the item was added — for display only.
    // pricing.service.js always re-reads the live Product price for totals.
    priceAtAdd: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
    couponCode: { type: String, uppercase: true, trim: true, default: null },
  },
  { timestamps: true }
);

toJSONPlugin(cartSchema);

export const Cart = mongoose.model('Cart', cartSchema);
```

### `src/models/Category.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

const categorySchema = new mongoose.Schema(
  {
    name: { type: bilingualSchema, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    icon: { type: String, default: '' },
    image: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ isActive: 1, sortOrder: 1 });

toJSONPlugin(categorySchema);

export const Category = mongoose.model('Category', categorySchema);
```

### `src/models/Coupon.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    // Optional offer text for the "Offers" screen, e.g. { en: "Flat 50 off on orders above 199", hi: "..." }.
    description: { type: bilingualSchema, default: undefined },
    type: { type: String, enum: ['flat', 'percent'], required: true },
    // flat -> paise; percent -> whole number percent (e.g. 10 = 10%)
    value: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 }, // paise
    maxDiscount: { type: Number, default: null, min: 0 }, // paise; caps percent coupons
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    usageLimit: { type: Number, default: null, min: 0 }, // total redemptions across all users
    perUserLimit: { type: Number, default: 1, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.index({ code: 1, isActive: 1 });

toJSONPlugin(couponSchema);

export const Coupon = mongoose.model('Coupon', couponSchema);
```

### `src/models/CouponRedemption.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

/**
 * One row per successful redemption of a coupon by a user on an order.
 * Backs per-user usage limit checks (Coupon.perUserLimit) without having
 * to scan the Order collection.
 */
const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    code: { type: String, required: true, uppercase: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ code: 1, user: 1 });

toJSONPlugin(couponRedemptionSchema);

export const CouponRedemption = mongoose.model('CouponRedemption', couponRedemptionSchema);
```

### `src/models/Order.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { addressSchema } from './shared/address.js';
import { bilingualSchema } from './shared/bilingual.js';

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Snapshot of the chosen variant (both null for products without variants / orders from before variants existed).
    // Stock is returned to this variant if the order is cancelled.
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    variantLabel: { type: bilingualSchema, default: null },
    title: {
      en: { type: String, required: true },
      hi: { type: String, required: true },
    },
    image: { type: String, default: '' },
    unit: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // paise, at time of order
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const pricingSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    handlingFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      required: true,
    },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

// One refund of an online payment (see services/refund.service.js). The order-level refund fields summarise these.
const refundSchema = new mongoose.Schema(
  {
    refundId: { type: String, default: null }, // the gateway's id (null until the gateway has answered)
    amount: { type: Number, required: true, min: 1 }, // paise
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    reason: { type: String, default: '' },
    source: { type: String, enum: ['cancel', 'admin', 'gateway'], default: 'admin' }, // gateway = made outside this API
    failureReason: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
  },
  { _id: true }
);
toJSONPlugin(refundSchema);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
    pricing: { type: pricingSchema, required: true },
    couponCode: { type: String, default: null },
    shippingAddress: { type: addressSchema, required: true },
    paymentMethod: { type: String, enum: ['cod', 'upi', 'card', 'netbanking'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'placed',
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
    expectedDeliveryAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true, unique: true },
    paymentProviderOrderId: { type: String, default: null },
    // Earlier gateway orders of this order (replaced by a payment retry or a switch to COD). Kept so a late
    // webhook for an abandoned attempt can still be matched to the order. Never serialised.
    previousProviderOrderIds: { type: [String], default: [], private: true },
    // Gateway payment id (e.g. Razorpay pay_xxx), set when payment is verified / captured.
    paymentId: { type: String, default: null },
    cancelReason: { type: String, default: null },
    // Refund summary (recomputed from `refunds`): the status of the latest refund, its gateway id, the total refunded so
    // far (processed only) and when. paymentStatus turns "refunded" only once processed refunds cover the whole amount.
    refundStatus: { type: String, enum: ['pending', 'processed', 'failed', null], default: null },
    refundId: { type: String, default: null },
    refundedAmount: { type: Number, default: 0, min: 0 },
    refundedAt: { type: Date, default: null },
    refunds: { type: [refundSchema], default: [] },
    deliveryNote: { type: String, trim: true, maxlength: 200, default: '' },
    // 4-digit code the customer reads out to the rider. `private`: stripped from every serialisation; only the
    // customer-facing order endpoints add it back explicitly. Never shown to admin or rider APIs.
    deliveryOtp: { type: String, default: null, private: true },
    deliveryOtpAttempts: { type: Number, default: 0, private: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Paise the rider reports having collected (COD only), set when the order is delivered.
    cashCollected: { type: Number, min: 0, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ rider: 1, status: 1, createdAt: -1 });

toJSONPlugin(orderSchema);

export const Order = mongoose.model('Order', orderSchema);
```

### `src/models/Otp.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

const otpSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/ },
    codeHash: { type: String, required: true, private: true },
    purpose: { type: String, enum: ['login', 'signup'], required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index — Mongo auto-deletes the document once expiresAt passes.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ mobile: 1, createdAt: -1 });

toJSONPlugin(otpSchema);

export const Otp = mongoose.model('Otp', otpSchema);
```

### `src/models/Pincode.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

/** A delivery area. GET /serviceability and checkout both read this collection. */
const pincodeSchema = new mongoose.Schema(
  {
    pincode: { type: String, required: true, unique: true, trim: true, match: /^[1-9]\d{5}$/ },
    areaName: { type: bilingualSchema, required: true },
    isActive: { type: Boolean, default: true },
    // Paise. null => use the store-wide Setting.deliveryFee. (Free-delivery threshold still applies on top.)
    deliveryFee: { type: Number, default: null, min: 0 },
    etaDays: { type: Number, default: 2, min: 0, max: 30 },
    // Quick-delivery areas ("30 minutes"). When set, expectedDeliveryAt = order time + etaMinutes instead of etaDays.
    etaMinutes: { type: Number, default: null, min: 5, max: 1440, validate: { validator: (v) => v === null || Number.isInteger(v), message: 'etaMinutes must be a whole number' } },
  },
  { timestamps: true }
);

pincodeSchema.index({ isActive: 1, pincode: 1 });

toJSONPlugin(pincodeSchema);

export const Pincode = mongoose.model('Pincode', pincodeSchema);
```

### `src/models/Product.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

export const MAX_VARIANTS = 20;

const discountOf = (mrp, price) => (!mrp || mrp <= 0 || price >= mrp ? 0 : Math.round(((mrp - price) / mrp) * 100));

/**
 * One purchasable option of a product (e.g. "Aata 5 kg"). Money in integer paise.
 * A product WITH variants sells only through them: its top-level price / mrp / unit / stock are derived (see the
 * pre-validate hook below) so listing, sorting, filters and suggest keep working unchanged.
 */
const variantSchema = new mongoose.Schema(
  {
    label: { type: bilingualSchema, required: true },
    sku: { type: String, trim: true, default: '' },
    mrp: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: { type: [String], default: [] }, // empty = use the product's images
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

variantSchema.virtual('discountPercent').get(function () {
  return discountOf(this.mrp, this.price);
});
variantSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});
toJSONPlugin(variantSchema);

const productSchema = new mongoose.Schema(
  {
    title: { type: bilingualSchema, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: bilingualSchema, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, trim: true, default: '' },
    images: { type: [String], default: [] },
    // All money in integer paise. With variants these four are DERIVED from them (see the hook below).
    mrp: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true }, // e.g. "1 kg", "500 ml"
    stock: { type: Number, required: true, min: 0, default: 0 },
    // What the options are called, e.g. { en: "Pack size", hi: "पैक साइज़" }. null when there are no variants.
    optionName: { type: bilingualSchema, default: null },
    variants: { type: [variantSchema], default: [] },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [], index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.virtual('discountPercent').get(function () {
  return discountOf(this.mrp, this.price);
});

productSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});

/**
 * Keeps the top-level fields consistent with the variants (runs on every save / create):
 *   price / mrp / unit = the default variant's (unit = its English label), stock = total of the ACTIVE variants.
 * Also guards the invariants the admin API validates up front, so no code path can store a broken product.
 */
productSchema.pre('validate', function syncFromVariants(next) {
  const variants = this.variants ?? [];
  if (variants.length === 0) {
    if (this.optionName) this.optionName = null;
    return next();
  }

  if (variants.length > MAX_VARIANTS) this.invalidate('variants', `At most ${MAX_VARIANTS} variants`);
  if (!this.optionName) this.invalidate('optionName', 'optionName is required when a product has variants');

  const defaults = variants.filter((v) => v.isDefault);
  if (defaults.length !== 1) this.invalidate('variants', 'Exactly one variant must be the default');
  const def = defaults[0];
  if (def && !def.isActive) this.invalidate('variants', 'The default variant must be active');
  if (variants.some((v) => v.price > v.mrp)) this.invalidate('variants', 'A variant price cannot exceed its mrp');

  if (def) {
    this.price = def.price;
    this.mrp = def.mrp;
    this.unit = def.label.en;
  }
  this.stock = variants.filter((v) => v.isActive).reduce((sum, v) => sum + v.stock, 0);
  next();
});

// Search
productSchema.index({ 'title.en': 'text', 'title.hi': 'text', tags: 'text' });

// Common catalog filter/sort combinations
productSchema.index({ category: 1, price: 1 });
productSchema.index({ category: 1, ratingAvg: -1 });
productSchema.index({ isActive: 1, createdAt: -1 });

toJSONPlugin(productSchema);

export const Product = mongoose.model('Product', productSchema);
```

### `src/models/PushSubscription.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

/** A browser's Web Push subscription (PWA). One row per browser/device; `endpoint` is globally unique. */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    expirationTime: { type: Number, default: null },
    // Encryption secrets for this subscription — never serialised.
    keys: {
      p256dh: { type: String, required: true, private: true },
      auth: { type: String, required: true, private: true },
    },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

toJSONPlugin(pushSubscriptionSchema);

export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
```

### `src/models/RefreshToken.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

/**
 * Persisted refresh tokens (hashed) so /auth/logout and /auth/refresh can
 * revoke and rotate reliably, and reused/stolen tokens can be detected.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true, private: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null, private: true },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1 });

toJSONPlugin(refreshTokenSchema);

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
```

### `src/models/Review.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, default: '', maxlength: 1000 },
    // New reviews wait for an admin; only "approved" ones are shown on the storefront and count towards the rating.
    // Reviews that existed before moderation were marked "approved" by the migration (src/migrations).
    status: { type: String, enum: REVIEW_STATUSES, default: 'pending', index: true },
    moderatedAt: { type: Date, default: null },
    moderationNote: { type: String, trim: true, maxlength: 300, default: null },
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });

toJSONPlugin(reviewSchema);

export const Review = mongoose.model('Review', reviewSchema);
```

### `src/models/Setting.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

/**
 * Singleton store configuration (exactly one document, key = 'store').
 * Money fields are integer paise. Replaces the delivery/handling values that used to be env-only;
 * the env values are now just the defaults used to create this document the first time.
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'store', private: true },
    deliveryFee: { type: Number, required: true, min: 0 },
    // Delivery is free once subtotal >= this. 0 means delivery is always free.
    freeDeliveryThreshold: { type: Number, required: true, min: 0 },
    handlingFee: { type: Number, required: true, min: 0 },
    // Orders with a subtotal below this are rejected at checkout. 0 = no minimum.
    minOrderValue: { type: Number, required: true, min: 0, default: 0 },
    // false => POST /orders is rejected with STORE_CLOSED.
    storeOpen: { type: Boolean, required: true, default: true },
    // Public store details (legal pages, invoices, contact). Empty string = not filled in yet.
    storeName: { type: String, trim: true, default: 'Aali Market' },
    phone: { type: String, trim: true, default: '' },
    whatsapp: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: {
      line1: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      pincode: { type: String, trim: true, default: '' },
    },
    fssaiNumber: { type: String, trim: true, default: '' },
    gstin: { type: String, trim: true, uppercase: true, default: '' },
    // Display-only ("HH:mm", 24h). Not enforced automatically.
    storeTimings: {
      open: { type: String, required: true, default: '08:00' },
      close: { type: String, required: true, default: '22:00' },
    },
  },
  { timestamps: true }
);

toJSONPlugin(settingSchema);

export const Setting = mongoose.model('Setting', settingSchema);
```

### `src/models/User.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { addressSchema } from './shared/address.js';

const userSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^[6-9]\d{9}$/,
    },
    name: { type: String, required: true, trim: true },
    // Admin / rider only (customers sign in with an OTP). `sparse` so the many users without one don't collide.
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true, minlength: 3, maxlength: 30, match: /^[a-z0-9._]+$/ },
    passwordHash: { type: String, select: false, private: true },
    passwordChangedAt: { type: Date },
    // Login throttling (atomic counter; see staff-auth.service.js)
    failedLoginAttempts: { type: Number, default: 0, private: true },
    lockUntil: { type: Date, private: true },
    email: { type: String, trim: true, lowercase: true, default: undefined },
    role: { type: String, enum: ['customer', 'admin', 'rider'], default: 'customer' },
    addresses: { type: [addressSchema], default: [] },
    isVerified: { type: Boolean, default: false },
    // false blocks login and every authenticated call (used to deactivate riders).
    isActive: { type: Boolean, default: true },
    refreshTokenVersion: { type: Number, default: 0, private: true },
  },
  { timestamps: true }
);

toJSONPlugin(userSchema);

userSchema.methods.getDefaultAddress = function () {
  return this.addresses.find((a) => a.isDefault) || this.addresses[0] || null;
};

export const User = mongoose.model('User', userSchema);
```

### `src/models/Wishlist.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    products: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  },
  { timestamps: true }
);

toJSONPlugin(wishlistSchema);

export const Wishlist = mongoose.model('Wishlist', wishlistSchema);
```

### `src/models/index.js`

```js
export { User } from './User.js';
export { Otp } from './Otp.js';
export { Category } from './Category.js';
export { Product } from './Product.js';
export { Cart } from './Cart.js';
export { Coupon } from './Coupon.js';
export { CouponRedemption } from './CouponRedemption.js';
export { Order } from './Order.js';
export { Review } from './Review.js';
export { Wishlist } from './Wishlist.js';
export { Banner } from './Banner.js';
export { RefreshToken } from './RefreshToken.js';
export { Setting } from './Setting.js';
export { Pincode } from './Pincode.js';
export { PushSubscription } from './PushSubscription.js';
```

### `src/models/shared/address.js`

```js
import mongoose from 'mongoose';
import { toJSONPlugin } from '../../utils/mongoosePlugins.js';

// Optional pin so a rider can find the house. Both coordinates or none.
const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false }
);

/** Full address shape shared between User.addresses[] and Order.shippingAddress snapshot. */
export const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home' },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: '' },
    landmark: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true, match: /^[1-9]\d{5}$/ },
    isDefault: { type: Boolean, default: false },
    location: { type: locationSchema, default: undefined },
  },
  { timestamps: true }
);

// Applied here (not just on top-level models) so nested addresses inside
// User.addresses[] and Order.shippingAddress also serialise _id -> id.
toJSONPlugin(addressSchema);
```

### `src/models/shared/bilingual.js`

```js
import mongoose from 'mongoose';

/** Reusable { en, hi } embedded schema for every user-facing text field. */
export const bilingualSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    hi: { type: String, required: true, trim: true },
  },
  { _id: false }
);
```

## 3. Validation (request schemas)

### `src/validations/address.validation.js`

```js
import { z } from 'zod';
import { pincodeSchema, objectIdSchema, locationSchema } from '../utils/zodHelpers.js';

const addressBody = z
  .object({
    label: z.string().trim().max(30).default('Home'),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).default(''),
    landmark: z.string().trim().max(120).default(''),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().min(1).max(80),
    pincode: pincodeSchema,
    isDefault: z.boolean().default(false),
    location: locationSchema.optional(),
  })
  .strict();

export const createAddressSchema = { body: addressBody };

export const updateAddressSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  // location: null clears a previously saved pin
  body: addressBody.partial().extend({ location: locationSchema.nullable().optional() }),
};

export const addressIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

export const serviceabilitySchema = {
  query: z.object({ pincode: pincodeSchema }).strict(),
};
```

### `src/validations/admin.validation.js`

```js
import { z } from 'zod';
import { objectIdSchema, pageQuerySchema } from '../utils/zodHelpers.js';

// NOT z.coerce.boolean(): Boolean("false") === true.
const boolParam = z.enum(['true', 'false']).transform((v) => v === 'true');

export const adminListUsersSchema = {
  query: pageQuerySchema.extend({
    q: z.string().trim().min(1).max(40).optional(), // name or mobile, substring
  }),
};

export const adminListProductsSchema = {
  query: pageQuerySchema.extend({
    q: z.string().trim().min(1).max(80).optional(), // title (en/hi), slug, brand, tag — substring
    category: objectIdSchema.optional(),
    isActive: boolParam.optional(),
    lowStock: boolParam.optional(),
  }),
};
```

### `src/validations/auth.validation.js`

```js
import { z } from 'zod';
import { mobileSchema, passwordSchema } from '../utils/zodHelpers.js';

export const sendOtpSchema = {
  body: z
    .object({
      mobile: mobileSchema,
      purpose: z.enum(['login', 'signup']).default('login'),
    })
    .strict(),
};

export const verifyOtpSchema = {
  body: z
    .object({
      mobile: mobileSchema,
      code: z.string().trim().regex(/^\d{4,8}$/, 'OTP must be numeric'),
      purpose: z.enum(['login', 'signup']).default('login'),
      name: z.string().trim().min(1).max(80).optional(), // used to set the name on first signup
    })
    .strict(),
};

export const refreshSchema = {
  body: z
    .object({
      refreshToken: z.string().min(10),
    })
    .strict(),
};

export const logoutSchema = {
  body: z
    .object({
      refreshToken: z.string().min(10),
    })
    .strict(),
};

export const updateMeSchema = {
  body: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      email: z.string().trim().email().optional(),
    })
    .strict(),
};

// ---- staff (admin / rider) username + password
export const staffLoginSchema = {
  body: z
    .object({
      // Deliberately lenient: no format hints for an attacker, a wrong shape is simply "incorrect username or password".
      username: z.string().trim().toLowerCase().min(1).max(64),
      password: z.string().min(1).max(128),
    })
    .strict(),
};

export const changePasswordSchema = {
  body: z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: passwordSchema,
    })
    .strict(),
};
```

### `src/validations/banner.validation.js`

```js
import { z } from 'zod';
import { bilingualText, bilingualTextPartial, objectIdSchema } from '../utils/zodHelpers.js';

export const createBannerSchema = {
  body: z
    .object({
      title: bilingualText(1, 120),
      image: z.string().trim().url(),
      link: z.string().trim().default(''),
      sortOrder: z.number().int().default(0),
      isActive: z.boolean().default(true),
    })
    .strict(),
};

export const updateBannerSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      title: bilingualTextPartial(120),
      image: z.string().trim().url().optional(),
      link: z.string().trim().optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
};

export const bannerIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};
```

### `src/validations/cart.validation.js`

```js
import { z } from 'zod';
import { objectIdSchema, pincodeSchema } from '../utils/zodHelpers.js';

// Optional: preview that pincode's delivery-fee override so the cart total matches checkout.
export const getCartSchema = {
  query: z.object({ pincode: pincodeSchema.optional() }).strict(),
};

export const addCartItemSchema = {
  body: z
    .object({
      productId: objectIdSchema,
      variantId: objectIdSchema.optional(), // required when the product has variants (400 VARIANT_REQUIRED)
      qty: z.number().int().min(1).max(999).default(1),
    })
    .strict(),
};

// Lines are identified by product + variant, so PATCH / DELETE take the variant as a query parameter.
const variantQuery = z.object({ variantId: objectIdSchema.optional() }).strict();

export const updateCartItemSchema = {
  params: z.object({ productId: objectIdSchema }).strict(),
  query: variantQuery,
  body: z
    .object({
      qty: z.number().int().min(0).max(999),
    })
    .strict(),
};

export const removeCartItemSchema = {
  params: z.object({ productId: objectIdSchema }).strict(),
  query: variantQuery,
};

export const applyCouponSchema = {
  body: z
    .object({
      code: z.string().trim().min(3).max(30),
    })
    .strict(),
};
```

### `src/validations/category.validation.js`

```js
import { z } from 'zod';
import { bilingualText, bilingualTextPartial, objectIdSchema } from '../utils/zodHelpers.js';

export const createCategorySchema = {
  body: z
    .object({
      name: bilingualText(1, 100),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9-]+$/),
      icon: z.string().trim().default(''),
      image: z.string().trim().default(''),
      sortOrder: z.number().int().default(0),
      isActive: z.boolean().default(true),
    })
    .strict(),
};

export const updateCategorySchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      name: bilingualTextPartial(100),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9-]+$/)
        .optional(),
      icon: z.string().trim().optional(),
      image: z.string().trim().optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
};

export const categoryIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};
```

### `src/validations/coupon.validation.js`

```js
import { z } from 'zod';
import { bilingualText, objectIdSchema, paiseSchema } from '../utils/zodHelpers.js';

const couponBodyBase = {
  code: z.string().trim().toUpperCase().min(3).max(30),
  description: bilingualText(1, 200).nullable().default(null),
  type: z.enum(['flat', 'percent']),
  value: z.number().int().min(1),
  minOrderValue: paiseSchema.default(0),
  maxDiscount: paiseSchema.nullable().default(null),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  usageLimit: z.number().int().min(0).nullable().default(null),
  perUserLimit: z.number().int().min(0).default(1),
  isActive: z.boolean().default(true),
};

export const createCouponSchema = {
  body: z
    .object(couponBodyBase)
    .strict()
    .refine((v) => v.expiresAt > v.startsAt, { message: 'expiresAt must be after startsAt', path: ['expiresAt'] })
    .refine((v) => v.type !== 'percent' || v.value <= 100, {
      message: 'percent coupon value cannot exceed 100',
      path: ['value'],
    }),
};

export const updateCouponSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      description: bilingualText(1, 200).nullable().optional(), // null removes it
      type: z.enum(['flat', 'percent']).optional(),
      value: z.number().int().min(1).optional(),
      minOrderValue: paiseSchema.optional(),
      maxDiscount: paiseSchema.nullable().optional(),
      startsAt: z.coerce.date().optional(),
      expiresAt: z.coerce.date().optional(),
      usageLimit: z.number().int().min(0).nullable().optional(),
      perUserLimit: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
};

export const couponIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

// GET /coupons/available takes no parameters.
export const availableCouponsSchema = {
  query: z.object({}).strict(),
};
```

### `src/validations/geo.validation.js`

```js
import { z } from 'zod';

// Plain decimal strings only: z.coerce.number() would turn an empty "?lat=" into 0.
const coordinate = (min, max) =>
  z
    .string()
    .regex(/^-?\d{1,3}(\.\d+)?$/, 'Must be a decimal number')
    .transform(Number)
    .pipe(z.number().min(min).max(max));

export const reverseGeocodeSchema = {
  query: z.object({ lat: coordinate(-90, 90), lng: coordinate(-180, 180) }).strict(),
};
```

### `src/validations/order.validation.js`

```js
import { z } from 'zod';
import { objectIdSchema, pageQuerySchema } from '../utils/zodHelpers.js';
import { parseDateBoundary } from '../utils/dates.js';

export const createOrderSchema = {
  body: z
    .object({
      addressId: objectIdSchema,
      paymentMethod: z.enum(['cod', 'upi', 'card', 'netbanking']),
      deliveryNote: z.string().trim().max(200).optional(),
    })
    .strict(),
};

export const listOrdersSchema = {
  query: pageQuerySchema,
};

const dateParam = z
  .string()
  .trim()
  .refine((v) => parseDateBoundary(v, 'start') !== null, { message: 'Use YYYY-MM-DD or an ISO datetime' });

export const adminListOrdersSchema = {
  query: pageQuerySchema
    .extend({
      status: z.enum(['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']).optional(),
      from: dateParam.optional(), // YYYY-MM-DD = start of that IST day
      to: dateParam.optional(), // YYYY-MM-DD = end of that IST day (inclusive)
      q: z.string().trim().min(1).max(40).optional(), // orderNumber OR customer mobile, substring
    })
    .refine((v) => !v.from || !v.to || parseDateBoundary(v.from, 'start') <= parseDateBoundary(v.to, 'end'), {
      message: '"from" must not be after "to"',
      path: ['from'],
    }),
};

export const orderIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

export const cancelOrderSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      reason: z.string().trim().max(300).optional(),
    })
    .strict(),
};

export const refundOrderSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      amount: z.number().int().min(1).optional(), // paise; omitted = everything still refundable
      reason: z.string().trim().min(1).max(200),
    })
    .strict(),
};

export const updateOrderStatusSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      status: z.enum(['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']),
      note: z.string().trim().max(300).optional(),
    })
    .strict(),
};

// Online payment retry / switch to COD / reorder: the order id is the only input.
export const retryPaymentSchema = { params: z.object({ id: objectIdSchema }).strict() };
export const reorderSchema = { params: z.object({ id: objectIdSchema }).strict() };

export const changePaymentMethodSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z.object({ paymentMethod: z.literal('cod') }).strict(),
};

export const assignRiderSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  // riderId: null unassigns
  body: z.object({ riderId: objectIdSchema.nullable() }).strict(),
};

export const latestOrdersSchema = {
  query: z
    .object({
      // ISO datetime WITH a zone (e.g. 2026-11-18T10:30:00.000Z or ...+05:30) — what Date#toISOString() gives
      since: z.string().datetime({ offset: true }).transform((v) => new Date(v)),
    })
    .strict(),
};
```

### `src/validations/payment.validation.js`

```js
import { z } from 'zod';
import { objectIdSchema } from '../utils/zodHelpers.js';

export const verifyPaymentSchema = {
  body: z
    .object({
      orderId: objectIdSchema, // our order id (not Razorpay's)
      razorpay_payment_id: z.string().trim().min(3).max(100),
      razorpay_signature: z.string().trim().min(1).max(256),
      // Razorpay's checkout callback also returns this; accepted so clients can forward the whole
      // payload as-is. It is only cross-checked — the signature is always verified against the
      // provider order id stored on our order.
      razorpay_order_id: z.string().trim().min(3).max(100).optional(),
    })
    .strict(),
};
```

### `src/validations/pincode.validation.js`

```js
import { z } from 'zod';
import { bilingualText, bilingualTextPartial, objectIdSchema, paiseSchema, pageQuerySchema, pincodeSchema } from '../utils/zodHelpers.js';

const boolParam = z.enum(['true', 'false']).transform((v) => v === 'true');

export const listPincodesSchema = {
  query: pageQuerySchema.extend({
    q: z.string().trim().min(1).max(60).optional(), // pincode prefix/substring or area name
    isActive: boolParam.optional(),
  }),
};

export const createPincodeSchema = {
  body: z
    .object({
      pincode: pincodeSchema,
      areaName: bilingualText(1, 100),
      isActive: z.boolean().default(true),
      deliveryFee: paiseSchema.nullable().default(null), // null = use the store-wide delivery fee
      etaDays: z.number().int().min(0).max(30).default(2),
      etaMinutes: z.number().int().min(5).max(1440).nullable().default(null), // quick-delivery areas; null = use etaDays
    })
    .strict(),
};

export const updatePincodeSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      pincode: pincodeSchema.optional(),
      areaName: bilingualTextPartial(100),
      isActive: z.boolean().optional(),
      deliveryFee: paiseSchema.nullable().optional(),
      etaDays: z.number().int().min(0).max(30).optional(),
      etaMinutes: z.number().int().min(5).max(1440).nullable().optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one field to change' }),
};

export const pincodeIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};
```

### `src/validations/product.validation.js`

```js
import { z } from 'zod';
import { MAX_VARIANTS } from '../models/Product.js';
import { bilingualText, bilingualTextPartial, objectIdSchema, paiseSchema } from '../utils/zodHelpers.js';

export const listProductsSchema = {
  query: z
    .object({
      category: objectIdSchema.optional(),
      minPrice: z.coerce.number().int().min(0).optional(),
      maxPrice: z.coerce.number().int().min(0).optional(),
      brand: z.string().trim().min(1).max(80).optional(),
      rating: z.coerce.number().min(0).max(5).optional(),
      // NOT z.coerce.boolean(): Boolean("false") === true, so ?inStock=false would turn the filter ON.
      inStock: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
      sort: z.enum(['popular', 'price_asc', 'price_desc', 'newest', 'discount']).default('newest'),
      q: z.string().trim().min(1).max(120).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict(),
};

export const suggestProductsSchema = {
  query: z.object({ q: z.string().trim().min(1).max(60) }).strict(),
};

export const productSlugParamSchema = {
  params: z.object({ slug: z.string().trim().min(1) }).strict(),
};

export const productIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

export const relatedProductsSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }).strict(),
};

// ---- variants (same item, different options: Aata 1 kg / 5 kg / 10 kg)
const variantFields = {
  label: bilingualText(1, 60),
  sku: z.string().trim().max(60).default(''),
  mrp: paiseSchema,
  price: paiseSchema,
  stock: z.number().int().min(0),
  images: z.array(z.string().url()).max(10).default([]), // empty = use the product's images
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
};

const withPriceCheck = (schema) => schema.refine((v) => v.price <= v.mrp, { message: 'price cannot exceed mrp', path: ['price'] });

const createVariantSchema = withPriceCheck(z.object(variantFields).strict());
// On PATCH a variant WITH an id updates that variant; one without an id is new. Send the whole variant each time.
const updateVariantSchema = withPriceCheck(z.object({ id: objectIdSchema.optional(), ...variantFields }).strict());

/** Cross-variant rules shared by create and update. */
function checkVariantList(variants, ctx) {
  const issue = (message) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['variants'] });
  if (variants.length === 0) return;

  const dupes = (values) => new Set(values).size !== values.length;
  if (dupes(variants.map((v) => v.label.en.toLowerCase())) || dupes(variants.map((v) => v.label.hi.toLowerCase()))) {
    issue('Variant labels must be unique (English and Hindi)');
  }
  const skus = variants.map((v) => v.sku.toLowerCase()).filter(Boolean);
  if (dupes(skus)) issue('Variant sku values must be unique');
  const ids = variants.map((v) => v.id).filter(Boolean);
  if (dupes(ids)) issue('The same variant id appears twice');

  const defaults = variants.filter((v) => v.isDefault);
  if (defaults.length !== 1) issue(`Exactly one variant must have isDefault: true (got ${defaults.length})`);
  else if (!defaults[0].isActive) issue('The default variant must be active');
}

const optionNameField = bilingualText(1, 60);

const productBodyBase = {
  title: bilingualText(1, 200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/),
  description: bilingualText(1, 4000),
  category: objectIdSchema,
  brand: z.string().trim().max(80).default(''),
  images: z.array(z.string().url()).default([]),
  // Required for a plain product; with variants they are derived from the default variant / the variants' stock
  // and anything sent here is ignored.
  mrp: paiseSchema.optional(),
  price: paiseSchema.optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  stock: z.number().int().min(0).optional(),
  optionName: optionNameField.nullable().optional(),
  variants: z.array(createVariantSchema).max(MAX_VARIANTS).default([]),
  tags: z.array(z.string().trim().toLowerCase()).default([]),
  isActive: z.boolean().default(true),
};

export const createProductSchema = {
  body: z
    .object(productBodyBase)
    .strict()
    .superRefine((v, ctx) => {
      checkVariantList(v.variants, ctx);
      if (v.variants.length > 0) {
        if (!v.optionName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'optionName is required when the product has variants', path: ['optionName'] });
        return;
      }
      for (const key of ['mrp', 'price', 'unit', 'stock']) {
        if (v[key] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key} is required for a product without variants`, path: [key] });
      }
      if (v.price !== undefined && v.mrp !== undefined && v.price > v.mrp) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'price cannot exceed mrp', path: ['price'] });
      }
    }),
};

export const updateProductSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      title: bilingualTextPartial(200),
      description: bilingualTextPartial(4000),
      category: objectIdSchema.optional(),
      brand: z.string().trim().max(80).optional(),
      images: z.array(z.string().url()).optional(),
      mrp: paiseSchema.optional(),
      price: paiseSchema.optional(),
      unit: z.string().trim().min(1).max(40).optional(),
      stock: z.number().int().min(0).optional(),
      optionName: optionNameField.nullable().optional(),
      // The complete list of variants: ones with an id are updated, ones without are created, ones left out are DELETED.
      // [] turns the product back into a plain one. Omit the key to leave the variants alone.
      variants: z.array(updateVariantSchema).max(MAX_VARIANTS).optional(),
      tags: z.array(z.string().trim().toLowerCase()).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .superRefine((v, ctx) => v.variants && checkVariantList(v.variants, ctx)),
};

// ---- bulk / CSV (admin)
// The body is only checked to be an array here; each ROW is validated individually by the service, so one bad
// row is reported in `failed` instead of rejecting the whole request.
export const bulkUpdateProductsSchema = {
  body: z.array(z.unknown()).min(1, 'Send at least one row').max(200, 'At most 200 rows per request'),
};

export const importProductsSchema = {
  query: z.object({ dryRun: z.enum(['true', 'false']).transform((v) => v === 'true').optional() }).strict(),
};
```

### `src/validations/push.validation.js`

```js
import { z } from 'zod';

const decodedLength = (n) => (value) => Buffer.from(value, 'base64url').length === n;

// Exactly what `PushSubscription.toJSON()` produces in the browser.
export const pushSubscriptionSchema = {
  body: z
    .object({
      endpoint: z.string().trim().url().max(2048),
      expirationTime: z.number().nullable().optional(),
      keys: z
        .object({
          p256dh: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(decodedLength(65), 'p256dh must be a 65-byte public key'),
          auth: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(decodedLength(16), 'auth must be a 16-byte secret'),
        })
        .strict(),
    })
    .strict(),
};

export const removePushSubscriptionSchema = {
  body: z.object({ endpoint: z.string().trim().url().max(2048) }).strict(),
};
```

### `src/validations/report.validation.js`

```js
import { z } from 'zod';
import { parseDateBoundary } from '../utils/dates.js';

// YYYY-MM-DD = the whole IST day; an ISO datetime is used as given.
const dateParam = z
  .string()
  .trim()
  .refine((v) => parseDateBoundary(v, 'start') !== null, { message: 'Use YYYY-MM-DD or an ISO datetime' });

const rangeIsOrdered = (v) => !v.from || !v.to || parseDateBoundary(v.from, 'start') <= parseDateBoundary(v.to, 'end');
const rangeError = { message: '"from" must not be after "to"', path: ['from'] };

export const salesReportSchema = {
  query: z
    .object({
      from: dateParam.optional(), // default: 30 days before `to`
      to: dateParam.optional(), // default: today (IST)
      groupBy: z.enum(['day', 'week', 'month']).default('day'),
    })
    .strict()
    .refine(rangeIsOrdered, rangeError),
};

export const topProductsSchema = {
  query: z
    .object({
      from: dateParam.optional(),
      to: dateParam.optional(),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    })
    .strict()
    .refine(rangeIsOrdered, rangeError),
};

export const codReportSchema = {
  query: z
    .object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
        .refine((v) => parseDateBoundary(v, 'start') !== null, { message: 'Not a real date' }),
    })
    .strict(),
};
```

### `src/validations/review.validation.js`

```js
import { z } from 'zod';
import { objectIdSchema, pageQuerySchema } from '../utils/zodHelpers.js';
import { REVIEW_STATUSES } from '../models/Review.js';

export const createReviewSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).default(''),
    })
    .strict(),
};

export const listReviewsSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  query: pageQuerySchema,
};

export const adminListReviewsSchema = {
  query: pageQuerySchema.extend({
    productId: objectIdSchema.optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    status: z.enum(REVIEW_STATUSES).optional(), // default: every status
  }),
};

export const moderateReviewSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      status: z.enum(['approved', 'rejected']),
      note: z.string().trim().min(1).max(300).optional(),
    })
    .strict(),
};

export const myReviewSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

export const reviewIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};
```

### `src/validations/rider.validation.js`

```js
import { z } from 'zod';
import { boolParam, mobileSchema, objectIdSchema, pageQuerySchema, paiseSchema, passwordSchema, usernameSchema } from '../utils/zodHelpers.js';

const ORDER_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

// ---- admin: manage riders
export const adminListRidersSchema = {
  query: pageQuerySchema.extend({
    q: z.string().trim().min(1).max(40).optional(), // name or mobile
    isActive: boolParam.optional(),
  }),
};

export const createRiderSchema = {
  body: z
    .object({
      name: z.string().trim().min(1).max(80),
      mobile: mobileSchema, // still required: calls and push, not for login
      username: usernameSchema,
      password: passwordSchema,
      isActive: z.boolean().default(true),
    })
    .strict(),
};

export const updateRiderSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      mobile: mobileSchema.optional(),
      username: usernameSchema.optional(),
      password: passwordSchema.optional(), // an admin RESETS the rider's password: all their sessions end
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one field to change' }),
};

// ---- rider app
export const riderOrdersSchema = {
  query: pageQuerySchema.extend({ status: z.enum(ORDER_STATUSES).optional() }),
};

export const riderOrderIdSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

export const deliverOrderSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      // A STRING on purpose: as a number "0042" would lose its leading zeros.
      otp: z.string().trim().regex(/^\d{4}$/, 'The delivery OTP is 4 digits'),
      cashCollected: paiseSchema.optional(), // paise; required for unpaid COD orders
    })
    .strict(),
};
```

### `src/validations/settings.validation.js`

```js
import { z } from 'zod';
import { paiseSchema, pincodeSchema } from '../utils/zodHelpers.js';

const hhmm = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:mm, e.g. 08:00');

// Every store-info field may be cleared with "". Format checks apply only to non-empty values.
const blankOr = (schema) => schema.or(z.literal(''));
const phone = blankOr(z.string().trim().regex(/^\+?\d[\d\s-]{5,17}\d$/, 'Enter a valid phone number'));
const gstin = blankOr(
  z.string().trim().toUpperCase().regex(/^[0-3]\d[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN')
);
const fssai = blankOr(z.string().trim().regex(/^\d{14}$/, 'FSSAI licence number is 14 digits'));

export const updateSettingsSchema = {
  body: z
    .object({
      deliveryFee: paiseSchema.optional(),
      freeDeliveryThreshold: paiseSchema.optional(),
      handlingFee: paiseSchema.optional(),
      minOrderValue: paiseSchema.optional(),
      storeOpen: z.boolean().optional(),
      storeTimings: z.object({ open: hhmm.optional(), close: hhmm.optional() }).strict().optional(),
      storeName: z.string().trim().min(1).max(100).optional(),
      phone: phone.optional(),
      whatsapp: phone.optional(),
      email: blankOr(z.string().trim().toLowerCase().email().max(120)).optional(),
      address: z
        .object({
          line1: z.string().trim().max(200).optional(),
          city: z.string().trim().max(80).optional(),
          state: z.string().trim().max(80).optional(),
          pincode: blankOr(pincodeSchema).optional(),
        })
        .strict()
        .optional(),
      fssaiNumber: fssai.optional(),
      gstin: gstin.optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one setting to change' }),
};
```

## 4. Auth / admin middleware

### `src/middleware/auth.js`

```js
import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { User } from '../models/User.js';
import { catchAsync } from '../utils/catchAsync.js';

/** Requires a valid access token; attaches req.user (lean auth payload) and req.userDoc (fresh doc). */
export const authenticate = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized(ErrorCodes.UNAUTHORIZED, 'Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized(ErrorCodes.TOKEN_EXPIRED, 'Access token expired');
    }
    throw ApiError.unauthorized(ErrorCodes.TOKEN_INVALID, 'Invalid access token');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized(ErrorCodes.TOKEN_INVALID, 'User no longer exists');
  }

  if (user.isActive === false) {
    throw ApiError.forbidden(ErrorCodes.ACCOUNT_DISABLED, 'This account has been deactivated');
  }

  // A password change / reset ends every earlier session: tokens issued before it are refused.
  if (user.passwordChangedAt && payload.iat * 1000 < Math.floor(user.passwordChangedAt.getTime() / 1000) * 1000) {
    throw ApiError.unauthorized(ErrorCodes.TOKEN_INVALID, 'Your password was changed. Please sign in again.');
  }

  req.user = { id: user.id, mobile: user.mobile, role: user.role };
  req.userDoc = user;
  next();
});

/** Like `authenticate`, but a request WITHOUT an Authorization header goes through anonymously (req.user stays unset). */
export const optionalAuthenticate = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, next);
};

/** Restricts a route to one or more roles. Use after `authenticate`. */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden(ErrorCodes.FORBIDDEN, 'You do not have access to this resource'));
    }
    next();
  };
```

## 5. Config

### `.env.example`

```bash
# ---- Server ----
NODE_ENV=development
PORT=4000
API_BASE_PATH=/api/v1

# ---- Database ----
MONGO_URI=mongodb://127.0.0.1:27017/aali_market?replicaSet=rs0

# ---- JWT ----
JWT_ACCESS_SECRET=change_this_access_secret
JWT_REFRESH_SECRET=change_this_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# ---- OTP ----
OTP_LENGTH=6
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_SEND_LIMIT=3
OTP_SEND_WINDOW_MINUTES=15
SMS_PROVIDER=console

# ---- CORS ----
CORS_ORIGIN=*

# ---- Rate limiting ----
RATE_LIMIT_WINDOW_MINUTES=15
# Per IP per window. 300 is a sane production default; use ~5000 locally, a dev frontend burns through 300 fast.
RATE_LIMIT_MAX=300

# Reverse-proxy hops in front of the API (nginx/ALB/Render = 1). Without this, behind a proxy every user shares one IP
# and one rate-limit bucket. Keep 0 when the API is hit directly.
TRUST_PROXY=0

# ---- Image storage (POST /admin/uploads) ----
# cloudinary (default) | s3
STORAGE_PROVIDER=cloudinary

# Cloudinary: Dashboard -> Settings -> API Keys. Images go to the "aali-market/products" folder.
# The server boots fine without these; uploads then fail with UPLOAD_FAILED until they are set.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Only read when STORAGE_PROVIDER=s3 (legacy / S3-compatible storage)
S3_ENDPOINT=https://s3.ap-south-1.amazonaws.com
S3_REGION=ap-south-1
S3_BUCKET=aali-market-media
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_BASE_URL=https://aali-market-media.s3.ap-south-1.amazonaws.com

# ---- Payments (Razorpay-shaped) ----
PAYMENT_PROVIDER=mock
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=change_this_webhook_secret

# ---- Delivery / pricing: FIRST-RUN DEFAULTS (paise) ----
# These only seed the store settings document the first time it is created. After that the values live in the
# database and are edited through PATCH /admin/settings (and read by customers via GET /settings).
DEFAULT_DELIVERY_FEE_PAISE=2500
FREE_DELIVERY_THRESHOLD_PAISE=19900
DEFAULT_HANDLING_FEE_PAISE=500

# ---- Web Push (PWA order notifications) ----
# Generate once with `npm run vapid:generate`. The public key is served at GET /push/vapid-public-key.
# Without these, push is disabled (endpoints answer 503 PUSH_NOT_CONFIGURED) and nothing else is affected.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@aalimarket.in
# Extra push-service hostnames to accept (comma separated). Browser vendors' services are built in.
PUSH_EXTRA_ALLOWED_HOSTS=

# ---- Delivery OTP ----
# Wrong OTP attempts a rider gets per order before it locks (the OTP is only 4 digits).
DELIVERY_OTP_MAX_ATTEMPTS=5

# ---- Dashboard / admin ----
# "Today" in GET /admin/stats and the from/to order filters. 330 = IST (UTC+5:30).
STORE_UTC_OFFSET_MINUTES=330
# A product is "low stock" at or below this many units (admin lowStock filter + dashboard count).
LOW_STOCK_THRESHOLD=10

# ---- Staff login (admin + rider: username / password; customers use the OTP) ----
# Failed-attempt limits per IP / per username per 15 minutes (on top of the account lock: 5 wrong passwords = 15 min).
STAFF_LOGIN_IP_LIMIT=20
STAFF_LOGIN_USER_LIMIT=10
# bcrypt cost for staff passwords. Keep 12.
BCRYPT_COST=12

# ---- Location -> area + pincode (GET /geo/reverse) ----
# nominatim = OpenStreetMap, free (the default). Its usage policy needs an identifying User-Agent with a contact and at most
# 1 request/second (the API queues calls and caches results for 24 h). google = Google Geocoding API (needs GOOGLE_MAPS_API_KEY).
GEO_PROVIDER=nominatim
GEO_USER_AGENT=AaliMarketApi/1.0 (ops@your-domain.example)
GOOGLE_MAPS_API_KEY=
GEO_RATE_LIMIT_PER_MINUTE=30

# ---- Seed ----
# The seeded admin signs in with SEED_ADMIN_USERNAME + SEED_ADMIN_PASSWORD (min 8 chars, a letter and a number).
# There is NO default password: with NODE_ENV=production `npm run seed` refuses to run without SEED_ADMIN_PASSWORD.
# An existing password is never overwritten; to change it later run:  npm run admin:set-password -- <username>
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=
SEED_ADMIN_MOBILE=9999999999
SEED_ADMIN_NAME=Aali Admin
SEED_ADMIN_EMAIL=admin@aalimarket.in
```

### `src/config/env.js`

```js
import dotenv from 'dotenv';

dotenv.config();

const toInt = (val, fallback) => {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toBool = (val, fallback) => {
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: toInt(process.env.PORT, 4000),
  apiBasePath: process.env.API_BASE_PATH || '/api/v1',

  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/aali_market',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  otp: {
    length: toInt(process.env.OTP_LENGTH, 6),
    ttlMinutes: toInt(process.env.OTP_TTL_MINUTES, 5),
    maxAttempts: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
    sendLimit: toInt(process.env.OTP_SEND_LIMIT, 3),
    sendWindowMinutes: toInt(process.env.OTP_SEND_WINDOW_MINUTES, 15),
    smsProvider: process.env.SMS_PROVIDER || 'console',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },

  // Number of reverse-proxy hops in front of the app (nginx / ALB / Render = 1). Needed so rate limiting
  // sees each client's real IP instead of the proxy's. Leave 0 when the app is hit directly.
  trustProxy: toInt(process.env.TRUST_PROXY, 0),

  rateLimit: {
    windowMinutes: toInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 15),
    max: toInt(process.env.RATE_LIMIT_MAX, 300),
  },

  // Where POST /admin/uploads stores images: 'cloudinary' (default) or 's3'. Neither needs credentials to BOOT —
  // a missing config only makes uploads fail (UPLOAD_FAILED), it never crashes the server.
  storage: {
    provider: (process.env.STORAGE_PROVIDER || 'cloudinary').trim().toLowerCase(),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  // Only used when STORAGE_PROVIDER=s3
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'ap-south-1',
    bucket: process.env.S3_BUCKET || 'aali-market-media',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: toBool(process.env.S3_FORCE_PATH_STYLE, false),
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  },

  payments: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'dev_webhook_secret',
  },

  pricing: {
    deliveryFeePaise: toInt(process.env.DEFAULT_DELIVERY_FEE_PAISE, 2500),
    freeDeliveryThresholdPaise: toInt(process.env.FREE_DELIVERY_THRESHOLD_PAISE, 19900),
    handlingFeePaise: toInt(process.env.DEFAULT_HANDLING_FEE_PAISE, 500),
  },

  // Web Push (VAPID). Generate once with `npm run vapid:generate`. Without them push is simply disabled.
  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@aalimarket.in',
    // Push-service hostnames (suffix match) accepted for subscriptions, in addition to the built-in list of
    // the browser vendors' services. Subscriptions are rejected otherwise (the server POSTs to that URL).
    extraAllowedHosts: (process.env.PUSH_EXTRA_ALLOWED_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
  },

  // A rider gets this many wrong delivery-OTP attempts per order before it locks (4 digits = 10,000 combinations).
  deliveryOtpMaxAttempts: toInt(process.env.DELIVERY_OTP_MAX_ATTEMPTS, 5),

  // "Today" in dashboard stats / date filters. 330 = IST (UTC+5:30, no DST).
  storeUtcOffsetMinutes: toInt(process.env.STORE_UTC_OFFSET_MINUTES, 330),

  // A product counts as "low stock" at or below this many units (admin product filter + dashboard stats).
  lowStockThreshold: toInt(process.env.LOW_STOCK_THRESHOLD, 10),

  // bcrypt work factor for staff passwords. 12 in every real environment; tests use 4 so the suite stays fast.
  bcryptCost: process.env.NODE_ENV === 'test' ? 4 : toInt(process.env.BCRYPT_COST, 12),

  // Admin / rider username + password login (POST /auth/staff/login).
  staff: {
    maxFailedAttempts: 5, // wrong passwords before the account locks
    lockMinutes: 15,
    loginWindowMinutes: 15,
    loginIpLimit: toInt(process.env.STAFF_LOGIN_IP_LIMIT, 20), // failed attempts per IP per window
    loginUserLimit: toInt(process.env.STAFF_LOGIN_USER_LIMIT, 10), // failed attempts per username per window
  },

  // Reverse geocoding for GET /geo/reverse ("Delivering to G Block, Sector 63").
  geo: {
    provider: (process.env.GEO_PROVIDER || 'nominatim').trim().toLowerCase(), // nominatim (free, OpenStreetMap) | google
    googleApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    // Nominatim's usage policy requires an identifying User-Agent (put a contact in it, e.g. "AaliMarket/1.0 (ops@your-domain)").
    userAgent: process.env.GEO_USER_AGENT || 'AaliMarketApi/1.0',
    // Nominatim allows at most 1 request per second: outbound calls are spaced this far apart.
    nominatimMinIntervalMs: toInt(process.env.GEO_NOMINATIM_MIN_INTERVAL_MS, 1100),
    cacheTtlMs: 24 * 60 * 60 * 1000,
    rateLimitPerMinute: toInt(process.env.GEO_RATE_LIMIT_PER_MINUTE, 30), // per IP
  },

  seed: {
    adminUsername: (process.env.SEED_ADMIN_USERNAME || 'admin').trim().toLowerCase(),
    // No default: in production the seed refuses to run without it.
    adminPassword: process.env.SEED_ADMIN_PASSWORD || '',
    adminMobile: process.env.SEED_ADMIN_MOBILE || '9999999999',
    adminName: process.env.SEED_ADMIN_NAME || 'Aali Admin',
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@aalimarket.in',
  },
};
```
