# Aali Market — real sample responses

Captured by `npm run samples` (scripts/capture-samples.js) — the actual app, in-memory MongoDB, seed data. IDs/timestamps/tokens differ on every run. Arrays are trimmed to 2 items for readability.

> **Not captured:** `POST /admin/uploads` — it uploads to real Cloudinary, which needs credentials. Shape: `201 { "success": true, "data": { "urls": ["https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v<n>/aali-market/products/<id>"] }, "error": null }` (see docs/BACKEND_REFERENCE.md; the request/response handling is covered by tests/upload.test.js against a stand-in Cloudinary server).

## POST /auth/otp/send

`POST /api/v1/auth/otp/send` → **200**

```json
{
  "success": true,
  "data": {
    "mobile": "9876543210",
    "expiresAt": "2026-11-19T06:12:44.087Z",
    "ttlMinutes": 5,
    "code": "149113"
  },
  "error": null
}
```

## POST /auth/otp/verify (new user)

`POST /api/v1/auth/otp/verify` → **201**

```json
{
  "success": true,
  "data": {
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "role": "customer",
      "isVerified": true,
      "isActive": true,
      "addresses": [],
      "createdAt": "2026-11-19T06:07:44.155Z",
      "updatedAt": "2026-11-19T06:07:44.155Z",
      "id": "6afe92309f3e84bebd6e3797"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWZlOTIzMDlmM2U4NGJlYmQ2ZTM3OTciLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3OTUwNjg0NjQsImV4cCI6MTc5NTA2OTM2NH0.x3JKXXMHzSnJWZ4EGDU8rjUxWzK-qF4rfclHNHHUO9w",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWZlOTIzMDlmM2U4NGJlYmQ2ZTM3OTciLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3OTUwNjg0NjQsImV4cCI6MTc5NzY2MDQ2NCwianRpIjoiZTFkNmM1MDAtNDliMS00Nzg0LTg4NTktYWMwMWJlNmIwMGMwIn0.G_yaUAok5B9dbaaB5K4bC71CdLJVkAzQbAQsjbxQ-sU",
    "isNewUser": true
  },
  "error": null
}
```

## GET /me

`GET /api/v1/me` → **200**

```json
{
  "success": true,
  "data": {
    "mobile": "9876543210",
    "name": "Ritesh",
    "role": "customer",
    "isVerified": true,
    "isActive": true,
    "addresses": [],
    "createdAt": "2026-11-19T06:07:44.155Z",
    "updatedAt": "2026-11-19T06:07:44.155Z",
    "id": "6afe92309f3e84bebd6e3797"
  },
  "error": null
}
```

## GET /categories

`GET /api/v1/categories` → **200**

_data has 8 items, showing first 2_

```json
{
  "success": true,
  "data": [
    {
      "name": {
        "en": "Fruits & Vegetables",
        "hi": "फल और सब्जियां"
      },
      "slug": "fruits-vegetables",
      "icon": "",
      "image": "",
      "sortOrder": 1,
      "isActive": true,
      "createdAt": "2026-11-19T06:07:43.742Z",
      "updatedAt": "2026-11-19T06:07:43.742Z",
      "id": "6afe922f9f3e84bebd6e3700"
    },
    {
      "name": {
        "en": "Dairy & Breakfast",
        "hi": "डेयरी और नाश्ता"
      },
      "slug": "dairy-breakfast",
      "icon": "",
      "image": "",
      "sortOrder": 2,
      "isActive": true,
      "createdAt": "2026-11-19T06:07:43.764Z",
      "updatedAt": "2026-11-19T06:07:43.764Z",
      "id": "6afe922f9f3e84bebd6e3710"
    }
  ],
  "error": null
}
```

## GET /banners

`GET /api/v1/banners` → **200**

```json
{
  "success": true,
  "data": [
    {
      "title": {
        "en": "Monsoon Sale",
        "hi": "मानसून सेल"
      },
      "image": "https://example.com/banner.jpg",
      "link": "/category/grocery-staples",
      "sortOrder": 1,
      "isActive": true,
      "createdAt": "2026-11-19T06:07:44.178Z",
      "updatedAt": "2026-11-19T06:07:44.178Z",
      "id": "6afe92309f3e84bebd6e379e"
    }
  ],
  "error": null
}
```

## GET /products?limit=2&sort=discount

`GET /api/v1/products?limit=2&sort=discount` → **200**

```json
{
  "success": true,
  "data": [
    {
      "title": {
        "en": "Tomato",
        "hi": "टमाटर"
      },
      "slug": "tomato",
      "description": {
        "en": "Tomato — 1 kg, sourced fresh for Aali Market customers.",
        "hi": "टमाटर — 1 kg, आली मार्केट के ग्राहकों के लिए ताज़ा उपलब्ध।"
      },
      "category": "6afe922f9f3e84bebd6e3700",
      "brand": "Farm Fresh",
      "images": [],
      "mrp": 3500,
      "price": 2800,
      "unit": "1 kg",
      "stock": 100,
      "optionName": null,
      "ratingAvg": 0,
      "ratingCount": 0,
      "tags": [
        "tomato",
        "vegetable"
      ],
      "isActive": true,
      "variants": [],
      "createdAt": "2026-11-19T06:07:43.801Z",
      "updatedAt": "2026-11-19T06:07:43.801Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6afe922f9f3e84bebd6e3735"
    },
    {
      "title": {
        "en": "Fresh Onion",
        "hi": "ताज़ा प्याज़"
      },
      "slug": "fresh-onion",
      "description": {
        "en": "Fresh Onion — 1 kg, sourced fresh for Aali Market customers.",
        "hi": "ताज़ा प्याज़ — 1 kg, आली मार्केट के ग्राहकों के लिए ताज़ा उपलब्ध।"
      },
      "category": "6afe922f9f3e84bebd6e3700",
      "brand": "Farm Fresh",
      "images": [],
      "mrp": 4000,
      "price": 3200,
      "unit": "1 kg",
      "stock": 120,
      "optionName": null,
      "ratingAvg": 0,
      "ratingCount": 0,
      "tags": [
        "onion",
        "vegetable"
      ],
      "isActive": true,
      "variants": [],
      "createdAt": "2026-11-19T06:07:43.796Z",
      "updatedAt": "2026-11-19T06:07:43.796Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6afe922f9f3e84bebd6e3731"
    }
  ],
  "error": null,
  "meta": {
    "total": 40,
    "page": 1,
    "limit": 2,
    "pages": 20
  }
}
```

## GET /products?q=atta (search)

`GET /api/v1/products?q=atta` → **200**

```json
{
  "success": true,
  "data": [
    {
      "title": {
        "en": "Aata (Whole Wheat Flour)",
        "hi": "आटा (गेहूं का आटा)"
      },
      "slug": "aata-whole-wheat-flour",
      "description": {
        "en": "Aata (Whole Wheat Flour) — 5 kg, sourced fresh for Aali Market customers.",
        "hi": "आटा (गेहूं का आटा) — 5 kg, आली मार्केट के ग्राहकों के लिए ताज़ा उपलब्ध।"
      },
      "category": "6afe922f9f3e84bebd6e3721",
      "brand": "Aashirvaad",
      "images": [],
      "mrp": 27500,
      "price": 24900,
      "unit": "5 kg",
      "stock": 80,
      "optionName": null,
      "ratingAvg": 0,
      "ratingCount": 0,
      "tags": [
        "atta",
        "flour",
        "staple"
      ],
      "isActive": true,
      "variants": [],
      "createdAt": "2026-11-19T06:07:43.814Z",
      "updatedAt": "2026-11-19T06:07:43.814Z",
      "discountPercent": 9,
      "inStock": true,
      "id": "6afe922f9f3e84bebd6e3745"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## GET /products/:slug

`GET /api/v1/products/aata-whole-wheat-flour` → **200**

```json
{
  "success": true,
  "data": {
    "title": {
      "en": "Aata (Whole Wheat Flour)",
      "hi": "आटा (गेहूं का आटा)"
    },
    "slug": "aata-whole-wheat-flour",
    "description": {
      "en": "Aata (Whole Wheat Flour) — 5 kg, sourced fresh for Aali Market customers.",
      "hi": "आटा (गेहूं का आटा) — 5 kg, आली मार्केट के ग्राहकों के लिए ताज़ा उपलब्ध।"
    },
    "category": {
      "name": {
        "en": "Grocery & Staples",
        "hi": "किराना और राशन"
      },
      "slug": "grocery-staples",
      "id": "6afe922f9f3e84bebd6e3721"
    },
    "brand": "Aashirvaad",
    "images": [],
    "mrp": 27500,
    "price": 24900,
    "unit": "5 kg",
    "stock": 80,
    "optionName": null,
    "ratingAvg": 0,
    "ratingCount": 0,
    "tags": [
      "atta",
      "flour",
      "staple"
    ],
    "isActive": true,
    "variants": [],
    "createdAt": "2026-11-19T06:07:43.814Z",
    "updatedAt": "2026-11-19T06:07:43.814Z",
    "discountPercent": 9,
    "inStock": true,
    "id": "6afe922f9f3e84bebd6e3745"
  },
  "error": null
}
```

## GET /settings (public)

`GET /api/v1/settings` → **200**

```json
{
  "success": true,
  "data": {
    "deliveryFee": 2500,
    "freeDeliveryThreshold": 19900,
    "handlingFee": 500,
    "minOrderValue": 0,
    "storeOpen": true,
    "storeTimings": {
      "open": "08:00",
      "close": "22:00"
    },
    "storeName": "Aali Market",
    "phone": "",
    "whatsapp": "",
    "email": "",
    "address": {
      "line1": "",
      "city": "",
      "state": "",
      "pincode": ""
    },
    "fssaiNumber": "",
    "gstin": ""
  },
  "error": null
}
```

## GET /products/suggest?q=att (type-ahead)

`GET /api/v1/products/suggest?q=att` → **200**

```json
{
  "success": true,
  "data": [
    {
      "id": "6afe922f9f3e84bebd6e3745",
      "slug": "aata-whole-wheat-flour",
      "title": {
        "en": "Aata (Whole Wheat Flour)",
        "hi": "आटा (गेहूं का आटा)"
      },
      "price": 24900,
      "image": ""
    }
  ],
  "error": null
}
```

## POST /cart/coupon -> error COUPON_MIN_ORDER

`POST /api/v1/cart/coupon` → **400**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "COUPON_MIN_ORDER",
    "message": "Add more items to your cart to use this coupon (minimum order value required)",
    "details": {
      "minOrderValue": 19900
    }
  }
}
```

## POST /addresses

`POST /api/v1/addresses` → **201**

```json
{
  "success": true,
  "data": {
    "label": "Home",
    "line1": "123 MG Road",
    "line2": "Near Bus Stand",
    "landmark": "Opposite Petrol Pump",
    "city": "Sitapur",
    "state": "Uttar Pradesh",
    "pincode": "261001",
    "isDefault": true,
    "createdAt": "2026-11-19T06:07:44.275Z",
    "updatedAt": "2026-11-19T06:07:44.275Z",
    "id": "6afe92309f3e84bebd6e37bd"
  },
  "error": null
}
```

## GET /addresses

`GET /api/v1/addresses` → **200**

