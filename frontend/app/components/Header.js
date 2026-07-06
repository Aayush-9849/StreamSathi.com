'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  const checkSession = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        return;
      }
      
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
      } else {
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch (err) {
      console.error('Session retrieval error:', err);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      void checkSession();
    };
    const sessionTimer = window.setTimeout(handleAuthChange, 0);
    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.clearTimeout(sessionTimer);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, [pathname, checkSession]);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error('Logout request error:', err);
    }
    localStorage.removeItem('token');
    setUser(null);
    window.dispatchEvent(new Event('auth-change'));
    router.push('/login');
  };

  const isAdmin = Boolean(user?.isAdmin);

  return (
    <header>
      <div className="nav-container">
        <Link href="/" className="logo text-base sm:text-xl font-extrabold text-slate-950 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20">
            S
          </span>
          <span>StreamSathi</span>
        </Link>
        <nav className="flex gap-3 sm:gap-4 items-center">
          <Link href="/" className={`text-sm font-semibold transition-colors duration-150 ${pathname === '/' ? 'text-blue-700' : 'text-slate-600 hover:text-blue-700'}`}>
            Home
          </Link>
          {user && (
            <Link href="/dashboard" className={`text-sm font-semibold transition-colors duration-150 ${pathname === '/dashboard' ? 'text-blue-700' : 'text-slate-600 hover:text-blue-700'}`}>
              Dashboard
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className={`text-sm font-semibold transition-colors duration-150 ${pathname === '/admin' ? 'text-rose-600' : 'text-slate-600 hover:text-rose-600'}`}>
              Admin Panel
            </Link>
          )}
          {user ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-slate-500">Hi, {user.name.split(' ')[0]}</span>
              <button onClick={handleLogout} className="btn btn-secondary py-1.5 px-3.5 text-xs rounded-lg">
                Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Link href="/login" className="btn btn-secondary py-1.5 px-3.5 text-xs rounded-lg">
                Login
              </Link>
              <Link href="/register" className="btn btn-primary py-1.5 px-3.5 text-xs rounded-lg">
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
