import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { Navbar } from "@/components/navbar";

const inter = Inter({ subsets: ['latin'] });

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const SITE_DESCRIPTION = 'AI-powered platform that streamlines municipal building permit reviews, reducing delays and costs through automated compliance checking of architectural plans against building codes and regulations.';

export const metadata: Metadata = {
  title: 'CivicStream - Architectural Plan Review',
  description: SITE_DESCRIPTION,
  keywords: ['architectural plans', 'compliance review', 'building codes', 'construction', 'architecture'],
  authors: [{ name: 'CivicStream' }],
  creator: 'CivicStream',
  publisher: 'CivicStream',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    title: 'CivicStream - Architectural Plan Review',
    description: SITE_DESCRIPTION,
    siteName: 'CivicStream',
    images: [
      {
        url: `${BASE_URL}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: 'CivicStream - Architectural Plan Review',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CivicStream - Architectural Plan Review',
    description: SITE_DESCRIPTION,
    images: [`${BASE_URL}/opengraph-image.png`],
    creator: '@civicstream',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <Navbar />
            <main className="min-h-screen">
              {children}
            </main>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>

        {/* HubSpot Tracking Code */}
        <Script
          id="hs-script-loader"
          src="//js-na2.hs-scripts.com/243464187.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}