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
    "expiresAt": "2026-11-18T10:08:33.362Z",
    "ttlMinutes": 5,
    "code": "865744"
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
      "createdAt": "2026-11-18T10:03:33.426Z",
      "updatedAt": "2026-11-18T10:03:33.426Z",
      "id": "6afd77f55a269774363ae7cc"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWZkNzdmNTVhMjY5Nzc0MzYzYWU3Y2MiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3OTQ5OTYyMTMsImV4cCI6MTc5NDk5NzExM30.fHcNri0FVDCP7AjyQpIKJR-iGM0fEfaxeGGsnSTtw7s",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWZkNzdmNTVhMjY5Nzc0MzYzYWU3Y2MiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3OTQ5OTYyMTMsImV4cCI6MTc5NzU4ODIxMywianRpIjoiMjY4OTM1YTMtMGY1NC00YWEyLThlYmYtODBkY2UyZWUwYjc1In0.0Fis8fDE7ZtExNEPSUoJiZLT8mmfhleYz6cikXWfIUg",
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
    "createdAt": "2026-11-18T10:03:33.426Z",
    "updatedAt": "2026-11-18T10:03:33.426Z",
    "id": "6afd77f55a269774363ae7cc"
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
      "createdAt": "2026-11-18T10:03:33.030Z",
      "updatedAt": "2026-11-18T10:03:33.030Z",
      "id": "6afd77f55a269774363ae736"
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
      "createdAt": "2026-11-18T10:03:33.052Z",
      "updatedAt": "2026-11-18T10:03:33.052Z",
      "id": "6afd77f55a269774363ae745"
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
      "createdAt": "2026-11-18T10:03:33.446Z",
      "updatedAt": "2026-11-18T10:03:33.446Z",
      "id": "6afd77f55a269774363ae7d3"
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
      "category": "6afd77f55a269774363ae736",
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
      "createdAt": "2026-11-18T10:03:33.083Z",
      "updatedAt": "2026-11-18T10:03:33.083Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6afd77f55a269774363ae76a"
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
      "category": "6afd77f55a269774363ae736",
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
      "createdAt": "2026-11-18T10:03:33.078Z",
      "updatedAt": "2026-11-18T10:03:33.078Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6afd77f55a269774363ae766"
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
      "category": "6afd77f55a269774363ae756",
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
      "createdAt": "2026-11-18T10:03:33.093Z",
      "updatedAt": "2026-11-18T10:03:33.093Z",
      "discountPercent": 9,
      "inStock": true,
      "id": "6afd77f55a269774363ae77a"
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
      "id": "6afd77f55a269774363ae756"
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
    "createdAt": "2026-11-18T10:03:33.093Z",
    "updatedAt": "2026-11-18T10:03:33.093Z",
    "discountPercent": 9,
    "inStock": true,
    "id": "6afd77f55a269774363ae77a"
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
      "id": "6afd77f55a269774363ae77a",
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
    "createdAt": "2026-11-18T10:03:33.521Z",
    "updatedAt": "2026-11-18T10:03:33.521Z",
    "id": "6afd77f55a269774363ae7f2"
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
      "createdAt": "2026-11-18T10:03:33.521Z",
      "updatedAt": "2026-11-18T10:03:33.521Z",
      "id": "6afd77f55a269774363ae7f2"
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
        "productId": "6afd77f55a269774363ae77a",
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
        "productId": "6afd77f55a269774363ae77a",
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
    "orderNumber": "AALI2611182A0FE1AE",
    "user": "6afd77f55a269774363ae7cc",
    "items": [
      {
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.521Z",
      "updatedAt": "2026-11-18T10:03:33.521Z",
      "id": "6afd77f55a269774363ae7f2"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.583Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.583Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-18T10:03:33.585Z",
    "updatedAt": "2026-11-18T10:03:33.585Z",
    "id": "6afd77f55a269774363ae821",
    "deliveryOtp": "8083",
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
      "orderNumber": "AALI2611182A0FE1AE",
      "user": "6afd77f55a269774363ae7cc",
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6afd77f55a269774363ae77a",
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
        "createdAt": "2026-11-18T10:03:33.521Z",
        "updatedAt": "2026-11-18T10:03:33.521Z",
        "id": "6afd77f55a269774363ae7f2"
      },
      "paymentMethod": "cod",
      "paymentStatus": "pending",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-18T10:03:33.583Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-18T10:03:33.596Z",
          "note": "Packing started"
        }
      ],
      "expectedDeliveryAt": "2026-11-19T10:03:33.583Z",
      "idempotencyKey": "sample-key-1",
      "paymentProviderOrderId": null,
      "paymentId": null,
      "cancelReason": null,
      "deliveryNote": "",
      "rider": null,
      "cashCollected": null,
      "createdAt": "2026-11-18T10:03:33.585Z",
      "updatedAt": "2026-11-18T10:03:33.597Z",
      "id": "6afd77f55a269774363ae821"
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

