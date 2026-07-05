import "./globals.css";
import Header from "./components/Header";

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
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/streamsathi-favicon.svg?v=2" type="image/svg+xml" />
        <link rel="shortcut icon" href="/streamsathi-favicon.svg?v=2" type="image/svg+xml" />
      </head>
      <body>
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