```json
{
  "success": true,
  "data": [
    {
      "label": "Home",
      "line1": "123 MG Road",
      "line2": "Near Bus Stand",
      "landmark": "Opposite Petrol Pump",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": true,
      "createdAt": "2026-11-19T06:07:44.275Z",
      "updatedAt": "2026-11-19T06:07:44.275Z",
      "id": "6afe92309f3e84bebd6e37bd"
    }
  ],
  "error": null
}
```

## GET /serviceability?pincode=261001

`GET /api/v1/serviceability?pincode=261001` → **200**

```json
{
  "success": true,
  "data": {
    "pincode": "261001",
    "serviceable": true,
    "etaDays": 1,
    "areaName": {
      "en": "Sitapur",
      "hi": "सीतापुर"
    },
    "deliveryFee": 2500
  },
  "error": null
}
```

## GET /serviceability?pincode=991234 (not in the pincode list)

`GET /api/v1/serviceability?pincode=991234` → **200**

```json
{
  "success": true,
  "data": {
    "pincode": "991234",
    "serviceable": false,
    "etaDays": null,
    "areaName": null,
    "deliveryFee": null
  },
  "error": null
}
```

## POST /cart/coupon (success)

`POST /api/v1/cart/coupon` → **200**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "slug": "aata-whole-wheat-flour",
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "mrp": 27500,
        "qty": 1,
        "stock": 80,
        "isAvailable": true,
        "inStock": true,
        "lineTotal": 24900
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 5000,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 20400
    },
    "couponCode": "AALI50",
    "couponError": null
  },
  "error": null
}
```

## GET /cart (1 item + coupon applied)

`GET /api/v1/cart` → **200**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "slug": "aata-whole-wheat-flour",
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "mrp": 27500,
        "qty": 1,
        "stock": 80,
        "isAvailable": true,
        "inStock": true,
        "lineTotal": 24900
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 5000,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 20400
    },
    "couponCode": "AALI50",
    "couponError": null
  },
  "error": null
}
```

## POST /orders

`POST /api/v1/orders` → **201**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119805557FF",
    "user": "6afe92309f3e84bebd6e3797",
    "items": [
      {
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 5000,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 20400
    },
    "couponCode": "AALI50",
    "shippingAddress": {
      "label": "Home",
      "line1": "123 MG Road",
      "line2": "Near Bus Stand",
      "landmark": "Opposite Petrol Pump",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": true,
      "createdAt": "2026-11-19T06:07:44.275Z",
      "updatedAt": "2026-11-19T06:07:44.275Z",
      "id": "6afe92309f3e84bebd6e37bd"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.356Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.356Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.358Z",
    "updatedAt": "2026-11-19T06:07:44.358Z",
    "id": "6afe92309f3e84bebd6e37ec",
    "deliveryOtp": "5309",
    "payment": null
  },
  "error": null
}
```

## GET /orders

`GET /api/v1/orders` → **200**

```json
{
  "success": true,
  "data": [
    {
      "orderNumber": "AALI261119805557FF",
      "user": "6afe92309f3e84bebd6e3797",
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6afe922f9f3e84bebd6e3745",
          "variantId": null,
          "variantLabel": null,
          "image": "",
          "unit": "5 kg",
          "price": 24900,
          "qty": 1
        }
      ],
      "pricing": {
        "subtotal": 24900,
        "discount": 5000,
        "deliveryFee": 0,
        "handlingFee": 500,
        "total": 20400
      },
      "couponCode": "AALI50",
      "shippingAddress": {
        "label": "Home",
        "line1": "123 MG Road",
        "line2": "Near Bus Stand",
        "landmark": "Opposite Petrol Pump",
        "city": "Sitapur",
        "state": "Uttar Pradesh",
        "pincode": "261001",
        "isDefault": true,
        "createdAt": "2026-11-19T06:07:44.275Z",
        "updatedAt": "2026-11-19T06:07:44.275Z",
        "id": "6afe92309f3e84bebd6e37bd"
      },
      "paymentMethod": "cod",
      "paymentStatus": "pending",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-19T06:07:44.356Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-19T06:07:44.372Z",
          "note": "Packing started"
        }
      ],
      "expectedDeliveryAt": "2026-11-20T06:07:44.356Z",
      "idempotencyKey": "sample-key-1",
      "paymentProviderOrderId": null,
      "paymentId": null,
      "cancelReason": null,
      "deliveryNote": "",
      "rider": null,
      "cashCollected": null,
      "createdAt": "2026-11-19T06:07:44.358Z",
      "updatedAt": "2026-11-19T06:07:44.372Z",
      "id": "6afe92309f3e84bebd6e37ec"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## GET /orders/:id (statusHistory)

`GET /api/v1/orders/6afe92309f3e84bebd6e37ec` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119805557FF",
    "user": "6afe92309f3e84bebd6e3797",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 5000,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 20400
    },
    "couponCode": "AALI50",
    "shippingAddress": {
      "label": "Home",
      "line1": "123 MG Road",
      "line2": "Near Bus Stand",
      "landmark": "Opposite Petrol Pump",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": true,
      "createdAt": "2026-11-19T06:07:44.275Z",
      "updatedAt": "2026-11-19T06:07:44.275Z",
      "id": "6afe92309f3e84bebd6e37bd"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.356Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-19T06:07:44.372Z",
        "note": "Packing started"
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.356Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.358Z",
    "updatedAt": "2026-11-19T06:07:44.372Z",
    "id": "6afe92309f3e84bebd6e37ec",
    "deliveryOtp": "5309"
  },
  "error": null
}
```

## POST /products/:id/reviews (starts as "pending" until an admin approves it)

`POST /api/v1/products/6afe922f9f3e84bebd6e3745/reviews` → **201**

```json
{
  "success": true,
  "data": {
    "user": "6afe92309f3e84bebd6e3797",
    "product": "6afe922f9f3e84bebd6e3745",
    "order": "6afe92309f3e84bebd6e37ec",
    "rating": 5,
    "comment": "Great quality atta.",
    "status": "pending",
    "createdAt": "2026-11-19T06:07:44.405Z",
    "updatedAt": "2026-11-19T06:07:44.405Z",
    "id": "6afe92309f3e84bebd6e3808"
  },
  "error": null
}
```

## GET /products/:id/reviews/mine (the customer's own review, any status)

`GET /api/v1/products/6afe922f9f3e84bebd6e3745/reviews/mine` → **200**

```json
{
  "success": true,
  "data": {
    "user": "6afe92309f3e84bebd6e3797",
    "product": "6afe922f9f3e84bebd6e3745",
    "order": "6afe92309f3e84bebd6e37ec",
    "rating": 5,
    "comment": "Great quality atta.",
    "status": "pending",
    "createdAt": "2026-11-19T06:07:44.405Z",
    "updatedAt": "2026-11-19T06:07:44.405Z",
    "id": "6afe92309f3e84bebd6e3808"
  },
  "error": null
}
```

## GET /products/:id/reviews (public: approved reviews only, so still empty)

`GET /api/v1/products/6afe922f9f3e84bebd6e3745/reviews` → **200**

```json
{
  "success": true,
  "data": [],
  "error": null,
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## GET /wishlist

`GET /api/v1/wishlist` → **200**

```json
{
  "success": true,
  "data": {
    "user": "6afe92309f3e84bebd6e3797",
    "products": [
      {
        "title": {
          "en": "Mineral Water",
          "hi": "मिनरल वाटर"
        },
        "slug": "mineral-water",
        "description": {
          "en": "Mineral Water — 1 L, sourced fresh for Aali Market customers.",
          "hi": "मिनरल वाटर — 1 L, आली मार्केट के ग्राहकों के लिए ताज़ा उपलब्ध।"
        },
        "category": "6afe922f9f3e84bebd6e3729",
        "brand": "Bisleri",
        "images": [],
        "mrp": 2000,
        "price": 1800,
        "unit": "1 L",
        "stock": 300,
        "optionName": null,
        "ratingAvg": 0,
        "ratingCount": 0,
        "tags": [
          "water",
          "beverage"
        ],
        "isActive": true,
        "variants": [],
        "createdAt": "2026-11-19T06:07:43.839Z",
        "updatedAt": "2026-11-19T06:07:43.839Z",
        "discountPercent": 10,
        "inStock": true,
        "id": "6afe922f9f3e84bebd6e3769"
      }
    ],
    "createdAt": "2026-11-19T06:07:44.421Z",
    "updatedAt": "2026-11-19T06:07:44.422Z",
    "id": "6afe92309f3e84bebd6e3812"
  },
  "error": null
}
```

## GET /admin/coupons

`GET /api/v1/admin/coupons` → **200**

```json
{
  "success": true,
  "data": [
    {
      "code": "AALI50",
      "type": "flat",
      "value": 5000,
      "minOrderValue": 19900,
      "maxDiscount": null,
      "startsAt": "2026-11-19T06:07:43.856Z",
      "expiresAt": "2027-11-18T18:30:00.000Z",
      "usageLimit": 10000,
      "perUserLimit": 1,
      "usedCount": 1,
      "isActive": true,
      "createdAt": "2026-11-19T06:07:43.857Z",
      "updatedAt": "2026-11-19T06:07:44.361Z",
      "id": "6afe922f9f3e84bebd6e3781"
    }
  ],
  "error": null
}
```

## GET /admin/coupons as customer -> 403

`GET /api/v1/admin/coupons` → **403**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this resource"
  }
}
```

## POST /orders (paymentMethod: upi) -> includes `payment`

`POST /api/v1/orders` → **201**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119A2FE3961",
    "user": "6afe92309f3e84bebd6e3797",
    "items": [
      {
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 25400
    },
    "couponCode": null,
    "shippingAddress": {
      "label": "Home",
      "line1": "123 MG Road",
      "line2": "Near Bus Stand",
      "landmark": "Opposite Petrol Pump",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": true,
      "createdAt": "2026-11-19T06:07:44.275Z",
      "updatedAt": "2026-11-19T06:07:44.275Z",
      "id": "6afe92309f3e84bebd6e37bd"
    },
    "paymentMethod": "upi",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.459Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.459Z",
    "idempotencyKey": "sample-key-upi",
    "paymentProviderOrderId": "order_mock_452424aee7369f06",
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.460Z",
    "updatedAt": "2026-11-19T06:07:44.463Z",
    "id": "6afe92309f3e84bebd6e382f",
    "deliveryOtp": "3939",
    "payment": {
      "provider": "mock",
      "keyId": null,
      "providerOrderId": "order_mock_452424aee7369f06",
      "amount": 25400,
      "currency": "INR"
    }
  },
  "error": null
}
```

## POST /payments/verify

