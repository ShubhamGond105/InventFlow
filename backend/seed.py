"""
Seed script to populate the database with sample data for testing/demo.

Usage:
  docker compose exec backend python seed.py
  # OR locally:
  python seed.py
"""
from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

SAMPLE_PRODUCTS = [
    {"name": "Wireless Headphones", "sku": "WH-001", "price": 2499.0, "stock_quantity": 50, "category": "Electronics", "description": "Bluetooth 5.0, 30hr battery"},
    {"name": "Mechanical Keyboard", "sku": "KB-002", "price": 4999.0, "stock_quantity": 25, "category": "Electronics", "description": "RGB backlit, blue switches"},
    {"name": "Notebook A5", "sku": "NB-003", "price": 199.0, "stock_quantity": 200, "category": "Stationery", "description": "Hardcover, 200 dotted pages"},
    {"name": "Coffee Mug", "sku": "MG-004", "price": 349.0, "stock_quantity": 8, "category": "Kitchenware", "description": "Ceramic, 350ml"},
    {"name": "USB-C Cable", "sku": "CB-005", "price": 499.0, "stock_quantity": 100, "category": "Electronics", "description": "1m, 60W fast charging"},
    {"name": "Yoga Mat", "sku": "YM-006", "price": 1299.0, "stock_quantity": 3, "category": "Fitness", "description": "6mm thick, eco-friendly"},
]

SAMPLE_CUSTOMERS = [
    {"name": "Rahul Sharma", "email": "rahul@example.com", "phone": "+91-9876543210", "address": "Lucknow, UP"},
    {"name": "Priya Patel", "email": "priya@example.com", "phone": "+91-9123456789", "address": "Mumbai, MH"},
    {"name": "Amit Kumar", "email": "amit@example.com", "phone": "+91-9988776655", "address": "Delhi"},
]


def seed():
    db = SessionLocal()
    try:
        if db.query(models.Product).count() > 0:
            print("⚠️  Data already exists. Skipping seed (delete manually to re-seed).")
            return

        for p in SAMPLE_PRODUCTS:
            db.add(models.Product(**p))
        for c in SAMPLE_CUSTOMERS:
            db.add(models.Customer(**c))
        db.commit()

        print(f"✅ Seeded {len(SAMPLE_PRODUCTS)} products and {len(SAMPLE_CUSTOMERS)} customers")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
