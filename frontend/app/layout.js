import "./globals.css";
import Header from "./components/Header";
import VisitorTracker from "./components/VisitorTracker";
import { Outfit } from 'next/font/google';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-outfit',
});

export const metadata = {
  title: "StreamSathi | Premium Streaming Activations Nepal",
  description: "Activate your premium Netflix, Amazon Prime, SonyLIV, and Zee5 subscriptions instantly in Nepal using eSewa and Khalti.",
  icons: {
    icon: [{ url: "/streamsathi-favicon.svg?v=2", type: "image/svg+xml" }],
    shortcut: [{ url: "/streamsathi-favicon.svg?v=2", type: "image/svg+xml" }],
    apple: [{ url: "/streamsathi-favicon.svg?v=2", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={outfit.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://streamsathi-backend.onrender.com" />
        <link rel="icon" href="/streamsathi-favicon.svg?v=2" type="image/svg+xml" />
      </head>
      <body>
        <VisitorTracker />
        <Header />
        <main className="container max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1">
          {children}
        </main>
        <footer className="border-t border-slate-200/80 py-8 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} StreamSathi Nepal. All rights reserved. Secure Activation Platform.</p>
        </footer>
      </body>
    </html>
  );
}
