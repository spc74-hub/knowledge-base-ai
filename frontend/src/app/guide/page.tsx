'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default function GuidePage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-14">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">K</span>
                                </div>
                                <span className="font-semibold text-gray-900 dark:text-white">KBase</span>
                            </Link>
                            <span className="text-gray-300 dark:text-gray-600">/</span>
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Guía de Uso</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <Link
                                href="/dashboard"
                                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                            >
                                Volver
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* My Notes Link */}
                <Link
                    href="/guide/my-notes"
                    className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800 mb-6 hover:border-purple-300 dark:hover:border-purple-700 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-purple-900 dark:text-purple-200">Mis Notas Personales</h3>
                            <p className="text-sm text-purple-700 dark:text-purple-300">Documenta tu propio flujo de trabajo y tips</p>
                        </div>
                    </div>
                    <svg className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>

                {/* Table of Contents */}
                <nav className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contenido</h2>
                    <ol className="space-y-2 text-sm">
                        <li>
                            <a href="#vision" className="text-blue-600 dark:text-blue-400 hover:underline">1. Visión General</a>
                        </li>
                        <li>
                            <a href="#captura" className="text-blue-600 dark:text-blue-400 hover:underline">2. Captura de Contenidos</a>
                        </li>
                        <li>
                            <a href="#organizacion" className="text-blue-600 dark:text-blue-400 hover:underline">3. Organización Automática</a>
                        </li>
                        <li>
                            <a href="#exploracion" className="text-blue-600 dark:text-blue-400 hover:underline">4. Exploración</a>
                        </li>
                        <li>
                            <a href="#procesamiento" className="text-blue-600 dark:text-blue-400 hover:underline">5. Niveles de Madurez</a>
                        </li>
                        <li>
                            <a href="#chat" className="text-blue-600 dark:text-blue-400 hover:underline">6. Chat con IA</a>
                        </li>
                    </ol>
                </nav>

                {/* Section 1: Visión General */}
                <section id="vision" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-bold">1</span>
                        Visión General
                    </h2>
                    <div className="prose dark:prose-invert max-w-none">
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            KBase es tu <strong>base de conocimiento personal</strong> potenciada por inteligencia artificial.
                            Su objetivo es ayudarte a construir un "segundo cerebro" donde puedas:
                        </p>
                        <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2 mb-4">
                            <li>Capturar cualquier contenido de internet (artículos, vídeos, tweets, PDFs)</li>
                            <li>Organizar automáticamente con categorías, conceptos y entidades</li>
                            <li>Conectar ideas relacionadas a través del grafo de conocimiento</li>
                            <li>Consultar tu base de conocimiento mediante chat con IA</li>
                        </ul>
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Filosofía:</strong> Captura rápido, procesa después. No pierdas nunca una idea interesante
                                y deja que la IA te ayude a organizarla.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 2: Captura de Contenidos */}
                <section id="captura" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center text-green-600 dark:text-green-400 text-sm font-bold">2</span>
                        Captura de Contenidos
                    </h2>
                    <div className="space-y-6">
                        {/* Métodos de captura */}
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Métodos de captura</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">🔗</span>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Añadir URL</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Desde el dashboard, usa el botón "Añadir" para guardar cualquier URL.
                                        KBase extraerá el contenido automáticamente.
                                    </p>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">📝</span>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Nueva Nota</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Crea notas propias con el editor enriquecido. Perfecto para ideas,
                                        reflexiones o síntesis de lo aprendido.
                                    </p>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">🔖</span>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Quick Save (Bookmarklet)</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Instala el bookmarklet en tu navegador para guardar páginas con un solo clic.
                                        <Link href="/quick-save" className="text-blue-600 dark:text-blue-400 hover:underline ml-1">Configurar →</Link>
                                    </p>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">🍎</span>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Apple Notes</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Importa tus notas de Apple Notes para centralizar todo tu conocimiento.
                                        <Link href="/import-apple-notes" className="text-blue-600 dark:text-blue-400 hover:underline ml-1">Importar →</Link>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tipos soportados */}
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Tipos de contenido soportados</h3>
                            <div className="flex flex-wrap gap-2">
                                {['Artículos', 'Vídeos (YouTube)', 'Tweets/Threads', 'PDFs', 'Notas propias', 'Apple Notes'].map((type) => (
                                    <span key={type} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm">
                                        {type}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 3: Organización Automática */}
                <section id="organizacion" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm font-bold">3</span>
                        Organización Automática
                    </h2>
                    <div className="space-y-6">
                        <p className="text-gray-600 dark:text-gray-300">
                            Cuando añades contenido, la IA analiza y extrae automáticamente:
                        </p>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-4">
                                <div className="border-l-4 border-blue-500 pl-4">
                                    <h4 className="font-medium text-gray-900 dark:text-white">📂 Categorías IAB</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Clasificación jerárquica estándar (Tecnología, Negocios, Ciencia, etc.)
                                    </p>
                                </div>
                                <div className="border-l-4 border-green-500 pl-4">
                                    <h4 className="font-medium text-gray-900 dark:text-white">💡 Conceptos</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Ideas y temas principales del contenido
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="border-l-4 border-orange-500 pl-4">
                                    <h4 className="font-medium text-gray-900 dark:text-white">👤 Entidades</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Personas, organizaciones y productos mencionados
                                    </p>
                                </div>
                                <div className="border-l-4 border-pink-500 pl-4">
                                    <h4 className="font-medium text-gray-900 dark:text-white">📝 Resumen</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Síntesis automática del contenido
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tags heredados */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-2">🏷️ Reglas de Tags</h4>
                            <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
                                Puedes crear reglas para asignar tags automáticamente. Por ejemplo:
                            </p>
                            <ul className="text-sm text-yellow-800 dark:text-yellow-300 list-disc list-inside">
                                <li>Persona "Elon Musk" → Tag "Gurú"</li>
                                <li>Categoría "Inteligencia Artificial" → Tag "Prioridad"</li>
                            </ul>
                            <Link href="/tags" className="inline-block mt-2 text-sm text-yellow-700 dark:text-yellow-400 hover:underline">
                                Configurar reglas de tags →
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Section 4: Exploración */}
                <section id="exploracion" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 text-sm font-bold">4</span>
                        Exploración
                    </h2>
                    <div className="space-y-6">
                        <p className="text-gray-600 dark:text-gray-300">
                            KBase ofrece múltiples formas de navegar y descubrir tu conocimiento:
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white">Búsqueda Semántica</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Busca por significado, no solo por palabras exactas. La IA entiende qué estás buscando.
                                    </p>
                                    <Link href="/explore" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Ir a Explorar →</Link>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white">Grafo de Conocimiento</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Visualiza las conexiones entre tus contenidos: qué personas, conceptos y temas están relacionados.
                                    </p>
                                    <Link href="/knowledge-graph" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Ver Grafo →</Link>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white">Explorador de Taxonomía</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Navega jerárquicamente: Categoría → Persona → Concepto → Contenidos.
                                        Configura qué niveles quieres ver en cada drill-down.
                                    </p>
                                    <Link href="/taxonomy" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Ir a Taxonomía →</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section 5: Procesamiento y Madurez */}
                <section id="procesamiento" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center text-teal-600 dark:text-teal-400 text-sm font-bold">5</span>
                        Niveles de Madurez
                    </h2>
                    <div className="space-y-6">
                        <p className="text-gray-600 dark:text-gray-300">
                            El sistema de <strong>niveles de madurez</strong> te ayuda a evolucionar tu conocimiento
                            desde la captura inicial hasta la integración profunda. Cambia el nivel desde el detalle de cualquier contenido.
                        </p>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <span className="text-2xl">📥</span>
                                <div>
                                    <span className="font-medium text-gray-900 dark:text-white">Capturado</span>
                                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— Contenido guardado, pendiente de revisar</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                <span className="text-2xl">⚙️</span>
                                <div>
                                    <span className="font-medium text-gray-900 dark:text-white">Procesado</span>
                                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— Analizado por IA, listo para revisar</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                                <span className="text-2xl">🔗</span>
                                <div>
                                    <span className="font-medium text-gray-900 dark:text-white">Conectado</span>
                                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— Vinculado con otros contenidos relacionados</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                                <span className="text-2xl">✅</span>
                                <div>
                                    <span className="font-medium text-gray-900 dark:text-white">Integrado</span>
                                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— Conocimiento asimilado y sintetizado</span>
                                </div>
                            </div>
                        </div>

                        {/* Flujo de trabajo */}
                        <div className="bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
                            <h4 className="font-medium text-teal-900 dark:text-teal-200 mb-2">Flujo de trabajo recomendado</h4>
                            <ol className="text-sm text-teal-800 dark:text-teal-300 list-decimal list-inside space-y-1">
                                <li><strong>Captura rápido</strong> - No pierdas tiempo organizando al guardar</li>
                                <li><strong>Procesa con IA</strong> - Deja que extraiga categorías y conceptos</li>
                                <li><strong>Revisa periódicamente</strong> - Usa los filtros para ver contenidos pendientes</li>
                                <li><strong>Conecta ideas</strong> - Usa el grafo para descubrir relaciones</li>
                                <li><strong>Integra</strong> - Marca como integrado lo que ya has asimilado</li>
                            </ol>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>Consejo:</strong> Usa los filtros de "Nivel de Madurez" en el Explorador y Taxonomía
                                para revisar contenidos por su estado de integración.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 6: Chat con IA */}
                <section id="chat" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center text-pink-600 dark:text-pink-400 text-sm font-bold">6</span>
                        Chat con IA
                    </h2>
                    <div className="space-y-6">
                        <p className="text-gray-600 dark:text-gray-300">
                            Conversa con tu base de conocimiento usando lenguaje natural.
                            La IA busca en tus contenidos y genera respuestas basadas en tu información guardada.
                        </p>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Ejemplos de preguntas:</h4>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500">→</span>
                                        "¿Qué he guardado sobre inteligencia artificial?"
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500">→</span>
                                        "Resume lo que sé sobre productividad personal"
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500">→</span>
                                        "¿Qué artículos mencionan a Elon Musk?"
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500">→</span>
                                        "Conecta las ideas de mis últimas lecturas sobre startups"
                                    </li>
                                </ul>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 dark:text-white mb-2">El chat puede:</h4>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                                    <li className="flex items-center gap-2">
                                        <span className="text-green-500">✓</span>
                                        Buscar en todos tus contenidos
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-green-500">✓</span>
                                        Citar las fuentes originales
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-green-500">✓</span>
                                        Sintetizar información de múltiples artículos
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-green-500">✓</span>
                                        Encontrar conexiones no obvias
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <Link
                            href="/chat"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Ir al Chat
                        </Link>
                    </div>
                </section>

                {/* Footer */}
                <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                    <p>¿Tienes dudas o sugerencias? El sistema está en constante evolución.</p>
                </div>
            </div>
        </div>
    );
}
