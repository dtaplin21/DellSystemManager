import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './tailwind.css';
import './globals.css';
import { AuthProvider } from '../contexts/auth-context';
import { WebSocketProvider } from '../contexts/websocket-context';
import { Toaster } from '../components/ui/toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GeoQC - Geosynthetic Quality Control Management',
  description: 'Professional QC management application for geosynthetic projects',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <WebSocketProvider>
            {children}
            <Toaster />
          </WebSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
