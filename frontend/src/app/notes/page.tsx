'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Note {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export default function NotesPage() {
  const { user, loading: authLoading, token } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [token]);

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/notes/`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchNotes();
    }
  }, [user, authLoading, fetchNotes]);

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

  const pinnedNotes = notes.filter(n => n.is_pinned);
  const unpinnedNotes = notes.filter(n => !n.is_pinned);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-white">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold text-white">Notas / Diario</h1>
          </div>
          <Link
            href="/notes/new"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            + Nueva Nota
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {notes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No tienes notas todavia</p>
            <Link
              href="/notes/new"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              Crear primera nota
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pinned notes */}
            {pinnedNotes.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  📌 Fijadas
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {pinnedNotes.map((note) => (
                    <Link
                      key={note.id}
                      href={`/notes/${note.id}`}
                      className="bg-gray-900/50 border border-yellow-600/30 rounded-xl p-4 hover:bg-gray-800/50 transition-colors"
                    >
                      <h3 className="text-white font-medium mb-2 truncate">{note.title}</h3>
                      <p className="text-gray-400 text-sm line-clamp-2">
                        {note.content?.replace(/<[^>]*>/g, '').substring(0, 100) || 'Sin contenido'}
                      </p>
                      <p className="text-gray-500 text-xs mt-2">
                        {new Date(note.updated_at || note.created_at).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Other notes */}
            {unpinnedNotes.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  📝 Todas las notas
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {unpinnedNotes.map((note) => (
                    <Link
                      key={note.id}
                      href={`/notes/${note.id}`}
                      className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:bg-gray-800/50 transition-colors"
                    >
                      <h3 className="text-white font-medium mb-2 truncate">{note.title}</h3>
                      <p className="text-gray-400 text-sm line-clamp-2">
                        {note.content?.replace(/<[^>]*>/g, '').substring(0, 100) || 'Sin contenido'}
                      </p>
                      <p className="text-gray-500 text-xs mt-2">
                        {new Date(note.updated_at || note.created_at).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
