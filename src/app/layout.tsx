import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Forge | Manufacturing Operations',
  description: 'Manufacturing process tracking and production operations.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
