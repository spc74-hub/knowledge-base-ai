'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface ChatSession {
    id: string;
    title: string;
    message_count: number;
    created_at: string;
    updated_at: string;
}

interface ChatSource {
    content_id: string;
    title: string;
    relevance_score: number;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: ChatSource[];
    created_at: string;
}

export default function ChatPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const API_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1`;

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (user) {
            fetchSessions();
        }
    }, [user]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const getAuthHeader = async () => {
        const session = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.data.session?.access_token}`,
        };
    };

    const fetchSessions = async () => {
        try {
            const headers = await getAuthHeader();
            const response = await fetch(`${API_URL}/chat/sessions`, { headers });
            if (response.ok) {
                const data = await response.json();
                setSessions(data);
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    const createSession = async () => {
        try {
            const headers = await getAuthHeader();
            const response = await fetch(`${API_URL}/chat/sessions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({}),
            });

            if (response.ok) {
                const session = await response.json();
                setSessions([session, ...sessions]);
                setActiveSession(session);
                setMessages([]);
            }
        } catch (error) {
            console.error('Error creating session:', error);
        }
    };

    const selectSession = async (session: ChatSession) => {
        setActiveSession(session);
        setMessages([]);

        try {
            const headers = await getAuthHeader();
            const response = await fetch(`${API_URL}/chat/sessions/${session.id}/messages`, { headers });
            if (response.ok) {
                const data = await response.json();
                setMessages(data);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Eliminar esta conversacion?')) return;

        try {
            const headers = await getAuthHeader();
            await fetch(`${API_URL}/chat/sessions/${sessionId}`, {
                method: 'DELETE',
                headers,
            });

            setSessions(sessions.filter(s => s.id !== sessionId));
            if (activeSession?.id === sessionId) {
                setActiveSession(null);
                setMessages([]);
            }
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        // Create session if none exists
        let sessionId = activeSession?.id;
        if (!sessionId) {
            try {
                const headers = await getAuthHeader();
                const response = await fetch(`${API_URL}/chat/sessions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });

                if (response.ok) {
                    const session = await response.json();
                    setSessions([session, ...sessions]);
                    setActiveSession(session);
                    sessionId = session.id;
                }
            } catch (error) {
                console.error('Error creating session:', error);
                return;
            }
        }

        const userMessage: ChatMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: newMessage,
            created_at: new Date().toISOString(),
        };

        setMessages([...messages, userMessage]);
        setNewMessage('');
        setSending(true);

        try {
            const headers = await getAuthHeader();
            const response = await fetch(`${API_URL}/chat/sessions/${sessionId}/messages`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ content: userMessage.content }),
            });

            if (response.ok) {
                const assistantMessage = await response.json();
                setMessages(prev => [...prev.slice(0, -1), { ...userMessage, id: `user-${Date.now()}` }, assistantMessage]);

                // Refresh sessions to get updated title
                fetchSessions();
            } else {
                // Remove temp message on error
                setMessages(prev => prev.slice(0, -1));
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setSending(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Sidebar */}
            <div className={`${showSidebar ? 'w-64' : 'w-0'} bg-gray-900 text-white flex flex-col transition-all duration-300 overflow-hidden`}>
                <div className="p-4 border-b border-gray-700">
                    <button
                        onClick={createSession}
                        className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center gap-2"
                    >
                        <span>+</span>
                        Nueva conversacion
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => selectSession(session)}
                            className={`p-3 cursor-pointer hover:bg-gray-800 border-b border-gray-800 flex justify-between items-center group ${activeSession?.id === session.id ? 'bg-gray-800' : ''}`}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{session.title}</p>
                                <p className="text-xs text-gray-400">
                                    {session.message_count} mensajes
                                </p>
                            </div>
                            <button
                                onClick={(e) => deleteSession(session.id, e)}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 px-2"
                            >
                                x
                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-gray-700">
                    <Link
                        href="/dashboard"
                        className="block text-center text-sm text-gray-400 hover:text-white"
                    >
                        Volver al Dashboard
                    </Link>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-white dark:bg-gray-800 shadow-sm p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            {showSidebar ? '<' : '>'}
                        </button>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {activeSession?.title || 'Chat con tu Knowledge Base'}
                        </h1>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{user.email}</span>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && !activeSession && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="text-6xl mb-4">💬</div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Chat con tu Knowledge Base
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                                Preguntame sobre cualquier contenido que hayas guardado.
                                Usare busqueda semantica para encontrar informacion relevante
                                y te respondere basandome en tu base de conocimiento personal.
                            </p>
                            <div className="flex gap-2 flex-wrap justify-center">
                                <button
                                    onClick={() => setNewMessage('Que tengo guardado sobre')}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm dark:text-white"
                                >
                                    Que tengo guardado sobre...
                                </button>
                                <button
                                    onClick={() => setNewMessage('Resume el contenido sobre')}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm dark:text-white"
                                >
                                    Resume el contenido sobre...
                                </button>
                                <button
                                    onClick={() => setNewMessage('Cuales son los temas principales en mi knowledge base?')}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm dark:text-white"
                                >
                                    Temas principales
                                </button>
                            </div>
                        </div>
                    )}

                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-3xl rounded-lg p-4 ${message.role === 'user'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-white dark:bg-gray-800 shadow-sm border dark:border-gray-600 dark:text-white'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{message.content}</p>

                                {/* Sources */}
                                {message.sources && message.sources.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Fuentes utilizadas:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {message.sources.map((source, i) => (
                                                <Link
                                                    key={i}
                                                    href={`/explore?content=${source.content_id}`}
                                                    className="text-xs bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800 cursor-pointer transition-colors"
                                                    title={`Relevancia: ${(source.relevance_score * 100).toFixed(0)}% - Click para ver detalle`}
                                                >
                                                    {source.title}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs mt-2 opacity-50">
                                    {new Date(message.created_at).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))}

                    {sending && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-gray-800 shadow-sm border dark:border-gray-600 rounded-lg p-4">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-600">
                    <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Pregunta algo sobre tu knowledge base..."
                            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={sending || !newMessage.trim()}
                            className="px-6 py-3 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Enviar
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
