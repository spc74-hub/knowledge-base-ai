/**
 * API client for backend communication.
 */
import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: unknown;
    headers?: Record<string, string>;
}

interface ApiError {
    message: string;
    code?: string;
    status?: number;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private async getAuthHeaders(): Promise<Record<string, string>> {
        const { data: { session } } = await supabase.auth.getSession();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        return headers;
    }

    private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { method = 'GET', body, headers = {} } = options;

        const authHeaders = await this.getAuthHeaders();

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method,
            headers: {
                ...authHeaders,
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const error: ApiError = {
                message: 'An error occurred',
                status: response.status,
            };

            try {
                const errorData = await response.json();
                error.message = errorData.detail || errorData.message || error.message;
                error.code = errorData.code;
            } catch {
                // Ignore JSON parsing errors
            }

            throw error;
        }

        // Handle empty responses
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    async post<T>(endpoint: string, body?: unknown): Promise<T> {
        return this.request<T>(endpoint, { method: 'POST', body });
    }

    async put<T>(endpoint: string, body?: unknown): Promise<T> {
        return this.request<T>(endpoint, { method: 'PUT', body });
    }

    async patch<T>(endpoint: string, body?: unknown): Promise<T> {
        return this.request<T>(endpoint, { method: 'PATCH', body });
    }

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' });
    }
}

export const api = new ApiClient(`${API_URL}/api/v1`);

// Export types
export type { ApiError };