`POST /api/v1/payments/verify` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119A2FE3961",
    "user": "6afe92309f3e84bebd6e3797",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 25400
    },
    "couponCode": null,
    "shippingAddress": {
      "label": "Home",
      "line1": "123 MG Road",
      "line2": "Near Bus Stand",
      "landmark": "Opposite Petrol Pump",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": true,
      "createdAt": "2026-11-19T06:07:44.275Z",
      "updatedAt": "2026-11-19T06:07:44.275Z",
      "id": "6afe92309f3e84bebd6e37bd"
    },
    "paymentMethod": "upi",
    "paymentStatus": "paid",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.459Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-19T06:07:44.472Z",
        "note": "Payment verified"
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.459Z",
    "idempotencyKey": "sample-key-upi",
    "paymentProviderOrderId": "order_mock_452424aee7369f06",
    "paymentId": "pay_SAMPLE123",
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.460Z",
    "updatedAt": "2026-11-19T06:07:44.472Z",
    "id": "6afe92309f3e84bebd6e382f",
    "payment": {
      "provider": "mock",
      "keyId": null,
      "providerOrderId": "order_mock_452424aee7369f06",
      "amount": 25400,
      "currency": "INR"
    }
  },
  "error": null
}
```

## GET /admin/stats

`GET /api/v1/admin/stats` → **200**

```json
{
  "success": true,
  "data": {
    "todayOrders": 2,
    "todayRevenue": 45800,
    "pendingOrders": 1,
    "outForDelivery": 0,
    "lowStockCount": 0,
    "totalCustomers": 1,
    "pendingReviews": 1
  },
  "error": null
}
```

## GET /admin/users

`GET /api/v1/admin/users` → **200**

```json
{
  "success": true,
  "data": [
    {
      "id": "6afe92309f3e84bebd6e3797",
      "name": "Ritesh",
      "mobile": "9876543210",
      "email": null,
      "isVerified": true,
      "ordersCount": 2,
      "createdAt": "2026-11-19T06:07:44.155Z"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## GET /admin/orders?status=confirmed&from=...&q=9876 (filters)

`GET /api/v1/admin/orders?status=confirmed&from=2026-11-19&q=9876` → **200**

```json
{
  "success": true,
  "data": [
    {
      "orderNumber": "AALI261119A2FE3961",
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afe92309f3e84bebd6e3797"
      },
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6afe922f9f3e84bebd6e3745",
          "variantId": null,
          "variantLabel": null,
          "image": "",
          "unit": "5 kg",
          "price": 24900,
          "qty": 1
        }
      ],
      "pricing": {
        "subtotal": 24900,
        "discount": 0,
        "deliveryFee": 0,
        "handlingFee": 500,
        "total": 25400
      },
      "couponCode": null,
      "shippingAddress": {
        "label": "Home",
        "line1": "123 MG Road",
        "line2": "Near Bus Stand",
        "landmark": "Opposite Petrol Pump",
        "city": "Sitapur",
        "state": "Uttar Pradesh",
        "pincode": "261001",
        "isDefault": true,
        "createdAt": "2026-11-19T06:07:44.275Z",
        "updatedAt": "2026-11-19T06:07:44.275Z",
        "id": "6afe92309f3e84bebd6e37bd"
      },
      "paymentMethod": "upi",
      "paymentStatus": "paid",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-19T06:07:44.459Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-19T06:07:44.472Z",
          "note": "Payment verified"
        }
      ],
      "expectedDeliveryAt": "2026-11-20T06:07:44.459Z",
      "idempotencyKey": "sample-key-upi",
      "paymentProviderOrderId": "order_mock_452424aee7369f06",
      "paymentId": "pay_SAMPLE123",
      "cancelReason": null,
      "deliveryNote": "",
      "rider": null,
      "cashCollected": null,
      "createdAt": "2026-11-19T06:07:44.460Z",
      "updatedAt": "2026-11-19T06:07:44.472Z",
      "id": "6afe92309f3e84bebd6e382f"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## GET /admin/orders/:id (full order + customer)

`GET /api/v1/admin/orders/6afe92309f3e84bebd6e37ec` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119805557FF",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "isVerified": true,
      "createdAt": "2026-11-19T06:07:44.155Z",
      "id": "6afe92309f3e84bebd6e3797"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 5000,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 20400
    },
    "couponCode": "AALI50",
    "shippingAddress": {
      "label": "Home",
      "line1": "123 MG Road",
      "line2": "Near Bus Stand",
      "landmark": "Opposite Petrol Pump",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": true,
      "createdAt": "2026-11-19T06:07:44.275Z",
      "updatedAt": "2026-11-19T06:07:44.275Z",
      "id": "6afe92309f3e84bebd6e37bd"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "delivered",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.356Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-19T06:07:44.372Z",
        "note": "Packing started"
      },
      {
        "status": "delivered",
        "at": "2026-11-19T06:07:44.395Z",
        "note": "Delivered"
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.356Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.358Z",
    "updatedAt": "2026-11-19T06:07:44.395Z",
    "id": "6afe92309f3e84bebd6e37ec"
  },
  "error": null
}
```

## GET /admin/products?isActive=false (inactive products)

`GET /api/v1/admin/products?isActive=false` → **200**

```json
{
  "success": true,
  "data": [
    {
      "title": {
        "en": "Fresh Onion",
        "hi": "ताज़ा प्याज़"
      },
      "slug": "fresh-onion",
      "description": {
        "en": "Fresh Onion — 1 kg, sourced fresh for Aali Market customers.",
        "hi": "ताज़ा प्याज़ — 1 kg, आली मार्केट के ग्राहकों के लिए ताज़ा उपलब्ध।"
      },
      "category": {
        "name": {
          "en": "Fruits & Vegetables",
          "hi": "फल और सब्जियां"
        },
        "slug": "fruits-vegetables",
        "id": "6afe922f9f3e84bebd6e3700"
      },
      "brand": "Farm Fresh",
      "images": [],
      "mrp": 4000,
      "price": 3200,
      "unit": "1 kg",
      "stock": 120,
      "optionName": null,
      "ratingAvg": 0,
      "ratingCount": 0,
      "tags": [
        "onion",
        "vegetable"
      ],
      "isActive": false,
      "variants": [],
      "createdAt": "2026-11-19T06:07:43.796Z",
      "updatedAt": "2026-11-19T06:07:44.516Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6afe922f9f3e84bebd6e3731"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## GET /admin/products?lowStock=true

`GET /api/v1/admin/products?lowStock=true&limit=2` → **200**

```json
{
  "success": true,
  "data": [],
  "error": null,
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 2,
    "pages": 1
  }
}
```

## GET /admin/categories (incl. inactive)

`GET /api/v1/admin/categories` → **200**

_data has 8 items, showing first 2_

```json
{
  "success": true,
  "data": [
    {
      "name": {
        "en": "Fruits & Vegetables",
        "hi": "फल और सब्जियां"
      },
      "slug": "fruits-vegetables",
      "icon": "",
      "image": "",
      "sortOrder": 1,
      "isActive": true,
      "createdAt": "2026-11-19T06:07:43.742Z",
      "updatedAt": "2026-11-19T06:07:43.742Z",
      "id": "6afe922f9f3e84bebd6e3700"
    },
    {
      "name": {
        "en": "Dairy & Breakfast",
        "hi": "डेयरी और नाश्ता"
      },
      "slug": "dairy-breakfast",
      "icon": "",
      "image": "",
      "sortOrder": 2,
      "isActive": true,
      "createdAt": "2026-11-19T06:07:43.764Z",
      "updatedAt": "2026-11-19T06:07:43.764Z",
      "id": "6afe922f9f3e84bebd6e3710"
    }
  ],
  "error": null
}
```

## GET /admin/banners (incl. inactive)

`GET /api/v1/admin/banners` → **200**

```json
{
  "success": true,
  "data": [
    {
      "title": {
        "en": "Monsoon Sale",
        "hi": "मानसून सेल"
      },
      "image": "https://example.com/banner.jpg",
      "link": "/category/grocery-staples",
      "sortOrder": 1,
      "isActive": true,
      "createdAt": "2026-11-19T06:07:44.178Z",
      "updatedAt": "2026-11-19T06:07:44.178Z",
      "id": "6afe92309f3e84bebd6e379e"
    }
  ],
  "error": null
}
```

## GET /admin/settings

`GET /api/v1/admin/settings` → **200**

```json
{
  "success": true,
  "data": {
    "deliveryFee": 2500,
    "freeDeliveryThreshold": 19900,
    "handlingFee": 500,
    "minOrderValue": 0,
    "storeOpen": true,
    "storeTimings": {
      "open": "08:00",
      "close": "22:00"
    },
    "storeName": "Aali Market",
    "phone": "",
    "whatsapp": "",
    "email": "",
    "address": {
      "line1": "",
      "city": "",
      "state": "",
      "pincode": ""
    },
    "fssaiNumber": "",
    "gstin": "",
    "updatedAt": "2026-11-19T06:07:44.227Z"
  },
  "error": null
}
```

## PATCH /admin/settings

`PATCH /api/v1/admin/settings` → **200**

```json
{
  "success": true,
  "data": {
    "deliveryFee": 3000,
    "freeDeliveryThreshold": 19900,
    "handlingFee": 500,
    "minOrderValue": 9900,
    "storeOpen": true,
    "storeTimings": {
      "open": "08:00",
      "close": "22:00"
    },
    "storeName": "Aali Market",
    "phone": "",
    "whatsapp": "",
    "email": "",
    "address": {
      "line1": "",
      "city": "",
      "state": "",
      "pincode": ""
    },
    "fssaiNumber": "",
    "gstin": "",
    "updatedAt": "2026-11-19T06:07:44.555Z"
  },
  "error": null
}
```

## GET /admin/pincodes

`GET /api/v1/admin/pincodes` → **200**

_data has 3 items, showing first 2_

```json
{
  "success": true,
  "data": [
    {
      "pincode": "110001",
      "areaName": {
        "en": "New Delhi - Connaught Place",
        "hi": "नई दिल्ली - कनॉट प्लेस"
      },
      "isActive": true,
      "deliveryFee": 3500,
      "etaDays": 2,
      "createdAt": "2026-11-19T06:07:43.861Z",
      "updatedAt": "2026-11-19T06:07:43.861Z",
      "id": "6afe922f9f3e84bebd6e3787"
    },
    {
      "pincode": "226001",
      "areaName": {
        "en": "Lucknow - Hazratganj",
        "hi": "लखनऊ - हज़रतगंज"
      },
      "isActive": true,
      "deliveryFee": null,
      "etaDays": 2,
      "createdAt": "2026-11-19T06:07:43.861Z",
      "updatedAt": "2026-11-19T06:07:43.861Z",
      "id": "6afe922f9f3e84bebd6e3786"
    }
  ],
  "error": null,
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## POST /admin/pincodes

`POST /api/v1/admin/pincodes` → **201**

```json
{
  "success": true,
  "data": {
    "pincode": "261201",
    "areaName": {
      "en": "Laharpur",
      "hi": "लहरपुर"
    },
    "isActive": true,
    "deliveryFee": null,
    "etaDays": 2,
    "createdAt": "2026-11-19T06:07:44.569Z",
    "updatedAt": "2026-11-19T06:07:44.569Z",
    "id": "6afe92309f3e84bebd6e3867"
  },
  "error": null
}
```

## PATCH /admin/settings (store info)

`PATCH /api/v1/admin/settings` → **200**

```json
{
  "success": true,
  "data": {
    "deliveryFee": 3000,
    "freeDeliveryThreshold": 19900,
    "handlingFee": 500,
    "minOrderValue": 9900,
    "storeOpen": true,
    "storeTimings": {
      "open": "08:00",
      "close": "22:00"
    },
    "storeName": "Aali Market, Sitapur",
    "phone": "+91 98765 43210",
    "whatsapp": "9876543210",
    "email": "hello@aalimarket.in",
    "address": {
      "line1": "12 Station Road",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001"
    },
    "fssaiNumber": "12345678901234",
    "gstin": "09AABCU9603R1ZX",
    "updatedAt": "2026-11-19T06:07:44.576Z"
  },
  "error": null
}
```

## GET /settings (now with store info)

`GET /api/v1/settings` → **200**

```json
{
  "success": true,
  "data": {
    "deliveryFee": 3000,
    "freeDeliveryThreshold": 19900,
    "handlingFee": 500,
    "minOrderValue": 9900,
    "storeOpen": true,
    "storeTimings": {
      "open": "08:00",
      "close": "22:00"
    },
    "storeName": "Aali Market, Sitapur",
    "phone": "+91 98765 43210",
    "whatsapp": "9876543210",
    "email": "hello@aalimarket.in",
    "address": {
      "line1": "12 Station Road",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001"
    },
    "fssaiNumber": "12345678901234",
    "gstin": "09AABCU9603R1ZX"
  },
  "error": null
}
```

## POST /addresses (with location)

`POST /api/v1/addresses` → **201**

```json
{
  "success": true,
  "data": {
    "label": "Shop",
    "line1": "Gandhi Chowk",
    "line2": "",
    "landmark": "Opposite the temple",
    "city": "Sitapur",
    "state": "Uttar Pradesh",
    "pincode": "261001",
    "isDefault": false,
    "location": {
      "lat": 27.5706,
      "lng": 80.6822
    },
    "createdAt": "2026-11-19T06:07:44.586Z",
    "updatedAt": "2026-11-19T06:07:44.586Z",
    "id": "6afe92309f3e84bebd6e386f"
  },
  "error": null
}
```

## POST /orders (deliveryNote + address location; the owner sees deliveryOtp)

`POST /api/v1/orders` → **201**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119F91C2A0B",
    "user": "6afe92309f3e84bebd6e3797",
    "items": [
      {
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 25400
    },
    "couponCode": null,
    "shippingAddress": {
      "label": "Shop",
      "line1": "Gandhi Chowk",
      "line2": "",
      "landmark": "Opposite the temple",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": false,
      "location": {
        "lat": 27.5706,
        "lng": 80.6822
      },
      "createdAt": "2026-11-19T06:07:44.586Z",
      "updatedAt": "2026-11-19T06:07:44.586Z",
      "id": "6afe92309f3e84bebd6e386f"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.608Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.608Z",
    "idempotencyKey": "sample-key-note",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "Ring the bell twice, leave with the guard",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.611Z",
    "updatedAt": "2026-11-19T06:07:44.611Z",
    "id": "6afe92309f3e84bebd6e3886",
    "deliveryOtp": "0622",
    "payment": null
  },
  "error": null
}
```

## GET /orders/:id (customer view: includes deliveryOtp)

`GET /api/v1/orders/6afe92309f3e84bebd6e3886` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119F91C2A0B",
    "user": "6afe92309f3e84bebd6e3797",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 25400
    },
    "couponCode": null,
    "shippingAddress": {
      "label": "Shop",
      "line1": "Gandhi Chowk",
      "line2": "",
      "landmark": "Opposite the temple",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": false,
      "location": {
        "lat": 27.5706,
        "lng": 80.6822
      },
      "createdAt": "2026-11-19T06:07:44.586Z",
      "updatedAt": "2026-11-19T06:07:44.586Z",
      "id": "6afe92309f3e84bebd6e386f"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.608Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.608Z",
    "idempotencyKey": "sample-key-note",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "Ring the bell twice, leave with the guard",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.611Z",
    "updatedAt": "2026-11-19T06:07:44.611Z",
    "id": "6afe92309f3e84bebd6e3886",
    "deliveryOtp": "0622"
  },
  "error": null
}
```

## POST /orders/:id/payment (pay again with a fresh gateway order)

`POST /api/v1/orders/6afe92309f3e84bebd6e38a3/payment` → **200**

```json
{
  "success": true,
  "data": {
    "payment": {
      "provider": "mock",
      "keyId": null,
      "providerOrderId": "order_mock_15788b88acf5a1f1",
      "amount": 25400,
      "currency": "INR"
    }
  },
  "error": null
}
```

## PATCH /orders/:id/payment-method (switch to cash on delivery)

`PATCH /api/v1/orders/6afe92309f3e84bebd6e38a3/payment-method` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119CADE78A1",
    "user": "6afe92309f3e84bebd6e3797",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 25400
    },
    "couponCode": null,
    "shippingAddress": {
      "label": "Shop",
      "line1": "Gandhi Chowk",
      "line2": "",
      "landmark": "Opposite the temple",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": false,
      "location": {
        "lat": 27.5706,
        "lng": 80.6822
      },
      "createdAt": "2026-11-19T06:07:44.586Z",
      "updatedAt": "2026-11-19T06:07:44.586Z",
      "id": "6afe92309f3e84bebd6e386f"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.641Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.641Z",
    "idempotencyKey": "sample-key-retry",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.643Z",
    "updatedAt": "2026-11-19T06:07:44.661Z",
    "id": "6afe92309f3e84bebd6e38a3",
    "deliveryOtp": "4171",
    "payment": null
  },
  "error": null
}
```

## POST /orders/:id/payment on a COD order -> error PAYMENT_NOT_RETRYABLE

`POST /api/v1/orders/6afe92309f3e84bebd6e38a3/payment` → **400**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PAYMENT_NOT_RETRYABLE",
    "message": "Only an unpaid online-payment order that is not cancelled can be paid again"
  }
}
```

## POST /orders/:id/reorder (qty_reduced + out_of_stock)

`POST /api/v1/orders/6afe92309f3e84bebd6e38d5/reorder` → **200**

```json
{
  "success": true,
  "data": {
    "cart": {
      "items": [
        {
          "productId": "6afe922f9f3e84bebd6e3745",
          "variantId": null,
          "variantLabel": null,
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "slug": "aata-whole-wheat-flour",
          "image": "",
          "unit": "5 kg",
          "price": 24900,
          "mrp": 27500,
          "qty": 1,
          "stock": 1,
          "isAvailable": true,
          "inStock": true,
          "lineTotal": 24900
        }
      ],
      "pricing": {
        "subtotal": 24900,
        "discount": 0,
        "deliveryFee": 0,
        "handlingFee": 500,
        "total": 25400
      },
      "couponCode": null,
      "couponError": null
    },
    "skipped": [
      {
        "productId": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "reason": "qty_reduced",
        "requested": 2,
        "added": 1
      },
      {
        "productId": "6afe922f9f3e84bebd6e3769",
        "variantId": null,
        "variantLabel": null,
        "title": {
          "en": "Mineral Water",
          "hi": "मिनरल वाटर"
        },
        "reason": "out_of_stock",
        "requested": 1,
        "added": 0
      }
    ]
  },
  "error": null
}
```

## POST /admin/riders

`POST /api/v1/admin/riders` → **201**

```json
{
  "success": true,
  "data": {
    "id": "6afe92309f3e84bebd6e38f0",
    "name": "Ramesh Kumar",
    "mobile": "9877700001",
    "isActive": true,
    "activeOrders": 0,
    "createdAt": "2026-11-19T06:07:44.731Z"
  },
  "error": null
}
```

## GET /admin/riders

`GET /api/v1/admin/riders` → **200**

```json
{
  "success": true,
  "data": [
    {
      "id": "6afe92309f3e84bebd6e38f0",
      "name": "Ramesh Kumar",
      "mobile": "9877700001",
      "isActive": true,
      "activeOrders": 0,
      "createdAt": "2026-11-19T06:07:44.731Z"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## PATCH /admin/riders/:id

`PATCH /api/v1/admin/riders/6afe92309f3e84bebd6e38f0` → **200**

```json
{
  "success": true,
  "data": {
    "id": "6afe92309f3e84bebd6e38f0",
    "name": "Ramesh Yadav",
    "mobile": "9877700001",
    "isActive": true,
    "activeOrders": 0,
    "createdAt": "2026-11-19T06:07:44.731Z"
  },
  "error": null
}
```

## PATCH /admin/orders/:id/assign (order.rider populated; no deliveryOtp)

`PATCH /api/v1/admin/orders/6afe92309f3e84bebd6e3886/assign` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119F91C2A0B",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "id": "6afe92309f3e84bebd6e3797"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 25400
    },
    "couponCode": null,
    "shippingAddress": {
      "label": "Shop",
      "line1": "Gandhi Chowk",
      "line2": "",
      "landmark": "Opposite the temple",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": false,
      "location": {
        "lat": 27.5706,
        "lng": 80.6822
      },
      "createdAt": "2026-11-19T06:07:44.586Z",
      "updatedAt": "2026-11-19T06:07:44.586Z",
      "id": "6afe92309f3e84bebd6e386f"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.608Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-19T06:07:44.749Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.608Z",
    "idempotencyKey": "sample-key-note",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "Ring the bell twice, leave with the guard",
    "rider": {
      "mobile": "9877700001",
      "name": "Ramesh Yadav",
      "id": "6afe92309f3e84bebd6e38f0"
    },
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.611Z",
    "updatedAt": "2026-11-19T06:07:44.759Z",
    "id": "6afe92309f3e84bebd6e3886"
  },
  "error": null
}
```

## GET /admin/orders?q=<orderNumber> (rider { id, name, mobile } populated)

`GET /api/v1/admin/orders?q=AALI261119F91C2A0B` → **200**

```json
{
  "success": true,
  "data": [
    {
      "orderNumber": "AALI261119F91C2A0B",
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afe92309f3e84bebd6e3797"
      },
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6afe922f9f3e84bebd6e3745",
          "variantId": null,
          "variantLabel": null,
          "image": "",
          "unit": "5 kg",
          "price": 24900,
          "qty": 1
        }
      ],
      "pricing": {
        "subtotal": 24900,
        "discount": 0,
        "deliveryFee": 0,
        "handlingFee": 500,
        "total": 25400
      },
      "couponCode": null,
      "shippingAddress": {
        "label": "Shop",
        "line1": "Gandhi Chowk",
        "line2": "",
        "landmark": "Opposite the temple",
        "city": "Sitapur",
        "state": "Uttar Pradesh",
        "pincode": "261001",
        "isDefault": false,
        "location": {
          "lat": 27.5706,
          "lng": 80.6822
        },
        "createdAt": "2026-11-19T06:07:44.586Z",
        "updatedAt": "2026-11-19T06:07:44.586Z",
        "id": "6afe92309f3e84bebd6e386f"
      },
      "paymentMethod": "cod",
      "paymentStatus": "pending",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-19T06:07:44.608Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-19T06:07:44.749Z",
          "note": ""
        }
      ],
      "expectedDeliveryAt": "2026-11-20T06:07:44.608Z",
      "idempotencyKey": "sample-key-note",
      "paymentProviderOrderId": null,
      "paymentId": null,
      "cancelReason": null,
      "deliveryNote": "Ring the bell twice, leave with the guard",
      "rider": {
        "mobile": "9877700001",
        "name": "Ramesh Yadav",
        "id": "6afe92309f3e84bebd6e38f0"
      },
      "cashCollected": null,
      "createdAt": "2026-11-19T06:07:44.611Z",
      "updatedAt": "2026-11-19T06:07:44.759Z",
      "id": "6afe92309f3e84bebd6e3886"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## GET /rider/orders (only mine; no deliveryOtp)

`GET /api/v1/rider/orders` → **200**

```json
{
  "success": true,
  "data": [
    {
      "orderNumber": "AALI261119F91C2A0B",
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afe92309f3e84bebd6e3797"
      },
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6afe922f9f3e84bebd6e3745",
          "variantId": null,
          "variantLabel": null,
          "image": "",
          "unit": "5 kg",
          "price": 24900,
          "qty": 1
        }
      ],
      "pricing": {
        "subtotal": 24900,
        "discount": 0,
        "deliveryFee": 0,
        "handlingFee": 500,
        "total": 25400
      },
      "couponCode": null,
      "shippingAddress": {
        "label": "Shop",
        "line1": "Gandhi Chowk",
        "line2": "",
        "landmark": "Opposite the temple",
        "city": "Sitapur",
        "state": "Uttar Pradesh",
        "pincode": "261001",
        "isDefault": false,
        "location": {
          "lat": 27.5706,
          "lng": 80.6822
        },
        "createdAt": "2026-11-19T06:07:44.586Z",
        "updatedAt": "2026-11-19T06:07:44.586Z",
        "id": "6afe92309f3e84bebd6e386f"
      },
      "paymentMethod": "cod",
      "paymentStatus": "pending",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-19T06:07:44.608Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-19T06:07:44.749Z",
          "note": ""
        }
      ],
      "expectedDeliveryAt": "2026-11-20T06:07:44.608Z",
      "idempotencyKey": "sample-key-note",
      "paymentProviderOrderId": null,
      "paymentId": null,
      "cancelReason": null,
      "deliveryNote": "Ring the bell twice, leave with the guard",
      "rider": "6afe92309f3e84bebd6e38f0",
      "cashCollected": null,
      "createdAt": "2026-11-19T06:07:44.611Z",
      "updatedAt": "2026-11-19T06:07:44.759Z",
      "id": "6afe92309f3e84bebd6e3886"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## PATCH /rider/orders/:id/out-for-delivery

