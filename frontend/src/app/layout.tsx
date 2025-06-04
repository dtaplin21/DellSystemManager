import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../contexts/auth-context';
import { WebSocketProvider } from '../contexts/websocket-context';
import { Toaster } from '../components/ui/toast';

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
      <body className="font-sans antialiased">
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
