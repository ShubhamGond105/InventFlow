from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime


# ── Product Schemas ──────────────────────────────────────
class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Product name (required)")
    sku: str = Field(..., min_length=1, max_length=100, description="Unique product code/SKU")
    description: Optional[str] = None
    price: float = Field(..., ge=0, description="Price must be >= 0")
    stock_quantity: int = Field(0, ge=0, description="Stock quantity cannot be negative")
    category: Optional[str] = Field(None, max_length=100)

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    stock_quantity: Optional[int] = Field(None, ge=0)
    category: Optional[str] = Field(None, max_length=100)

class Product(ProductBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ── Customer Schemas ─────────────────────────────────────
class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr = Field(..., description="Valid email address (must be unique)")
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None

class Customer(CustomerBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Order Item Schemas ────────────────────────────────────
class OrderItemBase(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0, description="Order quantity must be greater than 0")

class OrderItemCreate(OrderItemBase):
    pass

class OrderItem(OrderItemBase):
    id: int
    unit_price: float
    product: Optional[Product] = None
    model_config = ConfigDict(from_attributes=True)


# ── Order Schemas ─────────────────────────────────────────
OrderStatus = Literal["pending", "processing", "shipped", "delivered", "cancelled"]

class OrderBase(BaseModel):
    customer_id: int = Field(..., gt=0)
    notes: Optional[str] = None

class OrderCreate(OrderBase):
    items: List[OrderItemCreate] = Field(..., min_length=1, description="At least one item required")

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

class Order(OrderBase):
    id: int
    status: str
    total_amount: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    customer: Optional[Customer] = None
    items: List[OrderItem] = []
    model_config = ConfigDict(from_attributes=True)
