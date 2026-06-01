import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Search, ShoppingCart, Eye, X } from 'lucide-react';
import { getOrders, getOrder, createOrder, deleteOrder, updateOrderStatus, getProducts, getCustomers } from '../services/api';

const STATUS_COLORS = { pending: 'amber', processing: 'blue', shipped: 'purple', delivered: 'green', cancelled: 'red' };
const STATUS_OPTIONS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

function CreateOrderModal({ onClose, onSave }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getCustomers(), getProducts()]).then(([c, p]) => {
      setCustomers(c.data);
      setProducts(p.data);
    });
  }, []);

  const addItem = () => setItems([...items, { product_id: '', quantity: 1 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: val };
    setItems(updated);
  };

  const getTotal = () => items.reduce((sum, item) => {
    const p = products.find(p => p.id === parseInt(item.product_id));
    return sum + (p ? p.price * (parseInt(item.quantity) || 0) : 0);
  }, 0);

  const handleSubmit = async () => {
    if (!customerId) { toast.error('Please select a customer'); return; }
    const validItems = items.filter(i => i.product_id && i.quantity > 0);
    if (!validItems.length) { toast.error('Add at least one product'); return; }
    setLoading(true);
    try {
      await createOrder({
        customer_id: parseInt(customerId),
        notes,
        items: validItems.map(i => ({ product_id: parseInt(i.product_id), quantity: parseInt(i.quantity) }))
      });
      toast.success('Order created!');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create order');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>Create New Order</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label>Customer *</label>
          <select className="form-control" value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">Select a customer...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Order Items *</label>
          {items.map((item, i) => (
            <div key={i} className="order-item-row" style={{ marginBottom: 10 }}>
              <select className="form-control" value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id} disabled={p.stock_quantity === 0}>
                    {p.name} — ₹{p.price} (Stock: {p.stock_quantity})
                  </option>
                ))}
              </select>
              <input
                className="form-control"
                type="number" min="1"
                value={item.quantity}
                onChange={e => updateItem(i, 'quantity', e.target.value)}
                placeholder="Qty"
              />
              {items.length > 1 && (
                <button className="btn-icon btn-icon-danger" onClick={() => removeItem(i)}><X size={14} /></button>
              )}
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Item</button>
        </div>

        {items.some(i => i.product_id) && (
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>Estimated Total</span>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.1rem' }}>₹{getTotal().toLocaleString()}</span>
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea className="form-control" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions, special requests..." />
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Placing...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrder(orderId).then(r => setOrder(r.data)).finally(() => setLoading(false));
  }, [orderId]);

  const handleStatus = async (status) => {
    try {
      const res = await updateOrderStatus(orderId, status);
      setOrder(res.data);
      toast.success(`Status updated to ${status}`);
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>Order #{orderId}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        {loading ? <div className="loading"><div className="spinner" /></div> : order && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, border: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--text3)', fontSize: '0.72rem', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customer</p>
                <p style={{ fontWeight: 600 }}>{order.customer?.name}</p>
                <p style={{ color: 'var(--text2)', fontSize: '0.83rem' }}>{order.customer?.email}</p>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 14, border: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--text3)', fontSize: '0.72rem', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Order Info</p>
                <p style={{ fontWeight: 600 }}>₹{order.total_amount.toLocaleString()}</p>
                <p style={{ color: 'var(--text2)', fontSize: '0.83rem' }}>{new Date(order.created_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="form-group">
              <label>Update Status</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    className={`badge badge-${STATUS_COLORS[s]} ${order.status === s ? '' : ''}`}
                    style={{ cursor: 'pointer', border: order.status === s ? '1px solid currentColor' : '1px solid transparent', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600 }}
                    onClick={() => handleStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Items</label>
              <div className="order-items-list">
                <div className="order-item-line" style={{ background: 'var(--bg)', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <span>Product</span><span>Qty</span><span>Subtotal</span>
                </div>
                {order.items.map(item => (
                  <div key={item.id} className="order-item-line">
                    <span className="td-name">{item.product?.name || `Product #${item.product_id}`}</span>
                    <span>{item.quantity}</span>
                    <span>₹{(item.unit_price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
                <div className="order-item-line" style={{ borderTop: '2px solid var(--border2)', fontWeight: 700 }}>
                  <span></span><span style={{ color: 'var(--text3)' }}>Total</span>
                  <span style={{ color: 'var(--accent2)' }}>₹{order.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {order.notes && (
              <div className="form-group">
                <label>Notes</label>
                <p style={{ color: 'var(--text2)', fontSize: '0.88rem' }}>{order.notes}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewId, setViewId] = useState(null);

  const load = () => {
    setLoading(true);
    getOrders()
      .then(r => setOrders([...r.data].reverse()))
      .catch(err => toast.error(err.response?.data?.detail || 'Failed to load orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (o) => {
    if (!window.confirm(`Cancel order #${o.id}? Stock will be restored.`)) return;
    try {
      await deleteOrder(o.id);
      toast.success('Order cancelled and stock restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel order');
    }
  };

  const filtered = orders.filter(o =>
    String(o.id).includes(search) ||
    (o.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    o.status.includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div><h2>Orders</h2><p>{orders.length} order{orders.length !== 1 ? 's' : ''} total</p></div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Order</button>
      </div>

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input className="form-control" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order #, customer, or status..." />
          </div>
        </div>
        {loading ? <div className="loading"><div className="spinner" /></div> : (
          filtered.length === 0 ? (
            <div className="empty-state"><ShoppingCart size={40} /><p>{search ? 'No orders match.' : 'No orders yet. Create your first order!'}</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id}>
                      <td className="td-name">#{o.id}</td>
                      <td>{o.customer?.name || '—'}</td>
                      <td style={{ color: 'var(--text3)' }}>{o.items?.length || 0} item{(o.items?.length || 0) !== 1 ? 's' : ''}</td>
                      <td style={{ fontWeight: 600 }}>₹{o.total_amount.toLocaleString()}</td>
                      <td><span className={`badge badge-${STATUS_COLORS[o.status] || 'gray'}`}>{o.status}</span></td>
                      <td style={{ fontSize: '0.8rem' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-icon" onClick={() => setViewId(o.id)} title="View Details"><Eye size={14} /></button>
                          {o.status !== 'delivered' && (
                            <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(o)} title="Cancel"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onSave={() => { setShowCreate(false); load(); }} />}
      {viewId && <OrderDetailModal orderId={viewId} onClose={() => { setViewId(null); load(); }} />}
    </>
  );
}
