# 🎨 Shbash — E-Commerce Backend

> **FEEL IT LUXURY. BORN IN BAHRAIN.**

The official backend API powering the new **Shbash** shopping experience — a Bahraini creative brand selling art, stickers, clothing, and collectibles. Built to serve the web app, iOS, and Android with a single unified API.

---

## 🌟 Key Features

### 🛒 Secure Checkout & Inventory
- **Atomic Transactions** — Orders are only created if stock is available and the cart is cleared successfully, all in a single DB transaction. No overselling, no ghost carts.
- **Race Condition Protection** — Stock check and decrement happen atomically, preventing two customers from buying the last item simultaneously.
- **Snapshot Pricing** — Records the exact price at the time of purchase to ensure financial data integrity regardless of future price changes.
- **Idempotent Checkout** — Supports idempotency keys so client retries on slow mobile connections never create duplicate orders.

### 🛡️ Auth & Access Control (RBAC)
- **JWT Authentication** — Secure, stateless login with configurable token expiry.
- **Role-Based Access** — `USER` and `ADMIN` roles with protected routes.
- **Timing Attack Prevention** — Login always runs bcrypt regardless of whether the email exists, preventing email enumeration.

### 👔 Admin Dashboard
- **Order Management** — State machine transitions: `PENDING` → `SHIPPED` → `COMPLETED` or `CANCELLED`. Invalid transitions are rejected.
- **Global Order Visibility** — Admins can view all transactions across all customers.
- **Revenue & Stats** — Total revenue (excluding cancelled orders), order count, and product count in a single endpoint.

### 🗂️ Product & Category Management
- **Paginated Listings** — Filter by category, search by name, paginate results.
- **Category CRUD** — Full create, read, update, delete with product count per category.
- **Admin-Only Writes** — Only admins can create, update, or delete products and categories.

### 🛒 Smart Cart
- **Auto Cart Creation** — Cart is automatically created on first add using upsert — no race conditions.
- **Stock Validation** — Adding to cart checks live stock so checkout failures are caught early.
- **Live Cart Total** — Total calculated from current prices on every fetch.

---

## 🏗️ Architecture Overview

```
src/
├── auth/                   # JWT auth, guards, strategy, decorators
│   ├── decorators/
│   ├── dto/
│   ├── guards/
│   └── strategies/
├── cart/                   # Cart management
│   └── dto/
├── categories/             # Product categories
│   └── dto/
├── common/                 # Shared DTOs (pagination etc.)
│   └── dto/
├── orders/                 # Checkout, order history, admin stats
│   └── dto/
├── prisma/                 # PrismaService and module
├── products/               # Product CRUD with search and pagination
│   └── dto/
├── app.module.ts
└── main.ts
```

**Request lifecycle:**
```
Client (Web / iOS / Android)
  → ValidationPipe (DTO validation + field stripping)
    → JwtAuthGuard (token verification)
      → RolesGuard (USER / ADMIN check)
        → Controller
          → Service
            → Prisma
              → PostgreSQL
```

---

## 🗄️ Database Schema

```
User
 ├── id, email, password, name, role (USER | ADMIN)
 ├── Cart (one-to-one)
 └── Orders (one-to-many)

Category
 └── Products (one-to-many, cascade delete)

Product
 ├── id, name, description, price, stock, images[]
 ├── categoryId → Category
 ├── CartItems (one-to-many)
 └── OrderItems (one-to-many)

Cart
 ├── userId → User (unique)
 └── CartItems (one-to-many, cascade delete)

CartItem
 ├── cartId → Cart
 ├── productId → Product
 └── quantity

Order
 ├── userId → User
 ├── total, status (PENDING | SHIPPED | COMPLETED | CANCELLED)
 ├── idempotencyKey (unique, optional)
 └── OrderItems (one-to-many)

OrderItem
 ├── orderId → Order
 ├── productId → Product
 ├── quantity
 └── price  ← snapshotted at time of purchase
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shbash

# JWT
JWT_SECRET=your-long-random-secret-at-least-32-characters
JWT_EXPIRES_IN=1h

# Security
BCRYPT_ROUNDS=12

# CORS — set to your frontend/app URL in production
ALLOWED_ORIGIN=http://localhost:5173
```

> ⚠️ **Never commit `.env` to version control.** The app will throw on startup if `JWT_SECRET` or `DATABASE_URL` are missing.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/jaberb281-art/ecommerce-backend.git
cd ecommerce-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### Running the Server

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run start:prod
```

Server: `http://localhost:3000`  
Swagger docs: `http://localhost:3000/api`

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | Public | Register a new account |
| `POST` | `/auth/login` | Public | Login and receive JWT |
| `GET` | `/auth/me` | User | Get current user profile |

### Products
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/products` | Public | List products (paginated, filterable, searchable) |
| `GET` | `/products/:id` | Public | Get a single product |
| `POST` | `/products` | Admin | Create a product |
| `PATCH` | `/products/:id` | Admin | Update a product |
| `DELETE` | `/products/:id` | Admin | Delete a product |

**Query params for `GET /products`:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 10, max: 50) |
| `categoryId` | string | Filter by category |
| `search` | string | Search by product name |

### Categories
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/categories` | Public | List all categories with product count |
| `GET` | `/categories/:id` | Public | Get category with its products |
| `POST` | `/categories` | Admin | Create a category |
| `PATCH` | `/categories/:id` | Admin | Update a category |
| `DELETE` | `/categories/:id` | Admin | Delete a category |

### Cart
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/cart` | User | Get current cart with live total |
| `POST` | `/cart` | User | Add item to cart |
| `DELETE` | `/cart/:productId` | User | Remove item from cart |
| `DELETE` | `/cart` | User | Clear entire cart |

### Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/orders/checkout` | User | Checkout cart and create order |
| `GET` | `/orders` | User | Get my orders (paginated) |
| `GET` | `/orders/admin/all` | Admin | Get all orders (paginated) |
| `GET` | `/orders/admin/stats` | Admin | Revenue and order stats |
| `PATCH` | `/orders/:id/status` | Admin | Update order status |

**Idempotent checkout (recommended for mobile clients):**
```http
POST /orders/checkout
Authorization: Bearer <token>
x-idempotency-key: <unique-client-generated-uuid>
```

---

## 🧪 Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

---

## 🔒 Security Highlights

- Passwords hashed with `bcrypt` (configurable rounds via `BCRYPT_ROUNDS`)
- JWT secret validated at startup — app refuses to boot without it
- `ValidationPipe` with `whitelist: true` strips unknown fields from all requests
- Timing-safe login prevents email enumeration attacks
- CORS locked to allowed origins in production
- Admin routes protected by both `JwtAuthGuard` and `RolesGuard`
- Atomic stock operations prevent overselling under high concurrency

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | NestJS (TypeScript) |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT + Passport |
| Validation | class-validator + class-transformer |
| Documentation | Swagger / OpenAPI |
| Testing | Jest |

---

## 🌐 Platforms

This backend serves all Shbash client platforms via a single unified API:

- 🌍 **Web App**
- 🍎 **iOS**
- 🤖 **Android**

---

*© 2026 Shbash — Born in Bahrain 🇧🇭*