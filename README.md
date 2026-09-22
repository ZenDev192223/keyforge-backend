# Keyboards Store — Backend API

Node.js + Express backend for a keyboards e-commerce site. Uses SQLite
(via `better-sqlite3`) so there's zero external database setup — the DB is a
single file (`data.sqlite`) created automatically the first time you run it.

Covers everything the frontend (landing page, product page, admin dashboard)
will need: product catalog, checkout/orders, admin auth, and analytics
endpoints for dashboard charts.

## 1. Setup

```bash
cd keyboards-backend
npm install
cp .env.example .env      # then edit .env if you want to change the JWT secret / admin password
npm run seed               # creates the admin account + 10 sample keyboards + 25 sample orders
npm run dev                 # starts the API on http://localhost:5000 (auto-restarts on changes)
# or: npm start
```

After seeding, the console prints your admin login. By default:
- **username:** `admin`
- **password:** `Admin@12345`

⚠️ Change `ADMIN_PASSWORD` and `JWT_SECRET` in `.env` before deploying anywhere real.

## 2. Project structure

```
keyboards-backend/
├── server.js              # Express app entry point
├── seed.js                 # Seeds admin user + sample products + sample orders
├── config/db.js             # SQLite connection + schema (auto-creates tables)
├── middleware/auth.js       # JWT verification middleware (requireAdmin)
├── utils/asyncHandler.js    # Wraps async routes so errors reach the error handler
└── routes/
    ├── auth.js               # POST /login, GET /me, POST /register
    ├── products.js            # Public catalog + admin CRUD
    ├── orders.js               # Public checkout/tracking + admin order management
    └── analytics.js             # Admin-only dashboard metrics
```

## 3. Data model

- **products** — name, brand, category, switch_type, layout, connectivity, description,
  price, discount_price, stock, image_url, rating, rating_count, is_featured
- **orders** — customer info, subtotal, shipping_fee, total_amount, status, payment_method
- **order_items** — line items per order (snapshotted product name/price at time of purchase)
- **admins** — username + bcrypt password hash, used for dashboard login

Categories seeded: `mechanical`, `membrane`, `wireless`, `gaming`, `ergonomic`.

## 4. API Reference

All responses are JSON. Admin-only routes require an `Authorization: Bearer <token>`
header, obtained from `POST /api/auth/login`.

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | `{ username, password }` → `{ token, admin }` |
| GET | `/api/auth/me` | Admin | Returns the currently authenticated admin |
| POST | `/api/auth/register` | Admin | Create another admin account |

### Products (public)
| Method | Route | Description |
|---|---|---|
| GET | `/api/products` | List products. Query params: `category`, `brand`, `search`, `minPrice`, `maxPrice`, `sort` (`price_asc`\|`price_desc`\|`newest`\|`rating`\|`name`), `page`, `limit`, `featured=true` |
| GET | `/api/products/:id` | Single product detail |
| GET | `/api/products/meta/categories` | Distinct categories + counts (for filter UI) |
| GET | `/api/products/meta/brands` | Distinct brands + counts (for filter UI) |

### Products (admin)
| Method | Route | Description |
|---|---|---|
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Partially update a product |
| DELETE | `/api/products/:id` | Delete a product |

### Orders
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/orders` | — | Place an order (checkout). Validates stock, decrements it, computes shipping (free ≥ $100, else $9.99) |
| GET | `/api/orders/:id` | — | Order lookup / tracking, includes line items |
| GET | `/api/orders` | Admin | List all orders. Query params: `status`, `page`, `limit` |
| PUT | `/api/orders/:id/status` | Admin | Update order status (`pending`\|`processing`\|`shipped`\|`delivered`\|`cancelled`) |

### Analytics (admin only — for dashboard graphs)
| Method | Route | Returns |
|---|---|---|
| GET | `/api/analytics/summary` | Total revenue, total orders, avg order value, total products, low-stock count, orders-by-status breakdown |
| GET | `/api/analytics/sales-over-time?days=30` | Daily revenue + order count → line/bar chart |
| GET | `/api/analytics/top-products?limit=5` | Best sellers by units sold → bar chart |
| GET | `/api/analytics/category-breakdown` | Revenue/units by category → pie/donut chart |
| GET | `/api/analytics/inventory` | All products sorted by stock ascending → low-stock table |

## 5. Example requests

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@12345"}'
```

**List gaming keyboards under $150, cheapest first:**
```bash
curl "http://localhost:5000/api/products?category=gaming&maxPrice=150&sort=price_asc"
```

**Place an order:**
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Jane Doe",
    "email": "jane@example.com",
    "address": "1 Main St",
    "city": "Springfield",
    "items": [{ "product_id": 1, "quantity": 1 }]
  }'
```

**Create a product (admin):**
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "Zenith 75",
    "brand": "SteelEdge",
    "category": "mechanical",
    "switch_type": "Tactile",
    "layout": "75%",
    "connectivity": "Wired",
    "price": 119.99,
    "stock": 40
  }'
```

## 6. Notes for hooking up the React frontend

- Enable CORS is already on (`cors()` middleware) so the React dev server (e.g. `localhost:3000`
  or `5173`) can call this API directly during development.
- Store the JWT from `/api/auth/login` (e.g. in memory or `sessionStorage`) and send it as
  `Authorization: Bearer <token>` on every admin dashboard request.
- The `discount_price` field (when non-null) is the price to actually display/charge — treat it
  as "on sale", falling back to `price` otherwise.
- `stock <= 5` is treated as "low stock" in the analytics summary; adjust the threshold in
  `routes/analytics.js` if you want a different cutoff.
