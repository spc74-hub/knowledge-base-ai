'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

// Changelog entries - Add new entries at the top
const CHANGELOG_ENTRIES = [
    {
        version: "1.6",
        date: "Dic 2024",
        title: "Dashboard mejorado y estadísticas de hábitos",
        changes: [
            "Dashboard con KPIs y cajas arrastrables (drag & drop)",
            "Notas separadas en Quick Notes y Full Notes",
            "Estadísticas completas de hábitos por período y área",
            "Quick View popup para contenidos",
        ]
    },
    {
        version: "1.5",
        date: "Dic 2024",
        title: "Transcripción de audio desde Google Drive",
        changes: [
            "Transcripción automática de archivos de audio usando Whisper API",
            "Soporte para archivos de Google Drive",
            "Procesamiento asíncrono en cola",
        ]
    },
    {
        version: "1.4",
        date: "Dic 2024",
        title: "Explorer con tabs y filtros mejorados",
        changes: [
            "Tabs separados: Contenidos y Mis Reflexiones",
            "Filtros de notas por tipo, vinculación y fijadas",
            "Notas vinculadas muestran enlace al contenido original",
        ]
    },
    {
        version: "1.3",
        date: "Nov 2024",
        title: "Notas vinculadas a contenidos",
        changes: [
            "Crear notas rápidas desde el detalle de contenido",
            "Tipos de nota: Reflexión, Idea, Pregunta, Conexión",
            "Auto-avance de madurez al añadir nota",
        ]
    },
];

