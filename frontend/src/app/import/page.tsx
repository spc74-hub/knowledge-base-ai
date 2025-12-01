'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface ImportResult {
    url: string;
    success: boolean;
    content_id?: string;
    error?: string;
}

interface ImportResponse {
    total: number;
    successful: number;
    failed: number;
    results: ImportResult[];
}

export default function ImportPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [urls, setUrls] = useState('');
    const [tags, setTags] = useState('');
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState<string | null>(null);
    const [results, setResults] = useState<ImportResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResults(null);
        setImporting(true);

        // Parse URLs (one per line, filter empty lines)
        const urlList = urls
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);

        if (urlList.length === 0) {
            setError('Por favor, introduce al menos una URL');
            setImporting(false);
            return;
        }

        setProgress(`Procesando ${urlList.length} URLs...`);

        try {
            const session = await supabase.auth.getSession();
            if (!session.data.session) {
                throw new Error('No session');
            }

            const response = await fetch('http://localhost:8000/api/v1/content/bulk-import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.data.session.access_token}`,
                },
                body: JSON.stringify({
                    urls: urlList,
                    tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error en la importacion');
            }

            const data: ImportResponse = await response.json();
            setResults(data);
            setProgress(null);

            // Clear form if all successful
            if (data.failed === 0) {
                setUrls('');
                setTags('');
            }

        } catch (err: any) {
            setError(err.message || 'Error en la importacion');
            setProgress(null);
        } finally {
            setImporting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                            ← Volver
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900">Importar URLs</h1>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">Importacion masiva de URLs</h2>
                        <p className="text-gray-600">
                            Pega multiples URLs (una por linea) para importarlas todas a la vez.
                            Cada URL sera procesada automaticamente: se extraera el contenido,
                            se clasificara y se generara un resumen.
                        </p>
                    </div>

                    <form onSubmit={handleImport}>
                        {error && (
                            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                URLs (una por linea)
                            </label>
                            <textarea
                                value={urls}
                                onChange={(e) => setUrls(e.target.value)}
                                placeholder="https://example.com/article1&#10;https://example.com/article2&#10;https://youtube.com/watch?v=..."
                                rows={10}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono text-sm"
                                disabled={importing}
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                {urls.split('\n').filter(u => u.trim()).length} URLs detectadas
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tags (opcional, separados por coma)
                            </label>
                            <input
                                type="text"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="trabajo, investigacion, referencia"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                                disabled={importing}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="submit"
                                disabled={importing || !urls.trim()}
                                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {importing ? 'Importando...' : 'Importar URLs'}
                            </button>
                            <Link
                                href="/dashboard"
                                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancelar
                            </Link>
                        </div>
                    </form>

                    {/* Progress */}
                    {progress && (
                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                <span className="text-blue-800">{progress}</span>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {results && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-4">Resultados</h3>

                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-gray-50 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-gray-900">{results.total}</p>
                                    <p className="text-sm text-gray-600">Total</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-green-600">{results.successful}</p>
                                    <p className="text-sm text-green-700">Exitosas</p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                                    <p className="text-sm text-red-700">Fallidas</p>
                                </div>
                            </div>

                            {/* Detailed results */}
                            <div className="border rounded-lg overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Estado
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                URL
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                Detalle
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {results.results.map((result, idx) => (
                                            <tr key={idx} className={result.success ? 'bg-green-50' : 'bg-red-50'}>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {result.success ? (
                                                        <span className="text-green-600 text-lg">✓</span>
                                                    ) : (
                                                        <span className="text-red-600 text-lg">✗</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm font-mono break-all">
                                                        {result.url.length > 60
                                                            ? result.url.substring(0, 60) + '...'
                                                            : result.url}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {result.success ? (
                                                        <span className="text-sm text-green-700">Importado correctamente</span>
                                                    ) : (
                                                        <span className="text-sm text-red-700">{result.error}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {results.successful > 0 && (
                                <div className="mt-4">
                                    <Link
                                        href="/dashboard"
                                        className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                                    >
                                        Ver contenidos importados →
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