`PATCH /api/v1/rider/orders/6afe92309f3e84bebd6e3886/out-for-delivery` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119F91C2A0B",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "id": "6afe92309f3e84bebd6e3797"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 25400
    },
    "couponCode": null,
    "shippingAddress": {
      "label": "Shop",
      "line1": "Gandhi Chowk",
      "line2": "",
      "landmark": "Opposite the temple",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": false,
      "location": {
        "lat": 27.5706,
        "lng": 80.6822
      },
      "createdAt": "2026-11-19T06:07:44.586Z",
      "updatedAt": "2026-11-19T06:07:44.586Z",
      "id": "6afe92309f3e84bebd6e386f"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "out_for_delivery",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.608Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-19T06:07:44.749Z",
        "note": ""
      },
      {
        "status": "out_for_delivery",
        "at": "2026-11-19T06:07:44.906Z",
        "note": "Out for delivery with rider"
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.608Z",
    "idempotencyKey": "sample-key-note",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "Ring the bell twice, leave with the guard",
    "rider": "6afe92309f3e84bebd6e38f0",
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.611Z",
    "updatedAt": "2026-11-19T06:07:44.906Z",
    "id": "6afe92309f3e84bebd6e3886"
  },
  "error": null
}
```

## POST /rider/orders/:id/deliver -> error INVALID_DELIVERY_OTP

`POST /api/v1/rider/orders/6afe92309f3e84bebd6e3886/deliver` → **400**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_DELIVERY_OTP",
    "message": "The delivery OTP is incorrect",
    "details": {
      "attemptsLeft": 4
    }
  }
}
```