export default function GuidePage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [showChangelog, setShowChangelog] = useState(false);

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

                {/* Changelog / Novedades Section */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 mb-6 overflow-hidden">
                    <button
                        onClick={() => setShowChangelog(!showChangelog)}
                        className="w-full flex items-center justify-between p-4 hover:bg-emerald-100/50 dark:hover:bg-emerald-800/20 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center">
                                <span className="text-xl">🆕</span>
                            </div>
                            <div className="text-left">
                                <h3 className="font-semibold text-emerald-900 dark:text-emerald-200">Novedades</h3>
                                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                    Ultimas actualizaciones y nuevas funcionalidades
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                                v{CHANGELOG_ENTRIES[0]?.version}
                            </span>
                            <svg
                                className={`w-5 h-5 text-emerald-500 transition-transform ${showChangelog ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </button>

                    {showChangelog && (
                        <div className="border-t border-emerald-200 dark:border-emerald-800 p-4 space-y-4">
                            {CHANGELOG_ENTRIES.map((entry, index) => (
                                <div
                                    key={entry.version}
                                    className={`${index === 0 ? 'bg-white dark:bg-gray-800 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700' : 'pl-4 border-l-2 border-emerald-200 dark:border-emerald-700'}`}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${index === 0 ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                            v{entry.version}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{entry.date}</span>
                                        {index === 0 && (
                                            <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                                                Nuevo
                                            </span>
                                        )}
                                    </div>
                                    <h4 className={`font-medium mb-2 ${index === 0 ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300 text-sm'}`}>
                                        {entry.title}
                                    </h4>
                                    <ul className={`space-y-1 ${index === 0 ? 'text-sm text-gray-600 dark:text-gray-400' : 'text-xs text-gray-500 dark:text-gray-500'}`}>
                                        {entry.changes.map((change, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-emerald-500 mt-0.5">•</span>
                                                {change}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                            <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-2">
                                Para documentacion completa de cada funcionalidad, consulta las secciones de la guia.
                            </p>
                        </div>
                    )}
                </div>

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
                            <a href="#procesamiento" className="text-blue-600 dark:text-blue-400 hover:underline">5. Cola de Procesamiento</a>
                        </li>
                        <li>
                            <a href="#madurez" className="text-blue-600 dark:text-blue-400 hover:underline">6. Niveles de Madurez</a>
                        </li>
                        <li>
                            <a href="#vinculacion" className="text-blue-600 dark:text-blue-400 hover:underline">7. Vinculación a Objetos</a>
                        </li>
                        <li>
                            <a href="#notas" className="text-blue-600 dark:text-blue-400 hover:underline">8. Sistema de Notas</a>
                        </li>
                        <li>
                            <a href="#chat" className="text-blue-600 dark:text-blue-400 hover:underline">9. Chat con IA</a>
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

                        {/* Tabs del Explorador */}
                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                            <h4 className="font-medium text-orange-900 dark:text-orange-200 mb-3">📑 Tabs del Explorador</h4>
                            <p className="text-sm text-orange-800 dark:text-orange-300 mb-3">
                                El Explorador tiene dos vistas principales accesibles mediante tabs:
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-orange-200 dark:border-orange-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">📚</span>
                                        <span className="font-medium text-gray-900 dark:text-white">Contenidos</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        Todos tus contenidos capturados: artículos, vídeos, Apple Notes. Búsqueda semántica y filtros por tipo, categoría, madurez, etc.
                                    </p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-orange-200 dark:border-orange-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">💭</span>
                                        <span className="font-medium text-gray-900 dark:text-white">Mis Reflexiones</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        Tus notas personales: reflexiones, ideas, preguntas. Filtra por tipo de nota, estado de vinculación y notas fijadas.
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-orange-700 dark:text-orange-400 mt-3">
                                <strong>Tip:</strong> En "Mis Reflexiones", las notas vinculadas muestran "Vinculado a:" con un enlace clickeable al contenido original.
                            </p>
                        </div>

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

                {/* Section 5: Cola de Procesamiento */}
                <section id="procesamiento" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center text-teal-600 dark:text-teal-400 text-sm font-bold">5</span>
                        Cola de Procesamiento
                    </h2>
                    <div className="space-y-6">
                        <p className="text-gray-600 dark:text-gray-300">
                            Cuando capturas contenido, la IA lo procesa automáticamente para extraer resumen, categorías,
                            conceptos y entidades. La <strong>Cola de Procesamiento</strong> te permite gestionar este flujo.
                        </p>

                        {/* Estados de procesamiento */}
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Estados de procesamiento</h3>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white">Pendiente</span>
                                        <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— En cola, esperando ser procesado por la IA</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white">Procesando</span>
                                        <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— La IA está analizando el contenido</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                                    <span className="text-green-500">✓</span>
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white">Completado</span>
                                        <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— Procesado correctamente, listo para explorar</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white">Fallido</span>
                                        <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— Error al procesar, puedes reintentar</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Acciones disponibles */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">⚡</span>
                                    <h4 className="font-medium text-gray-900 dark:text-white">Procesar Todos</h4>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Procesa en lote todos los contenidos pendientes. Útil después de importar muchos items.
                                </p>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xl">🔄</span>
                                    <h4 className="font-medium text-gray-900 dark:text-white">Reintentar Fallidos</h4>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Reintenta el procesamiento de contenidos que fallaron (problemas de red, etc.).
                                </p>
                            </div>
                        </div>

                        <Link
                            href="/processing"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Ir a Cola de Procesamiento
                        </Link>
                    </div>
                </section>

                {/* Section 6: Niveles de Madurez */}
                <section id="madurez" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-sm font-bold">6</span>
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
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900 dark:text-white">Capturado</span>
                                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— Contenido guardado, pendiente de revisar</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                <span className="text-2xl">⚙️</span>
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900 dark:text-white">Procesado</span>
                                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— Analizado por IA, listo para revisar</span>
                                </div>
                                <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">Auto al añadir nota</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                                <span className="text-2xl">🔗</span>
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900 dark:text-white">Conectado</span>
                                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— Vinculado a proyectos o modelos mentales</span>
                                </div>
                                <span className="text-xs bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">Auto al vincular</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                                <span className="text-2xl">✅</span>
                                <div className="flex-1">
                                    <span className="font-medium text-gray-900 dark:text-white">Integrado</span>
                                    <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">— Conocimiento asimilado y sintetizado</span>
                                </div>
                                <span className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">Manual</span>
                            </div>
                        </div>

                        {/* Auto-avance */}
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                            <h4 className="font-medium text-indigo-900 dark:text-indigo-200 mb-2">🚀 Auto-avance de madurez</h4>
                            <p className="text-sm text-indigo-800 dark:text-indigo-300 mb-2">
                                El nivel de madurez avanza automáticamente cuando realizas ciertas acciones:
                            </p>
                            <ul className="text-sm text-indigo-800 dark:text-indigo-300 list-disc list-inside space-y-1">
                                <li><strong>Capturado → Procesado:</strong> Al añadir una nota personal al contenido</li>
                                <li><strong>Procesado → Conectado:</strong> Al vincular a un proyecto o modelo mental</li>
                                <li><strong>→ Integrado:</strong> Marcado manualmente cuando has asimilado el conocimiento</li>
                            </ul>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>Consejo:</strong> Usa los filtros de "Nivel de Madurez" en el Explorador y Dashboard
                                para revisar contenidos por su estado de integración.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 7: Vinculación a Objetos */}
                <section id="vinculacion" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-sm font-bold">7</span>
                        Vinculación a Objetos
                    </h2>
                    <div className="space-y-6">
                        <p className="text-gray-600 dark:text-gray-300">
                            Conecta tus contenidos con <strong>Proyectos</strong> y <strong>Modelos Mentales</strong> para
                            darles contexto y facilitar su organización. Esto automáticamente sube el nivel de madurez a "Conectado".
                        </p>

                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Proyectos */}
                            <div className="border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 bg-indigo-50/50 dark:bg-indigo-900/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">📁</span>
                                    <h4 className="font-medium text-gray-900 dark:text-white">Proyectos</h4>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    Agrupa contenidos relacionados con un proyecto específico: investigación,
                                    trabajo, aprendizaje de una habilidad, etc.
                                </p>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                    <li className="flex items-center gap-2">
                                        <span className="text-indigo-500">•</span>
                                        Un contenido puede estar en un solo proyecto
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-indigo-500">•</span>
                                        Ve los contenidos vinculados desde el Dashboard
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-indigo-500">•</span>
                                        Estados: activo, completado, archivado
                                    </li>
                                </ul>
                                <Link href="/projects" className="inline-block mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                                    Gestionar proyectos →
                                </Link>
                            </div>

                            {/* Modelos Mentales */}
                            <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 bg-emerald-50/50 dark:bg-emerald-900/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-2xl">🧠</span>
                                    <h4 className="font-medium text-gray-900 dark:text-white">Modelos Mentales</h4>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    Frameworks de pensamiento que aplicas a tus contenidos: First Principles,
                                    Pareto, Inversión, etc.
                                </p>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                    <li className="flex items-center gap-2">
                                        <span className="text-emerald-500">•</span>
                                        Un contenido puede tener múltiples modelos
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-emerald-500">•</span>
                                        Catálogo predefinido de modelos clásicos
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-emerald-500">•</span>
                                        Crea tus propios modelos personalizados
                                    </li>
                                </ul>
                                <Link href="/mental-models" className="inline-block mt-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
                                    Ver modelos mentales →
                                </Link>
                            </div>
                        </div>

                        {/* Cómo vincular */}
                        <div className="bg-gradient-to-r from-emerald-50 to-indigo-50 dark:from-emerald-900/20 dark:to-indigo-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                            <h4 className="font-medium text-emerald-900 dark:text-emerald-200 mb-2">Cómo vincular contenidos</h4>
                            <ol className="text-sm text-emerald-800 dark:text-emerald-300 list-decimal list-inside space-y-1">
                                <li>Abre el detalle de cualquier contenido (clic en el título)</li>
                                <li>En la sección "Maduración", haz clic en <strong>📁 Proyecto</strong> o <strong>🧠 Modelo Mental</strong></li>
                                <li>Selecciona el proyecto o modelos mentales a vincular</li>
                                <li>El nivel de madurez se actualizará automáticamente a "Conectado"</li>
                            </ol>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>Consejo:</strong> En el Dashboard, al seleccionar "Proyectos" o "Modelos Mentales"
                                puedes ver los contenidos vinculados a cada uno directamente.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 8: Sistema de Notas */}
                <section id="notas" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center text-yellow-600 dark:text-yellow-400 text-sm font-bold">8</span>
                        Sistema de Notas
                    </h2>
                    <div className="space-y-6">
                        <p className="text-gray-600 dark:text-gray-300">
                            KBase distingue entre diferentes tipos de notas para ayudarte a organizar tu pensamiento.
                            Puedes crearlas desde el <strong>Dashboard</strong>, el <strong>Journal</strong> o directamente desde el detalle de un contenido.
                        </p>

                        {/* Acciones rápidas desde contenido */}
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                            <h4 className="font-medium text-purple-900 dark:text-purple-200 mb-2">⚡ Acciones rápidas desde contenido</h4>
                            <p className="text-sm text-purple-800 dark:text-purple-300 mb-3">
                                En la sección "Maduración" del detalle de cualquier contenido, tienes acceso directo a:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1.5 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300 rounded-lg text-sm">💭 Nueva Reflexión</span>
                                <span className="px-3 py-1.5 bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded-lg text-sm">💡 Nueva Idea</span>
                                <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-sm">❓ Nueva Pregunta</span>
                                <span className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm">📁 Vincular Proyecto</span>
                                <span className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm">🧠 Modelo Mental</span>
                            </div>
                            <p className="text-sm text-purple-700 dark:text-purple-400 mt-2">
                                Las notas creadas desde aquí quedan automáticamente vinculadas al contenido original.
                            </p>
                        </div>

                        {/* Tipos de notas */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Tipos de notas</h3>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">💬</span>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Anotaciones en contenidos</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Comentarios y reflexiones sobre contenido guardado. Añádelos desde el detalle
                                        de cualquier artículo o vídeo. <strong>Auto-avanza</strong> el nivel de madurez a "Procesado".
                                    </p>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">📓</span>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Diario (Journal)</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Entradas del día a día: lo que aprendiste, reflexiones personales, ideas que surgieron.
                                        Perfecto para llevar un registro de tu evolución.
                                    </p>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">💡</span>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Ideas</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Captura rápida de ideas que surgen. Puedes vincularlas a contenidos relacionados
                                        o crearlas desde el detalle de un contenido.
                                    </p>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">💭</span>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Reflexiones</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Análisis más profundos sobre temas que estás estudiando.
                                        Síntesis de lo que has aprendido.
                                    </p>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">❓</span>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Preguntas</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Dudas que te surgen y quieres investigar. Genial para volver a ellas
                                        cuando tengas tiempo de profundizar.
                                    </p>
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xl">🔗</span>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Conexiones</h4>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Notas que vinculan conceptos de diferentes fuentes. Ayudan a construir
                                        mapas mentales de tus conocimientos.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Filtrar por anotaciones */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">💬 Filtrar contenidos con anotaciones</h4>
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                En el <strong>Explorador</strong> y <strong>Taxonomía</strong> puedes filtrar por contenidos que tienen
                                o no tienen anotaciones. Esto te ayuda a identificar qué contenidos ya has procesado
                                y cuáles necesitan tu atención.
                            </p>
                        </div>

                        {/* Distinción Apple Notes vs Notas Manuales */}
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                            <h4 className="font-medium text-amber-900 dark:text-amber-200 mb-2">🍎 Apple Notes vs Notas Manuales</h4>
                            <p className="text-sm text-amber-800 dark:text-amber-300">
                                El sistema distingue entre <strong>Apple Notes</strong> (importadas desde la app de Apple) y
                                <strong> Notas Manuales</strong> (creadas directamente en KBase). Al filtrar por tipo "Nota" en el
                                Explorador, solo verás tus notas manuales. Las Apple Notes tienen su propia categoría en los filtros.
                            </p>
                        </div>

                        {/* Flujo recomendado */}
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-2">Flujo de trabajo con notas</h4>
                            <ol className="text-sm text-yellow-800 dark:text-yellow-300 list-decimal list-inside space-y-1">
                                <li>Captura contenido interesante (artículo, vídeo, tweet)</li>
                                <li>Léelo y añade una <strong>anotación</strong> con tus impresiones (auto-avanza a "Procesado")</li>
                                <li>Si surge una idea o pregunta, usa los <strong>botones de acción rápida</strong></li>
                                <li>Vincula a un <strong>proyecto</strong> o <strong>modelo mental</strong> (auto-avanza a "Conectado")</li>
                                <li>Usa el <strong>diario</strong> para reflexionar sobre lo aprendido al final del día</li>
                            </ol>
                        </div>

                        <Link
                            href="/journal"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Ir al Journal
                        </Link>
                    </div>
                </section>

                {/* Section 9: Chat con IA */}
                <section id="chat" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center text-pink-600 dark:text-pink-400 text-sm font-bold">9</span>
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
