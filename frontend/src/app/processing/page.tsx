'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

      // Fetch failed (status is "error" in database)
      const failedResponse = await fetch(
        `${API_URL}/api/v1/content/?processing_status=error&limit=50`,
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
        {/* Pending Section */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            Pendientes ({pendingContents.length})
          </h2>
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
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            Fallidos ({failedContents.length})
          </h2>
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
