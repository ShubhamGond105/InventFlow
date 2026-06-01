"""
Pytest test suite for the Inventory & Order Management API.
Uses an in-memory SQLite database for fast, isolated tests.

Run with:  pytest -v
"""
import os
# Must set BEFORE importing app modules so engine is built against sqlite
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Patch database engine to a single-connection in-memory SQLite
import database as _database
_test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)
_database.engine = _test_engine
_database.SessionLocal = _TestingSessionLocal

from main import app, get_db
from database import Base


def override_get_db():
    db = _TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def fresh_db():
    """Recreate schema before each test for full isolation."""
    Base.metadata.drop_all(bind=_test_engine)
    Base.metadata.create_all(bind=_test_engine)
    yield


client = TestClient(app)


# ── Health ─────────────────────────────────────────────
def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


# ── Products ───────────────────────────────────────────
def test_create_product_success():
    res = client.post("/products", json={
        "name": "Test Item", "sku": "T-001", "price": 99.99, "stock_quantity": 10
    })
    assert res.status_code == 201
    body = res.json()
    assert body["sku"] == "T-001"
    assert body["price"] == 99.99

def test_create_product_duplicate_sku_rejected():
    client.post("/products", json={"name": "A", "sku": "DUP", "price": 1, "stock_quantity": 1})
    res = client.post("/products", json={"name": "B", "sku": "DUP", "price": 2, "stock_quantity": 1})
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]

def test_create_product_negative_price_rejected():
    res = client.post("/products", json={"name": "Bad", "sku": "BAD-1", "price": -5, "stock_quantity": 0})
    assert res.status_code == 422

def test_create_product_negative_stock_rejected():
    res = client.post("/products", json={"name": "Bad", "sku": "BAD-2", "price": 5, "stock_quantity": -1})
    assert res.status_code == 422

def test_get_product_not_found():
    res = client.get("/products/999")
    assert res.status_code == 404

def test_update_product():
    create = client.post("/products", json={"name": "Old", "sku": "U-1", "price": 10, "stock_quantity": 5}).json()
    res = client.put(f"/products/{create['id']}", json={"name": "New", "price": 20})
    assert res.status_code == 200
    assert res.json()["name"] == "New"
    assert res.json()["price"] == 20

def test_delete_product():
    p = client.post("/products", json={"name": "Bye", "sku": "D-1", "price": 1, "stock_quantity": 1}).json()
    res = client.delete(f"/products/{p['id']}")
    assert res.status_code == 200


# ── Customers ──────────────────────────────────────────
def test_create_customer_success():
    res = client.post("/customers", json={
        "name": "Alice", "email": "alice@example.com", "phone": "9876543210"
    })
    assert res.status_code == 201
    assert res.json()["email"] == "alice@example.com"

def test_create_customer_duplicate_email_rejected():
    client.post("/customers", json={"name": "A", "email": "x@y.com"})
    res = client.post("/customers", json={"name": "B", "email": "x@y.com"})
    assert res.status_code == 400

def test_create_customer_invalid_email_rejected():
    res = client.post("/customers", json={"name": "X", "email": "not-an-email"})
    assert res.status_code == 422


# ── Orders ─────────────────────────────────────────────
def _setup_product_and_customer(stock=10, price=100, sku="W-1", email="bob@example.com"):
    p = client.post("/products", json={
        "name": "Widget", "sku": sku, "price": price, "stock_quantity": stock
    }).json()
    c = client.post("/customers", json={"name": "Bob", "email": email}).json()
    return p, c

def test_create_order_success_reduces_stock():
    p, c = _setup_product_and_customer(stock=10, price=50)
    res = client.post("/orders", json={
        "customer_id": c["id"],
        "items": [{"product_id": p["id"], "quantity": 3}]
    })
    assert res.status_code == 201
    body = res.json()
    assert body["total_amount"] == 150.0
    assert body["status"] == "pending"
    stock_after = client.get(f"/products/{p['id']}").json()["stock_quantity"]
    assert stock_after == 7

