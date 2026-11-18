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
    "expiresAt": "2026-11-18T09:11:50.163Z",
    "ttlMinutes": 5,
    "code": "406394"
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
      "addresses": [],
      "createdAt": "2026-11-18T09:06:50.226Z",
      "updatedAt": "2026-11-18T09:06:50.226Z",
      "id": "6afd6aaa9d90ebe96ec5daed"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWZkNmFhYTlkOTBlYmU5NmVjNWRhZWQiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3OTQ5OTI4MTAsImV4cCI6MTc5NDk5MzcxMH0.Afy8RVEUxYjeXHkfMLm7yAh1nUr_rJWpoVOdILeAXeo",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWZkNmFhYTlkOTBlYmU5NmVjNWRhZWQiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3OTQ5OTI4MTAsImV4cCI6MTc5NzU4NDgxMCwianRpIjoiZWJiMDk4MzAtMzllYS00OWYzLTk1NzQtZjhjMTk0MTg5Y2Y2In0.NhmamX68SsNgRwW4e85axZ9Khr1ETLVOVLuuuKfpILw",
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
    "addresses": [],
    "createdAt": "2026-11-18T09:06:50.226Z",
    "updatedAt": "2026-11-18T09:06:50.226Z",
    "id": "6afd6aaa9d90ebe96ec5daed"
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
      "createdAt": "2026-11-18T09:06:49.821Z",
      "updatedAt": "2026-11-18T09:06:49.821Z",
      "id": "6afd6aa99d90ebe96ec5da5b"
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
      "createdAt": "2026-11-18T09:06:49.842Z",
      "updatedAt": "2026-11-18T09:06:49.842Z",
      "id": "6afd6aa99d90ebe96ec5da6a"
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
      "createdAt": "2026-11-18T09:06:50.248Z",
      "updatedAt": "2026-11-18T09:06:50.248Z",
      "id": "6afd6aaa9d90ebe96ec5daf4"
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
      "category": "6afd6aa99d90ebe96ec5da5b",
      "brand": "Farm Fresh",
      "images": [],
      "mrp": 3500,
      "price": 2800,
      "unit": "1 kg",
      "stock": 100,
      "ratingAvg": 0,
      "ratingCount": 0,
      "tags": [
        "tomato",
        "vegetable"
      ],
      "isActive": true,
      "createdAt": "2026-11-18T09:06:49.879Z",
      "updatedAt": "2026-11-18T09:06:49.879Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6afd6aa99d90ebe96ec5da8b"
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
      "category": "6afd6aa99d90ebe96ec5da5b",
      "brand": "Farm Fresh",
      "images": [],
      "mrp": 4000,
      "price": 3200,
      "unit": "1 kg",
      "stock": 120,
      "ratingAvg": 0,
      "ratingCount": 0,
      "tags": [
        "onion",
        "vegetable"
      ],
      "isActive": true,
      "createdAt": "2026-11-18T09:06:49.873Z",
      "updatedAt": "2026-11-18T09:06:49.873Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6afd6aa99d90ebe96ec5da87"
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
      "category": "6afd6aa99d90ebe96ec5da74",
      "brand": "Aashirvaad",
      "images": [],
      "mrp": 27500,
      "price": 24900,
      "unit": "5 kg",
      "stock": 80,
      "ratingAvg": 0,
      "ratingCount": 0,
      "tags": [
        "atta",
        "flour",
        "staple"
      ],
      "isActive": true,
      "createdAt": "2026-11-18T09:06:49.891Z",
      "updatedAt": "2026-11-18T09:06:49.891Z",
      "discountPercent": 9,
      "inStock": true,
      "id": "6afd6aa99d90ebe96ec5da9b"
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
      "id": "6afd6aa99d90ebe96ec5da74"
    },
    "brand": "Aashirvaad",
    "images": [],
    "mrp": 27500,
    "price": 24900,
    "unit": "5 kg",
    "stock": 80,
    "ratingAvg": 0,
    "ratingCount": 0,
    "tags": [
      "atta",
      "flour",
      "staple"
    ],
    "isActive": true,
    "createdAt": "2026-11-18T09:06:49.891Z",
    "updatedAt": "2026-11-18T09:06:49.891Z",
    "discountPercent": 9,
    "inStock": true,
    "id": "6afd6aa99d90ebe96ec5da9b"
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
    }
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
      "id": "6afd6aa99d90ebe96ec5da9b",
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
    "createdAt": "2026-11-18T09:06:50.348Z",
    "updatedAt": "2026-11-18T09:06:50.348Z",
    "id": "6afd6aaa9d90ebe96ec5db13"
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
      "createdAt": "2026-11-18T09:06:50.348Z",
      "updatedAt": "2026-11-18T09:06:50.348Z",
      "id": "6afd6aaa9d90ebe96ec5db13"
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
        "productId": "6afd6aa99d90ebe96ec5da9b",
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
        "productId": "6afd6aa99d90ebe96ec5da9b",
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
    "orderNumber": "AALI261118778CDA4B",
    "user": "6afd6aaa9d90ebe96ec5daed",
    "items": [
      {
        "product": "6afd6aa99d90ebe96ec5da9b",
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
      "createdAt": "2026-11-18T09:06:50.348Z",
      "updatedAt": "2026-11-18T09:06:50.348Z",
      "id": "6afd6aaa9d90ebe96ec5db13"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T09:06:50.410Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-19T09:06:50.410Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "createdAt": "2026-11-18T09:06:50.412Z",
    "updatedAt": "2026-11-18T09:06:50.412Z",
    "id": "6afd6aaa9d90ebe96ec5db42",
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
      "orderNumber": "AALI261118778CDA4B",
      "user": "6afd6aaa9d90ebe96ec5daed",
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6afd6aa99d90ebe96ec5da9b",
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
        "createdAt": "2026-11-18T09:06:50.348Z",
        "updatedAt": "2026-11-18T09:06:50.348Z",
        "id": "6afd6aaa9d90ebe96ec5db13"
      },
      "paymentMethod": "cod",
      "paymentStatus": "pending",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-18T09:06:50.410Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-18T09:06:50.425Z",
          "note": "Packing started"
        }
      ],
      "expectedDeliveryAt": "2026-11-19T09:06:50.410Z",
      "idempotencyKey": "sample-key-1",
      "paymentProviderOrderId": null,
      "paymentId": null,
      "cancelReason": null,
      "createdAt": "2026-11-18T09:06:50.412Z",
      "updatedAt": "2026-11-18T09:06:50.426Z",
      "id": "6afd6aaa9d90ebe96ec5db42"
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

