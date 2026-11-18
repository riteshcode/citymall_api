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
| User roles | \`User.role\` ∈ \`customer\` \\| \`admin\` \\| \`rider\` (default \`customer\`) |
| Admin check | \`authenticate\` verifies the JWT and loads the user from the DB each request; \`requireRole('admin')\` compares the DB role (not the token claim). |
| Money | integer **paise** everywhere (₹1 = 100) |
| Envelope | \`{ success, data, error, meta? }\`; errors \`{ code, message, details? }\` |

### Customer-facing endpoints

\`\`\`
POST /auth/otp/send            POST /auth/otp/verify        POST /auth/refresh       POST /auth/logout
GET  /me                       PATCH /me
GET  /categories               GET /banners                 GET /settings            (public)
GET  /products                 GET /products/suggest?q=     GET /products/:slug      GET /products/:id/related
GET  /products/:id/reviews     POST /products/:id/reviews
GET  /cart[?pincode=]          POST /cart/items             PATCH|DELETE /cart/items/:productId
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

\`{ pincode, areaName:{en,hi}, isActive, deliveryFee (paise|null), etaDays }\`. **No pincodes configured → every pincode is served.** Once any exists, only active listed pincodes are serviceable and \`POST /orders\` rejects others with **400 \`NOT_SERVICEABLE\`**. \`deliveryFee\` overrides the store fee for that area (free threshold still applies); \`etaDays\` sets \`expectedDeliveryAt\`. \`GET /cart?pincode=\` previews the override.

### Online payments

\`POST /orders\` with \`paymentMethod\` upi/card/netbanking returns, besides the order, \`data.payment = { provider, keyId, providerOrderId, amount, currency }\` (null for COD). Open Razorpay checkout with \`keyId\` + \`providerOrderId\`, then \`POST /payments/verify { orderId, razorpay_payment_id, razorpay_signature, razorpay_order_id? }\` (\`orderId\` is OUR order id). Signature = HMAC-SHA256(\`<razorpay_order_id>|<razorpay_payment_id>\`, \`RAZORPAY_KEY_SECRET\`). The webhook confirms independently; both paths are idempotent. \`PAYMENT_PROVIDER=mock\` (default) never verifies in production.

### Store info

\`GET /settings\` (public) and admin \`GET|PATCH /admin/settings\` also carry \`storeName\`, \`phone\`, \`whatsapp\`, \`email\`, \`address { line1, city, state, pincode }\`, \`fssaiNumber\` (14 digits), \`gstin\` (15 chars) for legal pages / invoices / contact. Every value can be cleared with \`""\`; \`address\` merges field by field.

### Delivery: notes, location, riders, OTP

- \`POST /orders\` accepts \`deliveryNote\` (≤ 200 chars). Addresses accept an optional \`location { lat, lng }\` (copied into the order snapshot; \`null\` on PATCH clears it).
- Every order gets a random 4-digit \`deliveryOtp\`. **Only the owner sees it** (\`POST /orders\`, \`GET /orders/:id\`); it is stripped from every other serialisation — admin, rider, push.
- Admins manage riders (\`/admin/riders\`, \`role: rider\`, same OTP login) and assign orders (\`PATCH /admin/orders/:id/assign { riderId | null }\`).
- Rider app (\`/rider/*\`, rider token only): \`GET /orders\` (mine only), \`PATCH /orders/:id/out-for-delivery\`, \`POST /orders/:id/deliver { otp: "1234", cashCollected }\`. Wrong OTP = 400 \`INVALID_DELIVERY_OTP\` (\`details.attemptsLeft\`); after \`DELIVERY_OTP_MAX_ATTEMPTS\` (5) wrong tries = 429 \`DELIVERY_OTP_LOCKED\`. Unpaid COD needs \`cashCollected\` (paise) and becomes paid.

### Payment retry, COD switch, reorder

- \`POST /orders/:id/payment\` → \`{ payment: {...} }\` with a fresh gateway order (else 400 \`PAYMENT_NOT_RETRYABLE\`). Abandoned gateway orders are remembered, so a late webhook still pays the order.
- \`PATCH /orders/:id/payment-method { paymentMethod: "cod" }\` (else 400 \`PAYMENT_METHOD_NOT_CHANGEABLE\`).
- \`POST /orders/:id/reorder\` → \`{ cart, skipped: [{ productId, title, reason: inactive|out_of_stock|qty_reduced, requested, added }] }\`.

### Push notifications (PWA)

\`GET /push/vapid-public-key\` → \`POST /me/push-subscriptions\` (the browser's PushSubscription JSON; only browser vendors' push services are accepted) → on order status changes (admin, rider, confirmed payment) the customer gets \`{ title, body, url: "/orders/<id>" }\` (English + Hindi). 404/410 removes the subscription. Needs \`VAPID_*\` (\`npm run vapid:generate\`).

### Admin endpoints (\`/admin/*\`, admin token)

| | |
|---|---|
| \`GET /stats\` | \`{ todayOrders, todayRevenue, pendingOrders, outForDelivery, lowStockCount, totalCustomers }\` — "today" is the IST day (\`STORE_UTC_OFFSET_MINUTES\`); revenue excludes cancelled / payment-failed / refunded orders; low stock = active products at or below \`LOW_STOCK_THRESHOLD\` |
| \`GET /orders?page&limit&status&from&to&q\` | all orders; \`q\` = orderNumber or customer mobile; \`from\`/\`to\` = \`YYYY-MM-DD\` (whole IST day, \`to\` inclusive) or ISO datetime; \`user\` populated \`{ id, name, mobile }\` |
| \`GET /orders/:id\`, \`PATCH /orders/:id/status\` | full order + customer card; status transition |
| \`GET /users?page&limit&q\` | customers: \`{ id, name, mobile, email, isVerified, ordersCount, createdAt }\` |
| \`GET /products?page&limit&q&category&isActive&lowStock\` | incl. inactive; \`POST\`, \`PATCH /:id\`, \`DELETE /:id\` (soft; re-activate with \`PATCH { isActive: true }\`) |
| \`GET|POST /categories\`, \`PATCH|DELETE /categories/:id\` | list includes inactive |
| \`GET|POST /banners\`, \`PATCH|DELETE /banners/:id\` | list includes inactive |
| \`GET|POST /coupons\`, \`PATCH|DELETE /coupons/:id\` | |
| \`GET|PATCH /settings\` | see above |
| \`GET|POST /pincodes\`, \`PATCH|DELETE /pincodes/:id\` | DELETE is a hard delete |
| \`POST /uploads\` | multipart field \`images\` |
| \`GET /orders/latest?since=<ISO>\` | new-order alert: \`{ count, orders: [{ id, orderNumber, total, createdAt }] }\` (newest 10; \`since\` exclusive) |
| \`PATCH /orders/:id/assign\` | \`{ riderId }\` (null unassigns) → order with \`rider { id, name, mobile }\` |
| \`GET|POST /riders\`, \`PATCH /riders/:id\` | delivery riders \`{ name, mobile, isActive }\` (+ \`activeOrders\`) |
| \`GET /reports/sales?from&to&groupBy=day\` (or week, month) | \`[{ period, orders, revenue, avgOrderValue }]\` |
| \`GET /reports/top-products?from&to&limit\` | \`[{ productId, title, qtySold, revenue }]\` |
| \`GET /reports/cod?date=YYYY-MM-DD\` | \`{ totalExpected, totalCollected, byRider: [{ rider, orders, expected, collected }] }\` |
| \`PATCH /products/bulk\` | \`[{ id, price?, mrp?, stock?, isActive? }]\` (≤ 200) → \`{ updated, failed: [{ id, error }] }\` |
| \`GET /products/export\` | CSV of all products (paise; UTF-8 BOM) |
| \`POST /products/import?dryRun=\` | multipart \`file\` (.csv ≤ 2 MB, ≤ 2000 rows) → \`{ created, updated, errors: [{ row, error }], dryRun }\` |
| \`GET /reviews?page&limit&productId&rating\`, \`DELETE /reviews/:id\` | moderation; delete recalculates the product rating |

Not available: promoting an existing customer to admin/rider (admins come from \`npm run seed\` or the DB; riders are created with \`POST /admin/riders\` for a NEW mobile).

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