def test_create_order_insufficient_stock_rejected():
    p, c = _setup_product_and_customer(stock=2)
    res = client.post("/orders", json={
        "customer_id": c["id"],
        "items": [{"product_id": p["id"], "quantity": 5}]
    })
    assert res.status_code == 400
    assert "Insufficient stock" in res.json()["detail"]
    stock_after = client.get(f"/products/{p['id']}").json()["stock_quantity"]
    assert stock_after == 2

def test_create_order_invalid_customer_rejected():
    p, _ = _setup_product_and_customer()
    res = client.post("/orders", json={
        "customer_id": 9999,
        "items": [{"product_id": p["id"], "quantity": 1}]
    })
    assert res.status_code == 404

def test_create_order_zero_quantity_rejected():
    p, c = _setup_product_and_customer()
    res = client.post("/orders", json={
        "customer_id": c["id"],
        "items": [{"product_id": p["id"], "quantity": 0}]
    })
    assert res.status_code == 422

def test_create_order_no_items_rejected():
    _, c = _setup_product_and_customer()
    res = client.post("/orders", json={"customer_id": c["id"], "items": []})
    assert res.status_code == 422

def test_delete_order_restores_stock():
    p, c = _setup_product_and_customer(stock=10, price=10)
    order = client.post("/orders", json={
        "customer_id": c["id"],
        "items": [{"product_id": p["id"], "quantity": 4}]
    }).json()
    assert client.get(f"/products/{p['id']}").json()["stock_quantity"] == 6
    client.delete(f"/orders/{order['id']}")
    assert client.get(f"/products/{p['id']}").json()["stock_quantity"] == 10

def test_invalid_order_status_rejected():
    p, c = _setup_product_and_customer()
    order = client.post("/orders", json={
        "customer_id": c["id"], "items": [{"product_id": p["id"], "quantity": 1}]
    }).json()
    res = client.put(f"/orders/{order['id']}/status", json={"status": "exploded"})
    assert res.status_code == 422


# ── Stats ──────────────────────────────────────────────
def test_stats_endpoint():
    res = client.get("/stats")
    assert res.status_code == 200
    body = res.json()
    for key in ["total_products", "total_customers", "total_orders", "total_revenue", "low_stock_products"]:
        assert key in body


# ── Edge cases / regression tests ─────────────────────────
def test_duplicate_product_in_order_aggregates_quantities():
    """REGRESSION: same product listed twice must aggregate qty before validation,
    otherwise stock could go negative and break /orders responses."""
    p, c = _setup_product_and_customer(stock=5, price=10)
    # Try to order 3+3=6 of a product with only 5 in stock
    res = client.post("/orders", json={
        "customer_id": c["id"],
        "items": [
            {"product_id": p["id"], "quantity": 3},
            {"product_id": p["id"], "quantity": 3},
        ]
    })
    assert res.status_code == 400, "Aggregated quantity exceeds stock — must reject"
    # Stock must remain unchanged (not go negative)
    stock_after = client.get(f"/products/{p['id']}").json()["stock_quantity"]
    assert stock_after == 5

def test_duplicate_product_in_order_within_stock_succeeds():
    """Same product twice with total <= stock should succeed and decrement correctly."""
    p, c = _setup_product_and_customer(stock=5, price=10)
    res = client.post("/orders", json={
        "customer_id": c["id"],
        "items": [
            {"product_id": p["id"], "quantity": 2},
            {"product_id": p["id"], "quantity": 2},
        ]
    })
    assert res.status_code == 201
    assert res.json()["total_amount"] == 40.0  # 2*10 + 2*10
    # Stock should be 5 - 4 = 1 (not 5 - 2 - 2 - 2 from a buggy double-decrement)
    assert client.get(f"/products/{p['id']}").json()["stock_quantity"] == 1

