# StockFlow — Inventory & Order Management System

A full-stack, production-ready Inventory & Order Management System built with **FastAPI**, **React**, and **PostgreSQL**, fully containerized with **Docker**.

---

## 🚀 Live Demo

| Service | URL |
|---|---|
| Frontend | _[https://invent-flow.vercel.app/]_ |
| Backend API | _[https://inventflow.onrender.com]_ |
| API Docs | [https://inventflow.onrender.com/docs] |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Axios, Lucide React |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0 |
| Database | PostgreSQL 16 |
| Containerization | Docker, Docker Compose |
| Frontend Hosting | Vercel / Netlify |
| Backend Hosting | Render / Railway |

---

## ✅ Features

### Quality & Production-Readiness
- **Comprehensive validation** — Pydantic enforces non-negative prices/stock, valid email format, positive order quantities, restricted order status values
- **Race-condition safe** — Order creation uses `SELECT FOR UPDATE` to atomically lock product rows during stock validation
- **19 backend tests** — Full pytest suite covering every business rule (run `pytest -v` inside the backend container)
- **Seed script** — `python seed.py` populates demo data for quick evaluation
- **Env-driven CORS** — `CORS_ORIGINS` env var controls allowed origins for production safety
- **Integrity error handler** — Catches DB constraint violations and returns clean 400 responses
- **Interactive API docs** — Auto-generated Swagger UI at `/docs`, tagged by resource

### Product Management
- Create, read, update, delete products
- Unique SKU enforcement
- Stock quantity tracking with low-stock alerts
- Category tagging

### Customer Management
- Add and manage customers
- Unique email enforcement
- Phone & address fields

### Order Management
- Create orders with multiple product line items
- Automatic stock validation (cannot order more than available)
- Automatic stock deduction on order creation
- Order status workflow: `pending → processing → shipped → delivered → cancelled`
- Stock restoration when order is cancelled/deleted
- Automatic total amount calculation

### Dashboard
- Total products, customers, orders
- Revenue summary (non-cancelled orders)
- Low-stock alerts (≤10 units)
- Recent orders overview

---

## 📁 Project Structure

```
inventory-system/
├── backend/
│   ├── main.py          # FastAPI app & routes
│   ├── models.py        # SQLAlchemy ORM models
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── crud.py          # Database operations
│   ├── database.py      # DB connection & session
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   ├── Products.js
│   │   │   ├── Customers.js
│   │   │   └── Orders.js
│   │   ├── services/
│   │   │   └── api.js   # Axios API layer
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── nginx.conf
│   ├── Dockerfile
│   └── .dockerignore
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 🐳 Running with Docker Compose (Recommended)

### Prerequisites
- Docker Desktop installed and running

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/inventory-system.git
cd inventory-system

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env with your preferred credentials

# 3. Start all services
docker compose up --build

# 4. Open the app
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## 💻 Running Locally (Development)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variable (or create a .env file)
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inventory_db

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Set REACT_APP_API_URL=http://localhost:8000

npm install
npm start
# Opens at http://localhost:3000
```

---

## 🧪 Running Tests

```bash
# Inside the backend container
docker compose exec backend pytest -v

# Or locally (after pip install -r requirements.txt)
cd backend
pytest -v
```

All 19 tests should pass — they cover product CRUD, customer CRUD, order creation, stock validation, atomic stock updates, and all business rules.

## 🌱 Seed Sample Data

```bash
docker compose exec backend python seed.py
```

This adds 6 sample products (with one low-stock and one out-of-stock item) and 3 sample customers for quick UI evaluation.

---

## 🌐 API Reference

All endpoints return JSON. Base URL: `http://localhost:8000`

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/products` | List all products |
| POST | `/products` | Create product |
| GET | `/products/{id}` | Get product by ID |
| PUT | `/products/{id}` | Update product |
| DELETE | `/products/{id}` | Delete product |

### Customers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/customers` | List all customers |
| POST | `/customers` | Create customer |
| GET | `/customers/{id}` | Get customer by ID |
| PUT | `/customers/{id}` | Update customer |
| DELETE | `/customers/{id}` | Delete customer |

### Orders
| Method | Endpoint | Description |
|---|---|---|
| GET | `/orders` | List all orders |
| POST | `/orders` | Create order |
| GET | `/orders/{id}` | Get order by ID |
| PUT | `/orders/{id}/status` | Update order status |
| DELETE | `/orders/{id}` | Cancel/Delete order |

### Misc
| Method | Endpoint | Description |
|---|---|---|
| GET | `/stats` | Dashboard statistics |
| GET | `/health` | Health check |

Interactive docs: `http://localhost:8000/docs`

---

## 🚢 Deployment Guide

### Backend → Render

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo, select `backend/` as root
4. Set:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable: `DATABASE_URL` (from Render PostgreSQL or Supabase)
6. Deploy

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo, set root to `frontend/`
3. Add environment variable: `REACT_APP_API_URL=https://your-render-backend.onrender.com`
4. Deploy

### Docker Hub (Backend Image)

```bash
# Build and push
docker build -t YOUR_DOCKERHUB_USERNAME/inventory-backend:latest ./backend
docker push YOUR_DOCKERHUB_USERNAME/inventory-backend:latest
```

---

## 🔒 Business Rules Implemented

- ✅ Product SKU must be unique
- ✅ Customer email must be unique
- ✅ Product stock cannot go negative
- ✅ Orders are rejected if stock is insufficient (with descriptive error)
- ✅ Creating an order automatically reduces stock
- ✅ Cancelling an order restores stock
- ✅ Total order amount calculated automatically by backend
- ✅ All APIs include proper HTTP status codes and error messages
- ✅ All request data is validated with Pydantic

---

## 📦 Docker Hub

Backend image: `docker pull YOUR_DOCKERHUB_USERNAME/inventory-backend:latest`
