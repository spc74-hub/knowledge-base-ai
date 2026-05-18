'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
    const router = useRouter();
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await signIn(email, password);

        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            router.push('/dashboard');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-10">
                    <Link href="/" className="font-serif text-4xl font-medium text-primary tracking-tight">
                        Kbia
                    </Link>
                </div>

                <div className="bg-surface rounded-xl border border-border shadow-card p-8">
                    <div className="mb-8">
                        <h2 className="font-serif text-2xl text-foreground">Iniciar sesión</h2>
                        <p className="mt-1 text-sm text-muted">
                            Accede a tu capa estratégica.
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                                placeholder="tu@email.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                                Contraseña
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 px-4 rounded-md text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Iniciando…' : 'Entrar'}
                        </button>

                        <p className="text-center text-sm text-muted">
                            ¿No tienes cuenta?{' '}
                            <Link href="/register" className="font-medium text-primary hover:underline">
                                Crear cuenta
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
