import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Toktok — ton feed vidéo',
  description: 'Un flux vertical de vidéos publiques TikTok.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
