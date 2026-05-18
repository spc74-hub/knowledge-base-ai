/**
 * BridgeBanner — first-run explainer that surfaces on the home when the user
 * has captures sitting in the inbox. Dismissed via localStorage so it shows
 * once and only re-appears if the user clears storage.
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'kbia-bridge-banner-dismissed';

export default function BridgeBanner({ untriagedCount }: { untriagedCount: number }) {
    const [dismissed, setDismissed] = useState(true); // start dismissed, flip after mount

    useEffect(() => {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        setDismissed(stored === '1');
    }, []);

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY, '1');
        setDismissed(true);
    };

    if (dismissed || untriagedCount === 0) return null;

    return (
        <div className="mb-10 rounded-xl border border-primary/20 bg-primary-soft/40 p-5 relative">
            <button
                onClick={handleDismiss}
                aria-label="Cerrar banner"
                className="absolute top-3 right-3 text-muted hover:text-foreground text-sm w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface"
            >
                ✕
            </button>
            <div className="flex items-start gap-4">
                <div className="text-2xl">🔗</div>
                <div className="flex-1 pr-6">
                    <h3 className="font-serif text-lg text-primary mb-1">
                        {untriagedCount} capture{untriagedCount === 1 ? '' : 's'} desde ContentHub esperando triage
                    </h3>
                    <p className="text-sm text-muted mb-3 max-w-2xl">
                        Cada vez que envías contenido desde <strong>ContentHub</strong> con
                        “Send to Kbia”, aparece aquí esperando que decidas a qué <strong>área</strong> o
                        <strong> proyecto</strong> pertenece. Verás siempre el badge <em>ContentHub</em> en la card.
                    </p>
                    <div className="flex gap-2 text-sm">
                        <Link
                            href="/captures"
                            className="inline-flex items-center justify-center rounded-md bg-primary px-3.5 py-1.5 font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
                        >
                            Ir al inbox →
                        </Link>
                        <button
                            onClick={handleDismiss}
                            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3.5 py-1.5 text-muted hover:text-foreground transition-colors"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
