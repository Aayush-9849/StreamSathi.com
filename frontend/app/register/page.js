'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../config';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    whatsApp: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        router.push(`/verify?email=${encodeURIComponent(formData.email)}`);
      } else {
        setError(data.message || 'Registration failed. Please try again.');
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
          Create an Account
        </h2>
        <p style={{ color: '#526071', fontSize: '0.9rem', textAlign: 'center', marginBottom: '2rem' }}>
          Register to StreamSathi to activate your premium plans
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-6 text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="floating-label-group">
            <input
              type="text"
              id="name"
              name="name"
              required
              className="floating-label-input"
              placeholder=" "
              value={formData.name}
              onChange={handleChange}
            />
            <label className="floating-label-text" htmlFor="name">Full Name</label>
          </div>

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

          <div className="floating-label-group">
            <input
              type="text"
              id="whatsApp"
              name="whatsApp"
              required
              className="floating-label-input"
              placeholder=" "
              value={formData.whatsApp}
              onChange={handleChange}
            />
            <label className="floating-label-text" htmlFor="whatsApp">WhatsApp Number</label>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2 py-3 rounded-xl">
            {loading ? 'Registering...' : 'Register Account'}
          </button>
        </form>

        <p style={{ color: '#526071', fontSize: '0.9rem', textAlign: 'center', marginTop: '1.5rem' }}>
          Already have an account? <Link href="/login" style={{ color: '#2563eb', fontWeight: '600' }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}