`GET /api/v1/orders/6afd6aaa9d90ebe96ec5db42` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261118778CDA4B",
    "user": "6afd6aaa9d90ebe96ec5daed",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd6aa99d90ebe96ec5da9b",
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
      "createdAt": "2026-11-18T09:06:50.348Z",
      "updatedAt": "2026-11-18T09:06:50.348Z",
      "id": "6afd6aaa9d90ebe96ec5db13"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T09:06:50.410Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-18T09:06:50.425Z",
        "note": "Packing started"
      }
    ],
    "expectedDeliveryAt": "2026-11-19T09:06:50.410Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "createdAt": "2026-11-18T09:06:50.412Z",
    "updatedAt": "2026-11-18T09:06:50.426Z",
    "id": "6afd6aaa9d90ebe96ec5db42"
  },
  "error": null
}
```

## POST /products/:id/reviews

`POST /api/v1/products/6afd6aa99d90ebe96ec5da9b/reviews` → **201**

```json
{
  "success": true,
  "data": {
    "user": "6afd6aaa9d90ebe96ec5daed",
    "product": "6afd6aa99d90ebe96ec5da9b",
    "order": "6afd6aaa9d90ebe96ec5db42",
    "rating": 5,
    "comment": "Great quality atta.",
    "createdAt": "2026-11-18T09:06:50.454Z",
    "updatedAt": "2026-11-18T09:06:50.454Z",
    "id": "6afd6aaa9d90ebe96ec5db5a"
  },
  "error": null
}
```

## GET /products/:id/reviews

`GET /api/v1/products/6afd6aa99d90ebe96ec5da9b/reviews` → **200**

```json
{
  "success": true,
  "data": [
    {
      "user": {
        "name": "Ritesh",
        "id": "6afd6aaa9d90ebe96ec5daed"
      },
      "product": "6afd6aa99d90ebe96ec5da9b",
      "order": "6afd6aaa9d90ebe96ec5db42",
      "rating": 5,
      "comment": "Great quality atta.",
      "createdAt": "2026-11-18T09:06:50.454Z",
      "updatedAt": "2026-11-18T09:06:50.454Z",
      "id": "6afd6aaa9d90ebe96ec5db5a"
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

## GET /wishlist

`GET /api/v1/wishlist` → **200**

```json
{
  "success": true,
  "data": {
    "user": "6afd6aaa9d90ebe96ec5daed",
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
        "category": "6afd6aa99d90ebe96ec5da7d",
        "brand": "Bisleri",
        "images": [],
        "mrp": 2000,
        "price": 1800,
        "unit": "1 L",
        "stock": 300,
        "ratingAvg": 0,
        "ratingCount": 0,
        "tags": [
          "water",
          "beverage"
        ],
        "isActive": true,
        "createdAt": "2026-11-18T09:06:49.920Z",
        "updatedAt": "2026-11-18T09:06:49.920Z",
        "discountPercent": 10,
        "inStock": true,
        "id": "6afd6aa99d90ebe96ec5dabf"
      }
    ],
    "createdAt": "2026-11-18T09:06:50.480Z",
    "updatedAt": "2026-11-18T09:06:50.481Z",
    "id": "6afd6aaa9d90ebe96ec5db64"
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
      "startsAt": "2026-11-18T09:06:49.935Z",
      "expiresAt": "2027-11-17T18:30:00.000Z",
      "usageLimit": 10000,
      "perUserLimit": 1,
      "usedCount": 1,
      "isActive": true,
      "createdAt": "2026-11-18T09:06:49.936Z",
      "updatedAt": "2026-11-18T09:06:50.413Z",
      "id": "6afd6aa99d90ebe96ec5dad7"
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
    "orderNumber": "AALI26111865C98725",
    "user": "6afd6aaa9d90ebe96ec5daed",
    "items": [
      {
        "product": "6afd6aa99d90ebe96ec5da9b",
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
      "createdAt": "2026-11-18T09:06:50.348Z",
      "updatedAt": "2026-11-18T09:06:50.348Z",
      "id": "6afd6aaa9d90ebe96ec5db13"
    },
    "paymentMethod": "upi",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T09:06:50.515Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-19T09:06:50.515Z",
    "idempotencyKey": "sample-key-upi",
    "paymentProviderOrderId": "order_mock_6d7f21aafa12992a",
    "paymentId": null,
    "cancelReason": null,
    "createdAt": "2026-11-18T09:06:50.517Z",
    "updatedAt": "2026-11-18T09:06:50.520Z",
    "id": "6afd6aaa9d90ebe96ec5db81",
    "payment": {
      "provider": "mock",
      "keyId": null,
      "providerOrderId": "order_mock_6d7f21aafa12992a",
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
    "orderNumber": "AALI26111865C98725",
    "user": "6afd6aaa9d90ebe96ec5daed",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd6aa99d90ebe96ec5da9b",
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
      "createdAt": "2026-11-18T09:06:50.348Z",
      "updatedAt": "2026-11-18T09:06:50.348Z",
      "id": "6afd6aaa9d90ebe96ec5db13"
    },
    "paymentMethod": "upi",
    "paymentStatus": "paid",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T09:06:50.515Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-18T09:06:50.532Z",
        "note": "Payment verified"
      }
    ],
    "expectedDeliveryAt": "2026-11-19T09:06:50.515Z",
    "idempotencyKey": "sample-key-upi",
    "paymentProviderOrderId": "order_mock_6d7f21aafa12992a",
    "paymentId": "pay_SAMPLE123",
    "cancelReason": null,
    "createdAt": "2026-11-18T09:06:50.517Z",
    "updatedAt": "2026-11-18T09:06:50.532Z",
    "id": "6afd6aaa9d90ebe96ec5db81",
    "payment": {
      "provider": "mock",
      "keyId": null,
      "providerOrderId": "order_mock_6d7f21aafa12992a",
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
    "totalCustomers": 1
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
      "id": "6afd6aaa9d90ebe96ec5daed",
      "name": "Ritesh",
      "mobile": "9876543210",
      "email": null,
      "isVerified": true,
      "ordersCount": 2,
      "createdAt": "2026-11-18T09:06:50.226Z"
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

`GET /api/v1/admin/orders?status=confirmed&from=2026-11-18&q=9876` → **200**

```json
{
  "success": true,
  "data": [
    {
      "orderNumber": "AALI26111865C98725",
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afd6aaa9d90ebe96ec5daed"
      },
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6afd6aa99d90ebe96ec5da9b",
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
        "createdAt": "2026-11-18T09:06:50.348Z",
        "updatedAt": "2026-11-18T09:06:50.348Z",
        "id": "6afd6aaa9d90ebe96ec5db13"
      },
      "paymentMethod": "upi",
      "paymentStatus": "paid",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-18T09:06:50.515Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-18T09:06:50.532Z",
          "note": "Payment verified"
        }
      ],
      "expectedDeliveryAt": "2026-11-19T09:06:50.515Z",
      "idempotencyKey": "sample-key-upi",
      "paymentProviderOrderId": "order_mock_6d7f21aafa12992a",
      "paymentId": "pay_SAMPLE123",
      "cancelReason": null,
      "createdAt": "2026-11-18T09:06:50.517Z",
      "updatedAt": "2026-11-18T09:06:50.532Z",
      "id": "6afd6aaa9d90ebe96ec5db81"
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

`GET /api/v1/admin/orders/6afd6aaa9d90ebe96ec5db42` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261118778CDA4B",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "isVerified": true,
      "createdAt": "2026-11-18T09:06:50.226Z",
      "id": "6afd6aaa9d90ebe96ec5daed"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd6aa99d90ebe96ec5da9b",
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
      "createdAt": "2026-11-18T09:06:50.348Z",
      "updatedAt": "2026-11-18T09:06:50.348Z",
      "id": "6afd6aaa9d90ebe96ec5db13"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "delivered",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T09:06:50.410Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-18T09:06:50.425Z",
        "note": "Packing started"
      },
      {
        "status": "delivered",
        "at": "2026-11-18T09:06:50.445Z",
        "note": "Delivered"
      }
    ],
    "expectedDeliveryAt": "2026-11-19T09:06:50.410Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "createdAt": "2026-11-18T09:06:50.412Z",
    "updatedAt": "2026-11-18T09:06:50.446Z",
    "id": "6afd6aaa9d90ebe96ec5db42"
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
        "id": "6afd6aa99d90ebe96ec5da5b"
      },
      "brand": "Farm Fresh",
      "images": [],
      "mrp": 4000,
      "price": 3200,
      "unit": "1 kg",
      "stock": 120,
      "ratingAvg": 0,
      "ratingCount": 0,
      "tags": [
        "onion",
        "vegetable"
      ],
      "isActive": false,
      "createdAt": "2026-11-18T09:06:49.873Z",
      "updatedAt": "2026-11-18T09:06:50.570Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6afd6aa99d90ebe96ec5da87"
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
      "createdAt": "2026-11-18T09:06:49.821Z",
      "updatedAt": "2026-11-18T09:06:49.821Z",
      "id": "6afd6aa99d90ebe96ec5da5b"
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
      "createdAt": "2026-11-18T09:06:49.842Z",
      "updatedAt": "2026-11-18T09:06:49.842Z",
      "id": "6afd6aa99d90ebe96ec5da6a"
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
      "createdAt": "2026-11-18T09:06:50.248Z",
      "updatedAt": "2026-11-18T09:06:50.248Z",
      "id": "6afd6aaa9d90ebe96ec5daf4"
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
    "updatedAt": "2026-11-18T09:06:50.304Z"
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
    "updatedAt": "2026-11-18T09:06:50.605Z"
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
      "createdAt": "2026-11-18T09:06:49.939Z",
      "updatedAt": "2026-11-18T09:06:49.939Z",
      "id": "6afd6aa99d90ebe96ec5dadd"
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
      "createdAt": "2026-11-18T09:06:49.939Z",
      "updatedAt": "2026-11-18T09:06:49.939Z",
      "id": "6afd6aa99d90ebe96ec5dadc"
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
    "createdAt": "2026-11-18T09:06:50.615Z",
    "updatedAt": "2026-11-18T09:06:50.615Z",
    "id": "6afd6aaa9d90ebe96ec5dbb5"
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
        "productId": "6afd6aa99d90ebe96ec5dabf",
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
