'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../config';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('token', data.token);
        window.dispatchEvent(new Event('auth-change'));

        const redirect = searchParams.get('redirect');
        const platform = searchParams.get('platform');
        const plan = searchParams.get('plan');
        const price = searchParams.get('price');

        if (redirect === 'checkout' && platform && plan && price) {
          router.push(`/checkout?platform=${platform}&plan=${plan}&price=${price}`);
        } else {
          router.push('/');
        }
      } else if (data.notVerified && data.email) {
        // Account not verified — redirect to OTP verify page
        router.push(`/verify?email=${encodeURIComponent(data.email)}`);
      } else {
        setError(data.message || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed. Make sure backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <div className="glass-card rounded-2xl shadow-2xl p-6 sm:p-10" style={{ maxWidth: '450px', width: '100%' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.5rem', textAlign: 'center', color: '#111827' }}>
          Welcome Back
        </h2>
        <p style={{ color: '#526071', fontSize: '0.9rem', textAlign: 'center', marginBottom: '2rem' }}>
          Login to manage and buy your subscriptions
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="floating-label-group">
            <input
              type="email"
              id="email"
              name="email"
              required
              className="floating-label-input"
              placeholder=" "
              value={formData.email}
              onChange={handleChange}
            />
            <label className="floating-label-text" htmlFor="email">Gmail Address</label>
          </div>

          <div className="floating-label-group">
            <input
              type="password"
              id="password"
              name="password"
              required
              className="floating-label-input"
              placeholder=" "
              value={formData.password}
              onChange={handleChange}
            />
            <label className="floating-label-text" htmlFor="password">Password</label>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2 py-3 rounded-xl">
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ color: '#526071', fontSize: '0.9rem', textAlign: 'center', marginTop: '1.5rem' }}>
          Don&apos;t have an account? <Link href="/register" style={{ color: '#2563eb', fontWeight: '600' }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>Loading login...</div>}>
      <LoginForm />
    </Suspense>
  );
}
