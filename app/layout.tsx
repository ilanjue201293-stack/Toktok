import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Toktok — lives TikTok',
  description: 'Un flux vertical de lives publics TikTok.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
