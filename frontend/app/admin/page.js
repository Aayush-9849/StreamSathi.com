'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../config';

function PlanRow({ plan, onUpdate }) {
  const [price, setPrice] = useState(plan.price);
  const [details, setDetails] = useState(plan.details);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(plan._id, price, details);
    setSaving(false);
  };

  return (
    <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div className="flex-1 flex flex-col gap-1 w-full">
        <span className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">{plan.name}</span>
        <input
          type="text"
          className="w-full text-xs border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Plan description details note"
        />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto self-stretch md:self-center">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Rs.</span>
          <input
            type="number"
            className="w-full sm:w-24 text-xs border border-slate-200 rounded px-2.5 py-1.5 text-center bg-white text-slate-800 font-extrabold focus:outline-none focus:border-indigo-500"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary px-4 py-1.5 text-xs rounded-lg shrink-0 shadow-sm w-full sm:w-auto"
        >
          {saving ? 'Saving...' : 'Save 💾'}
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  
  // Tabs: 'orders', 'customers', 'prices', 'qrCodes'
  const [activeTab, setActiveTab] = useState('orders');
  
  // Orders State
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedScreenshotUrl, setSelectedScreenshotUrl] = useState('');
  
  // Plans & QRs State
  const [plans, setPlans] = useState([]);
  const [qrConfig, setQrConfig] = useState({ esewa_qr: '', khalti_qr: '' });
  const [uploadingQr, setUploadingQr] = useState(false);
  
  // QR Upload Local Files
  const [esewaFile, setEsewaFile] = useState(null);
  const [khaltiFile, setKhaltiFile] = useState(null);
  const [esewaPreview, setEsewaPreview] = useState('');
  const [khaltiPreview, setKhaltiPreview] = useState('');

  // Email Sender State
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailTitle, setEmailTitle] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const fetchGlobalOrders = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/admin/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.status === 403) {
        setError('Access denied. Administrator session is required.');
        setLoading(false);
        return;
      }

      if (data.success) {
        setOrders(data.orders);
      } else {
        setError(data.message || 'Failed to fetch administrative records.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failure loading admin database records.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchCustomers = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/admin/customers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.status === 403) {
        setError('Access denied. Administrator session is required.');
        setLoading(false);
        return;
      }

      if (data.success) {
        setCustomers(data.customers);
        setTotalCustomers(data.totalCustomers);
      } else {
        setError(data.message || 'Failed to fetch customer records.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failure loading customer records.');
    }
  }, [router]);

  const fetchStorefrontConfig = useCallback(async () => {
    try {
      const plansRes = await fetch(`${API_BASE_URL}/api/plans`);
      const plansData = await plansRes.json();
      if (plansData.success) {
        setPlans(plansData.plans);
      }

      const settingsRes = await fetch(`${API_BASE_URL}/api/settings`);
      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        setQrConfig(settingsData.settings);
      }
    } catch (err) {
      console.error('Failed loading storefront configurations:', err);
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void fetchGlobalOrders();
      void fetchCustomers();
      void fetchStorefrontConfig();
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [fetchGlobalOrders, fetchCustomers, fetchStorefrontConfig]);

  const handleUpdateStatus = async (orderId, targetStatus) => {
    if (!confirm(`Are you sure you want to mark this activation order as ${targetStatus}?`)) {
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/admin/update-status/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });

      const data = await res.json();
      if (data.success) {
        alert(`Order successfully marked as ${targetStatus}!`);
        void fetchGlobalOrders();
      } else {
        alert(data.message || 'Failed to update order status.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error updating order status.');
    }
  };

  const handleUpdatePlan = async (planId, price, details) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ price: Number(price), details })
      });
      const data = await res.json();
      if (data.success) {
        alert('Pricing plan updated successfully!');
        setPlans(prev => prev.map(p => p._id === planId ? data.plan : p));
      } else {
        alert(data.message || 'Failed to update pricing plan.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error updating pricing plan.');
    }
  };

  const handleQrUpload = async (key, file) => {
    if (!file) return;
    setUploadingQr(true);

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('key', key);
    formData.append('qrImage', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/upload-qr`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert(`${key === 'esewa_qr' ? 'eSewa' : 'Khalti'} merchant QR stand updated successfully!`);
        setQrConfig(prev => ({ ...prev, [key]: data.value }));
        if (key === 'esewa_qr') {
          setEsewaFile(null);
          setEsewaPreview('');
        } else {
          setKhaltiFile(null);
          setKhaltiPreview('');
        }
      } else {
        alert(data.message || 'Failed to upload QR image.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error uploading QR image.');
    } finally {
      setUploadingQr(false);
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailRecipient || !emailSubject || !emailMessage) {
      alert('Please provide Recipient Email, Subject, and Message.');
      return;
    }
    setSendingEmail(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/admin/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientEmail: emailRecipient,
          subject: emailSubject,
          title: emailTitle,
          message: emailMessage
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Email sent successfully to ${emailRecipient}!`);
        setEmailSubject('');
        setEmailTitle('');
        setEmailMessage('');
      } else {
        alert(data.message || 'Failed to send email.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while sending email.');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-slate-500">Loading administrative records...</div>;
  }

  if (error) {
    return (
      <div className="glass-card max-w-lg mx-auto text-center p-5 sm:p-8 mt-12">
        <p className="text-red-600 font-semibold mb-6">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <button onClick={() => router.push('/')} className="btn btn-secondary py-2 px-5 text-sm rounded-xl">Go Home</button>
          <button onClick={() => {
            localStorage.removeItem('token');
            router.push('/login');
          }} className="btn btn-primary py-2 px-5 text-sm rounded-xl">Login as Admin</button>
        </div>
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

  return (
    <div className="flex flex-col gap-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-red-500">Admin Control Cockpit</h1>
          <p className="text-slate-500 text-sm mt-1">Manage activations, pricing rates, plan descriptions, and QR codes.</p>
        </div>
        <button onClick={() => {
          void fetchGlobalOrders();
          void fetchCustomers();
          void fetchStorefrontConfig();
        }} className="btn btn-secondary py-2 px-4 text-xs rounded-xl shadow-sm w-full sm:w-auto">
          🔄 Refresh Dashboard
        </button>
      </div>

      {/* Segmented Dashboard Tabs */}
        <div className="flex border-b border-slate-200 mb-2 overflow-x-auto gap-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab('orders')}
          className={`py-3 px-4 font-bold text-sm transition-all duration-150 border-b-2 whitespace-nowrap ${activeTab === 'orders' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          📥 Activations ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`py-3 px-4 font-bold text-sm transition-all duration-150 border-b-2 whitespace-nowrap ${activeTab === 'customers' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Customers ({totalCustomers})
        </button>
        <button
          onClick={() => setActiveTab('prices')}
          className={`py-3 px-4 font-bold text-sm transition-all duration-150 border-b-2 whitespace-nowrap ${activeTab === 'prices' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          💰 Prices & Features
        </button>
        <button
          onClick={() => setActiveTab('qrCodes')}
          className={`py-3 px-4 font-bold text-sm transition-all duration-150 border-b-2 whitespace-nowrap ${activeTab === 'qrCodes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          📷 Merchant Wallet QRs
        </button>
        <button
          onClick={() => setActiveTab('sendEmail')}
          className={`py-3 px-4 font-bold text-sm transition-all duration-150 border-b-2 whitespace-nowrap ${activeTab === 'sendEmail' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          ✉️ Send Email
        </button>
      </div>

      {/* TABS CONTAINER */}
      
      {/* Tab 1: Orders */}
      {activeTab === 'orders' && (
        <>
          {orders.length === 0 ? (
            <div className="glass-card rounded-2xl text-center py-16">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg font-extrabold text-slate-500">0</span>
              <h3 className="font-bold text-slate-950 text-base mt-4">No incoming activations</h3>
              <p className="text-slate-500 text-xs mt-1">There are no client subscription activations pending.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {orders.map((order) => (
                <div key={order._id} className="glass-card rounded-2xl p-5 md:p-6 flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex justify-between items-start gap-3 mb-4">
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
                      <span className="text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <h3 className="text-base md:text-lg font-bold text-slate-950 mb-1.5 flex items-start gap-2">
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
                      <span>{order.platform} — <span className="text-blue-700">{order.planSelected}</span></span>
                    </h3>
                    
                    <p className="text-lg font-extrabold text-emerald-600 mb-4">
                      Rs. {order.amountPaidNPR} via {order.paymentMethod}
                    </p>

                    {/* Customer Info */}
                    <div className="text-xs text-slate-500 grid grid-cols-[76px_minmax(0,1fr)] gap-x-2 gap-y-1 pb-4 mb-4 border-b border-slate-100">
                      <span>Customer:</span>
                      <strong className="text-slate-950">{order.userId?.name || 'N/A'}</strong>
                      <span>Email:</span>
                      <span className="text-blue-700">{order.userId?.email || 'N/A'}</span>
                      <span>WhatsApp:</span>
                      <span>{order.userId?.whatsApp || 'N/A'}</span>
                    </div>

                    {/* Credentials */}
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl font-mono text-xs text-slate-700 flex flex-col gap-1.5 my-4">
                      <span className="text-[10px] text-rose-600 font-extrabold tracking-wider uppercase mb-1">
                        Target Profile credentials
                      </span>
                      <div>
                        <strong>Gmail:</strong> <span className="select-all">{order.targetStreamingGmail}</span>
                      </div>
                      <div>
                        <strong>Password:</strong> <span className="select-all">{order.targetStreamingPassword}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 mt-4">
                    <button
                      onClick={() => setSelectedScreenshotUrl(`${API_BASE_URL}${order.paymentScreenshotUrl}`)}
                      className="btn btn-secondary w-full py-2 text-xs rounded-xl shadow-sm"
                    >
                      View Receipt Screenshot 🖼️
                    </button>
                    
                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                      {order.status !== 'In Progress' && order.status !== 'Active' && (
                        <button
                          onClick={() => handleUpdateStatus(order._id, 'In Progress')}
                          className="btn btn-secondary flex-1 py-2 text-xs rounded-xl"
                          style={{ border: '1px solid rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}
                        >
                          In Progress
                        </button>
                      )}
                      {order.status !== 'Active' ? (
                        <button
                          onClick={() => handleUpdateStatus(order._id, 'Active')}
                          className="btn btn-primary flex-1 py-2 text-xs rounded-xl shadow-sm"
                          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          disabled
                          className="btn btn-secondary w-full py-2 text-xs rounded-xl opacity-50 cursor-not-allowed"
                        >
                          Activated
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 2: Customers */}
      {activeTab === 'customers' && (
        <div className="glass-card rounded-2xl p-5 md:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-100 pb-6 mb-6">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-950">Customers</h2>
              <p className="text-slate-500 text-xs mt-1">Total registered customer accounts: {totalCustomers}</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchCustomers()}
              className="btn btn-secondary py-2 px-4 text-xs rounded-xl w-full sm:w-auto"
            >
              Refresh Customers
            </button>
          </div>

          {customers.length === 0 ? (
            <div className="text-center py-16">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg font-extrabold text-slate-500">0</span>
              <h3 className="font-bold text-slate-950 text-base mt-4">No customers yet</h3>
              <p className="text-slate-500 text-xs mt-1">Customer accounts will appear here after registration.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table-el">
                <thead>
                  <tr>
                    <th>Joined</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>WhatsApp</th>
                    <th>Orders</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer._id}>
                      <td className="text-slate-600">
                        {new Date(customer.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="font-bold text-slate-950">{customer.name}</td>
                      <td className="font-mono text-xs text-blue-700">{customer.email}</td>
                      <td className="text-slate-600">{customer.whatsApp}</td>
                      <td className="font-bold text-slate-950">{customer.totalOrders}</td>
                      <td>
                        <span className="badge badge-completed">Active</span>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setEmailRecipient(customer.email);
                            setActiveTab('sendEmail');
                          }}
                          className="btn btn-secondary py-1 px-3 text-xs rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-200 shadow-sm"
                        >
                          Email ✉️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Pricing */}
      {activeTab === 'prices' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8">
            {['Netflix', 'Amazon Prime', 'SonyLIV', 'Zee5'].map((platform) => {
              const platformPlans = plans.filter(p => p.platform === platform);
              return (
                <div key={platform} className="glass-card rounded-2xl p-5 md:p-6 flex flex-col gap-4 border border-slate-100 shadow-sm bg-white">
                  <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
                    <span>{platform} Plans & Notes</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Group</span>
                  </h3>
                  <div className="flex flex-col gap-4">
                    {platformPlans.map((plan) => (
                      <PlanRow key={plan._id} plan={plan} onUpdate={handleUpdatePlan} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: QRs */}
      {activeTab === 'qrCodes' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
            
            {/* eSewa Setup */}
            <div className="glass-card rounded-2xl p-5 md:p-6 flex flex-col gap-5 border border-slate-100 bg-white">
              <h3 className="text-lg font-bold text-[#4faf2f] border-b border-slate-100 pb-3">
                eSewa Merchant QR Stand
              </h3>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative w-48 h-48 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-2 shadow-inner">
                  <img
                    src={esewaPreview || (qrConfig.esewa_qr ? (qrConfig.esewa_qr.startsWith('/uploads/') ? `${API_BASE_URL}${qrConfig.esewa_qr}` : qrConfig.esewa_qr) : '/images/esewa_qr.jpg')}
                    alt="eSewa QR Code"
                    className="object-contain w-full h-full"
                  />
                </div>
                
                <label className="btn btn-secondary text-xs py-2 px-4 rounded-xl cursor-pointer">
                  Select eSewa QR Image 📁
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setEsewaFile(file);
                        setEsewaPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>

                {esewaFile && (
                  <button
                    onClick={() => handleQrUpload('esewa_qr', esewaFile)}
                    disabled={uploadingQr}
                    className="btn btn-primary text-xs py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                  >
                    {uploadingQr ? 'Saving...' : 'Upload & Save eSewa QR 🚀'}
                  </button>
                )}
              </div>
            </div>

            {/* Khalti Setup */}
            <div className="glass-card rounded-2xl p-5 md:p-6 flex flex-col gap-5 border border-slate-100 bg-white">
              <h3 className="text-lg font-bold text-[#5c2d91] border-b border-slate-100 pb-3">
                Khalti Merchant QR Stand
              </h3>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative w-48 h-48 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-2 shadow-inner">
                  <img
                    src={khaltiPreview || (qrConfig.khalti_qr ? (qrConfig.khalti_qr.startsWith('/uploads/') ? `${API_BASE_URL}${qrConfig.khalti_qr}` : qrConfig.khalti_qr) : '/images/khalti_qr.jpg')}
                    alt="Khalti QR Code"
                    className="object-contain w-full h-full"
                  />
                </div>
                
                <label className="btn btn-secondary text-xs py-2 px-4 rounded-xl cursor-pointer w-full sm:w-auto">
                  Select Khalti QR Image 📁
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setKhaltiFile(file);
                        setKhaltiPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>

                {khaltiFile && (
                  <button
                    onClick={() => handleQrUpload('khalti_qr', khaltiFile)}
                    disabled={uploadingQr}
                    className="btn btn-primary text-xs py-2 px-5 rounded-xl bg-purple-700 hover:bg-purple-800 shadow-sm w-full sm:w-auto"
                  >
                    {uploadingQr ? 'Saving...' : 'Upload & Save Khalti QR 🚀'}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab 5: Send Email */}
      {activeTab === 'sendEmail' && (
        <div className="glass-card rounded-2xl p-6 md:p-8 max-w-2xl mx-auto border border-slate-100 bg-white shadow-xl">
          <div className="border-b border-slate-100 pb-4 mb-6">
            <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span>✉️ Send Direct Email to Customer</span>
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              Send personalized updates, activation instructions, or support messages directly to any registered customer.
            </p>
          </div>

          <form onSubmit={handleSendEmail} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Quick Select Customer
              </label>
              <select
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
              >
                <option value="">-- Choose a Customer from Database ({customers.length}) --</option>
                {customers.map((c) => (
                  <option key={c._id} value={c.email}>
                    {c.name} ({c.email}) - {c.totalOrders} order(s)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Recipient Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="customer@example.com"
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-blue-600 font-mono"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Heading / Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Your Subscription is Now Active!"
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-blue-600 font-semibold"
                value={emailTitle}
                onChange={(e) => setEmailTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Subject Line *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. StreamSathi Account & Order Update"
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-blue-600"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Message Content *
              </label>
              <textarea
                required
                rows={6}
                placeholder="Type your message here. Line breaks and paragraphs will be automatically styled."
                className="w-full text-sm border border-slate-200 rounded-xl p-3.5 bg-white text-slate-800 focus:outline-none focus:border-blue-600 font-sans leading-relaxed"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={() => {
                  setEmailSubject('');
                  setEmailTitle('');
                  setEmailMessage('');
                }}
                className="btn btn-secondary px-5 py-2.5 text-xs rounded-xl"
              >
                Clear Form
              </button>
              <button
                type="submit"
                disabled={sendingEmail || !emailRecipient || !emailSubject || !emailMessage}
                className="btn btn-primary px-6 py-2.5 text-xs rounded-xl shadow-sm"
              >
                {sendingEmail ? (
                  <>
                    <span className="spinner mr-2" /> Sending Email...
                  </>
                ) : (
                  'Send Email Now 🚀'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Screenshot full image receipt modal */}
      {selectedScreenshotUrl && (
        <div 
          className="modal-overlay" 
          onClick={() => setSelectedScreenshotUrl('')}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.06)', padding: '2rem', borderRadius: '24px', maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900">Payment Verification Proof</h3>
              <button
                className="btn btn-secondary py-1.5 px-3 text-xs rounded-lg shadow-sm"
                onClick={() => setSelectedScreenshotUrl('')}
              >
                Close ✕
              </button>
            </div>
            <img
              src={selectedScreenshotUrl}
              alt="Payment receipt proof"
              style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '12px' }}
            />
            <a
              href={selectedScreenshotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline py-2.5 text-center text-xs rounded-xl mt-2"
            >
              Open Receipt in New Tab ↗
            </a>
          </div>
        </div>
      )}

    </div>
  );
}
