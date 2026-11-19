// Regenerates docs/BACKEND_REFERENCE.md: a hand-written overview on top of the VERBATIM source of the routes,
// models, validation schemas, auth middleware and config. Usage: npm run reference
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n').trimEnd();
const list = (dir) =>
  fs
    .readdirSync(path.join(root, dir), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.js'))
    .map((e) => `${dir}/${e.name}`)
    .sort();
const code = (rel, lang = 'js') => `### \`${rel}\`\n\n\`\`\`${lang}\n${read(rel)}\n\`\`\`\n`;

const header = `# Aali Market API — backend reference (exact code)

Everything below the overview is copied verbatim from the repo by \`npm run reference\` — not retyped. Real response JSON for every endpoint is in [SAMPLE_RESPONSES.md](SAMPLE_RESPONSES.md) (\`npm run samples\`).

## 0. Quick answers

| Question | Answer |
|---|---|
| Port | \`PORT\` env, default **4000** |
| Base path | \`API_BASE_PATH\` env, default **/api/v1**. \`/health\` is at the server root. |
| CORS | \`cors({ origin: env.cors.origin })\`; \`CORS_ORIGIN\` default \`*\`. One string only — a comma-separated list is **not** split into several origins. |
| Uploaded images | No \`/uploads\` path, no static serving. \`POST /admin/uploads\` (multipart field \`images\`, max 6, 5 MB each) → Cloudinary (\`STORAGE_PROVIDER=cloudinary\`, default; \`s3\` still available) → \`201 { success, data: { urls: ["https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v<n>/aali-market/products/<id>"] }, error: null }\`. Errors: \`VALIDATION_ERROR\`, \`FILE_TOO_LARGE\` (413), \`UPLOAD_FAILED\` (400/502/503). |
| User roles | \`User.role\` ∈ \`customer\` \\| \`admin\` \\| \`rider\` (default \`customer\`). **Customers sign in with the OTP; admin and rider sign in with username + password** (\`POST /auth/staff/login\`) — the OTP endpoints answer 403 \`USE_PASSWORD_LOGIN\` for their mobiles. |
| Admin check | \`authenticate\` verifies the JWT and loads the user from the DB each request; \`requireRole('admin')\` compares the DB role (not the token claim). |
| Money | integer **paise** everywhere (₹1 = 100) |
| Envelope | \`{ success, data, error, meta? }\`; errors \`{ code, message, details? }\` |

### Customer-facing endpoints

\`\`\`
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
\`\`\`

### \`GET /products\` query params

All optional; unknown params → 400. \`page\` (default 1), \`limit\` (1–100, default 20), \`sort\` (\`popular|price_asc|price_desc|newest|discount\`, default \`newest\`), \`category\` (category **id**, not slug), \`minPrice\`/\`maxPrice\` (paise), \`brand\`, \`rating\`, \`inStock\` (\`"true"|"false"\`), \`q\` ($text search — whole words only; use \`/products/suggest\` for type-ahead). Response \`meta: { total, page, limit, pages }\`.

### \`GET /products/suggest?q=\`

Prefix search for type-ahead, top 8 → \`[{ id, slug, title:{en,hi}, price, image }]\`. Matches the start of any word in the English/Hindi title or brand, or the start of a tag ("att" → "Aata" via its "atta" tag). Active products only. \`q\` is required (1–60 chars).

### Store settings (\`GET /settings\`, admin \`GET|PATCH /admin/settings\`)

\`{ deliveryFee, freeDeliveryThreshold, handlingFee, minOrderValue, storeOpen, storeTimings: { open, close } }\` — money in paise, times \`HH:mm\`. One DB document, created from the \`DEFAULT_*\` env values on first read; edits apply to the next cart/checkout. \`storeOpen=false\` → \`POST /orders\` = **503 \`STORE_CLOSED\`**; subtotal < \`minOrderValue\` → **400 \`MIN_ORDER_VALUE\`**; \`storeTimings\` is display-only; \`freeDeliveryThreshold: 0\` = delivery always free.

### Serviceable areas (\`/admin/pincodes\`, \`GET /serviceability\`)

\`{ pincode, areaName:{en,hi}, isActive, deliveryFee (paise|null), etaDays, etaMinutes (5–1440|null) }\`. **No pincodes configured → every pincode is served.** Once any exists, only active listed pincodes are serviceable and \`POST /orders\` rejects others with **400 \`NOT_SERVICEABLE\`**. \`deliveryFee\` overrides the store fee for that area (free threshold still applies); \`etaDays\` sets \`expectedDeliveryAt\`. \`etaMinutes\` (5–1440, \`null\` by default) is for quick-delivery areas: when set, \`expectedDeliveryAt\` = order time + \`etaMinutes\` instead, and \`GET /serviceability\` returns it next to \`etaDays\`. \`GET /cart?pincode=\` previews the override.

### Online payments

\`POST /orders\` with \`paymentMethod\` upi/card/netbanking returns, besides the order, \`data.payment = { provider, keyId, providerOrderId, amount, currency }\` (null for COD). Open Razorpay checkout with \`keyId\` + \`providerOrderId\`, then \`POST /payments/verify { orderId, razorpay_payment_id, razorpay_signature, razorpay_order_id? }\` (\`orderId\` is OUR order id). Signature = HMAC-SHA256(\`<razorpay_order_id>|<razorpay_payment_id>\`, \`RAZORPAY_KEY_SECRET\`). The webhook confirms independently; both paths are idempotent. \`PAYMENT_PROVIDER=mock\` (default) never verifies in production.

### Store info

\`GET /settings\` (public) and admin \`GET|PATCH /admin/settings\` also carry \`storeName\`, \`phone\`, \`whatsapp\`, \`email\`, \`address { line1, city, state, pincode }\`, \`fssaiNumber\` (14 digits), \`gstin\` (15 chars) for legal pages / invoices / contact. Every value can be cleared with \`""\`; \`address\` merges field by field.

### Delivery: notes, location, riders, OTP

- \`POST /orders\` accepts \`deliveryNote\` (≤ 200 chars). Addresses accept an optional \`location { lat, lng }\` (copied into the order snapshot; \`null\` on PATCH clears it).
- Every order gets a random 4-digit \`deliveryOtp\`. **Only the owner sees it** (\`POST /orders\`, \`GET /orders/:id\`); it is stripped from every other serialisation — admin, rider, push.
- Admins manage riders (\`/admin/riders\`, \`role: rider\`, username + password login) and assign orders (\`PATCH /admin/orders/:id/assign { riderId | null }\`).
- Rider app (\`/rider/*\`, rider token only): \`GET /orders\` (mine only), \`PATCH /orders/:id/out-for-delivery\`, \`POST /orders/:id/deliver { otp: "1234", cashCollected }\`. Wrong OTP = 400 \`INVALID_DELIVERY_OTP\` (\`details.attemptsLeft\`); after \`DELIVERY_OTP_MAX_ATTEMPTS\` (5) wrong tries = 429 \`DELIVERY_OTP_LOCKED\`. Unpaid COD needs \`cashCollected\` (paise) and becomes paid.

### Payment retry, COD switch, reorder

- \`POST /orders/:id/payment\` → \`{ payment: {...} }\` with a fresh gateway order (else 400 \`PAYMENT_NOT_RETRYABLE\`). Abandoned gateway orders are remembered, so a late webhook still pays the order.
- \`PATCH /orders/:id/payment-method { paymentMethod: "cod" }\` (else 400 \`PAYMENT_METHOD_NOT_CHANGEABLE\`).
- \`POST /orders/:id/reorder\` → \`{ cart, skipped: [{ productId, title, reason: inactive|out_of_stock|qty_reduced, requested, added }] }\`.

### Push notifications (PWA)

\`GET /push/vapid-public-key\` → \`POST /me/push-subscriptions\` (the browser's PushSubscription JSON; only browser vendors' push services are accepted) → on order status changes (admin, rider, confirmed payment) the customer gets \`{ title, body, url: "/orders/<id>" }\` (English + Hindi). 404/410 removes the subscription. Needs \`VAPID_*\` (\`npm run vapid:generate\`).

**Riders** use the same \`POST|DELETE /me/push-subscriptions\` with their rider token. \`PATCH /admin/orders/:id/assign\` pushes the new rider \`{ title: "New delivery / नई डिलीवरी", body: "#<last 6 of orderNumber>, <area or city>", url: "/rider" }\`; taking the order from a rider (given to someone else, or \`riderId: null\`) pushes the previous rider \`{ title: "Order reassigned / ऑर्डर बदला गया", … }\`. Assigning the same rider again sends nothing. These pushes never contain the customer's phone, the delivery OTP or the door number (area = address line 2, else the city).

### Product variants (Aata 1 kg / 5 kg / 10 kg)

A product either sells as before (no variants) or **only through its variants**. Product JSON now always has \`optionName\` (\`{ en, hi }\` or \`null\`) and \`variants: [{ id, label:{en,hi}, sku, mrp, price, stock, images, isDefault, isActive, discountPercent, inStock }]\` (\`[]\` for a plain product). With variants the top-level fields are **derived by the backend** on every save: \`price\` / \`mrp\` / \`unit\` = the default variant's (unit = its English label), \`stock\` = total of the **active** variants. So listing, \`sort\`, \`minPrice\`/\`maxPrice\`, \`inStock\`, suggest and the wishlist work unchanged. Customers never receive an inactive variant; admin endpoints return all of them.

- **Admin create / PATCH** \`/admin/products\`: \`optionName\` + \`variants\` (max 20; labels unique in English and Hindi; sku unique; exactly one \`isDefault\`, and it must be active; each \`price ≤ mrp\`). \`mrp\`/\`price\`/\`unit\`/\`stock\` are optional (and ignored) when variants are sent. On PATCH \`variants\` is the **complete list**: with \`id\` = update that variant (unknown id = 404 \`VARIANT_NOT_FOUND\`), without \`id\` = create, **left out = deleted** (hard delete: orders keep their own snapshot, carts show the line as unavailable, reorder skips it as \`inactive\`; use \`isActive: false\` to just hide a variant). \`variants: []\` turns the product back into a plain one; omit the key to leave variants alone.
- **Cart**: \`POST /cart/items { productId, variantId?, qty }\` — \`variantId\` is required for a product with variants (**400 \`VARIANT_REQUIRED\`**, \`details.options\` lists the choices; unknown / inactive variant = 404 \`VARIANT_NOT_FOUND\`). A line is (product, variant): \`PATCH|DELETE /cart/items/:productId?variantId=\`. \`GET /cart\` items add \`variantId\`, \`variantLabel { en, hi }\` (both \`null\` for plain products) and show that variant's \`price\`/\`mrp\`/\`stock\`/\`image\`/\`unit\`. A line from before the product got variants is shown as unavailable and can be removed.
- **Orders**: each item snapshots \`variantId\` + \`variantLabel\`; stock is taken (atomically, no oversell) from that variant and returned to it on cancel. \`POST /orders/:id/reorder\` keeps the variant (gone/inactive = \`skipped\` with reason \`inactive\`; \`skipped\` entries also carry \`variantId\`, \`variantLabel\`).
- **Admin**: \`PATCH /admin/products/bulk\` rows take an optional \`variantId\` (that variant's price/mrp/stock/isActive; a row without it on a variant product may only send \`isActive\`). \`lowStock=true\` and \`lowStockCount\` count a product when **any active variant** is at or below the threshold. \`GET /admin/reports/top-products\` has one row per variant (\`variantId\`, \`variantLabel\`; \`null\` for plain products).
- **CSV**: columns \`id, variant_id, variant_label_en, variant_label_hi, sku, slug, title_en, title_hi, option_name_en, option_name_hi, category_slug, brand, unit, mrp, price, stock, isActive\`. Export writes one row per variant (product columns repeated; \`unit\` = the variant's English label; \`isActive\` = the variant's). Import: a row with \`variant_id\` (or \`variant_label_en\`/\`_hi\`) targets one variant — found by id, else by English label, else created (needs both labels, mrp, price, stock and the option names); the first variant of a new product is the default; the CSV never deletes variants. Old files without the variant columns still import.
- **Existing data** needs no migration for this: products without \`variants\`/\`optionName\`, cart lines and order items without \`variantId\` read as plain.

### Review approval

\`Review.status\` ∈ \`pending\` (default) | \`approved\` | \`rejected\`, plus \`moderatedAt\`, \`moderationNote\`. \`POST /products/:id/reviews\` returns the review as \`pending\` (it does not change the rating). \`GET /products/:id/reviews\` (public) lists **approved only** and never shows moderation fields. \`ratingAvg\`/\`ratingCount\` are computed from approved reviews and recomputed on approve / reject / delete. \`GET /products/:id/reviews/mine\` (auth) returns the caller's own review in any status (\`status\` only, never the admin's note) or \`null\`. Admin: \`GET /admin/reviews?status=pending|approved|rejected\` (default every status; + \`productId\`, \`rating\`), \`PATCH /admin/reviews/:id/status { status: "approved" | "rejected", note? }\` → \`{ review, product: { id, ratingAvg, ratingCount } }\` (can be changed again later), \`GET /admin/stats\` → \`pendingReviews\`. **Migration**: reviews from before moderation are set to \`approved\` automatically at server start (\`src/migrations\`, idempotent; also \`npm run migrate\`). A customer still has one review per product, whatever its status.

### Staff login (admin + rider)

\`POST /auth/staff/login { username, password }\` → \`{ user, accessToken, refreshToken, isNewUser: false }\` (same shape as \`/auth/otp/verify\`). \`User\` has \`username\` (unique, a–z 0–9 . _, 3–30, lower-cased), \`passwordHash\` (bcrypt cost 12, never returned), \`passwordChangedAt\`, \`failedLoginAttempts\` / \`lockUntil\` (private).
- A wrong password, an unknown username and a **customer** account all answer the same **401 \`INVALID_CREDENTIALS\`** (and take the same time).
- **5 wrong passwords lock the account for 15 minutes** → **429 \`ACCOUNT_LOCKED\`** with \`details.retryAfterSeconds\` (the 5th wrong try is the one that answers it; even the right password is refused until the lock ends). The counter is **atomic**: every attempt first reserves a slot with one conditional update, so parallel guesses never get more than 5 tries. A correct login resets it. Inactive account (after the password was right) → 403 \`ACCOUNT_DISABLED\`.
- Rate limiters on top, counting only failed attempts: per IP (\`STAFF_LOGIN_IP_LIMIT\`, default 20 / 15 min) and per username (\`STAFF_LOGIN_USER_LIMIT\`, default 10 / 15 min) → 429 \`RATE_LIMITED\`.
- \`POST /auth/otp/send\` and \`/auth/otp/verify\` for a mobile that belongs to an admin or rider → **403 \`USE_PASSWORD_LOGIN\`** (no OTP is generated or sent). The OTP \`code\` is echoed in the \`/auth/otp/send\` response **only when \`NODE_ENV != production\` and \`SMS_PROVIDER=console\`**.
- \`PATCH /me/password { currentPassword, newPassword }\` (staff only; new password ≥ 8 chars with a letter and a number, ≤ 72 bytes, different from the old one; wrong current = 400 \`INVALID_CURRENT_PASSWORD\`, which also counts towards the lock). All refresh tokens are revoked and access tokens issued before the change stop working; the response is \`{ accessToken, refreshToken, passwordChangedAt }\` — a fresh pair for the current session.
- **Riders**: \`POST /admin/riders { name, mobile, username, password }\` (the mobile stays — for calls and push); \`PATCH /admin/riders/:id\` also takes \`username\` / \`password\` (a reset ends that rider's sessions); \`GET /admin/riders\` shows \`username\` (null for riders created before this existed — give them one with PATCH); duplicate username = 409 \`USERNAME_TAKEN\`.
- **Seed**: \`SEED_ADMIN_USERNAME\` (default \`admin\`) + \`SEED_ADMIN_PASSWORD\`. There is no default password: with \`NODE_ENV=production\` the seed refuses to run without it. The seed never overwrites an existing password.
- **Recovery**: \`npm run admin:set-password -- <username>\` asks for the new password in the terminal (hidden). For an older admin without a username: \`npm run admin:set-password -- <new-username> --mobile <their mobile>\`. It clears a lock and signs the account out everywhere.

### Location → area + pincode (\`GET /geo/reverse\`)

Public. \`?lat=&lng=\` → \`{ pincode, area, city, state }\` — \`area\` is the mohalla / sector (e.g. "G Block, Sector 63") for "Delivering to …". India only: outside it, or with no pincode there → **404 \`GEO_NOT_FOUND\`**; provider trouble → 502 \`GEO_PROVIDER_ERROR\`; \`GEO_PROVIDER=google\` without \`GOOGLE_MAPS_API_KEY\` → 503 \`GEO_NOT_CONFIGURED\`. \`GEO_PROVIDER\` = \`nominatim\` (OpenStreetMap, free, default) or \`google\`. Nominatim's policy is followed: an identifying \`GEO_USER_AGENT\` (put a contact in it) and at most 1 request/second (outbound calls are queued and spaced). Coordinates are rounded to 3 decimals (~110 m) and answers are cached for 24 hours (also "nothing here"; provider errors are not cached). Per-IP rate limit \`GEO_RATE_LIMIT_PER_MINUTE\` (default 30).

### Cancellation and refunds

Every cancellation — customer \`POST /orders/:id/cancel\` **and** admin \`PATCH /admin/orders/:id/status { status: "cancelled" }\` — runs the same transaction: the order is **claimed atomically** (so it is idempotent: a second or simultaneous cancel changes nothing), stock goes back to the **same variant**, and the coupon redemption is given back (\`usedCount\` − 1, the user's per-user limit is free again). A cancelled order cannot be re-opened (400 \`INVALID_ORDER_STATE\`).

**Refunds** (online-paid orders): \`Order.refundStatus\` (\`null\` | \`pending\` | \`processed\` | \`failed\`), \`refundId\`, \`refundedAmount\` (paise, processed only), \`refundedAt\`, plus \`refunds[]\` (one entry per refund: \`refundId, amount, status, reason, source: cancel|admin|gateway, failureReason, createdAt, processedAt\`) — all in \`GET /orders/:id\` and the admin order. Cancelling a **paid online** order (customer or admin) starts a Razorpay refund for everything still refundable; \`paymentStatus\` becomes \`refunded\` **only when processed refunds cover the whole paid amount**. A gateway failure never undoes the cancellation: the refund is marked \`failed\` and an admin retries with \`POST /admin/orders/:id/refund\`. The mock provider processes refunds at once; Razorpay answers \`pending\` and finishes through the **webhook** \`refund.processed\` / \`refund.failed\` (same signature as the payment webhook; idempotent; a refund made in the Razorpay dashboard is recorded as \`source: gateway\`).
- \`POST /admin/orders/:id/refund { amount?, reason }\` — partial or full refund of a paid online order (\`amount\` in paise, default = everything still refundable). The amount is reserved with one conditional update, so refunds can never add up to more than was paid (pending refunds count): **400 \`REFUND_AMOUNT_EXCEEDED\`** (\`details.maxRefundable\`); COD / unpaid / fully refunded = 400 \`REFUND_NOT_ALLOWED\`; gateway error = 502 \`REFUND_PROVIDER_ERROR\`. Returns the order the way \`GET /admin/orders/:id\` does. A partial refund leaves the order \`paid\` (and still counted in revenue reports).
- Cancelling a COD order that was already paid in cash only sets \`paymentStatus: refunded\` (the shop returns cash by hand). A payment that arrives for an already cancelled order is logged for manual refund.

### Offers (\`GET /coupons/available\`)

Public; with a token, coupons whose per-user limit that user has already used up are removed (an invalid token is 401, not a guest). Returns \`[{ code, type, value, minOrderValue, maxDiscount, expiresAt, description: { en, hi } | null }]\` of coupons that are active, inside their dates and not used up (\`usageLimit\`), soonest-expiring first. \`minOrderValue\` is shown, not filtered (the app can say "add ₹50 more"). \`Coupon.description { en, hi }\` is optional and set in \`POST|PATCH /admin/coupons\` (\`null\` removes it).

### Admin endpoints (\`/admin/*\`, admin token)

| | |
|---|---|
| \`GET /stats\` | \`{ todayOrders, todayRevenue, pendingOrders, outForDelivery, lowStockCount, totalCustomers, pendingReviews }\` — "today" is the IST day (\`STORE_UTC_OFFSET_MINUTES\`); revenue excludes cancelled / payment-failed / refunded orders; low stock = active products at or below \`LOW_STOCK_THRESHOLD\` (variant products: any active variant); \`pendingReviews\` = reviews waiting for approval |
| \`GET /orders?page&limit&status&from&to&q\` | all orders; \`q\` = orderNumber or customer mobile; \`from\`/\`to\` = \`YYYY-MM-DD\` (whole IST day, \`to\` inclusive) or ISO datetime; \`user\` populated \`{ id, name, mobile }\` |
| \`GET /orders/:id\`, \`PATCH /orders/:id/status\` | full order + customer card; status transition. \`cancelled\` restores stock + coupon and refunds a paid online order (idempotent) |
| \`GET /users?page&limit&q\` | customers: \`{ id, name, mobile, email, isVerified, ordersCount, createdAt }\` |
| \`GET /products?page&limit&q&category&isActive&lowStock\` | incl. inactive (and inactive variants); \`POST\`, \`PATCH /:id\` (both take \`optionName\` + \`variants\`), \`DELETE /:id\` (soft; re-activate with \`PATCH { isActive: true }\`) |
| \`GET|POST /categories\`, \`PATCH|DELETE /categories/:id\` | list includes inactive |
| \`GET|POST /banners\`, \`PATCH|DELETE /banners/:id\` | list includes inactive |
| \`GET|POST /coupons\`, \`PATCH|DELETE /coupons/:id\` | optional \`description { en, hi }\` |
| \`GET|PATCH /settings\` | see above |
| \`GET|POST /pincodes\`, \`PATCH|DELETE /pincodes/:id\` | \`etaMinutes\` (5–1440 or null) for quick-delivery areas; DELETE is a hard delete |
| \`POST /uploads\` | multipart field \`images\` |
| \`GET /orders/latest?since=<ISO>\` | new-order alert: \`{ count, orders: [{ id, orderNumber, total, createdAt }] }\` (newest 10; \`since\` exclusive) |
| \`POST /orders/:id/refund\` | \`{ amount?, reason }\` partial / full refund of a paid online order → the order with \`refunds[]\` (see Cancellation and refunds) |
| \`PATCH /orders/:id/assign\` | \`{ riderId }\` (null unassigns) → order with \`rider { id, name, mobile }\` |
| \`GET|POST /riders\`, \`PATCH /riders/:id\` | delivery riders \`{ name, mobile, username, isActive }\` (+ \`activeOrders\`); create needs \`username\` + \`password\`, PATCH can reset them |
| \`GET /reports/sales?from&to&groupBy=day\` (or week, month) | \`[{ period, orders, revenue, avgOrderValue }]\` |
| \`GET /reports/top-products?from&to&limit\` | \`[{ productId, variantId, variantLabel, title, qtySold, revenue }]\` (one row per variant; variant fields \`null\` for plain products) |
| \`GET /reports/cod?date=YYYY-MM-DD\` | \`{ totalExpected, totalCollected, byRider: [{ rider, orders, expected, collected }] }\` |
| \`PATCH /products/bulk\` | \`[{ id, variantId?, price?, mrp?, stock?, isActive? }]\` (≤ 200; \`variantId\` = change that variant) → \`{ updated, failed: [{ id, variantId?, error }] }\` |
| \`GET /products/export\` | CSV of all products, one row per variant (paise; UTF-8 BOM) |
| \`POST /products/import?dryRun=\` | multipart \`file\` (.csv ≤ 2 MB, ≤ 2000 rows) → \`{ created, updated, errors: [{ row, error }], dryRun }\` |
| \`GET /reviews?page&limit&productId&rating&status\` | moderation list; \`status\` = \`pending\` \\| \`approved\` \\| \`rejected\` (default every status) |
| \`PATCH /reviews/:id/status\` | \`{ status: "approved" \\| "rejected", note? }\` → \`{ review, product: { id, ratingAvg, ratingCount } }\` |
| \`DELETE /reviews/:id\` | removes it; recalculates the product rating |

Not available: promoting an existing customer to admin/rider (admins come from \`npm run seed\` or the DB; riders are created with \`POST /admin/riders\` for a NEW mobile and username).

---

## 1. Routes (mounted by \`src/routes/index.js\`)
`;

const sections = [
  header,
  ...list('src/routes').map((f) => code(f)),
  code('src/app.js'),
  '## 2. Models\n',
  ...list('src/models').map((f) => code(f)),
  ...list('src/models/shared').map((f) => code(f)),
  '## 3. Validation (request schemas)\n',
  ...list('src/validations').map((f) => code(f)),
  '## 4. Auth / admin middleware\n',
  code('src/middleware/auth.js'),
  '## 5. Config\n',
  code('.env.example', 'bash'),
  code('src/config/env.js'),
];

fs.writeFileSync(path.join(root, 'docs', 'BACKEND_REFERENCE.md'), sections.join('\n'));
console.log(`Wrote docs/BACKEND_REFERENCE.md (${sections.length - 1} sections)`);
