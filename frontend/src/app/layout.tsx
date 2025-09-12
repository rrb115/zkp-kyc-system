import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { EthersProvider } from './EthersProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ZKP-KYC System',
  description: 'Zero-Knowledge Proof based KYC verification system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <EthersProvider>{children}</EthersProvider>
      </body>
    </html>
  );
}