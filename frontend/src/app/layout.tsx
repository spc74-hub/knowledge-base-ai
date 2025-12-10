/**
 * Root layout for the application.
 */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Knowledge Base AI',
    description: 'Personal knowledge base with AI-powered classification and search',
    manifest: '/manifest.json',
    icons: {
        icon: '/icons/icon-192.png',
        apple: '/icons/apple-touch-icon.png',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'KBAI',
    },
    formatDetection: {
        telephone: false,
    },
    themeColor: '#f59e0b',
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className={inter.className}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
