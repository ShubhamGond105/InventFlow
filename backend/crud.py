from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from collections import defaultdict
import models, schemas


# ── Products ─────────────────────────────────────────────
def get_products(db: Session, skip=0, limit=100):
    return db.query(models.Product).order_by(models.Product.id).offset(skip).limit(limit).all()

def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def get_product_by_sku(db: Session, sku: str):
    return db.query(models.Product).filter(models.Product.sku == sku).first()

def create_product(db: Session, product: schemas.ProductCreate):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def update_product(db: Session, product_id: int, product: schemas.ProductUpdate):
    db_product = get_product(db, product_id)
    if not db_product:
        return None
    for key, value in product.model_dump(exclude_unset=True).items():
        setattr(db_product, key, value)
    db.commit()
    db.refresh(db_product)
    return db_product

def delete_product(db: Session, product_id: int):
    db_product = get_product(db, product_id)
    if not db_product:
        return None  # not found

    # Check if product is referenced by any order
    in_use = db.query(models.OrderItem).filter(models.OrderItem.product_id == product_id).first()
    if in_use:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this product because it appears in one or more orders. "
                   "Delete or cancel those orders first."
        )
    db.delete(db_product)
    db.commit()
    return True


# ── Customers ─────────────────────────────────────────────
def get_customers(db: Session, skip=0, limit=100):
    return db.query(models.Customer).order_by(models.Customer.id).offset(skip).limit(limit).all()

def get_customer(db: Session, customer_id: int):
    return db.query(models.Customer).filter(models.Customer.id == customer_id).first()

def get_customer_by_email(db: Session, email: str):
    return db.query(models.Customer).filter(models.Customer.email == email).first()

def create_customer(db: Session, customer: schemas.CustomerCreate):
    db_customer = models.Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

def update_customer(db: Session, customer_id: int, customer: schemas.CustomerUpdate):
    db_customer = get_customer(db, customer_id)
    if not db_customer:
        return None
    for key, value in customer.model_dump(exclude_unset=True).items():
        setattr(db_customer, key, value)
    db.commit()
    db.refresh(db_customer)
    return db_customer

def delete_customer(db: Session, customer_id: int):
    db_customer = get_customer(db, customer_id)
    if not db_customer:
        return None

    # Check if customer has any orders
    has_orders = db.query(models.Order).filter(models.Order.customer_id == customer_id).first()
    if has_orders:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this customer because they have existing orders. "
                   "Delete or cancel those orders first."
        )
    db.delete(db_customer)
    db.commit()
    return True


# ── Orders ────────────────────────────────────────────────
def get_orders(db: Session, skip=0, limit=100):
    return db.query(models.Order).order_by(models.Order.id.desc()).offset(skip).limit(limit).all()

def get_order(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()


def create_order(db: Session, order: schemas.OrderCreate):
    """
    Atomically validates stock and creates an order.

    Business rules enforced:
      - Customer must exist
      - All products must exist
      - Quantities are aggregated per product (same product appearing twice
        in the same order is summed, then checked against stock — prevents
        the "duplicate product = negative stock" bug)
      - Sufficient stock for total quantity per product
      - Stock decremented atomically
      - Total computed by backend from server-side product prices
    """
    # 1. Customer exists
    customer = db.query(models.Customer).filter(models.Customer.id == order.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # 2. Aggregate quantities per product (handles duplicate line items)
    qty_by_product = defaultdict(int)
    for item in order.items:
        qty_by_product[item.product_id] += item.quantity

    # 3. Lock product rows (no-op on SQLite, enforces row-locking on Postgres)
    product_ids = list(qty_by_product.keys())
    products = (
        db.query(models.Product)
        .filter(models.Product.id.in_(product_ids))
        .with_for_update()
        .all()
    )
    product_map = {p.id: p for p in products}

    # 4. Validate each unique product against its aggregated quantity
    for pid, total_qty in qty_by_product.items():
        product = product_map.get(pid)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product with id {pid} not found")
        if product.stock_quantity < total_qty:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Insufficient stock for '{product.name}'. "
                    f"Available: {product.stock_quantity}, Requested: {total_qty}"
                ),
            )

    # 5. Create order
    total = 0.0
    db_order = models.Order(
        customer_id=order.customer_id,
        notes=order.notes,
        status="pending",
    )
    db.add(db_order)
    db.flush()

    # 6. Create line items as user submitted them (preserve duplicates if any),
    #    but stock is decremented from the aggregate to keep totals right.
    for item in order.items:
        product = product_map[item.product_id]
        unit_price = product.price
        total += unit_price * item.quantity
        db.add(models.OrderItem(
            order_id=db_order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=unit_price,
        ))

    # 7. Decrement stock once per unique product, by aggregated amount
    for pid, total_qty in qty_by_product.items():
        product_map[pid].stock_quantity -= total_qty

    db_order.total_amount = round(total, 2)
    db.commit()
    db.refresh(db_order)
    return db_order


def update_order_status(db: Session, order_id: int, status: str):
    db_order = get_order(db, order_id)
    if not db_order:
        return None
    # If cancelling an active order, restore stock
    if status == "cancelled" and db_order.status != "cancelled":
        for item in db_order.items:
            product = get_product(db, item.product_id)
            if product:
                product.stock_quantity += item.quantity
    db_order.status = status
    db.commit()
    db.refresh(db_order)
    return db_order


def delete_order(db: Session, order_id: int):
    """Cancel an order and restore stock for all items."""
    db_order = get_order(db, order_id)
    if not db_order:
        return False
    # Only restore stock if it wasn't already restored via cancellation
    if db_order.status != "cancelled":
        for item in db_order.items:
            product = get_product(db, item.product_id)
            if product:
                product.stock_quantity += item.quantity
    db.delete(db_order)
    db.commit()
    return True


# ── Stats ─────────────────────────────────────────────────
def get_stats(db: Session):
    total_products = db.query(func.count(models.Product.id)).scalar()
    total_customers = db.query(func.count(models.Customer.id)).scalar()
    total_orders = db.query(func.count(models.Order.id)).scalar()
    total_revenue = db.query(func.sum(models.Order.total_amount)).filter(
        models.Order.status != "cancelled"
    ).scalar() or 0.0
    low_stock = db.query(models.Product).filter(models.Product.stock_quantity <= 10).count()
    pending_orders = db.query(models.Order).filter(models.Order.status == "pending").count()

    return {
        "total_products": total_products,
        "total_customers": total_customers,
        "total_orders": total_orders,
        "total_revenue": round(total_revenue, 2),
        "low_stock_products": low_stock,
        "pending_orders": pending_orders,
    }
