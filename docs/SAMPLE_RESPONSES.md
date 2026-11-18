# Aali Market — real sample responses

Captured by `npm run samples` (scripts/capture-samples.js) — the actual app, in-memory MongoDB, seed data. IDs/timestamps/tokens differ on every run. Arrays are trimmed to 2 items for readability.

> **Not captured:** `POST /admin/uploads` — it uploads to real S3, which needs credentials. Its response shape is documented in docs/BACKEND_REFERENCE.md.

## POST /auth/otp/send

`POST /api/v1/auth/otp/send` → **200**

```json
{
  "success": true,
  "data": {
    "mobile": "9876543210",
    "expiresAt": "2026-11-14T07:12:36.807Z",
    "ttlMinutes": 5,
    "code": "814566"
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
      "createdAt": "2026-11-14T07:07:36.871Z",
      "updatedAt": "2026-11-14T07:07:36.871Z",
      "id": "6af808b84584c783f4070c1b"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWY4MDhiODQ1ODRjNzgzZjQwNzBjMWIiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3OTQ2NDAwNTYsImV4cCI6MTc5NDY0MDk1Nn0.vFB7CAGaI_s2KxagRq4lx1O0OQeT9t4C_cwzs26kWdw",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWY4MDhiODQ1ODRjNzgzZjQwNzBjMWIiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3OTQ2NDAwNTYsImV4cCI6MTc5NzIzMjA1NiwianRpIjoiMGMzZjBhYWQtNWY0Yi00YTNlLTljNGUtZjM0MTFhY2ZmN2FkIn0.eV9-alsqTxTQdpVF6ROK8svZvEJufEGuUvQhQ6-IuF0",
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
    "createdAt": "2026-11-14T07:07:36.871Z",
    "updatedAt": "2026-11-14T07:07:36.871Z",
    "id": "6af808b84584c783f4070c1b"
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
      "createdAt": "2026-11-14T07:07:36.475Z",
      "updatedAt": "2026-11-14T07:07:36.475Z",
      "id": "6af808b84584c783f4070b89"
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
      "createdAt": "2026-11-14T07:07:36.498Z",
      "updatedAt": "2026-11-14T07:07:36.498Z",
      "id": "6af808b84584c783f4070b99"
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
      "createdAt": "2026-11-14T07:07:36.892Z",
      "updatedAt": "2026-11-14T07:07:36.892Z",
      "id": "6af808b84584c783f4070c22"
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
      "category": "6af808b84584c783f4070b89",
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
      "createdAt": "2026-11-14T07:07:36.530Z",
      "updatedAt": "2026-11-14T07:07:36.530Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6af808b84584c783f4070bb9"
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
      "category": "6af808b84584c783f4070b89",
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
      "createdAt": "2026-11-14T07:07:36.525Z",
      "updatedAt": "2026-11-14T07:07:36.525Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6af808b84584c783f4070bb5"
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
      "category": "6af808b84584c783f4070ba6",
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
      "createdAt": "2026-11-14T07:07:36.541Z",
      "updatedAt": "2026-11-14T07:07:36.541Z",
      "discountPercent": 9,
      "inStock": true,
      "id": "6af808b84584c783f4070bc9"
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
      "id": "6af808b84584c783f4070ba6"
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
    "createdAt": "2026-11-14T07:07:36.541Z",
    "updatedAt": "2026-11-14T07:07:36.541Z",
    "discountPercent": 9,
    "inStock": true,
    "id": "6af808b84584c783f4070bc9"
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
      "id": "6af808b84584c783f4070bc9",
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
    "createdAt": "2026-11-14T07:07:36.973Z",
    "updatedAt": "2026-11-14T07:07:36.973Z",
    "id": "6af808b84584c783f4070c41"
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
      "createdAt": "2026-11-14T07:07:36.973Z",
      "updatedAt": "2026-11-14T07:07:36.973Z",
      "id": "6af808b84584c783f4070c41"
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
        "productId": "6af808b84584c783f4070bc9",
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
        "productId": "6af808b84584c783f4070bc9",
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
    "orderNumber": "AALI261114939B19A5",
    "user": "6af808b84584c783f4070c1b",
    "items": [
      {
        "product": "6af808b84584c783f4070bc9",
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
      "createdAt": "2026-11-14T07:07:36.973Z",
      "updatedAt": "2026-11-14T07:07:36.973Z",
      "id": "6af808b84584c783f4070c41"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-14T07:07:37.039Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-15T07:07:37.039Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "createdAt": "2026-11-14T07:07:37.041Z",
    "updatedAt": "2026-11-14T07:07:37.041Z",
    "id": "6af808b94584c783f4070c70",
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
      "orderNumber": "AALI261114939B19A5",
      "user": "6af808b84584c783f4070c1b",
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6af808b84584c783f4070bc9",
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
        "createdAt": "2026-11-14T07:07:36.973Z",
        "updatedAt": "2026-11-14T07:07:36.973Z",
        "id": "6af808b84584c783f4070c41"
      },
      "paymentMethod": "cod",
      "paymentStatus": "pending",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-14T07:07:37.039Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-14T07:07:37.052Z",
          "note": "Packing started"
        }
      ],
      "expectedDeliveryAt": "2026-11-15T07:07:37.039Z",
      "idempotencyKey": "sample-key-1",
      "paymentProviderOrderId": null,
      "paymentId": null,
      "cancelReason": null,
      "createdAt": "2026-11-14T07:07:37.041Z",
      "updatedAt": "2026-11-14T07:07:37.053Z",
      "id": "6af808b94584c783f4070c70"
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

`GET /api/v1/orders/6af808b94584c783f4070c70` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261114939B19A5",
    "user": "6af808b84584c783f4070c1b",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6af808b84584c783f4070bc9",
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
      "createdAt": "2026-11-14T07:07:36.973Z",
      "updatedAt": "2026-11-14T07:07:36.973Z",
      "id": "6af808b84584c783f4070c41"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-14T07:07:37.039Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-14T07:07:37.052Z",
        "note": "Packing started"
      }
    ],
    "expectedDeliveryAt": "2026-11-15T07:07:37.039Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "createdAt": "2026-11-14T07:07:37.041Z",
    "updatedAt": "2026-11-14T07:07:37.053Z",
    "id": "6af808b94584c783f4070c70"
  },
  "error": null
}
```

