'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

export default function RegisterPage() {
    const router = useRouter();
    const { signUp } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        const result = await signUp(email, password, name);

        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            setSuccess(true);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="max-w-md w-full">
                    <div className="text-center mb-10">
                        <Link href="/" className="font-serif text-4xl font-medium text-primary tracking-tight">
                            Kbia
                        </Link>
                    </div>
                    <div className="bg-surface rounded-xl border border-border shadow-card p-8 text-center">
                        <div className="text-success text-5xl mb-4">✓</div>
                        <h2 className="font-serif text-2xl text-foreground mb-2">Cuenta creada</h2>
                        <p className="text-muted mb-6">
                            Te hemos enviado un email de confirmación a{' '}
                            <strong className="text-foreground">{email}</strong>.
                        </p>
                        <Link
                            href="/login"
                            className="inline-block px-6 py-2.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover transition-colors font-medium"
                        >
                            Ir a iniciar sesión
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

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
                        <h2 className="font-serif text-2xl text-foreground">Crear cuenta</h2>
                        <p className="mt-1 text-sm text-muted">
                            Empieza tu capa estratégica.
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-3 py-2 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                                Nombre
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="block w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                                placeholder="Tu nombre"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                                Email
                            </label>
                            <input
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
                            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-1.5">
                                Confirmar contraseña
                            </label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="block w-full px-3 py-2.5 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                                placeholder="Repite tu contraseña"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 px-4 rounded-md text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Creando…' : 'Crear cuenta'}
                        </button>

                        <p className="text-center text-sm text-muted">
                            ¿Ya tienes cuenta?{' '}
                            <Link href="/login" className="font-medium text-primary hover:underline">
                                Inicia sesión
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
