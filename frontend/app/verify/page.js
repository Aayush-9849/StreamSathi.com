'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '../config';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const redirectTimer = useRef(null);

  // Clean up redirect timer on unmount
  useEffect(() => {
    return () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); };
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleDigitChange = (val, index) => {
    const cleanVal = val.replace(/\D/g, '');
    const newOtp = [...otpArray];
    if (!cleanVal) {
      newOtp[index] = '';
      setOtpArray(newOtp);
      return;
    }
    const singleDigit = cleanVal.slice(-1);
    newOtp[index] = singleDigit;
    setOtpArray(newOtp);
    if (index < 5) {
      const nextInput = document.getElementById(`otp-digit-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleDigitKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      const newOtp = [...otpArray];
      if (otpArray[index]) {
        newOtp[index] = '';
        setOtpArray(newOtp);
      } else if (index > 0) {
        newOtp[index - 1] = '';
        setOtpArray(newOtp);
        const prevInput = document.getElementById(`otp-digit-${index - 1}`);
        if (prevInput) prevInput.focus();
      }
    }
  };

  const handleDigitPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    const numericPaste = pasteData.replace(/\D/g, '').slice(0, 6);
    if (numericPaste.length > 0) {
      const newOtp = ['', '', '', '', '', ''];
      for (let i = 0; i < 6; i++) newOtp[i] = numericPaste[i] || '';
      setOtpArray(newOtp);
      const targetIndex = Math.min(numericPaste.length, 5);
      const targetInput = document.getElementById(`otp-digit-${targetIndex}`);
      if (targetInput) targetInput.focus();
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email address first.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('A new OTP has been sent to your email. Please check your inbox and spam folder.');
        setOtpArray(['', '', '', '', '', '']);
        setCooldown(60);
        setTimeout(() => {
          const firstInput = document.getElementById('otp-digit-0');
          if (firstInput) firstInput.focus();
        }, 100);
      } else {
        setError(data.message || 'Failed to resend OTP.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed. Please check your internet and try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const otpCode = otpArray.join('');
    if (otpCode.length !== 6) {
      setError('Please fill in all 6 OTP digits.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Email verified! Logging you in...');
        if (data.token) localStorage.setItem('token', data.token);
        window.dispatchEvent(new Event('auth-change'));

        const redirect = searchParams.get('redirect');
        const platform = searchParams.get('platform');
        const plan = searchParams.get('plan');
        const price = searchParams.get('price');

        redirectTimer.current = setTimeout(() => {
          if (redirect === 'checkout' && platform && plan && price) {
            router.push(`/checkout?platform=${platform}&plan=${plan}&price=${price}`);
          } else {
            router.push('/dashboard');
          }
        }, 1500);
      } else {
        setError(data.message || 'Verification failed. Please check the code and try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
      <div className="glass-card rounded-2xl shadow-2xl p-6 sm:p-10" style={{ maxWidth: '450px', width: '100%' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.5rem', textAlign: 'center', color: '#111827' }}>
          Verify Your Email
        </h2>
        <p style={{ color: '#526071', fontSize: '0.9rem', textAlign: 'center', marginBottom: '2rem' }}>
          A 6-digit OTP was sent to your email address. Check your inbox and spam folder.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 p-3 rounded-lg mb-4 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="floating-label-group">
            <input
              type="email"
              id="email"
              required
              className="floating-label-input"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label className="floating-label-text" htmlFor="email">Email Address</label>
          </div>

          <div className="flex flex-col gap-2 mb-6">
            <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider text-center">
              Enter 6-Digit OTP Code
            </label>
            <div className="split-otp-container" onPaste={handleDigitPaste}>
              {otpArray.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-digit-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="split-otp-input"
                  value={digit}
                  onChange={(e) => handleDigitChange(e.target.value, index)}
                  onKeyDown={(e) => handleDigitKeyDown(e, index)}
                />
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2 py-3 rounded-xl">
            {loading ? 'Verifying...' : 'Verify & Activate Account'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={cooldown > 0}
            className={`text-sm font-semibold transition-all duration-150 border-b border-transparent ${
              cooldown > 0
                ? 'text-slate-400 cursor-not-allowed'
                : 'text-indigo-600 hover:text-indigo-800 hover:border-indigo-800'
            }`}
          >
            {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP Code ✉️'}
          </button>
        </div>

        <p style={{ color: '#526071', fontSize: '0.8rem', textAlign: 'center', marginTop: '1.5rem' }}>
          Didn&apos;t get the email? Check spam/junk folder or click Resend above.
        </p>
      </div>
    </div>
  );
}

export default function Verify() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>Loading verification...</div>}>
      <VerifyForm />
    </Suspense>
  );
}