## POST /rider/orders/:id/deliver (COD: right OTP + cash)

`POST /api/v1/rider/orders/6afe92309f3e84bebd6e3886/deliver` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119F91C2A0B",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "id": "6afe92309f3e84bebd6e3797"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 25400
    },
    "couponCode": null,
    "shippingAddress": {
      "label": "Shop",
      "line1": "Gandhi Chowk",
      "line2": "",
      "landmark": "Opposite the temple",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": false,
      "location": {
        "lat": 27.5706,
        "lng": 80.6822
      },
      "createdAt": "2026-11-19T06:07:44.586Z",
      "updatedAt": "2026-11-19T06:07:44.586Z",
      "id": "6afe92309f3e84bebd6e386f"
    },
    "paymentMethod": "cod",
    "paymentStatus": "paid",
    "status": "delivered",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.608Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-19T06:07:44.749Z",
        "note": ""
      },
      {
        "status": "out_for_delivery",
        "at": "2026-11-19T06:07:44.906Z",
        "note": "Out for delivery with rider"
      },
      {
        "status": "delivered",
        "at": "2026-11-19T06:07:44.927Z",
        "note": "Delivered (OTP verified)"
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.608Z",
    "idempotencyKey": "sample-key-note",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "Ring the bell twice, leave with the guard",
    "rider": "6afe92309f3e84bebd6e38f0",
    "cashCollected": 25400,
    "createdAt": "2026-11-19T06:07:44.611Z",
    "updatedAt": "2026-11-19T06:07:44.927Z",
    "id": "6afe92309f3e84bebd6e3886"
  },
  "error": null
}
```

## GET /admin/reports/sales?groupBy=day

`GET /api/v1/admin/reports/sales?groupBy=day` → **200**

```json
{
  "success": true,
  "data": [
    {
      "orders": 5,
      "revenue": 148700,
      "period": "2026-11-19",
      "avgOrderValue": 29740
    }
  ],
  "error": null
}
```

## GET /admin/reports/top-products?limit=3

`GET /api/v1/admin/reports/top-products?limit=3` → **200**

```json
{
  "success": true,
  "data": [
    {
      "productId": "6afe922f9f3e84bebd6e3745",
      "variantId": null,
      "variantLabel": null,
      "title": {
        "en": "Aata (Whole Wheat Flour)",
        "hi": "आटा (गेहूं का आटा)"
      },
      "qtySold": 6,
      "revenue": 149400
    },
    {
      "productId": "6afe922f9f3e84bebd6e3769",
      "variantId": null,
      "variantLabel": null,
      "title": {
        "en": "Mineral Water",
        "hi": "मिनरल वाटर"
      },
      "qtySold": 1,
      "revenue": 1800
    }
  ],
  "error": null
}
```

## GET /admin/reports/cod?date=2026-11-19

`GET /api/v1/admin/reports/cod?date=2026-11-19` → **200**

```json
{
  "success": true,
  "data": {
    "date": "2026-11-19",
    "totalExpected": 45800,
    "totalCollected": 25400,
    "byRider": [
      {
        "rider": {
          "id": "6afe92309f3e84bebd6e38f0",
          "name": "Ramesh Yadav",
          "mobile": "9877700001"
        },
        "orders": 1,
        "expected": 25400,
        "collected": 25400
      },
      {
        "rider": null,
        "orders": 1,
        "expected": 20400,
        "collected": 0
      }
    ]
  },
  "error": null
}
```

## GET /admin/orders/latest?since=<ISO datetime>

`GET /api/v1/admin/orders/latest?since=2026-11-19T05%3A07%3A44.949Z` → **200**

```json
{
  "success": true,
  "data": {
    "count": 5,
    "orders": [
      {
        "id": "6afe92309f3e84bebd6e38d5",
        "orderNumber": "AALI261119D3FA42A4",
        "total": 52100,
        "createdAt": "2026-11-19T06:07:44.700Z"
      },
      {
        "id": "6afe92309f3e84bebd6e38a3",
        "orderNumber": "AALI261119CADE78A1",
        "total": 25400,
        "createdAt": "2026-11-19T06:07:44.643Z"
      },
      {
        "id": "6afe92309f3e84bebd6e3886",
        "orderNumber": "AALI261119F91C2A0B",
        "total": 25400,
        "createdAt": "2026-11-19T06:07:44.611Z"
      },
      {
        "id": "6afe92309f3e84bebd6e382f",
        "orderNumber": "AALI261119A2FE3961",
        "total": 25400,
        "createdAt": "2026-11-19T06:07:44.460Z"
      },
      {
        "id": "6afe92309f3e84bebd6e37ec",
        "orderNumber": "AALI261119805557FF",
        "total": 20400,
        "createdAt": "2026-11-19T06:07:44.358Z"
      }
    ]
  },
  "error": null
}
```

## PATCH /admin/products/bulk (one row fails the price <= mrp check, one id is unknown)

`PATCH /api/v1/admin/products/bulk` → **200**

```json
{
  "success": true,
  "data": {
    "updated": 1,
    "failed": [
      {
        "id": "6afe922f9f3e84bebd6e3733",
        "error": "price (99999999) cannot exceed mrp (3000)"
      },
      {
        "id": "507f1f77bcf86cd799439011",
        "error": "Product not found"
      }
    ]
  },
  "error": null
}
```

## GET /admin/products/export (CSV)

`GET /api/v1/admin/products/export` → **200**

_Content-Type: text/csv; charset=utf-8 · Content-Disposition: attachment; filename="products-2026-11-19.csv" · the file starts with a UTF-8 BOM so Excel shows Hindi correctly · money columns are paise_

```csv
id,variant_id,variant_label_en,variant_label_hi,sku,slug,title_en,title_hi,option_name_en,option_name_hi,category_slug,brand,unit,mrp,price,stock,isActive
6afe922f9f3e84bebd6e3731,,,,,fresh-onion,Fresh Onion,ताज़ा प्याज़,,,fruits-vegetables,Farm Fresh,1 kg,4000,2000,90,false
6afe922f9f3e84bebd6e3733,,,,,potato,Potato,आलू,,,fruits-vegetables,Farm Fresh,1 kg,3000,2500,150,true
6afe922f9f3e84bebd6e3735,,,,,tomato,Tomato,टमाटर,,,fruits-vegetables,Farm Fresh,1 kg,3500,2800,100,true
6afe922f9f3e84bebd6e3737,,,,,banana,Banana,केला,,,fruits-vegetables,Farm Fresh,6 pcs,3600,3000,90,true
... (40 product rows in total)
```

## POST /admin/products/import?dryRun=true (validates, writes nothing)

`POST /api/v1/admin/products/import?dryRun=true` → **200**

```json
{
  "success": true,
  "data": {
    "created": 1,
    "updated": 1,
    "errors": [
      {
        "row": 4,
        "error": "category_slug \"no-such-category\" does not exist"
      }
    ],
    "dryRun": true
  },
  "error": null
}
```

## POST /admin/products/import (applies the valid rows)

`POST /api/v1/admin/products/import` → **200**

```json
{
  "success": true,
  "data": {
    "created": 1,
    "updated": 1,
    "errors": [
      {
        "row": 4,
        "error": "category_slug \"no-such-category\" does not exist"
      }
    ],
    "dryRun": false
  },
  "error": null
}
```

## POST /admin/products (with variants: price / mrp / unit / stock are derived)

`POST /api/v1/admin/products` → **201**

```json
{
  "success": true,
  "data": {
    "title": {
      "en": "Aashirvaad Select Atta",
      "hi": "आशीर्वाद सेलेक्ट आटा"
    },
    "slug": "aashirvaad-select-atta",
    "description": {
      "en": "Whole wheat flour, sold in three pack sizes.",
      "hi": "गेहूं का आटा, तीन पैक साइज़ में।"
    },
    "category": "6afe922f9f3e84bebd6e3721",
    "brand": "Aashirvaad",
    "images": [
      "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg"
    ],
    "stock": 73,
    "optionName": {
      "en": "Pack size",
      "hi": "पैक साइज़"
    },
    "variants": [
      {
        "label": {
          "en": "1 kg",
          "hi": "1 किलो"
        },
        "sku": "ATTA-1",
        "mrp": 6000,
        "price": 5200,
        "stock": 40,
        "images": [],
        "isDefault": true,
        "isActive": true,
        "discountPercent": 13,
        "inStock": true,
        "id": "6afe92319f3e84bebd6e3944"
      },
      {
        "label": {
          "en": "5 kg",
          "hi": "5 किलो"
        },
        "sku": "ATTA-5",
        "mrp": 27500,
        "price": 24900,
        "stock": 25,
        "images": [],
        "isDefault": false,
        "isActive": true,
        "discountPercent": 9,
        "inStock": true,
        "id": "6afe92319f3e84bebd6e3945"
      },
      {
        "label": {
          "en": "10 kg",
          "hi": "10 किलो"
        },
        "sku": "ATTA-10",
        "mrp": 55000,
        "price": 47000,
        "stock": 8,
        "images": [
          "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta-10kg.jpg"
        ],
        "isDefault": false,
        "isActive": true,
        "discountPercent": 15,
        "inStock": true,
        "id": "6afe92319f3e84bebd6e3946"
      }
    ],
    "ratingAvg": 0,
    "ratingCount": 0,
    "tags": [],
    "isActive": true,
    "price": 5200,
    "mrp": 6000,
    "unit": "1 kg",
    "createdAt": "2026-11-19T06:07:45.012Z",
    "updatedAt": "2026-11-19T06:07:45.012Z",
    "discountPercent": 13,
    "inStock": true,
    "id": "6afe92319f3e84bebd6e3943"
  },
  "error": null
}
```

## POST /admin/products -> error: two default variants

`POST /api/v1/admin/products` → **400**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "path": "variants",
        "message": "Exactly one variant must have isDefault: true (got 3)"
      }
    ]
  }
}
```

