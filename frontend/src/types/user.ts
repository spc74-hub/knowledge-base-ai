/**
 * User type definitions.
 */

export interface User {
    id: string;
    email: string;
    name?: string;
    created_at: string;
}

export interface Session {
    access_token: string;
    refresh_token: string;
    expires_at: string;
}

export interface AuthResponse {
    user: User;
    session: Session;
}

export interface UserPreferences {
    theme: 'light' | 'dark' | 'system';
    language: string;
    items_per_page: number;
    default_view: 'grid' | 'list';
    auto_classify: boolean;
    auto_summarize: boolean;
    notifications_enabled: boolean;
}