## POST /products/:id/reviews

`POST /api/v1/products/6af808b84584c783f4070bc9/reviews` → **201**

```json
{
  "success": true,
  "data": {
    "user": "6af808b84584c783f4070c1b",
    "product": "6af808b84584c783f4070bc9",
    "order": "6af808b94584c783f4070c70",
    "rating": 5,
    "comment": "Great quality atta.",
    "createdAt": "2026-11-14T07:07:37.082Z",
    "updatedAt": "2026-11-14T07:07:37.082Z",
    "id": "6af808b94584c783f4070c88"
  },
  "error": null
}
```

## GET /products/:id/reviews

`GET /api/v1/products/6af808b84584c783f4070bc9/reviews` → **200**

```json
{
  "success": true,
  "data": [
    {
      "user": {
        "name": "Ritesh",
        "id": "6af808b84584c783f4070c1b"
      },
      "product": "6af808b84584c783f4070bc9",
      "order": "6af808b94584c783f4070c70",
      "rating": 5,
      "comment": "Great quality atta.",
      "createdAt": "2026-11-14T07:07:37.082Z",
      "updatedAt": "2026-11-14T07:07:37.082Z",
      "id": "6af808b94584c783f4070c88"
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
    "user": "6af808b84584c783f4070c1b",
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
        "category": "6af808b84584c783f4070bac",
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
        "createdAt": "2026-11-14T07:07:36.566Z",
        "updatedAt": "2026-11-14T07:07:36.566Z",
        "discountPercent": 10,
        "inStock": true,
        "id": "6af808b84584c783f4070bed"
      }
    ],
    "createdAt": "2026-11-14T07:07:37.096Z",
    "updatedAt": "2026-11-14T07:07:37.097Z",
    "id": "6af808b94584c783f4070c92"
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
      "startsAt": "2026-11-14T07:07:36.582Z",
      "expiresAt": "2027-11-13T18:30:00.000Z",
      "usageLimit": 10000,
      "perUserLimit": 1,
      "usedCount": 1,
      "isActive": true,
      "createdAt": "2026-11-14T07:07:36.583Z",
      "updatedAt": "2026-11-14T07:07:37.043Z",
      "id": "6af808b84584c783f4070c05"
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
    "orderNumber": "AALI261114EB0E11CF",
    "user": "6af808b84584c783f4070c1b",
    "items": [
      {
        "product": "6af808b84584c783f4070bc9",
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
      "createdAt": "2026-11-14T07:07:36.973Z",
      "updatedAt": "2026-11-14T07:07:36.973Z",
      "id": "6af808b84584c783f4070c41"
    },
    "paymentMethod": "upi",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-14T07:07:37.133Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-15T07:07:37.133Z",
    "idempotencyKey": "sample-key-upi",
    "paymentProviderOrderId": "order_mock_5d177aceaa72b769",
    "paymentId": null,
    "cancelReason": null,
    "createdAt": "2026-11-14T07:07:37.134Z",
    "updatedAt": "2026-11-14T07:07:37.137Z",
    "id": "6af808b94584c783f4070caf",
    "payment": {
      "provider": "mock",
      "keyId": null,
      "providerOrderId": "order_mock_5d177aceaa72b769",
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
    "orderNumber": "AALI261114EB0E11CF",
    "user": "6af808b84584c783f4070c1b",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6af808b84584c783f4070bc9",
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
      "createdAt": "2026-11-14T07:07:36.973Z",
      "updatedAt": "2026-11-14T07:07:36.973Z",
      "id": "6af808b84584c783f4070c41"
    },
    "paymentMethod": "upi",
    "paymentStatus": "paid",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-14T07:07:37.133Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-14T07:07:37.146Z",
        "note": "Payment verified"
      }
    ],
    "expectedDeliveryAt": "2026-11-15T07:07:37.133Z",
    "idempotencyKey": "sample-key-upi",
    "paymentProviderOrderId": "order_mock_5d177aceaa72b769",
    "paymentId": "pay_SAMPLE123",
    "cancelReason": null,
    "createdAt": "2026-11-14T07:07:37.134Z",
    "updatedAt": "2026-11-14T07:07:37.146Z",
    "id": "6af808b94584c783f4070caf",
    "payment": {
      "provider": "mock",
      "keyId": null,
      "providerOrderId": "order_mock_5d177aceaa72b769",
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
      "id": "6af808b84584c783f4070c1b",
      "name": "Ritesh",
      "mobile": "9876543210",
      "email": null,
      "isVerified": true,
      "ordersCount": 2,
      "createdAt": "2026-11-14T07:07:36.871Z"
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

`GET /api/v1/admin/orders?status=confirmed&from=2026-11-14&q=9876` → **200**

```json
{
  "success": true,
  "data": [
    {
      "orderNumber": "AALI261114EB0E11CF",
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6af808b84584c783f4070c1b"
      },
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6af808b84584c783f4070bc9",
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
        "createdAt": "2026-11-14T07:07:36.973Z",
        "updatedAt": "2026-11-14T07:07:36.973Z",
        "id": "6af808b84584c783f4070c41"
      },
      "paymentMethod": "upi",
      "paymentStatus": "paid",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-14T07:07:37.133Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-14T07:07:37.146Z",
          "note": "Payment verified"
        }
      ],
      "expectedDeliveryAt": "2026-11-15T07:07:37.133Z",
      "idempotencyKey": "sample-key-upi",
      "paymentProviderOrderId": "order_mock_5d177aceaa72b769",
      "paymentId": "pay_SAMPLE123",
      "cancelReason": null,
      "createdAt": "2026-11-14T07:07:37.134Z",
      "updatedAt": "2026-11-14T07:07:37.146Z",
      "id": "6af808b94584c783f4070caf"
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