## GET /products/:slug (product with variants; inactive variants are hidden from customers)

`GET /api/v1/products/aashirvaad-select-atta` → **200**

```json
{
  "success": true,
  "data": {
    "title": {
      "en": "Aashirvaad Select Atta",
      "hi": "आशीर्वाद सेलेक्ट आटा"
    },
    "slug": "aashirvaad-select-atta",
    "description": {
      "en": "Whole wheat flour, sold in three pack sizes.",
      "hi": "गेहूं का आटा, तीन पैक साइज़ में।"
    },
    "category": {
      "name": {
        "en": "Grocery & Staples",
        "hi": "किराना और राशन"
      },
      "slug": "grocery-staples",
      "id": "6afe922f9f3e84bebd6e3721"
    },
    "brand": "Aashirvaad",
    "images": [
      "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg"
    ],
    "stock": 73,
    "optionName": {
      "en": "Pack size",
      "hi": "पैक साइज़"
    },
    "variants": [
      {
        "label": {
          "en": "1 kg",
          "hi": "1 किलो"
        },
        "sku": "ATTA-1",
        "mrp": 6000,
        "price": 5200,
        "stock": 40,
        "images": [],
        "isDefault": true,
        "isActive": true,
        "discountPercent": 13,
        "inStock": true,
        "id": "6afe92319f3e84bebd6e3944"
      },
      {
        "label": {
          "en": "5 kg",
          "hi": "5 किलो"
        },
        "sku": "ATTA-5",
        "mrp": 27500,
        "price": 24900,
        "stock": 25,
        "images": [],
        "isDefault": false,
        "isActive": true,
        "discountPercent": 9,
        "inStock": true,
        "id": "6afe92319f3e84bebd6e3945"
      },
      {
        "label": {
          "en": "10 kg",
          "hi": "10 किलो"
        },
        "sku": "ATTA-10",
        "mrp": 55000,
        "price": 47000,
        "stock": 8,
        "images": [
          "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta-10kg.jpg"
        ],
        "isDefault": false,
        "isActive": true,
        "discountPercent": 15,
        "inStock": true,
        "id": "6afe92319f3e84bebd6e3946"
      }
    ],
    "ratingAvg": 0,
    "ratingCount": 0,
    "tags": [],
    "isActive": true,
    "price": 5200,
    "mrp": 6000,
    "unit": "1 kg",
    "createdAt": "2026-11-19T06:07:45.012Z",
    "updatedAt": "2026-11-19T06:07:45.012Z",
    "discountPercent": 13,
    "inStock": true,
    "id": "6afe92319f3e84bebd6e3943"
  },
  "error": null
}
```

## POST /cart/items without variantId -> error VARIANT_REQUIRED

`POST /api/v1/cart/items` → **400**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VARIANT_REQUIRED",
    "message": "Choose an option (variantId) for this product",
    "details": {
      "options": [
        {
          "id": "6afe92319f3e84bebd6e3944",
          "label": {
            "en": "1 kg",
            "hi": "1 किलो"
          }
        },
        {
          "id": "6afe92319f3e84bebd6e3945",
          "label": {
            "en": "5 kg",
            "hi": "5 किलो"
          }
        },
        {
          "id": "6afe92319f3e84bebd6e3946",
          "label": {
            "en": "10 kg",
            "hi": "10 किलो"
          }
        }
      ]
    }
  }
}
```

## POST /cart/items (variantId)

`POST /api/v1/cart/items` → **201**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "6afe92319f3e84bebd6e3943",
        "variantId": "6afe92319f3e84bebd6e3945",
        "variantLabel": {
          "en": "5 kg",
          "hi": "5 किलो"
        },
        "title": {
          "en": "Aashirvaad Select Atta",
          "hi": "आशीर्वाद सेलेक्ट आटा"
        },
        "slug": "aashirvaad-select-atta",
        "image": "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg",
        "unit": "5 kg",
        "price": 24900,
        "mrp": 27500,
        "qty": 2,
        "stock": 25,
        "isAvailable": true,
        "inStock": true,
        "lineTotal": 49800
      }
    ],
    "pricing": {
      "subtotal": 49800,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 50300
    },
    "couponCode": null,
    "couponError": null
  },
  "error": null
}
```

## GET /cart (each variant is its own line, with its own price / mrp / stock / label)

`GET /api/v1/cart` → **200**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "6afe92319f3e84bebd6e3943",
        "variantId": "6afe92319f3e84bebd6e3945",
        "variantLabel": {
          "en": "5 kg",
          "hi": "5 किलो"
        },
        "title": {
          "en": "Aashirvaad Select Atta",
          "hi": "आशीर्वाद सेलेक्ट आटा"
        },
        "slug": "aashirvaad-select-atta",
        "image": "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg",
        "unit": "5 kg",
        "price": 24900,
        "mrp": 27500,
        "qty": 2,
        "stock": 25,
        "isAvailable": true,
        "inStock": true,
        "lineTotal": 49800
      },
      {
        "productId": "6afe92319f3e84bebd6e3943",
        "variantId": "6afe92319f3e84bebd6e3944",
        "variantLabel": {
          "en": "1 kg",
          "hi": "1 किलो"
        },
        "title": {
          "en": "Aashirvaad Select Atta",
          "hi": "आशीर्वाद सेलेक्ट आटा"
        },
        "slug": "aashirvaad-select-atta",
        "image": "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg",
        "unit": "1 kg",
        "price": 5200,
        "mrp": 6000,
        "qty": 1,
        "stock": 40,
        "isAvailable": true,
        "inStock": true,
        "lineTotal": 5200
      }
    ],
    "pricing": {
      "subtotal": 55000,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 55500
    },
    "couponCode": null,
    "couponError": null
  },
  "error": null
}
```

## PATCH /cart/items/:productId?variantId= (changes only that line)

`PATCH /api/v1/cart/items/6afe92319f3e84bebd6e3943?variantId=6afe92319f3e84bebd6e3944` → **200**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "6afe92319f3e84bebd6e3943",
        "variantId": "6afe92319f3e84bebd6e3945",
        "variantLabel": {
          "en": "5 kg",
          "hi": "5 किलो"
        },
        "title": {
          "en": "Aashirvaad Select Atta",
          "hi": "आशीर्वाद सेलेक्ट आटा"
        },
        "slug": "aashirvaad-select-atta",
        "image": "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg",
        "unit": "5 kg",
        "price": 24900,
        "mrp": 27500,
        "qty": 2,
        "stock": 25,
        "isAvailable": true,
        "inStock": true,
        "lineTotal": 49800
      },
      {
        "productId": "6afe92319f3e84bebd6e3943",
        "variantId": "6afe92319f3e84bebd6e3944",
        "variantLabel": {
          "en": "1 kg",
          "hi": "1 किलो"
        },
        "title": {
          "en": "Aashirvaad Select Atta",
          "hi": "आशीर्वाद सेलेक्ट आटा"
        },
        "slug": "aashirvaad-select-atta",
        "image": "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg",
        "unit": "1 kg",
        "price": 5200,
        "mrp": 6000,
        "qty": 3,
        "stock": 40,
        "isAvailable": true,
        "inStock": true,
        "lineTotal": 15600
      }
    ],
    "pricing": {
      "subtotal": 65400,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 65900
    },
    "couponCode": null,
    "couponError": null
  },
  "error": null
}
```

## DELETE /cart/items/:productId?variantId= (removes only that line)

`DELETE /api/v1/cart/items/6afe92319f3e84bebd6e3943?variantId=6afe92319f3e84bebd6e3944` → **200**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "6afe92319f3e84bebd6e3943",
        "variantId": "6afe92319f3e84bebd6e3945",
        "variantLabel": {
          "en": "5 kg",
          "hi": "5 किलो"
        },
        "title": {
          "en": "Aashirvaad Select Atta",
          "hi": "आशीर्वाद सेलेक्ट आटा"
        },
        "slug": "aashirvaad-select-atta",
        "image": "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg",
        "unit": "5 kg",
        "price": 24900,
        "mrp": 27500,
        "qty": 2,
        "stock": 25,
        "isAvailable": true,
        "inStock": true,
        "lineTotal": 49800
      }
    ],
    "pricing": {
      "subtotal": 49800,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 50300
    },
    "couponCode": null,
    "couponError": null
  },
  "error": null
}
```

## POST /orders (items carry variantId + variantLabel; stock leaves those variants)

`POST /api/v1/orders` → **201**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI26111929EA9B31",
    "user": "6afe92309f3e84bebd6e3797",
    "items": [
      {
        "product": "6afe92319f3e84bebd6e3943",
        "variantId": "6afe92319f3e84bebd6e3945",
        "variantLabel": {
          "en": "5 kg",
          "hi": "5 किलो"
        },
        "title": {
          "en": "Aashirvaad Select Atta",
          "hi": "आशीर्वाद सेलेक्ट आटा"
        },
        "image": "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg",
        "unit": "5 kg",
        "price": 24900,
        "qty": 2
      },
      {
        "product": "6afe92319f3e84bebd6e3943",
        "variantId": "6afe92319f3e84bebd6e3946",
        "variantLabel": {
          "en": "10 kg",
          "hi": "10 किलो"
        },
        "title": {
          "en": "Aashirvaad Select Atta",
          "hi": "आशीर्वाद सेलेक्ट आटा"
        },
        "image": "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta-10kg.jpg",
        "unit": "10 kg",
        "price": 47000,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 96800,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 97300
    },
    "couponCode": null,
    "shippingAddress": {
      "label": "Shop",
      "line1": "Gandhi Chowk",
      "line2": "",
      "landmark": "Opposite the temple",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": false,
      "location": {
        "lat": 27.5706,
        "lng": 80.6822
      },
      "createdAt": "2026-11-19T06:07:44.586Z",
      "updatedAt": "2026-11-19T06:07:44.586Z",
      "id": "6afe92309f3e84bebd6e386f"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:45.103Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:45.103Z",
    "idempotencyKey": "sample-key-variant",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:45.105Z",
    "updatedAt": "2026-11-19T06:07:45.105Z",
    "id": "6afe92319f3e84bebd6e39ad",
    "deliveryOtp": "6971",
    "payment": null
  },
  "error": null
}
```

