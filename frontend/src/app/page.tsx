/**
 * Landing page.
 */
import Link from 'next/link';

export default function Home() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="max-w-4xl text-center space-y-8">
                <h1 className="text-5xl font-bold tracking-tight">
                    Knowledge Base AI
                </h1>

                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    Tu base de conocimiento personal con IA.
                    Guarda, clasifica y busca contenido de múltiples fuentes.
                </p>

                <div className="flex gap-4 justify-center">
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        Iniciar Sesión
                    </Link>
                    <Link
                        href="/register"
                        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    >
                        Registrarse
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
                    <div className="p-6 rounded-lg border bg-card">
                        <h3 className="font-semibold text-lg mb-2">Multi-fuente</h3>
                        <p className="text-sm text-muted-foreground">
                            Captura contenido de web, YouTube, TikTok y Twitter en un solo lugar.
                        </p>
                    </div>
                    <div className="p-6 rounded-lg border bg-card">
                        <h3 className="font-semibold text-lg mb-2">Clasificación IA</h3>
                        <p className="text-sm text-muted-foreground">
                            Claude clasifica automáticamente usando Schema.org e IAB Taxonomy.
                        </p>
                    </div>
                    <div className="p-6 rounded-lg border bg-card">
                        <h3 className="font-semibold text-lg mb-2">Búsqueda Semántica</h3>
                        <p className="text-sm text-muted-foreground">
                            Encuentra contenido relevante con búsqueda por significado, no solo texto.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
