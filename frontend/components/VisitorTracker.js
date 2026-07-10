'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Avoid tracking inside admin pages if desired, or track all storefront visits
    if (pathname && pathname.startsWith('/admin')) return;

    try {
      // Get or create unique visitor fingerprint in localStorage
      let visitorId = localStorage.getItem('streamsathi_vid');
      if (!visitorId) {
        visitorId = 'vid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        localStorage.setItem('streamsathi_vid', visitorId);
      }

      // Detect device type
      const ua = navigator.userAgent || '';
      let deviceType = 'Desktop';
      if (/mobile|android|iphone|ipod/i.test(ua)) {
        deviceType = 'Mobile';
      } else if (/ipad|tablet/i.test(ua)) {
        deviceType = 'Tablet';
      }

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://streamsathi-backend.onrender.com';

      fetch(`${API_BASE}/api/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          path: pathname || '/',
          referrer: document.referrer || 'Direct',
          userAgent: ua,
          deviceType,
        }),
      }).catch((err) => {
        // Silent catch for adblockers / offline
      });
    } catch (err) {
      // Silent error handler
    }
  }, [pathname]);

  return null;
}
