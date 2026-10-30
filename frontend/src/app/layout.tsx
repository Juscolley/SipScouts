import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#E2725B",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://sipscouts.com"),
  title: "SipScouts — Find Your Next Perfect Sip",
  description: "Discover nearby cafés, tea houses, and cocktail bars serving your favorite drinks and ingredients.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SipScouts",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=4" },
      { url: "/icon-192.png?v=4", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=4", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=4", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "SipScouts — Find Your Next Perfect Sip",
    description: "Coffee, tea, or craft cocktails — search by drink or ingredient and discover hidden gems sorted by distance.",
    url: "https://sipscouts.com",
    siteName: "SipScouts",
    images: [
      {
        url: "/sipscouts-logo.jpg",
        width: 1024,
        height: 1024,
        alt: "SipScouts — Coffee, Tea & Craft Cocktail Discovery",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SipScouts — Find Your Next Perfect Sip",
    description: "Coffee, tea, or craft cocktails — search by drink or ingredient and discover hidden gems sorted by distance.",
    images: ["/sipscouts-logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
