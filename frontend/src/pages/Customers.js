import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Search, Users, Mail, Phone, X } from 'lucide-react';
import { getCustomers, createCustomer, deleteCustomer } from '../services/api';

function CustomerModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      await createCustomer(form);
      toast.success('Customer added');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add customer');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Add Customer</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Full Name <span className="req">*</span></label>
            <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rahul Sharma" />
            {errors.name && <p className="form-error">{errors.name}</p>}
          </div>
          <div className="form-group">
            <label>Email <span className="req">*</span></label>
            <input className="form-control" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="rahul@example.com" />
            {errors.email && <p className="form-error">{errors.email}</p>}
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea className="form-control" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street, City, State..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    getCustomers()
      .then(r => setCustomers(r.data))
      .catch(err => toast.error(err.response?.data?.detail || 'Failed to load customers'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete customer "${c.name}"?`)) return;
    try {
      await deleteCustomer(c.id);
      toast.success('Customer deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Customers</h2>
          <p className="subtitle">{customers.length} customer{customers.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} /> Add Customer</button>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or phone..." />
          </div>
        </div>

        {loading ? <div className="loading"><div className="spinner" /></div> : (
          filtered.length === 0 ? (
            <div className="empty-state">
              <div className="icon-wrap"><Users size={20} /></div>
              <p>{search ? 'No customers match your search' : 'No customers yet. Click "Add Customer" to get started.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th className="hide-mobile">Phone</th>
                    <th className="hide-mobile">Joined</th>
                    <th style={{ width: 60, textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td className="td-name">{c.name}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={12} color="var(--text-4)" />{c.email}
                        </span>
                      </td>
                      <td className="hide-mobile">
                        {c.phone ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Phone size={12} color="var(--text-4)" />{c.phone}
                          </span>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td className="hide-mobile td-muted">
                        {new Date(c.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(c)} title="Delete"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {showModal && <CustomerModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load(); }} />}
    </>
  );
}
