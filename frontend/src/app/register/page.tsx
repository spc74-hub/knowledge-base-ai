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
            setError('Las contrasenas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contrasena debe tener al menos 6 caracteres');
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
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg text-center">
                    <div className="text-green-500 text-5xl mb-4">✓</div>
                    <h2 className="text-2xl font-bold text-gray-900">Registro exitoso</h2>
                    <p className="text-gray-600">
                        Hemos enviado un email de confirmacion a <strong>{email}</strong>.
                        Por favor, revisa tu bandeja de entrada y confirma tu cuenta.
                    </p>
                    <Link
                        href="/login"
                        className="inline-block mt-4 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                    >
                        Ir a Iniciar Sesion
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
                <div>
                    <h2 className="text-center text-3xl font-bold text-gray-900">
                        Crear Cuenta
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Empieza a construir tu knowledge base personal
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                Nombre
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                placeholder="Tu nombre"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                placeholder="tu@email.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Contrasena
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                placeholder="Minimo 6 caracteres"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                Confirmar Contrasena
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                placeholder="Repite tu contrasena"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                    </button>

                    <p className="text-center text-sm text-gray-600">
                        Ya tienes cuenta?{' '}
                        <Link href="/login" className="font-medium text-gray-900 hover:underline">
                            Inicia sesion
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