## PATCH /admin/products/:id (variants: update by id, add one without id, leave one out = deleted)

`PATCH /api/v1/admin/products/6afe92319f3e84bebd6e3943` → **200**

```json
{
  "success": true,
  "data": {
    "title": {
      "en": "Aashirvaad Select Atta",
      "hi": "आशीर्वाद सेलेक्ट आटा"
    },
    "slug": "aashirvaad-select-atta",
    "description": {
      "en": "Whole wheat flour, sold in three pack sizes.",
      "hi": "गेहूं का आटा, तीन पैक साइज़ में।"
    },
    "category": "6afe922f9f3e84bebd6e3721",
    "brand": "Aashirvaad",
    "images": [
      "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg"
    ],
    "stock": 88,
    "optionName": {
      "en": "Pack size",
      "hi": "पैक साइज़"
    },
    "variants": [
      {
        "label": {
          "en": "1 kg",
          "hi": "1 किलो"
        },
        "sku": "ATTA-1",
        "mrp": 6000,
        "price": 5400,
        "stock": 60,
        "images": [],
        "isDefault": true,
        "isActive": true,
        "discountPercent": 10,
        "inStock": true,
        "id": "6afe92319f3e84bebd6e3944"
      },
      {
        "label": {
          "en": "5 kg",
          "hi": "5 किलो"
        },
        "sku": "ATTA-5",
        "mrp": 27500,
        "price": 24900,
        "stock": 25,
        "images": [],
        "isDefault": false,
        "isActive": true,
        "discountPercent": 9,
        "inStock": true,
        "id": "6afe92319f3e84bebd6e3945"
      },
      {
        "label": {
          "en": "25 kg",
          "hi": "25 किलो"
        },
        "sku": "ATTA-25",
        "mrp": 130000,
        "price": 115000,
        "stock": 3,
        "images": [],
        "isDefault": false,
        "isActive": true,
        "discountPercent": 12,
        "inStock": true,
        "id": "6afe92319f3e84bebd6e39b8"
      }
    ],
    "ratingAvg": 0,
    "ratingCount": 0,
    "tags": [],
    "isActive": true,
    "price": 5400,
    "mrp": 6000,
    "unit": "1 kg",
    "createdAt": "2026-11-19T06:07:45.012Z",
    "updatedAt": "2026-11-19T06:07:45.116Z",
    "discountPercent": 10,
    "inStock": true,
    "id": "6afe92319f3e84bebd6e3943"
  },
  "error": null
}
```

## POST /orders/:id/reorder (the 10 kg variant was deleted -> skipped with reason "inactive")

`POST /api/v1/orders/6afe92319f3e84bebd6e39ad/reorder` → **200**

```json
{
  "success": true,
  "data": {
    "cart": {
      "items": [
        {
          "productId": "6afe92319f3e84bebd6e3943",
          "variantId": "6afe92319f3e84bebd6e3945",
          "variantLabel": {
            "en": "5 kg",
            "hi": "5 किलो"
          },
          "title": {
            "en": "Aashirvaad Select Atta",
            "hi": "आशीर्वाद सेलेक्ट आटा"
          },
          "slug": "aashirvaad-select-atta",
          "image": "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg",
          "unit": "5 kg",
          "price": 24900,
          "mrp": 27500,
          "qty": 2,
          "stock": 25,
          "isAvailable": true,
          "inStock": true,
          "lineTotal": 49800
        }
      ],
      "pricing": {
        "subtotal": 49800,
        "discount": 0,
        "deliveryFee": 0,
        "handlingFee": 500,
        "total": 50300
      },
      "couponCode": null,
      "couponError": null
    },
    "skipped": [
      {
        "productId": "6afe92319f3e84bebd6e3943",
        "variantId": "6afe92319f3e84bebd6e3946",
        "variantLabel": {
          "en": "10 kg",
          "hi": "10 किलो"
        },
        "title": {
          "en": "Aashirvaad Select Atta",
          "hi": "आशीर्वाद सेलेक्ट आटा"
        },
        "reason": "inactive",
        "requested": 1,
        "added": 0
      }
    ]
  },
  "error": null
}
```

## PATCH /admin/products/bulk (variantId: one variant per row)

`PATCH /api/v1/admin/products/bulk` → **200**

```json
{
  "success": true,
  "data": {
    "updated": 2,
    "failed": [
      {
        "id": "6afe92319f3e84bebd6e3943",
        "error": "This product has variants: send variantId to change price, mrp or stock"
      }
    ]
  },
  "error": null
}
```

## GET /admin/products?lowStock=true (variant level: any active variant at or below the threshold)

`GET /api/v1/admin/products?lowStock=true&q=aashirvaad%20select&limit=2` → **200**

```json
{
  "success": true,
  "data": [
    {
      "title": {
        "en": "Aashirvaad Select Atta",
        "hi": "आशीर्वाद सेलेक्ट आटा"
      },
      "slug": "aashirvaad-select-atta",
      "description": {
        "en": "Whole wheat flour, sold in three pack sizes.",
        "hi": "गेहूं का आटा, तीन पैक साइज़ में।"
      },
      "category": {
        "name": {
          "en": "Grocery & Staples",
          "hi": "किराना और राशन"
        },
        "slug": "grocery-staples",
        "id": "6afe922f9f3e84bebd6e3721"
      },
      "brand": "Aashirvaad",
      "images": [
        "https://res.cloudinary.com/demo/image/upload/aali-market/products/atta.jpg"
      ],
      "stock": 58,
      "optionName": {
        "en": "Pack size",
        "hi": "पैक साइज़"
      },
      "variants": [
        {
          "label": {
            "en": "1 kg",
            "hi": "1 किलो"
          },
          "sku": "ATTA-1",
          "mrp": 6000,
          "price": 5300,
          "stock": 55,
          "images": [],
          "isDefault": true,
          "isActive": true,
          "discountPercent": 12,
          "inStock": true,
          "id": "6afe92319f3e84bebd6e3944"
        },
        {
          "label": {
            "en": "5 kg",
            "hi": "5 किलो"
          },
          "sku": "ATTA-5",
          "mrp": 27500,
          "price": 24900,
          "stock": 25,
          "images": [],
          "isDefault": false,
          "isActive": false,
          "discountPercent": 9,
          "inStock": true,
          "id": "6afe92319f3e84bebd6e3945"
        },
        {
          "label": {
            "en": "25 kg",
            "hi": "25 किलो"
          },
          "sku": "ATTA-25",
          "mrp": 130000,
          "price": 115000,
          "stock": 3,
          "images": [],
          "isDefault": false,
          "isActive": true,
          "discountPercent": 12,
          "inStock": true,
          "id": "6afe92319f3e84bebd6e39b8"
        }
      ],
      "ratingAvg": 0,
      "ratingCount": 0,
      "tags": [],
      "isActive": true,
      "price": 5300,
      "mrp": 6000,
      "unit": "1 kg",
      "createdAt": "2026-11-19T06:07:45.012Z",
      "updatedAt": "2026-11-19T06:07:45.143Z",
      "discountPercent": 12,
      "inStock": true,
      "id": "6afe92319f3e84bebd6e3943"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 2,
    "pages": 1
  }
}
```

## GET /admin/reports/top-products (one row per variant, with variantLabel)

`GET /api/v1/admin/reports/top-products?limit=3` → **200**

_data has 3 items, showing first 2_

```json
{
  "success": true,
  "data": [
    {
      "productId": "6afe922f9f3e84bebd6e3745",
      "variantId": null,
      "variantLabel": null,
      "title": {
        "en": "Aata (Whole Wheat Flour)",
        "hi": "आटा (गेहूं का आटा)"
      },
      "qtySold": 6,
      "revenue": 149400
    },
    {
      "productId": "6afe92319f3e84bebd6e3943",
      "variantId": "6afe92319f3e84bebd6e3945",
      "variantLabel": {
        "en": "5 kg",
        "hi": "5 किलो"
      },
      "title": {
        "en": "Aashirvaad Select Atta",
        "hi": "आशीर्वाद सेलेक्ट आटा"
      },
      "qtySold": 2,
      "revenue": 49800
    }
  ],
  "error": null
}
```

## GET /admin/products/export (a product with variants gets one row per variant)

`GET /api/v1/admin/products/export` → **200**

_Header plus the rows of the variant product only (the real file has one row per product / variant). On a variant row mrp / price / stock / isActive belong to the variant and `unit` is its English label._

```csv
id,variant_id,variant_label_en,variant_label_hi,sku,slug,title_en,title_hi,option_name_en,option_name_hi,category_slug,brand,unit,mrp,price,stock,isActive
6afe92319f3e84bebd6e3943,6afe92319f3e84bebd6e3944,1 kg,1 किलो,ATTA-1,aashirvaad-select-atta,Aashirvaad Select Atta,आशीर्वाद सेलेक्ट आटा,Pack size,पैक साइज़,grocery-staples,Aashirvaad,1 kg,6000,5300,55,true
6afe92319f3e84bebd6e3943,6afe92319f3e84bebd6e3945,5 kg,5 किलो,ATTA-5,aashirvaad-select-atta,Aashirvaad Select Atta,आशीर्वाद सेलेक्ट आटा,Pack size,पैक साइज़,grocery-staples,Aashirvaad,5 kg,27500,24900,25,false
6afe92319f3e84bebd6e3943,6afe92319f3e84bebd6e39b8,25 kg,25 किलो,ATTA-25,aashirvaad-select-atta,Aashirvaad Select Atta,आशीर्वाद सेलेक्ट आटा,Pack size,पैक साइज़,grocery-staples,Aashirvaad,25 kg,130000,115000,3,true
```

## POST /admin/products/import?dryRun=true (variant rows: update by variant_id, add a variant by label, one bad row)

`POST /api/v1/admin/products/import?dryRun=true` → **200**

```json
{
  "success": true,
  "data": {
    "created": 0,
    "updated": 1,
    "errors": [
      {
        "row": 4,
        "error": "price (9999999) cannot exceed mrp (6000)"
      }
    ],
    "dryRun": true
  },
  "error": null
}
```

