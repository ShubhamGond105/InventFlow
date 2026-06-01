import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Users, ShoppingCart, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { getStats, getProducts, getOrders } from '../services/api';

const STATUS_COLORS = {
  pending: 'amber', processing: 'blue', shipped: 'purple', delivered: 'green', cancelled: 'red',
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
        setRecentOrders(o.data.slice(0, 5));
      })
      .catch(() => {
        setStats({ total_products: 0, total_customers: 0, total_orders: 0, total_revenue: 0, low_stock_products: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const fmt = (n) => (n ?? 0).toLocaleString('en-IN');

  const statCards = [
    { label: 'Total Products', value: fmt(stats?.total_products), icon: <Package size={18} />, color: 'indigo' },
    { label: 'Total Customers', value: fmt(stats?.total_customers), icon: <Users size={18} />, color: 'blue' },
    { label: 'Total Orders', value: fmt(stats?.total_orders), icon: <ShoppingCart size={18} />, color: 'green' },
    { label: 'Revenue', value: `₹${fmt(stats?.total_revenue)}`, icon: <TrendingUp size={18} />, color: 'amber' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p className="subtitle">Overview of your inventory and orders</p>
        </div>
      </div>

      <div className="stat-grid">
        {statCards.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="info">
              <div className="label">{s.label}</div>
              <h3>{s.value}</h3>
            </div>
            <div className={`icon icon-${s.color}`}>{s.icon}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} color="var(--warning)" />
              Low Stock Alert
            </h3>
            <Link to="/products" className="card-link">View all →</Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="empty-state">
              <div className="icon-wrap"><Package size={20} /></div>
              <p>All products are well stocked</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Product</th><th>SKU</th><th className="num">Stock</th></tr>
                </thead>
                <tbody>
                  {lowStock.map(p => (
                    <tr key={p.id}>
                      <td className="td-name">{p.name}</td>
                      <td className="td-mono">{p.sku}</td>
                      <td className="num">
                        <span className={`badge badge-${p.stock_quantity === 0 ? 'red' : 'amber'}`}>
                          {p.stock_quantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} color="var(--info)" />
              Recent Orders
            </h3>
            <Link to="/orders" className="card-link">View all →</Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="empty-state">
              <div className="icon-wrap"><ShoppingCart size={20} /></div>
              <p>No orders yet</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Order</th><th className="hide-mobile">Customer</th><th className="num">Amount</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {recentOrders.map(o => (
                    <tr key={o.id}>
                      <td className="td-name">#{o.id}</td>
                      <td className="hide-mobile">{o.customer?.name || '—'}</td>
                      <td className="num td-amount">₹{o.total_amount.toLocaleString('en-IN')}</td>
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
