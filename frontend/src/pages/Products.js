import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search, Package } from 'lucide-react';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../services/api';

function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    description: product?.description || '',
    price: product?.price || '',
    stock_quantity: product?.stock_quantity ?? '',
    category: product?.category || '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.sku.trim()) e.sku = 'SKU is required';
    if (!form.price || isNaN(form.price) || Number(form.price) < 0) e.price = 'Valid price required';
    if (form.stock_quantity === '' || isNaN(form.stock_quantity) || Number(form.stock_quantity) < 0) e.stock_quantity = 'Valid quantity required';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const data = { ...form, price: parseFloat(form.price), stock_quantity: parseInt(form.stock_quantity) };
      if (product) await updateProduct(product.id, data);
      else await createProduct(data);
      toast.success(product ? 'Product updated!' : 'Product created!');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{product ? 'Edit Product' : 'Add Product'}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label>Product Name *</label>
          <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Wireless Headphones" />
          {errors.name && <p className="form-error">{errors.name}</p>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>SKU / Code *</label>
            <input className="form-control" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} placeholder="e.g. WH-001" disabled={!!product} />
            {errors.sku && <p className="form-error">{errors.sku}</p>}
          </div>
          <div className="form-group">
            <label>Category</label>
            <input className="form-control" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g. Electronics" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Price (₹) *</label>
            <input className="form-control" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00" />
            {errors.price && <p className="form-error">{errors.price}</p>}
          </div>
          <div className="form-group">
            <label>Stock Quantity *</label>
            <input className="form-control" type="number" min="0" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: e.target.value})} placeholder="0" />
            {errors.stock_quantity && <p className="form-error">{errors.stock_quantity}</p>}
          </div>
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional product description..." />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : (product ? 'Save Changes' : 'Create Product')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | product object

  const load = () => {
    setLoading(true);
    getProducts()
      .then(r => setProducts(r.data))
      .catch(err => toast.error(err.response?.data?.detail || 'Failed to load products'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct(p.id);
      toast.success('Product deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete product');
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div><h2>Products</h2><p>{products.length} product{products.length !== 1 ? 's' : ''} in inventory</p></div>
        <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={15} /> Add Product</button>
      </div>

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input className="form-control" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU, or category..." />
          </div>
        </div>
        {loading ? <div className="loading"><div className="spinner" /></div> : (
          filtered.length === 0 ? (
            <div className="empty-state"><Package size={40} /><p>{search ? 'No products match your search.' : 'No products yet. Add your first product!'}</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td className="td-name">{p.name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{p.sku}</td>
                      <td>{p.category ? <span className="badge badge-purple">{p.category}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td>₹{p.price.toLocaleString()}</td>
                      <td>
                        <span className={`badge badge-${p.stock_quantity === 0 ? 'red' : p.stock_quantity <= 10 ? 'amber' : 'green'}`}>
                          {p.stock_quantity}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-icon" onClick={() => setModal(p)} title="Edit"><Pencil size={14} /></button>
                          <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(p)} title="Delete"><Trash2 size={14} /></button>
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

      {modal && (
        <ProductModal
          product={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}
