'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '../config';

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const platform = searchParams.get('platform') || '';
  const plan = searchParams.get('plan') || '';
  const price = searchParams.get('price') || '';

  const [user, setUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [targetGmail, setTargetGmail] = useState('');
  const [targetPassword, setTargetPassword] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('eSewa'); // 'eSewa' or 'Khalti'
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const redirectTimer = useRef(null);
  const previewUrlRef = useRef(null);

  // Cleanup object URL and redirect timer on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push(`/login?redirect=checkout&platform=${platform}&plan=${plan}&price=${price}`);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
        } else {
          localStorage.removeItem('token');
          router.push(`/login?redirect=checkout&platform=${platform}&plan=${plan}&price=${price}`);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to reach backend server. Please verify database connectivity.');
      } finally {
        setLoadingSession(false);
      }
    };

    if (platform && plan && price) {
      fetchSession();
    } else {
      router.push('/');
    }
  }, [platform, plan, price, router]);

  const [qrSettings, setQrSettings] = useState({ esewa_qr: '/images/esewa_qr.jpg', khalti_qr: '/images/khalti_qr.jpg' });

  useEffect(() => {
    const fetchQrSettings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/settings`);
        const data = await res.json();
        if (data.success && data.settings) {
          setQrSettings({
            esewa_qr: data.settings.esewa_qr || '/images/esewa_qr.jpg',
            khalti_qr: data.settings.khalti_qr || '/images/khalti_qr.jpg'
          });
        }
      } catch (err) {
        console.error('Error fetching payment QRs:', err);
      }
    };
    void fetchQrSettings();
  }, []);

  const getQrSource = () => {
    const val = paymentMethod === 'eSewa' ? qrSettings.esewa_qr : qrSettings.khalti_qr;
    if (val.startsWith('/uploads/')) {
      return `${API_BASE_URL}${val}`;
    }
    return val;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Revoke previous object URL to prevent memory leak
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setScreenshotFile(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');


    if (!screenshotFile) {
      setError('Please upload your payment verification receipt screenshot.');
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const formData = new FormData();
      formData.append('platform', platform);
      formData.append('planSelected', plan);
      formData.append('amountPaidNPR', price);
      formData.append('targetStreamingGmail', String(targetGmail || '').trim());
      formData.append('targetStreamingPassword', String(targetPassword || '').trim());
      formData.append('paymentMethod', paymentMethod);
      formData.append('screenshot', screenshotFile);

      const res = await fetch(`${API_BASE_URL}/api/orders/place-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Order placed successfully! Redirecting to dashboard...');
        redirectTimer.current = setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setError(data.message || 'Checkout failed. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error submitting your order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSession) {
    return <div className="text-center py-20 text-slate-500">Verifying authorization...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 max-w-6xl mx-auto items-start">
      
      {/* Checkout details & Credentials forms */}
      <div className="glass-card rounded-2xl p-5 md:p-8 shadow-xl">
        <h2 className="text-xl md:text-2xl font-bold mb-6 text-slate-950">
          Secure Activation Checkout
        </h2>
        
        {/* Selected Plan Details banner */}
        <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 md:p-5 mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider">Requested Subscription</p>
            <p className="text-lg md:text-xl font-bold text-slate-950 mt-1">
              {platform} — <span className="text-blue-700">{plan}</span>
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-slate-500 text-xs uppercase tracking-wider">Amount NPR</p>
            <p className="text-xl md:text-2xl font-extrabold text-emerald-600 mt-1">
              Rs. {price}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg mb-6 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* Padlock trust banner */}
          <div className="bg-cyan-50 border border-cyan-100 text-cyan-900 p-4 rounded-xl flex flex-col sm:flex-row sm:items-start gap-3 text-xs leading-relaxed">
            <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Secure</span>
            <span><strong>Privacy Guarantee:</strong> Credentials are encrypted and used only for the 5-minute activation window.</span>
          </div>

          <div>
            <h3 className="text-md font-bold text-slate-950 mb-2 pb-2 border-b border-slate-100">
              Streaming Account Access
            </h3>
            
            {/* Explanatory Info Warning Alert */}
            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 flex flex-col gap-2.5 text-xs leading-relaxed mb-4">
              <span className="font-bold flex items-center gap-1.5 text-amber-800 text-sm">
                ⚠️ Enter your actual {platform} login details
              </span>
              <p>
                Provide the email address and password you use to sign in to <strong>{platform}</strong> (NOT your StreamSathi login credentials). 
              </p>
              <p>
                <strong>Why?</strong> Our activation agent logs in securely using these credentials during the 5-minute activation window to purchase and configure your selected <strong>{plan}</strong> subscription directly.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 border-t border-amber-200/50 pt-2.5 text-[11px] text-amber-800 font-medium">
                <span>🔒 SSL Encrypted & Secure</span>
                <span>🔑 Change password after activation</span>
              </div>
            </div>
          </div>

          <div className="floating-label-group">
            <input
              type="text"
              id="targetGmail"
              required
              className="floating-label-input"
              placeholder=" "
              value={targetGmail}
              onChange={(e) => setTargetGmail(e.target.value)}
            />
            <label className="floating-label-text" htmlFor="targetGmail">Your {platform} Email / Phone</label>
          </div>

          <div className="floating-label-group">
            <input
              type="password"
              id="targetPassword"
              required
              className="floating-label-input"
              placeholder=" "
              value={targetPassword}
              onChange={(e) => setTargetPassword(e.target.value)}
            />
            <label className="floating-label-text" htmlFor="targetPassword">Your {platform} Password</label>
          </div>

          {/* Screenshot receipt dropzone container */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
              Payment Receipt Screenshot
            </label>
            
            <div 
              className="upload-dropzone" 
              onClick={() => document.getElementById('receipt-upload').click()}
            >
              <input
                type="file"
                id="receipt-upload"
                accept="image/*"
                required
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {previewUrl ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img
                      src={previewUrl}
                      alt="Receipt preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  <span className="text-emerald-700 text-xs font-medium flex items-center gap-1">
                    Receipt image loaded: {screenshotFile.name.length > 25 ? screenshotFile.name.slice(0, 22) + '...' : screenshotFile.name} ({Math.round(screenshotFile.size / 1024)} KB)
                  </span>
                  <span className="text-blue-700 text-xs font-semibold underline">Replace screenshot receipt</span>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: '2.5rem' }}>📤</span>
                  <span className="font-semibold text-slate-900 text-sm">Click or drag to upload screenshot receipt</span>
                  <span className="text-slate-500 text-xs">JPEG, PNG, or WEBP formats up to 5MB</span>
                </>
              )}
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn btn-primary w-full py-4 text-base rounded-xl mt-4">
            {submitting ? 'Submitting Order...' : `Pay & Submit Order (Rs. ${price})`}
          </button>
        </form>
      </div>

      {/* Payment details & QR Scan codes */}
      <div className="glass-card rounded-2xl p-5 md:p-8 shadow-xl flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-950 mb-2">
            Digital Wallet Payment
          </h2>
          <p className="text-slate-500 text-xs">
            Toggle your digital wallet, scan the dynamic QR merchant display, transfer exact NPR, and upload a screenshot receipt.
          </p>
        </div>

        {/* Segmented Brand Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div
            className={`payment-toggle-btn ${paymentMethod === 'eSewa' ? 'esewa-selected shadow-[0_4px_12px_rgba(79,175,47,0.15)] ring-1 ring-[#4faf2f]' : 'hover:bg-slate-50'}`}
            onClick={() => setPaymentMethod('eSewa')}
          >
            eSewa Merchant
          </div>
          <div
            className={`payment-toggle-btn ${paymentMethod === 'Khalti' ? 'khalti-selected shadow-[0_4px_12px_rgba(92,45,145,0.15)] ring-1 ring-[#5c2d91]' : 'hover:bg-slate-50'}`}
            onClick={() => setPaymentMethod('Khalti')}
          >
            Khalti Merchant
          </div>
        </div>

        <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-inner">
          <h3 className="font-bold text-sm mb-4 uppercase tracking-wider" style={{ color: paymentMethod === 'eSewa' ? '#4faf2f' : '#a78bfa' }}>
            Merchant QR: Scan with {paymentMethod} App
          </h3>

          <div className="relative aspect-square w-full max-w-64 rounded-2xl overflow-hidden border border-slate-200 bg-white p-2 shadow-xl flex items-center justify-center">
            <img
              src={getQrSource()}
              alt={`${paymentMethod} QR code`}
              className="object-contain rounded-xl w-full h-full"
            />
          </div>

          <div className="w-full mt-6 pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span>Merchant Account Name:</span>
              <strong className="text-slate-950">StreamSathi Storefront Ltd.</strong>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span>Required NPR Amount:</span>
              <strong className="text-emerald-600 font-bold">Rs. {price}</strong>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span>Transaction Remarks:</span>
              <span className="text-slate-950 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px]">Your Gmail Address</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default function Checkout() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading checkout parameters...</div>}>
      <CheckoutForm />
    </Suspense>
  );
}
