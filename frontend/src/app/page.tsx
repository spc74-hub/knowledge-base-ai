/**
 * Landing page — Strategic palette.
 *
 * If the user already has a session token, we redirect them straight
 * to /dashboard (the PARA-first home). Public landing is only shown
 * to first-time visitors.
 */
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export default function Landing() {
    const { user, loading, signInWithCfAccess } = useAuth();
    const router = useRouter();
    // Try Cloudflare Access auto-login before showing the public landing, so a
    // user who already passed Access goes straight in (no second login).
    const [cfChecked, setCfChecked] = useState(false);

    useEffect(() => {
        if (loading) return;
        if (user) {
            router.replace('/dashboard');
            return;
        }
        if (!cfChecked) {
            signInWithCfAccess().finally(() => setCfChecked(true));
        }
    }, [loading, user, cfChecked, router, signInWithCfAccess]);

    // While deciding (auth loading, CF check pending, or redirecting), stay blank
    // to avoid flashing the "Iniciar sesión / Crear cuenta" screen.
    if (loading || !cfChecked || user) {
        return <main className="min-h-screen bg-background" />;
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12">
            <div className="max-w-3xl w-full text-center">
                <h1 className="font-serif text-6xl font-medium text-primary tracking-tight mb-4">
                    Kbia
                </h1>
                <p className="text-lg text-muted max-w-xl mx-auto mb-10">
                    Tu capa estratégica. Áreas, proyectos y objetivos para
                    decidir qué hacer con lo que has leído en otra parte.
                </p>

                <div className="flex gap-3 justify-center mb-20">
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
                    >
                        Iniciar sesión
                    </Link>
                    <Link
                        href="/register"
                        className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-6 py-3 text-sm font-medium text-foreground hover:bg-surface-muted transition-colors"
                    >
                        Crear cuenta
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                    <Feature
                        title="Inbox de captures"
                        body="Los contenidos enviados desde ContentHub llegan aquí esperando un sitio en tu sistema."
                    />
                    <Feature
                        title="Triage en PARA"
                        body="Asigna a área, proyecto u objetivo, y deja la acción que se deriva si la hay."
                    />
                    <Feature
                        title="Diario, hábitos, modelos"
                        body="La operación diaria con foco en lo que importa, sin ruido."
                    />
                </div>
            </div>
        </main>
    );
}

function Feature({ title, body }: { title: string; body: string }) {
    return (
        <div className="p-5 rounded-lg border border-border bg-surface">
            <h3 className="font-serif text-lg text-foreground mb-1">{title}</h3>
            <p className="text-sm text-muted">{body}</p>
        </div>
    );
}
