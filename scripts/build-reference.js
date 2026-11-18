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
| User roles | \`User.role\` ∈ \`customer\` \\| \`admin\` (default \`customer\`) |
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
POST /payments/verify          POST /payments/webhook       (webhook: raw body + HMAC, no JWT)
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

Not available: role/user management (admins are created by \`npm run seed\` or directly in the DB).

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
