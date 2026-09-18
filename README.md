# 📦 ALG-WMS Backend

> REST API backend for ALG-WMS, a warehouse management system for inventory, warehouse operations, sales orders, stock movements, and fulfillment workflows.

ALG-WMS Backend provides the server-side services used by the ALG-WMS frontend. It handles authentication, warehouse data, products, inventory, receiving, outbound operations, sales orders, stock movements, and related operational workflows.

The backend is built with **Node.js**, **Express.js**, **Prisma ORM**, and a **MySQL-compatible database hosted on TiDB Cloud**.

---

## 🔗 Related Project

### Frontend

https://github.com/amarmaruf6800-collab/wms-frontend

### Live Demo

https://alg-wms.vercel.app

> The live application is intended for portfolio and demonstration purposes.

---

## ✨ Features

### 🔐 Authentication

- User login
- JWT-based authentication
- Protected API routes
- Role-aware access control

### 📦 Product Management

- Product listing
- Product search by SKU or name
- Product creation
- Product editing
- Product activation/deactivation
- Minimum stock configuration

### 🏭 Inventory Management

- Inventory lookup
- Warehouse-based inventory
- Stock quantity tracking
- Inventory filtering
- Stock movement history
- Low-stock monitoring
- Out-of-stock monitoring

### 📥 Receiving

- Receive incoming inventory
- Record receiving operations
- Increase stock through receiving workflows
- Track inventory movements

### 📤 Outbound & Picking

- Outbound operations
- Picking workflow
- Stock availability validation
- Inventory deduction
- Outbound transaction tracking

### 🧾 Sales Orders

- Sales order management
- Sales order items
- Order fulfillment workflow
- Integration with inventory operations

### 📦 Packing & Shipping

- Packing workflow
- Shipping workflow
- Fulfillment status tracking
- Operational order progression

### 🔄 Stock Transfer

- Transfer stock between warehouse locations
- Record stock movements
- Maintain inventory quantities across locations

### ↩️ Returns

- Return item management
- Return processing
- Inventory-related return workflow

### 📊 Dashboard & Reporting

- Product statistics
- Warehouse statistics
- Total stock information
- Low-stock information
- Out-of-stock information
- Operational summaries

### 📋 Audit Trail

- Record important operational activities
- Maintain activity history

---

## 🧱 Architecture

```text
                         ALG-WMS

┌──────────────────────────────────────┐
│          React + Vite Frontend       │
│          Tailwind CSS                │
└──────────────────┬───────────────────┘
                   │
                   │ HTTPS / REST API
                   ▼
┌──────────────────────────────────────┐
│       Node.js + Express Backend      │
│                                      │
│ JWT Authentication                   │
│ Product API                          │
│ Inventory API                        │
│ Receiving API                        │
│ Outbound / Picking API               │
│ Sales Order API                      │
│ Returns API                          │
└──────────────────┬───────────────────┘
                   │
                   │ Prisma ORM
                   ▼
┌──────────────────────────────────────┐
│             TiDB Cloud               │
│          MySQL-compatible             │
└──────────────────────────────────────┘
```

---

## ☁️ Deployment

The backend is deployed separately from the frontend.

```text
Vercel
React + Vite
      │
      │ HTTPS
      ▼
Biznet Gio VPS
Node.js + Express
PM2
      │
      │ MySQL / TLS
      ▼
TiDB Cloud
```

The backend process is managed with **PM2** on the VPS.

---

## 🛠️ Tech Stack

### Backend

- Node.js
- Express.js
- Prisma ORM
- JWT
- bcrypt

### Database

- TiDB Cloud
- MySQL-compatible SQL database

### Infrastructure

- Linux VPS
- PM2
- Vercel frontend
- HTTPS / TLS

---

## 📁 Project Structure

```text
wms-backend/
│
├── controllers/
├── middleware/
├── prisma/
│   ├── schema.prisma
│   └── ...
│
├── routes/
├── utils/
├── index.js
├── package.json
├── package-lock.json
└── .env.example
```

---

## 🔑 API Overview

The API is organized around the main warehouse workflows.

### Authentication

```text
POST /api/auth/login
```

### Products

```text
GET    /api/products
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
```

### Inventory

```text
GET /api/inventory
GET /api/inventory/movements
```

### Receiving

```text
POST /api/inventory/receive
```

### Picking / Outbound

```text
POST /api/inventory/pick
POST /api/inventory/outbound
```

> Endpoint details can evolve as the application continues to be developed. Refer to the source code in `routes/` for the current API definitions.

---

## 🚀 Run Locally

### Requirements

- Node.js
- npm
- TiDB Cloud or another MySQL-compatible database
- Git

### 1. Clone the repository

```bash
git clone https://github.com/amarmaruf6800-collab/wms-backend.git

cd wms-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file based on `.env.example`.

Example:

```env
PORT=5001
FRONTEND_URL=http://localhost:5173
DATABASE_URL=your-database-connection-string
JWT_SECRET=your-secret
```

Do not use production credentials in local examples.

### 4. Configure Prisma

Make sure the database connection is available and Prisma is configured for the selected database.

```bash
npx prisma generate
```

### 5. Start the server

For development:

```bash
npm run dev
```

Or directly:

```bash
node index.js
```

---

## 🔐 Environment & Security

Production credentials must not be committed to GitHub.

Keep the following values private:

- Database connection strings
- Database passwords
- JWT secrets
- TLS/SSL credentials
- Server credentials

Use `.env` for environment-specific configuration and keep `.env` excluded from version control.

---

## 📌 Project Highlights

ALG-WMS Backend demonstrates practical backend development through:

- REST API development with Express.js
- JWT authentication
- Password hashing with bcrypt
- Prisma ORM
- Relational database integration
- Inventory management
- Warehouse operations
- Receiving and outbound workflows
- Picking, packing, and shipping
- Sales order processing
- Stock movement tracking
- Stock transfers
- Returns
- Dashboard data aggregation
- VPS deployment
- PM2 process management
- Cloud database integration

---

## 🎯 Warehouse Workflow

```text
Incoming Stock
      ↓
  Receiving
      ↓
   Inventory
      ↓
 Sales Order
      ↓
   Picking
      ↓
   Packing
      ↓
  Shipping
      ↓
  Completed
```

Additional inventory workflows include stock transfers, stock adjustments, and returns.

---

## 👨‍💻 Author

**Amar**

Junior Web Developer | Full-Stack Enthusiast

Information Technology / Web Development
