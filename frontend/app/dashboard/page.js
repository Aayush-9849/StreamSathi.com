'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../config';

export default function UserDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        // Profile
        const profileRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const profileData = await profileRes.json();
        
        if (!profileData.success) {
          localStorage.removeItem('token');
          router.push('/login');
          return;
        }

        setUser(profileData.user);

        // My orders
        const ordersRes = await fetch(`${API_BASE_URL}/api/orders/my-orders`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const ordersData = await ordersRes.json();
        if (ordersData.success) {
          setOrders(ordersData.orders);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to query dashboard database.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return <div className="text-center py-20 text-slate-500">Loading dashboard details...</div>;
  }

  if (error) {
    return (
      <div className="glass-card max-w-lg mx-auto text-center p-5 sm:p-8 mt-12">
        <p className="text-red-600 font-semibold mb-6">{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary">Retry</button>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return <span className="badge badge-pending">Pending</span>;
      case 'In Progress':
        return <span className="badge badge-progress">In Progress</span>;
      case 'Active':
        return <span className="badge badge-completed">Active</span>;
      case 'Deactivated':
        return <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.25rem 0.6rem', fontSize: '0.7rem' }}>Deactivated</span>;
      case 'Cancelled':
        return <span className="badge badge-cancelled">Cancelled</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Delete your StreamSathi account permanently? This will remove your profile and order history.')) {
      return;
    }

    setDeleting(true);
    setError('');
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();

      if (data.success) {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth-change'));
        router.push('/');
      } else {
        setError(data.message || 'Failed to delete account.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error deleting account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      
      {/* Profile summary banner */}
      <div className="glass-card rounded-2xl p-5 md:p-8 flex flex-col md:flex-row md:justify-between md:items-center gap-6 shadow-xl">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-950">My Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back, <strong className="text-slate-950">{user?.name}</strong>!
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-8 w-full md:w-auto">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider">Registered Gmail</p>
            <p className="font-bold text-sm text-blue-700 mt-1">{user?.email}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider">WhatsApp Contact</p>
            <p className="font-bold text-sm text-blue-700 mt-1">{user?.whatsApp}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider">Account Status</p>
            <span className="badge badge-completed mt-1.5">Active Account</span>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 md:p-6 shadow-xl border border-red-100">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Account Settings</h2>
            <p className="text-slate-500 text-xs mt-1">Delete your customer account and remove your saved order history.</p>
          </div>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="btn btn-secondary py-2 px-4 text-xs rounded-xl w-full sm:w-auto"
            style={{ color: '#dc2626', borderColor: 'rgba(220, 38, 38, 0.25)' }}
          >
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>

      {/* Orders history list */}
      <div className="glass-card rounded-2xl p-5 md:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-100 pb-6 mb-6">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-950">Your Orders History</h2>
            <p className="text-slate-500 text-xs mt-1">Overview of all active and past subscription orders.</p>
          </div>
          <Link href="/" className="btn btn-primary py-2 px-4 text-xs rounded-xl w-full sm:w-auto">
            + Buy New Subscription
          </Link>
        </div>

        {orders.length > 0 && (
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs md:text-sm text-indigo-900 mb-6 flex items-start gap-3">
            <span className="text-base select-none">⏳</span>
            <div>
              <p className="font-extrabold text-indigo-950 text-xs uppercase tracking-wider mb-1">
                Activation Processing Timeline
              </p>
              <p className="leading-relaxed font-normal">
                Your subscription requests are active in our queue. <strong>Under ordinary conditions, your plan will activate within 10 minutes.</strong>
              </p>
              <p className="leading-relaxed font-semibold mt-1.5 text-indigo-950">
                ⚠️ IMPORTANT: Please log in and use the streaming platform ONLY after the status turns to <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-1.5 py-0.5 rounded text-[10px]">Active</span>.
              </p>
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <span className="text-4xl">🛍️</span>
            <h3 className="font-bold text-slate-950 text-base">No orders found</h3>
            <p className="text-slate-500 text-xs max-w-xs mx-auto leading-relaxed">
              You haven&apos;t ordered any premium subscriptions yet. Pick a plan to begin!
            </p>
            <Link href="/" className="btn btn-outline py-2 px-5 text-xs rounded-xl">
              Browse Streaming Services
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="table-el">
              <thead>
                <tr>
                  <th>Order Date</th>
                  <th>Platform</th>
                  <th>Plan Tier</th>
                  <th>Paid Amount</th>
                  <th>Method</th>
                  <th>Target Gmail</th>
                  <th>Activation Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td className="text-slate-600">
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="font-bold text-slate-950">
                      <div className="flex items-center gap-2">
                        {order.platform === 'Netflix' && (
                          <img
                            src="/images/netflix.svg"
                            alt="Netflix logo"
                            className="w-6 h-6 rounded-md object-contain bg-black p-0.5 border border-slate-900 shadow-sm"
                          />
                        )}
                        {order.platform === 'Amazon Prime' && (
                          <img
                            src="/images/prime.svg"
                            alt="Amazon Prime logo"
                            className="w-6 h-6 rounded-md object-contain bg-slate-950 p-0.5 border border-slate-800 shadow-sm"
                          />
                        )}
                        {order.platform === 'SonyLIV' && (
                          <img
                            src="/images/sonyliv.png"
                            alt="SonyLIV logo"
                            className="w-6 h-6 rounded-md object-contain bg-[#0a0a0f] p-0.5 border border-slate-800 shadow-sm"
                          />
                        )}
                        {order.platform === 'Zee5' && (
                          <img
                            src="/images/zee5.svg"
                            alt="Zee5 logo"
                            className="w-6 h-6 rounded-md object-contain bg-slate-50 border border-slate-100 shadow-sm"
                          />
                        )}
                        <span>{order.platform}</span>
                      </div>
                    </td>
                    <td className="text-slate-600">{order.planSelected}</td>
                    <td className="font-bold text-emerald-600">Rs. {order.amountPaidNPR}</td>
                    <td className="text-slate-600">{order.paymentMethod}</td>
                    <td className="font-mono text-xs text-blue-700">{order.targetStreamingGmail}</td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        {getStatusBadge(order.status)}
                        {order.status === 'Active' && order.expiresAt && (
                          <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                            {(() => {
                              const diff = Math.max(0, Math.ceil((new Date(order.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)));
                              return diff === 0 ? '⏰ Expires today' : `⏰ ${diff} days left`;
                            })()}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