`GET /api/v1/orders/6afd77f55a269774363ae821` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI2611182A0FE1AE",
    "user": "6afd77f55a269774363ae7cc",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.521Z",
      "updatedAt": "2026-11-18T10:03:33.521Z",
      "id": "6afd77f55a269774363ae7f2"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.583Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-18T10:03:33.596Z",
        "note": "Packing started"
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.583Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-18T10:03:33.585Z",
    "updatedAt": "2026-11-18T10:03:33.597Z",
    "id": "6afd77f55a269774363ae821",
    "deliveryOtp": "8083"
  },
  "error": null
}
```

## POST /products/:id/reviews

`POST /api/v1/products/6afd77f55a269774363ae77a/reviews` → **201**

```json
{
  "success": true,
  "data": {
    "user": "6afd77f55a269774363ae7cc",
    "product": "6afd77f55a269774363ae77a",
    "order": "6afd77f55a269774363ae821",
    "rating": 5,
    "comment": "Great quality atta.",
    "createdAt": "2026-11-18T10:03:33.624Z",
    "updatedAt": "2026-11-18T10:03:33.624Z",
    "id": "6afd77f55a269774363ae839"
  },
  "error": null
}
```

## GET /products/:id/reviews

`GET /api/v1/products/6afd77f55a269774363ae77a/reviews` → **200**

```json
{
  "success": true,
  "data": [
    {
      "user": {
        "name": "Ritesh",
        "id": "6afd77f55a269774363ae7cc"
      },
      "product": "6afd77f55a269774363ae77a",
      "order": "6afd77f55a269774363ae821",
      "rating": 5,
      "comment": "Great quality atta.",
      "createdAt": "2026-11-18T10:03:33.624Z",
      "updatedAt": "2026-11-18T10:03:33.624Z",
      "id": "6afd77f55a269774363ae839"
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
    "user": "6afd77f55a269774363ae7cc",
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
        "category": "6afd77f55a269774363ae75e",
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
        "createdAt": "2026-11-18T10:03:33.117Z",
        "updatedAt": "2026-11-18T10:03:33.117Z",
        "discountPercent": 10,
        "inStock": true,
        "id": "6afd77f55a269774363ae79e"
      }
    ],
    "createdAt": "2026-11-18T10:03:33.637Z",
    "updatedAt": "2026-11-18T10:03:33.639Z",
    "id": "6afd77f55a269774363ae843"
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
      "startsAt": "2026-11-18T10:03:33.132Z",
      "expiresAt": "2027-11-17T18:30:00.000Z",
      "usageLimit": 10000,
      "perUserLimit": 1,
      "usedCount": 1,
      "isActive": true,
      "createdAt": "2026-11-18T10:03:33.134Z",
      "updatedAt": "2026-11-18T10:03:33.586Z",
      "id": "6afd77f55a269774363ae7b6"
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
    "orderNumber": "AALI261118163E3501",
    "user": "6afd77f55a269774363ae7cc",
    "items": [
      {
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.521Z",
      "updatedAt": "2026-11-18T10:03:33.521Z",
      "id": "6afd77f55a269774363ae7f2"
    },
    "paymentMethod": "upi",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.675Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.675Z",
    "idempotencyKey": "sample-key-upi",
    "paymentProviderOrderId": "order_mock_8f30cc5fa7e7b828",
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-18T10:03:33.676Z",
    "updatedAt": "2026-11-18T10:03:33.679Z",
    "id": "6afd77f55a269774363ae860",
    "deliveryOtp": "2683",
    "payment": {
      "provider": "mock",
      "keyId": null,
      "providerOrderId": "order_mock_8f30cc5fa7e7b828",
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
    "orderNumber": "AALI261118163E3501",
    "user": "6afd77f55a269774363ae7cc",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.521Z",
      "updatedAt": "2026-11-18T10:03:33.521Z",
      "id": "6afd77f55a269774363ae7f2"
    },
    "paymentMethod": "upi",
    "paymentStatus": "paid",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.675Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-18T10:03:33.687Z",
        "note": "Payment verified"
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.675Z",
    "idempotencyKey": "sample-key-upi",
    "paymentProviderOrderId": "order_mock_8f30cc5fa7e7b828",
    "paymentId": "pay_SAMPLE123",
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-18T10:03:33.676Z",
    "updatedAt": "2026-11-18T10:03:33.688Z",
    "id": "6afd77f55a269774363ae860",
    "payment": {
      "provider": "mock",
      "keyId": null,
      "providerOrderId": "order_mock_8f30cc5fa7e7b828",
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
      "id": "6afd77f55a269774363ae7cc",
      "name": "Ritesh",
      "mobile": "9876543210",
      "email": null,
      "isVerified": true,
      "ordersCount": 2,
      "createdAt": "2026-11-18T10:03:33.426Z"
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
      "orderNumber": "AALI261118163E3501",
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afd77f55a269774363ae7cc"
      },
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6afd77f55a269774363ae77a",
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
        "createdAt": "2026-11-18T10:03:33.521Z",
        "updatedAt": "2026-11-18T10:03:33.521Z",
        "id": "6afd77f55a269774363ae7f2"
      },
      "paymentMethod": "upi",
      "paymentStatus": "paid",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-18T10:03:33.675Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-18T10:03:33.687Z",
          "note": "Payment verified"
        }
      ],
      "expectedDeliveryAt": "2026-11-19T10:03:33.675Z",
      "idempotencyKey": "sample-key-upi",
      "paymentProviderOrderId": "order_mock_8f30cc5fa7e7b828",
      "paymentId": "pay_SAMPLE123",
      "cancelReason": null,
      "deliveryNote": "",
      "rider": null,
      "cashCollected": null,
      "createdAt": "2026-11-18T10:03:33.676Z",
      "updatedAt": "2026-11-18T10:03:33.688Z",
      "id": "6afd77f55a269774363ae860"
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

