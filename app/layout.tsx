import './globals.css';
import type { Metadata, Viewport } from 'next';
import AppProvider from '@/components/AppProvider';
import PaletteProvider from '@/components/Palette';
import Header from '@/components/Header';
import Gate from '@/components/Gate';

export const metadata: Metadata = {
  title: 'Roster',
  description: 'Agency directory: classified, ranked and kept up to date automatically.'
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Applies the saved theme and language before first paint
const boot = `try{var t=JSON.parse(localStorage.getItem('roster:theme'));if(t)document.documentElement.dataset.theme=t;var l=JSON.parse(localStorage.getItem('roster:lang'))||'ar';document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>
        <AppProvider>
          <PaletteProvider>
            <Header />
            <Gate>{children}</Gate>
          </PaletteProvider>
        </AppProvider>
      </body>
    </html>
  );
}
