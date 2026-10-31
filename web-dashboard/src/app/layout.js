import { cookies } from 'next/headers';
import Navbar from '@/components/Navbar';
import './globals.css';

export const metadata = {
  title: 'GMaps LeadGen | Dashboard Prospek Google Maps & AI',
  description: 'Dashboard kelola data prospek Google Maps terintegrasi DeepSeek dan OpenRouter AI beserta ekstensi scraper',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090b',
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has('auth');

  return (
    <html lang="id">
      <body className="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased selection:bg-zinc-700 selection:text-white">
        {isAuthenticated && <Navbar />}
        <main>{children}</main>
      </body>
    </html>
  );
}
