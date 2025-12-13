'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

// Hardcoded API URL - env vars broken in Railway
const PRODUCTION_API = 'https://knowledge-base-ai-production.up.railway.app';
const DEV_API = 'http://localhost:8000';
const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? PRODUCTION_API : DEV_API;

interface Content {
  id: string;
  title: string;
  content_type: string;
  source_url: string | null;
  processing_status: string;
  processing_error: string | null;
  created_at: string;
}

export default function ProcessingPage() {
  const { user, loading: authLoading, token } = useAuth();
  const [pendingContents, setPendingContents] = useState<Content[]>([]);
  const [failedContents, setFailedContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState<Set<string>>(new Set());
  const [processingAll, setProcessingAll] = useState(false);
  const [processProgress, setProcessProgress] = useState<{processed: number, failed: number, total: number} | null>(null);

  const getAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [token]);

  const fetchContents = useCallback(async () => {
    if (!user || !token) return;
    setLoading(true);
    try {
      // Fetch pending
      const pendingResponse = await fetch(
        `${API_URL}/api/v1/content/?processing_status=pending&limit=50`,
        { headers: getAuthHeaders() }
      );
      if (pendingResponse.ok) {
        const data = await pendingResponse.json();
        setPendingContents(data.contents || []);
      }

      // Fetch failed (status is "failed" in database)
      const failedResponse = await fetch(
        `${API_URL}/api/v1/content/?processing_status=failed&limit=50`,
        { headers: getAuthHeaders() }
      );
      if (failedResponse.ok) {
        const data = await failedResponse.json();
        setFailedContents(data.contents || []);
      }
    } catch (error) {
      console.error('Error fetching contents:', error);
    } finally {
      setLoading(false);
    }
  }, [user, token, getAuthHeaders]);

  useEffect(() => {
    if (user && !authLoading && token) {
      fetchContents();
    }
  }, [user, authLoading, token, fetchContents]);

  const handleReprocess = async (contentId: string) => {
    setReprocessing(prev => new Set(prev).add(contentId));
    try {
      const response = await fetch(`${API_URL}/api/v1/content/${contentId}/reprocess`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        // Refresh list after reprocess
        await fetchContents();
      }
    } catch (error) {
      console.error('Error reprocessing:', error);
    } finally {
      setReprocessing(prev => {
        const next = new Set(prev);
        next.delete(contentId);
        return next;
      });
    }
  };

  const handleDelete = async (contentId: string) => {
    if (!confirm('Estas seguro de eliminar este contenido?')) return;
    try {
      const response = await fetch(`${API_URL}/api/v1/content/bulk/delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content_ids: [contentId] }),
      });
      if (response.ok) {
        await fetchContents();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleProcessAll = async () => {
    if (pendingContents.length === 0) return;
    if (!confirm(`¿Procesar ${pendingContents.length} contenidos pendientes? Esto puede tomar varios minutos.`)) return;

    setProcessingAll(true);
    setProcessProgress({ processed: 0, failed: 0, total: pendingContents.length });

    try {
      const response = await fetch(`${API_URL}/api/v1/process/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setProcessProgress({
          processed: data.processed || 0,
          failed: data.failed || 0,
          total: pendingContents.length
        });
        // Refresh the list
        await fetchContents();
      }
    } catch (error) {
      console.error('Error processing all:', error);
    } finally {
      setProcessingAll(false);
    }
  };

  const handleRetryFailed = async () => {
    if (failedContents.length === 0) return;
    if (!confirm(`¿Reintentar ${failedContents.length} contenidos fallidos?`)) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/process/retry-failed`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        await fetchContents();
      }
    } catch (error) {
      console.error('Error retrying failed:', error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl text-white mb-4">Inicia sesion para acceder</h2>
          <Link href="/login" className="bg-indigo-600 text-white px-4 py-2 rounded-lg">
            Iniciar Sesion
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const ContentCard = ({ content, showError = false }: { content: Content; showError?: boolean }) => (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{content.title || 'Sin titulo'}</h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span>{content.content_type}</span>
            <span>-</span>
            <span>{formatDate(content.created_at)}</span>
          </div>
          {content.source_url && (
            <a
              href={content.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:underline truncate block mt-1"
            >
              {content.source_url}
            </a>
          )}
          {showError && content.processing_error && (
            <p className="text-sm text-red-400 mt-2 line-clamp-2">
              Error: {content.processing_error}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleReprocess(content.id)}
            disabled={reprocessing.has(content.id)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-lg"
          >
            {reprocessing.has(content.id) ? 'Procesando...' : 'Reprocesar'}
          </button>
          <button
            onClick={() => handleDelete(content.id)}
            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-white">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold text-white">Cola de Procesamiento</h1>
          </div>
          <button
            onClick={fetchContents}
            className="text-gray-400 hover:text-white text-sm"
          >
            Actualizar
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Progress indicator */}
        {processingAll && processProgress && (
          <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-indigo-300">
                Procesando... {processProgress.processed + processProgress.failed} / {processProgress.total}
                {processProgress.failed > 0 && ` (${processProgress.failed} fallidos)`}
              </span>
            </div>
          </div>
        )}

        {/* Pending Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
              Pendientes ({pendingContents.length})
            </h2>
            {pendingContents.length > 0 && (
              <button
                onClick={handleProcessAll}
                disabled={processingAll}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg flex items-center gap-2"
              >
                {processingAll ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Procesando...
                  </>
                ) : (
                  <>Procesar todos ({pendingContents.length})</>
                )}
              </button>
            )}
          </div>
          {pendingContents.length === 0 ? (
            <p className="text-gray-500">No hay contenidos pendientes de procesar</p>
          ) : (
            <div className="space-y-3">
              {pendingContents.map(content => (
                <ContentCard key={content.id} content={content} />
              ))}
            </div>
          )}
        </section>

        {/* Failed Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Fallidos ({failedContents.length})
            </h2>
            {failedContents.length > 0 && (
              <button
                onClick={handleRetryFailed}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg"
              >
                Reintentar todos ({failedContents.length})
              </button>
            )}
          </div>
          {failedContents.length === 0 ? (
            <p className="text-gray-500">No hay contenidos con errores</p>
          ) : (
            <div className="space-y-3">
              {failedContents.map(content => (
                <ContentCard key={content.id} content={content} showError />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
