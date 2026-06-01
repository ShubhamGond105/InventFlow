import os
import logging
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

import models, schemas, crud
from database import SessionLocal, engine

# ── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("inventory-api")

# ── App initialization ────────────────────────────────────
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Inventory & Order Management API",
    description="Production-grade backend for managing products, customers, and orders.",
    version="1.0.0",
)

# CORS from environment (comma-separated). Default to allow-all in dev.
_origins = os.getenv("CORS_ORIGINS", "*")
allow_origins = ["*"] if _origins.strip() == "*" else [o.strip() for o in _origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Global error handler for IntegrityError (catches race-condition dup keys) ──
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request, exc: IntegrityError):
    logger.warning(f"IntegrityError: {exc}")
    return JSONResponse(
        status_code=400,
        content={"detail": "Database constraint violated (duplicate value or invalid reference)."},
    )


# ── Health ──────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"message": "Inventory & Order Management API", "docs": "/docs", "health": "/health"}

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


# ── Products ────────────────────────────────────────────
@app.get("/products", response_model=List[schemas.Product], tags=["Products"])
def list_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_products(db, skip=skip, limit=limit)

@app.get("/products/{product_id}", response_model=schemas.Product, tags=["Products"])
def get_product(product_id: int, db: Session = Depends(get_db)):
    p = crud.get_product(db, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p

@app.post("/products", response_model=schemas.Product, status_code=201, tags=["Products"])
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    if crud.get_product_by_sku(db, product.sku):
        raise HTTPException(status_code=400, detail=f"A product with SKU '{product.sku}' already exists")
    return crud.create_product(db, product)

@app.put("/products/{product_id}", response_model=schemas.Product, tags=["Products"])
def update_product(product_id: int, product: schemas.ProductUpdate, db: Session = Depends(get_db)):
    p = crud.update_product(db, product_id, product)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p

@app.delete("/products/{product_id}", tags=["Products"])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    result = crud.delete_product(db, product_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}


# ── Customers ───────────────────────────────────────────
@app.get("/customers", response_model=List[schemas.Customer], tags=["Customers"])
def list_customers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_customers(db, skip=skip, limit=limit)

@app.get("/customers/{customer_id}", response_model=schemas.Customer, tags=["Customers"])
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    c = crud.get_customer(db, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c

@app.post("/customers", response_model=schemas.Customer, status_code=201, tags=["Customers"])
def create_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    if crud.get_customer_by_email(db, customer.email):
        raise HTTPException(status_code=400, detail=f"A customer with email '{customer.email}' already exists")
    return crud.create_customer(db, customer)

@app.put("/customers/{customer_id}", response_model=schemas.Customer, tags=["Customers"])
def update_customer(customer_id: int, customer: schemas.CustomerUpdate, db: Session = Depends(get_db)):
    # Check if new email is taken by someone else
    if customer.email:
        existing = crud.get_customer_by_email(db, customer.email)
        if existing and existing.id != customer_id:
            raise HTTPException(status_code=400, detail="Email already in use by another customer")
    c = crud.update_customer(db, customer_id, customer)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c

@app.delete("/customers/{customer_id}", tags=["Customers"])
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    result = crud.delete_customer(db, customer_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}


# ── Orders ──────────────────────────────────────────────
@app.get("/orders", response_model=List[schemas.Order], tags=["Orders"])
def list_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_orders(db, skip=skip, limit=limit)

@app.get("/orders/{order_id}", response_model=schemas.Order, tags=["Orders"])
def get_order(order_id: int, db: Session = Depends(get_db)):
    o = crud.get_order(db, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return o

@app.post("/orders", response_model=schemas.Order, status_code=201, tags=["Orders"])
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    """
    Creates an order. Business rules enforced:
      - Customer must exist
      - All products must exist
      - Available stock must be >= requested quantity for every item
      - Stock is decremented atomically (race-safe via SELECT FOR UPDATE)
      - Total amount is computed by the backend from current product prices
    """
    return crud.create_order(db, order)

@app.put("/orders/{order_id}/status", response_model=schemas.Order, tags=["Orders"])
def update_order_status(order_id: int, status_update: schemas.OrderStatusUpdate, db: Session = Depends(get_db)):
    o = crud.update_order_status(db, order_id, status_update.status)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return o

@app.delete("/orders/{order_id}", tags=["Orders"])
def delete_order(order_id: int, db: Session = Depends(get_db)):
    """Cancel/Delete an order. Stock is restored for all items in the order."""
    ok = crud.delete_order(db, order_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted and stock restored"}


# ── Dashboard Stats ──────────────────────────────────────
@app.get("/stats", tags=["Dashboard"])
def get_stats(db: Session = Depends(get_db)):
    """Aggregated statistics for the dashboard."""
    return crud.get_stats(db)