`GET /api/v1/admin/orders/6afd77f55a269774363ae821` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI2611182A0FE1AE",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "isVerified": true,
      "createdAt": "2026-11-18T10:03:33.426Z",
      "id": "6afd77f55a269774363ae7cc"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.521Z",
      "updatedAt": "2026-11-18T10:03:33.521Z",
      "id": "6afd77f55a269774363ae7f2"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "delivered",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.583Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-18T10:03:33.596Z",
        "note": "Packing started"
      },
      {
        "status": "delivered",
        "at": "2026-11-18T10:03:33.615Z",
        "note": "Delivered"
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.583Z",
    "idempotencyKey": "sample-key-1",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-18T10:03:33.585Z",
    "updatedAt": "2026-11-18T10:03:33.616Z",
    "id": "6afd77f55a269774363ae821"
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
        "id": "6afd77f55a269774363ae736"
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
      "createdAt": "2026-11-18T10:03:33.078Z",
      "updatedAt": "2026-11-18T10:03:33.726Z",
      "discountPercent": 20,
      "inStock": true,
      "id": "6afd77f55a269774363ae766"
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
      "createdAt": "2026-11-18T10:03:33.030Z",
      "updatedAt": "2026-11-18T10:03:33.030Z",
      "id": "6afd77f55a269774363ae736"
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
      "createdAt": "2026-11-18T10:03:33.052Z",
      "updatedAt": "2026-11-18T10:03:33.052Z",
      "id": "6afd77f55a269774363ae745"
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
      "createdAt": "2026-11-18T10:03:33.446Z",
      "updatedAt": "2026-11-18T10:03:33.446Z",
      "id": "6afd77f55a269774363ae7d3"
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
    "updatedAt": "2026-11-18T10:03:33.481Z"
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
    "updatedAt": "2026-11-18T10:03:33.758Z"
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
      "createdAt": "2026-11-18T10:03:33.137Z",
      "updatedAt": "2026-11-18T10:03:33.137Z",
      "id": "6afd77f55a269774363ae7bc"
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
      "createdAt": "2026-11-18T10:03:33.137Z",
      "updatedAt": "2026-11-18T10:03:33.137Z",
      "id": "6afd77f55a269774363ae7bb"
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
    "createdAt": "2026-11-18T10:03:33.768Z",
    "updatedAt": "2026-11-18T10:03:33.768Z",
    "id": "6afd77f55a269774363ae895"
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
    "updatedAt": "2026-11-18T10:03:33.775Z"
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
    "createdAt": "2026-11-18T10:03:33.784Z",
    "updatedAt": "2026-11-18T10:03:33.784Z",
    "id": "6afd77f55a269774363ae89d"
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
    "orderNumber": "AALI2611182A72DAA7",
    "user": "6afd77f55a269774363ae7cc",
    "items": [
      {
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.784Z",
      "updatedAt": "2026-11-18T10:03:33.784Z",
      "id": "6afd77f55a269774363ae89d"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.807Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.807Z",
    "idempotencyKey": "sample-key-note",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "Ring the bell twice, leave with the guard",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-18T10:03:33.809Z",
    "updatedAt": "2026-11-18T10:03:33.809Z",
    "id": "6afd77f55a269774363ae8b4",
    "deliveryOtp": "0011",
    "payment": null
  },
  "error": null
}
```

## GET /orders/:id (customer view: includes deliveryOtp)

`GET /api/v1/orders/6afd77f55a269774363ae8b4` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI2611182A72DAA7",
    "user": "6afd77f55a269774363ae7cc",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.784Z",
      "updatedAt": "2026-11-18T10:03:33.784Z",
      "id": "6afd77f55a269774363ae89d"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.807Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.807Z",
    "idempotencyKey": "sample-key-note",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "Ring the bell twice, leave with the guard",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-18T10:03:33.809Z",
    "updatedAt": "2026-11-18T10:03:33.809Z",
    "id": "6afd77f55a269774363ae8b4",
    "deliveryOtp": "0011"
  },
  "error": null
}
```

## POST /orders/:id/payment (pay again with a fresh gateway order)

`POST /api/v1/orders/6afd77f55a269774363ae8d1/payment` → **200**

```json
{
  "success": true,
  "data": {
    "payment": {
      "provider": "mock",
      "keyId": null,
      "providerOrderId": "order_mock_076c91f9a931a3f1",
      "amount": 25400,
      "currency": "INR"
    }
  },
  "error": null
}
```

## PATCH /orders/:id/payment-method (switch to cash on delivery)

`PATCH /api/v1/orders/6afd77f55a269774363ae8d1/payment-method` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI2611183F49DAE5",
    "user": "6afd77f55a269774363ae7cc",
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.784Z",
      "updatedAt": "2026-11-18T10:03:33.784Z",
      "id": "6afd77f55a269774363ae89d"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "placed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.842Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.842Z",
    "idempotencyKey": "sample-key-retry",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "",
    "rider": null,
    "cashCollected": null,
    "createdAt": "2026-11-18T10:03:33.844Z",
    "updatedAt": "2026-11-18T10:03:33.863Z",
    "id": "6afd77f55a269774363ae8d1",
    "deliveryOtp": "9511",
    "payment": null
  },
  "error": null
}
```

## POST /orders/:id/payment on a COD order -> error PAYMENT_NOT_RETRYABLE

`POST /api/v1/orders/6afd77f55a269774363ae8d1/payment` → **400**

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

`POST /api/v1/orders/6afd77f55a269774363ae903/reorder` → **200**

```json
{
  "success": true,
  "data": {
    "cart": {
      "items": [
        {
          "productId": "6afd77f55a269774363ae77a",
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
        "productId": "6afd77f55a269774363ae77a",
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "reason": "qty_reduced",
        "requested": 2,
        "added": 1
      },
      {
        "productId": "6afd77f55a269774363ae79e",
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
    "id": "6afd77f55a269774363ae91e",
    "name": "Ramesh Kumar",
    "mobile": "9877700001",
    "isActive": true,
    "activeOrders": 0,
    "createdAt": "2026-11-18T10:03:33.927Z"
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
      "id": "6afd77f55a269774363ae91e",
      "name": "Ramesh Kumar",
      "mobile": "9877700001",
      "isActive": true,
      "activeOrders": 0,
      "createdAt": "2026-11-18T10:03:33.927Z"
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

`PATCH /api/v1/admin/riders/6afd77f55a269774363ae91e` → **200**

```json
{
  "success": true,
  "data": {
    "id": "6afd77f55a269774363ae91e",
    "name": "Ramesh Yadav",
    "mobile": "9877700001",
    "isActive": true,
    "activeOrders": 0,
    "createdAt": "2026-11-18T10:03:33.927Z"
  },
  "error": null
}
```

## PATCH /admin/orders/:id/assign (order.rider populated; no deliveryOtp)

`PATCH /api/v1/admin/orders/6afd77f55a269774363ae8b4/assign` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI2611182A72DAA7",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "id": "6afd77f55a269774363ae7cc"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.784Z",
      "updatedAt": "2026-11-18T10:03:33.784Z",
      "id": "6afd77f55a269774363ae89d"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "confirmed",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.807Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-18T10:03:33.945Z",
        "note": ""
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.807Z",
    "idempotencyKey": "sample-key-note",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "Ring the bell twice, leave with the guard",
    "rider": {
      "mobile": "9877700001",
      "name": "Ramesh Yadav",
      "id": "6afd77f55a269774363ae91e"
    },
    "cashCollected": null,
    "createdAt": "2026-11-18T10:03:33.809Z",
    "updatedAt": "2026-11-18T10:03:33.953Z",
    "id": "6afd77f55a269774363ae8b4"
  },
  "error": null
}
```

## GET /admin/orders?q=<orderNumber> (rider { id, name, mobile } populated)

`GET /api/v1/admin/orders?q=AALI2611182A72DAA7` → **200**

```json
{
  "success": true,
  "data": [
    {
      "orderNumber": "AALI2611182A72DAA7",
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afd77f55a269774363ae7cc"
      },
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6afd77f55a269774363ae77a",
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
        "createdAt": "2026-11-18T10:03:33.784Z",
        "updatedAt": "2026-11-18T10:03:33.784Z",
        "id": "6afd77f55a269774363ae89d"
      },
      "paymentMethod": "cod",
      "paymentStatus": "pending",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-18T10:03:33.807Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-18T10:03:33.945Z",
          "note": ""
        }
      ],
      "expectedDeliveryAt": "2026-11-19T10:03:33.807Z",
      "idempotencyKey": "sample-key-note",
      "paymentProviderOrderId": null,
      "paymentId": null,
      "cancelReason": null,
      "deliveryNote": "Ring the bell twice, leave with the guard",
      "rider": {
        "mobile": "9877700001",
        "name": "Ramesh Yadav",
        "id": "6afd77f55a269774363ae91e"
      },
      "cashCollected": null,
      "createdAt": "2026-11-18T10:03:33.809Z",
      "updatedAt": "2026-11-18T10:03:33.953Z",
      "id": "6afd77f55a269774363ae8b4"
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
      "orderNumber": "AALI2611182A72DAA7",
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afd77f55a269774363ae7cc"
      },
      "items": [
        {
          "title": {
            "en": "Aata (Whole Wheat Flour)",
            "hi": "आटा (गेहूं का आटा)"
          },
          "product": "6afd77f55a269774363ae77a",
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
        "createdAt": "2026-11-18T10:03:33.784Z",
        "updatedAt": "2026-11-18T10:03:33.784Z",
        "id": "6afd77f55a269774363ae89d"
      },
      "paymentMethod": "cod",
      "paymentStatus": "pending",
      "status": "confirmed",
      "statusHistory": [
        {
          "status": "placed",
          "at": "2026-11-18T10:03:33.807Z",
          "note": ""
        },
        {
          "status": "confirmed",
          "at": "2026-11-18T10:03:33.945Z",
          "note": ""
        }
      ],
      "expectedDeliveryAt": "2026-11-19T10:03:33.807Z",
      "idempotencyKey": "sample-key-note",
      "paymentProviderOrderId": null,
      "paymentId": null,
      "cancelReason": null,
      "deliveryNote": "Ring the bell twice, leave with the guard",
      "rider": "6afd77f55a269774363ae91e",
      "cashCollected": null,
      "createdAt": "2026-11-18T10:03:33.809Z",
      "updatedAt": "2026-11-18T10:03:33.953Z",
      "id": "6afd77f55a269774363ae8b4"
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

`PATCH /api/v1/rider/orders/6afd77f55a269774363ae8b4/out-for-delivery` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI2611182A72DAA7",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "id": "6afd77f55a269774363ae7cc"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.784Z",
      "updatedAt": "2026-11-18T10:03:33.784Z",
      "id": "6afd77f55a269774363ae89d"
    },
    "paymentMethod": "cod",
    "paymentStatus": "pending",
    "status": "out_for_delivery",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.807Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-18T10:03:33.945Z",
        "note": ""
      },
      {
        "status": "out_for_delivery",
        "at": "2026-11-18T10:03:34.100Z",
        "note": "Out for delivery with rider"
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.807Z",
    "idempotencyKey": "sample-key-note",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "Ring the bell twice, leave with the guard",
    "rider": "6afd77f55a269774363ae91e",
    "cashCollected": null,
    "createdAt": "2026-11-18T10:03:33.809Z",
    "updatedAt": "2026-11-18T10:03:34.100Z",
    "id": "6afd77f55a269774363ae8b4"
  },
  "error": null
}
```

## POST /rider/orders/:id/deliver -> error INVALID_DELIVERY_OTP

`POST /api/v1/rider/orders/6afd77f55a269774363ae8b4/deliver` → **400**

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

`POST /api/v1/rider/orders/6afd77f55a269774363ae8b4/deliver` → **200**

```json
{
  "success": true,
  "data": {
    "orderNumber": "AALI2611182A72DAA7",
    "user": {
      "mobile": "9876543210",
      "name": "Ritesh",
      "id": "6afd77f55a269774363ae7cc"
    },
    "items": [
      {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "product": "6afd77f55a269774363ae77a",
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
      "createdAt": "2026-11-18T10:03:33.784Z",
      "updatedAt": "2026-11-18T10:03:33.784Z",
      "id": "6afd77f55a269774363ae89d"
    },
    "paymentMethod": "cod",
    "paymentStatus": "paid",
    "status": "delivered",
    "statusHistory": [
      {
        "status": "placed",
        "at": "2026-11-18T10:03:33.807Z",
        "note": ""
      },
      {
        "status": "confirmed",
        "at": "2026-11-18T10:03:33.945Z",
        "note": ""
      },
      {
        "status": "out_for_delivery",
        "at": "2026-11-18T10:03:34.100Z",
        "note": "Out for delivery with rider"
      },
      {
        "status": "delivered",
        "at": "2026-11-18T10:03:34.119Z",
        "note": "Delivered (OTP verified)"
      }
    ],
    "expectedDeliveryAt": "2026-11-19T10:03:33.807Z",
    "idempotencyKey": "sample-key-note",
    "paymentProviderOrderId": null,
    "paymentId": null,
    "cancelReason": null,
    "deliveryNote": "Ring the bell twice, leave with the guard",
    "rider": "6afd77f55a269774363ae91e",
    "cashCollected": 25400,
    "createdAt": "2026-11-18T10:03:33.809Z",
    "updatedAt": "2026-11-18T10:03:34.119Z",
    "id": "6afd77f55a269774363ae8b4"
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
      "period": "2026-11-18",
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
      "productId": "6afd77f55a269774363ae77a",
      "title": {
        "en": "Aata (Whole Wheat Flour)",
        "hi": "आटा (गेहूं का आटा)"
      },
      "qtySold": 6,
      "revenue": 149400
    },
    {
      "productId": "6afd77f55a269774363ae79e",
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

## GET /admin/reports/cod?date=2026-11-18

`GET /api/v1/admin/reports/cod?date=2026-11-18` → **200**

```json
{
  "success": true,
  "data": {
    "date": "2026-11-18",
    "totalExpected": 45800,
    "totalCollected": 25400,
    "byRider": [
      {
        "rider": {
          "id": "6afd77f55a269774363ae91e",
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

`GET /api/v1/admin/orders/latest?since=2026-11-18T09%3A03%3A34.139Z` → **200**

```json
{
  "success": true,
  "data": {
    "count": 5,
    "orders": [
      {
        "id": "6afd77f55a269774363ae903",
        "orderNumber": "AALI261118972C821F",
        "total": 52100,
        "createdAt": "2026-11-18T10:03:33.899Z"
      },
      {
        "id": "6afd77f55a269774363ae8d1",
        "orderNumber": "AALI2611183F49DAE5",
        "total": 25400,
        "createdAt": "2026-11-18T10:03:33.844Z"
      },
      {
        "id": "6afd77f55a269774363ae8b4",
        "orderNumber": "AALI2611182A72DAA7",
        "total": 25400,
        "createdAt": "2026-11-18T10:03:33.809Z"
      },
      {
        "id": "6afd77f55a269774363ae860",
        "orderNumber": "AALI261118163E3501",
        "total": 25400,
        "createdAt": "2026-11-18T10:03:33.676Z"
      },
      {
        "id": "6afd77f55a269774363ae821",
        "orderNumber": "AALI2611182A0FE1AE",
        "total": 20400,
        "createdAt": "2026-11-18T10:03:33.585Z"
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
        "id": "6afd77f55a269774363ae768",
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

_Content-Type: text/csv; charset=utf-8 · Content-Disposition: attachment; filename="products-2026-11-18.csv" · the file starts with a UTF-8 BOM so Excel shows Hindi correctly · money columns are paise_

```csv
id,slug,title_en,title_hi,category_slug,brand,unit,mrp,price,stock,isActive
6afd77f55a269774363ae766,fresh-onion,Fresh Onion,ताज़ा प्याज़,fruits-vegetables,Farm Fresh,1 kg,4000,2000,90,false
6afd77f55a269774363ae768,potato,Potato,आलू,fruits-vegetables,Farm Fresh,1 kg,3000,2500,150,true
6afd77f55a269774363ae76a,tomato,Tomato,टमाटर,fruits-vegetables,Farm Fresh,1 kg,3500,2800,100,true
6afd77f55a269774363ae76c,banana,Banana,केला,fruits-vegetables,Farm Fresh,6 pcs,3600,3000,90,true
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

## GET /admin/reviews

`GET /api/v1/admin/reviews` → **200**

```json
{
  "success": true,
  "data": [
    {
      "user": {
        "mobile": "9876543210",
        "name": "Ritesh",
        "id": "6afd77f55a269774363ae7cc"
      },
      "product": {
        "title": {
          "en": "Aata (Whole Wheat Flour)",
          "hi": "आटा (गेहूं का आटा)"
        },
        "slug": "aata-whole-wheat-flour",
        "discountPercent": 0,
        "inStock": false,
        "id": "6afd77f55a269774363ae77a"
      },
      "order": "6afd77f55a269774363ae821",
      "rating": 5,
      "comment": "Great quality atta.",
      "createdAt": "2026-11-18T10:03:33.624Z",
      "updatedAt": "2026-11-18T10:03:33.624Z",
      "id": "6afd77f55a269774363ae839"
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

## DELETE /admin/reviews/:id (ratingAvg / ratingCount recalculated)

`DELETE /api/v1/admin/reviews/6afd77f55a269774363ae839` → **200**

```json
{
  "success": true,
  "data": {
    "id": "6afd77f55a269774363ae839",
    "product": {
      "id": "6afd77f55a269774363ae77a",
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
    "publicKey": "BAk8OT0CYoVLMOG33HewJz9QMvXyZFl1j1ucXCXX1B2vos90cdsMX9tw6HQJmeXFPDdJRtcyhJvsHDABFLD9dpE"
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
    "id": "6afd77f6da222d5141f2b302",
    "endpoint": "https://fcm.googleapis.com/fcm/send/dMq1-example-device-token",
    "createdAt": "2026-11-18T10:03:34.203Z"
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
  "body": "Your order is confirmed / आपका ऑर्डर कन्फर्म हो गया है (#AALI2611183F49DAE5)",
  "url": "/orders/6afd77f55a269774363ae8d1"
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
        "productId": "6afd77f55a269774363ae79e",
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
