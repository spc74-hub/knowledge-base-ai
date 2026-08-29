/**
 * Root layout — Strategic palette (navy + cream), Crimson Pro + Inter.
 */
import type { Metadata } from 'next';
import { Inter, Crimson_Pro } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
});

const crimsonPro = Crimson_Pro({
    subsets: ['latin'],
    weight: ['400', '500', '600'],
    variable: '--font-crimson-pro',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Kbia',
    description: 'Tu capa estratégica: areas, proyectos, objetivos y captures.',
    manifest: '/manifest.json',
    icons: {
        icon: '/icons/icon-192.png',
        // 180 = iPhone, 167 = iPad Pro, 152 = iPad retina. Sin los dos últimos
        // el iPad no encuentra icono y pone una captura de la página.
        apple: [
            { url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' },
            { url: '/icons/apple-touch-icon-167.png', sizes: '167x167', type: 'image/png' },
            { url: '/icons/apple-touch-icon-152.png', sizes: '152x152', type: 'image/png' },
        ],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Kbia',
    },
    formatDetection: {
        telephone: false,
    },
    themeColor: '#1e3a5f',
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
        <html lang="es" suppressHydrationWarning className={`${inter.variable} ${crimsonPro.variable}`}>
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
