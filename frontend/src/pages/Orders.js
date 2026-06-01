import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Search, ShoppingCart, Eye, X } from 'lucide-react';
import { getOrders, getOrder, createOrder, deleteOrder, updateOrderStatus, getProducts, getCustomers } from '../services/api';

const STATUS_COLORS = { pending: 'amber', processing: 'blue', shipped: 'purple', delivered: 'green', cancelled: 'red' };
const STATUS_OPTIONS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const STATUS_VAR = {
  amber: 'var(--warning)',
  blue: 'var(--info)',
  purple: 'var(--purple)',
  green: 'var(--success)',
  red: 'var(--danger)',
};

function CreateOrderModal({ onClose, onSave }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getCustomers(), getProducts()]).then(([c, p]) => {
      setCustomers(c.data); setProducts(p.data);
    }).catch(() => toast.error('Failed to load data'));
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
      toast.success('Order created');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create order');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>New Order</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Customer <span className="req">*</span></label>
            <select className="form-control" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Select a customer...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Products <span className="req">*</span></label>
            {items.map((item, i) => (
              <div key={i} className="order-item-row">
                <select className="form-control" value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} disabled={p.stock_quantity === 0}>
                      {p.name} — ₹{p.price} (Stock: {p.stock_quantity})
                    </option>
                  ))}
                </select>
                <input className="form-control" type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" />
                {items.length > 1 ? (
                  <button className="btn-icon btn-icon-danger" onClick={() => removeItem(i)}><X size={14} /></button>
                ) : <div />}
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: 4 }}><Plus size={13} /> Add Item</button>
          </div>

          {items.some(i => i.product_id) && (
            <div className="summary">
              <span className="summary-label">Order Total</span>
              <span className="summary-value">₹{getTotal().toLocaleString('en-IN')}</span>
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea className="form-control" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions, special requests..." />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Order'}
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
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : order && (
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div className="info-plate">
                <div className="info-label">Customer</div>
                <div className="info-value">{order.customer?.name || '—'}</div>
                <div className="info-sub">{order.customer?.email}</div>
              </div>
              <div className="info-plate">
                <div className="info-label">Total</div>
                <div className="info-value" style={{ fontSize: '1.15rem', color: 'var(--primary-text)' }}>
                  ₹{order.total_amount.toLocaleString('en-IN')}
                </div>
                <div className="info-sub">{new Date(order.created_at).toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="form-group">
              <label>Status</label>
              <div className="status-picker">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    className={`status-btn ${order.status === s ? 'active' : ''}`}
                    style={{ color: STATUS_VAR[STATUS_COLORS[s]] }}
                    onClick={() => handleStatus(s)}
                  >
                    <span style={{ color: order.status === s ? '#fff' : STATUS_VAR[STATUS_COLORS[s]] }}>{s}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Items</label>
              <div className="order-items-list">
                <div className="order-item-line" style={{
                  background: 'var(--bg-subtle)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-3)',
                }}>
                  <span>Product</span><span>Qty</span><span style={{ textAlign: 'right' }}>Subtotal</span>
                </div>
                {order.items.map(item => (
                  <div key={item.id} className="order-item-line">
                    <span className="td-name">{item.product?.name || `Item #${item.product_id}`}</span>
                    <span>{item.quantity}</span>
                    <span className="td-amount" style={{ textAlign: 'right' }}>₹{(item.unit_price * item.quantity).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div className="order-item-line" style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-3)' }}>Total</span>
                  <span />
                  <span className="td-amount" style={{ textAlign: 'right', color: 'var(--primary-text)', fontSize: '1rem' }}>
                    ₹{order.total_amount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {order.notes && (
              <div className="form-group">
                <label>Notes</label>
                <div className="info-plate" style={{ color: 'var(--text-2)' }}>{order.notes}</div>
              </div>
            )}
          </div>
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
      .then(r => setOrders(r.data))
      .catch(err => toast.error(err.response?.data?.detail || 'Failed to load orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (o) => {
    if (!window.confirm(`Cancel order #${o.id}? Stock will be restored.`)) return;
    try {
      await deleteOrder(o.id);
      toast.success('Order cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel');
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
        <div>
          <h2>Orders</h2>
          <p className="subtitle">{orders.length} order{orders.length !== 1 ? 's' : ''} total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={15} /> New Order</button>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order #, customer, or status..." />
          </div>
        </div>

        {loading ? <div className="loading"><div className="spinner" /></div> : (
          filtered.length === 0 ? (
            <div className="empty-state">
              <div className="icon-wrap"><ShoppingCart size={20} /></div>
              <p>{search ? 'No orders match your search' : 'No orders yet. Click "New Order" to get started.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th className="hide-mobile num">Items</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                    <th className="hide-mobile">Date</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id}>
                      <td className="td-name">#{o.id}</td>
                      <td>{o.customer?.name || '—'}</td>
                      <td className="hide-mobile num td-muted">{o.items?.length || 0}</td>
                      <td className="num td-amount">₹{o.total_amount.toLocaleString('en-IN')}</td>
                      <td><span className={`badge badge-${STATUS_COLORS[o.status] || 'gray'}`}>{o.status}</span></td>
                      <td className="hide-mobile td-muted">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button className="btn-icon" onClick={() => setViewId(o.id)} title="View"><Eye size={14} /></button>
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
