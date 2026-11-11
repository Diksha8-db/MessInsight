import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MessInsight - Smart Mess & Canteen Management',
  description: 'Smart Mess and Canteen Feedback System with Demand Prediction',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}

