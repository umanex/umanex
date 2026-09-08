import type { Metadata } from 'next';
import { Fira_Sans } from 'next/font/google';
// Volgorde is functioneel: theme.css levert de ongelaagde :root/.dark rollaag,
// globals.css mag daar daarna overheen.
import '@umanex/tokens/theme.css';
import '@umanex/ui/globals.css';

const firaSans = Fira_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

// Zet de dark-class vóór first paint, zodat ThemeToggle geen flits van het verkeerde
// theme oplevert. Zelfde script als portfolio.
const themeInitScript = `(function () {
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();`;

export const metadata: Metadata = {
  title: 'umanex-apps',
  description: 'Lokaal dashboard: status en start van de apps in de monorepo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl-BE" className={firaSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen font-sans bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
