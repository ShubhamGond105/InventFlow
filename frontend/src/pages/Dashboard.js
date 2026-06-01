import React, { useEffect, useState } from 'react';
import { getStats, getProducts, getOrders } from '../services/api';
import { Package, Users, ShoppingCart, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_COLORS = {
  pending: 'amber', processing: 'blue', shipped: 'purple',
  delivered: 'green', cancelled: 'red',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getProducts(), getOrders()])
      .then(([s, p, o]) => {
        setStats(s.data);
        setLowStock(p.data.filter(pr => pr.stock_quantity <= 10).slice(0, 5));
        setRecentOrders(o.data.slice(-5).reverse());
      })
      .catch(() => {
        // Set safe defaults so UI doesn't crash
        setStats({ total_products: 0, total_customers: 0, total_orders: 0, total_revenue: 0, low_stock_products: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const statCards = [
    { label: 'Total Products', value: stats?.total_products ?? 0, icon: <Package size={18} />, color: 'var(--accent)', bg: 'var(--accent-dim)' },
    { label: 'Total Customers', value: stats?.total_customers ?? 0, icon: <Users size={18} />, color: 'var(--blue)', bg: 'var(--blue-dim)' },
    { label: 'Total Orders', value: stats?.total_orders ?? 0, icon: <ShoppingCart size={18} />, color: 'var(--green)', bg: 'var(--green-dim)' },
    { label: 'Revenue (non-cancelled)', value: `₹${(stats?.total_revenue ?? 0).toLocaleString()}`, icon: <TrendingUp size={18} />, color: 'var(--amber)', bg: 'var(--amber-dim)' },
  ];

  return (
    <>
      <div className="page-header">
        <div><h2>Dashboard</h2><p>Your inventory overview at a glance</p></div>
      </div>

      <div className="stat-grid">
        {statCards.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="info">
              <h3>{s.value}</h3>
              <p>{s.label}</p>
            </div>
            <div className="icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Low Stock */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="var(--amber)" />
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-head)' }}>Low Stock Alert</span>
            </div>
            <Link to="/products" style={{ fontSize: '0.78rem', color: 'var(--accent2)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {lowStock.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>All products are well stocked ✓</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Product</th><th>SKU</th><th>Stock</th></tr></thead>
                <tbody>
                  {lowStock.map(p => (
                    <tr key={p.id}>
                      <td className="td-name">{p.name}</td>
                      <td>{p.sku}</td>
                      <td><span className={`badge badge-${p.stock_quantity === 0 ? 'red' : 'amber'}`}>{p.stock_quantity}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} color="var(--blue)" />
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-head)' }}>Recent Orders</span>
            </div>
            <Link to="/orders" style={{ fontSize: '0.78rem', color: 'var(--accent2)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No orders yet</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Order #</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {recentOrders.map(o => (
                    <tr key={o.id}>
                      <td className="td-name">#{o.id}</td>
                      <td>{o.customer?.name || '—'}</td>
                      <td>₹{o.total_amount.toLocaleString()}</td>
                      <td><span className={`badge badge-${STATUS_COLORS[o.status] || 'gray'}`}>{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