## GET /admin/reviews?status=pending

`GET /api/v1/admin/reviews?status=pending` → **200**

```json
{
  "success": true,
  "data": [
    {
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afe92309f3e84bebd6e3797"
      },
      "product": {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "slug": "aata-whole-wheat-flour",
        "discountPercent": 0,
        "inStock": false,
        "id": "6afe922f9f3e84bebd6e3745"
      },
      "order": "6afe92309f3e84bebd6e37ec",
      "rating": 5,
      "comment": "Great quality atta.",
      "status": "pending",
      "moderatedAt": null,
      "moderationNote": null,
      "createdAt": "2026-11-19T06:07:44.405Z",
      "updatedAt": "2026-11-19T06:07:44.405Z",
      "id": "6afe92309f3e84bebd6e3808"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## PATCH /admin/reviews/:id/status (approve: returns the review + the product's recalculated rating)

`PATCH /api/v1/admin/reviews/6afe92309f3e84bebd6e3808/status` → **200**

```json
{
  "success": true,
  "data": {
    "review": {
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afe92309f3e84bebd6e3797"
      },
      "product": {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "slug": "aata-whole-wheat-flour",
        "discountPercent": 0,
        "inStock": false,
        "id": "6afe922f9f3e84bebd6e3745"
      },
      "order": "6afe92309f3e84bebd6e37ec",
      "rating": 5,
      "comment": "Great quality atta.",
      "status": "approved",
      "moderatedAt": "2026-11-19T06:07:45.189Z",
      "moderationNote": "Genuine review",
      "createdAt": "2026-11-19T06:07:44.405Z",
      "updatedAt": "2026-11-19T06:07:45.189Z",
      "id": "6afe92309f3e84bebd6e3808"
    },
    "product": {
      "id": "6afe922f9f3e84bebd6e3745",
      "ratingAvg": 5,
      "ratingCount": 1
    }
  },
  "error": null
}
```

## GET /products/:id/reviews (public: now shows the approved review)

`GET /api/v1/products/6afe922f9f3e84bebd6e3745/reviews` → **200**

```json
{
  "success": true,
  "data": [
    {
      "user": {
        "name": "Ritesh",
        "id": "6afe92309f3e84bebd6e3797"
      },
      "product": "6afe922f9f3e84bebd6e3745",
      "order": "6afe92309f3e84bebd6e37ec",
      "rating": 5,
      "comment": "Great quality atta.",
      "status": "approved",
      "createdAt": "2026-11-19T06:07:44.405Z",
      "updatedAt": "2026-11-19T06:07:45.189Z",
      "id": "6afe92309f3e84bebd6e3808"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## GET /admin/reviews (every status)

`GET /api/v1/admin/reviews` → **200**

```json
{
  "success": true,
  "data": [
    {
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afe92309f3e84bebd6e3797"
      },
      "product": {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "slug": "aata-whole-wheat-flour",
        "discountPercent": 0,
        "inStock": false,
        "id": "6afe922f9f3e84bebd6e3745"
      },
      "order": "6afe92309f3e84bebd6e37ec",
      "rating": 5,
      "comment": "Great quality atta.",
      "status": "approved",
      "moderatedAt": "2026-11-19T06:07:45.189Z",
      "moderationNote": "Genuine review",
      "createdAt": "2026-11-19T06:07:44.405Z",
      "updatedAt": "2026-11-19T06:07:45.189Z",
      "id": "6afe92309f3e84bebd6e3808"
    }
  ],
  "error": null,
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

## PATCH /admin/reviews/:id/status (reject: the rating drops it again)

`PATCH /api/v1/admin/reviews/6afe92309f3e84bebd6e3808/status` → **200**

```json
{
  "success": true,
  "data": {
    "review": {
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afe92309f3e84bebd6e3797"
      },
      "product": {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "slug": "aata-whole-wheat-flour",
        "discountPercent": 0,
        "inStock": false,
        "id": "6afe922f9f3e84bebd6e3745"
      },
      "order": "6afe92309f3e84bebd6e37ec",
      "rating": 5,
      "comment": "Great quality atta.",
      "status": "rejected",
      "moderatedAt": "2026-11-19T06:07:45.212Z",
      "moderationNote": "Changed my mind",
      "createdAt": "2026-11-19T06:07:44.405Z",
      "updatedAt": "2026-11-19T06:07:45.212Z",
      "id": "6afe92309f3e84bebd6e3808"
    },
    "product": {
      "id": "6afe922f9f3e84bebd6e3745",
      "ratingAvg": 0,
      "ratingCount": 0
    }
  },
  "error": null
}
```

## DELETE /admin/reviews/:id (ratingAvg / ratingCount recalculated)

`DELETE /api/v1/admin/reviews/6afe92309f3e84bebd6e3808` → **200**

```json
{
  "success": true,
  "data": {
    "id": "6afe92309f3e84bebd6e3808",
    "product": {
      "id": "6afe922f9f3e84bebd6e3745",
      "ratingAvg": 0,
      "ratingCount": 0
    }
  },
  "error": null
}
```

## GET /push/vapid-public-key

`GET /api/v1/push/vapid-public-key` → **200**

```json
{
  "success": true,
  "data": {
    "publicKey": "BELFQPualajBXInif_BP7uQ80PJdtIiwHpd5mx3m0y3DGACSN6n9XAq6SeiIywOkkO9yxUqFIX4LNftAuquQTVQ"
  },
  "error": null
}
```

## POST /me/push-subscriptions (the browser's PushSubscription JSON)

`POST /api/v1/me/push-subscriptions` → **201**

```json
{
  "success": true,
  "data": {
    "id": "6afe9231527f074bb34b15c2",
    "endpoint": "https://fcm.googleapis.com/fcm/send/dMq1-example-device-token",
    "createdAt": "2026-11-19T06:07:45.232Z"
  },
  "error": null
}
```

## POST /me/push-subscriptions -> error: endpoint is not a known push service

`POST /api/v1/me/push-subscriptions` → **400**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Unsupported push service endpoint"
  }
}
```

## Web Push message the server sends on an order status change (what your service worker receives)

`PUSH to https://fcm.googleapis.com/fcm/send/dMq1-example-device-token`

_Sent with web-push after PATCH /admin/orders/:id/status (also after rider actions and a confirmed payment). Bilingual because customers have no stored language. 404/410 from the push service deletes the subscription._

```json
{
  "title": "Aali Market, Sitapur",
  "body": "Your order is confirmed / आपका ऑर्डर कन्फर्म हो गया है (#AALI261119CADE78A1)",
  "url": "/orders/6afe92309f3e84bebd6e38a3"
}
```

## POST /me/push-subscriptions (with a RIDER token)

`POST /api/v1/me/push-subscriptions` → **201**

```json
{
  "success": true,
  "data": {
    "id": "6afe9231527f074bb34b15cf",
    "endpoint": "https://fcm.googleapis.com/fcm/send/rider-device-token",
    "createdAt": "2026-11-19T06:07:45.257Z"
  },
  "error": null
}
```

## Web Push to a rider when an order is assigned to them

`PUSH to https://fcm.googleapis.com/fcm/send/rider-device-token`

_Sent after PATCH /admin/orders/:id/assign. body = "#" + last 6 characters of the order number + the area (address line 2, else the city). Never the customer's phone, the delivery OTP or the door number._

```json
{
  "title": "New delivery / नई डिलीवरी",
  "body": "#DE78A1, Sitapur",
  "url": "/rider"
}
```

## PATCH /admin/orders/:id/assign (to another rider: both riders are notified)

`PATCH /api/v1/admin/orders/6afe92309f3e84bebd6e38a3/assign` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261119CADE78A1",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "id": "6afe92309f3e84bebd6e3797"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afe922f9f3e84bebd6e3745",
        "variantId": null,
        "variantLabel": null,
        "image": "",
        "unit": "5 kg",
        "price": 24900,
        "qty": 1
      }
    ],
    "pricing": {
      "subtotal": 24900,
      "discount": 0,
      "deliveryFee": 0,
      "handlingFee": 500,
      "total": 25400
    },
    "couponCode": null,
    "shippingAddress": {
      "label": "Shop",
      "line1": "Gandhi Chowk",
      "line2": "",
      "landmark": "Opposite the temple",
      "city": "Sitapur",
      "state": "Uttar Pradesh",
      "pincode": "261001",
      "isDefault": false,
      "location": {
        "lat": 27.5706,
        "lng": 80.6822
      },
      "createdAt": "2026-11-19T06:07:44.586Z",
      "updatedAt": "2026-11-19T06:07:44.586Z",
      "id": "6afe92309f3e84bebd6e386f"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-19T06:07:44.641Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-19T06:07:45.244Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-20T06:07:44.641Z",
    "idempotencyKey": "sample-key-retry",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": {
      "mobile": "9877700002",
      "name": "Suresh Verma",
      "id": "6afe92319f3e84bebd6e3a14"
    },
    "cashCollected": null,
    "createdAt": "2026-11-19T06:07:44.643Z",
    "updatedAt": "2026-11-19T06:07:45.277Z",
    "id": "6afe92309f3e84bebd6e38a3"
  },
  "error": null
}
```

## Web Push to the PREVIOUS rider when their order is given to someone else

`PUSH to https://fcm.googleapis.com/fcm/send/rider-device-token`

_Also sent when the order is un-assigned (riderId: null). The new rider gets the "New delivery" message at the same time._

```json
{
  "title": "Order reassigned / ऑर्डर बदला गया",
  "body": "#DE78A1 is no longer yours / अब आपका नहीं है",
  "url": "/rider"
}
```

## DELETE /me/push-subscriptions

`DELETE /api/v1/me/push-subscriptions` → **200**

```json
{
  "success": true,
  "data": {
    "removed": 1
  },
  "error": null
}
```

## GET /cart?pincode=110001 (this Delhi area has a ₹35 delivery-fee override)

`GET /api/v1/cart?pincode=110001` → **200**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "6afe922f9f3e84bebd6e3769",
        "variantId": null,
        "variantLabel": null,
        "title": {
          "en": "Mineral Water",
          "hi": "मिनरल वाटर"
        },
        "slug": "mineral-water",
        "image": "",
        "unit": "1 L",
        "price": 1800,
        "mrp": 2000,
        "qty": 1,
        "stock": 300,
        "isAvailable": true,
        "inStock": true,
        "lineTotal": 1800
      }
    ],
    "pricing": {
      "subtotal": 1800,
      "discount": 0,
      "deliveryFee": 3500,
      "handlingFee": 500,
      "total": 5800
    },
    "couponCode": null,
    "couponError": null
  },
  "error": null
}
```

## POST /orders -> error MIN_ORDER_VALUE

`POST /api/v1/orders` → **400**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "MIN_ORDER_VALUE",
    "message": "Your order is below the minimum order value",
    "details": {
      "minOrderValue": 9900,
      "subtotal": 1800
    }
  }
}
```

## POST /orders -> error STORE_CLOSED

`POST /api/v1/orders` → **503**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "STORE_CLOSED",
    "message": "The store is currently closed and not accepting orders",
    "details": {
      "storeTimings": {
        "open": "08:00",
        "close": "22:00"
      }
    }
  }
}
```