`GET /api/v1/admin/orders/6af808b94584c783f4070c70` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI261114939B19A5",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "isVerified": true,
      "createdAt": "2026-11-14T07:07:36.871Z",
      "id": "6af808b84584c783f4070c1b"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6af808b84584c783f4070bc9",
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
      "createdAt": "2026-11-14T07:07:36.973Z",
      "updatedAt": "2026-11-14T07:07:36.973Z",
      "id": "6af808b84584c783f4070c41"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "delivered",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-14T07:07:37.039Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-14T07:07:37.052Z",
        "note": "Packing started"
      },
      {
        "status": "delivered",
        "at": "2026-11-14T07:07:37.072Z",
        "note": "Delivered"
      }
    ],
    "expectedDeliveryAt": "2026-11-15T07:07:37.039Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "createdAt": "2026-11-14T07:07:37.041Z",
    "updatedAt": "2026-11-14T07:07:37.073Z",
    "id": "6af808b94584c783f4070c70"
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
        "id": "6af808b84584c783f4070b89"
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
      "createdAt": "2026-11-14T07:07:36.525Z",
      "updatedAt": "2026-11-14T07:07:37.183Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6af808b84584c783f4070bb5"
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
      "createdAt": "2026-11-14T07:07:36.475Z",
      "updatedAt": "2026-11-14T07:07:36.475Z",
      "id": "6af808b84584c783f4070b89"
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
      "createdAt": "2026-11-14T07:07:36.498Z",
      "updatedAt": "2026-11-14T07:07:36.498Z",
      "id": "6af808b84584c783f4070b99"
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
      "createdAt": "2026-11-14T07:07:36.892Z",
      "updatedAt": "2026-11-14T07:07:36.892Z",
      "id": "6af808b84584c783f4070c22"
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
    "updatedAt": "2026-11-14T07:07:36.932Z"
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
    "updatedAt": "2026-11-14T07:07:37.218Z"
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
      "createdAt": "2026-11-14T07:07:36.587Z",
      "updatedAt": "2026-11-14T07:07:36.587Z",
      "id": "6af808b84584c783f4070c0b"
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
      "createdAt": "2026-11-14T07:07:36.587Z",
      "updatedAt": "2026-11-14T07:07:36.587Z",
      "id": "6af808b84584c783f4070c0a"
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
    "createdAt": "2026-11-14T07:07:37.231Z",
    "updatedAt": "2026-11-14T07:07:37.231Z",
    "id": "6af808b94584c783f4070ce3"
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
        "productId": "6af808b84584c783f4070bed",
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