def test_delete_product_referenced_by_order_rejected():
    """Cannot delete a product that's part of any order."""
    p, c = _setup_product_and_customer(stock=10)
    client.post("/orders", json={
        "customer_id": c["id"],
        "items": [{"product_id": p["id"], "quantity": 1}]
    })
    res = client.delete(f"/products/{p['id']}")
    assert res.status_code == 400
    assert "order" in res.json()["detail"].lower()

def test_delete_customer_with_orders_rejected():
    """Cannot delete a customer who has placed orders."""
    p, c = _setup_product_and_customer(stock=10)
    client.post("/orders", json={
        "customer_id": c["id"],
        "items": [{"product_id": p["id"], "quantity": 1}]
    })
    res = client.delete(f"/customers/{c['id']}")
    assert res.status_code == 400
    assert "order" in res.json()["detail"].lower()

def test_multi_item_one_invalid_rejects_all():
    """If any item in an order fails validation, NO stock should change."""
    p1 = client.post("/products", json={"name": "Good", "sku": "G", "price": 1, "stock_quantity": 10}).json()
    p2 = client.post("/products", json={"name": "Bad", "sku": "B", "price": 1, "stock_quantity": 1}).json()
    c = client.post("/customers", json={"name": "Buyer", "email": "buyer@x.com"}).json()
    res = client.post("/orders", json={
        "customer_id": c["id"],
        "items": [
            {"product_id": p1["id"], "quantity": 5},   # OK
            {"product_id": p2["id"], "quantity": 999}  # FAIL
        ]
    })
    assert res.status_code == 400
    # Neither product's stock should have changed
    assert client.get(f"/products/{p1['id']}").json()["stock_quantity"] == 10
    assert client.get(f"/products/{p2['id']}").json()["stock_quantity"] == 1

def test_order_exact_stock_amount_succeeds():
    """Ordering exactly the available stock should succeed and leave 0."""
    p, c = _setup_product_and_customer(stock=3, price=10)
    res = client.post("/orders", json={
        "customer_id": c["id"],
        "items": [{"product_id": p["id"], "quantity": 3}]
    })
    assert res.status_code == 201
    assert client.get(f"/products/{p['id']}").json()["stock_quantity"] == 0

def test_cancel_already_cancelled_does_not_double_restore():
    """If an order is cancelled via PUT then deleted, stock is only restored once."""
    p, c = _setup_product_and_customer(stock=10, price=10)
    order = client.post("/orders", json={
        "customer_id": c["id"],
        "items": [{"product_id": p["id"], "quantity": 4}]
    }).json()
    # Stock is now 6
    client.put(f"/orders/{order['id']}/status", json={"status": "cancelled"})
    # Stock restored to 10
    assert client.get(f"/products/{p['id']}").json()["stock_quantity"] == 10
    # Now delete — should NOT double-restore
    client.delete(f"/orders/{order['id']}")
    assert client.get(f"/products/{p['id']}").json()["stock_quantity"] == 10

def test_invalid_email_string_rejected():
    res = client.post("/customers", json={"name": "X", "email": "not-an-email"})
    assert res.status_code == 422

def test_get_lists_remain_consistent_after_errors():
    """Make sure data isn't lost when API errors occur (the user's reported issue)."""
    p, c = _setup_product_and_customer(stock=5)
    # Try a bunch of bad requests
    client.post("/orders", json={"customer_id": c["id"], "items": [{"product_id": p["id"], "quantity": 999}]})
    client.post("/products", json={"name": "Bad", "sku": "X", "price": -1, "stock_quantity": 0})
    client.post("/customers", json={"name": "Bad", "email": "not-email"})
    # All lists should still work
    assert client.get("/products").status_code == 200
    assert client.get("/customers").status_code == 200
    assert client.get("/orders").status_code == 200
    # Original data still present
    assert len(client.get("/products").json()) == 1
    assert len(client.get("/customers").json()) == 1
