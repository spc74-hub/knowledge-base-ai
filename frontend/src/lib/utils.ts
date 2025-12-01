/**
 * Utility functions.
 */
import { clsx, type ClassValue } from 'clsx';

/**
 * Merge class names with clsx.
 */
export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

/**
 * Format date for display.
 */
export function formatDate(dateString: string): string {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return 'Fecha inválida';
    }
}

/**
 * Format relative time (e.g., "hace 2 horas").
 */
export function formatRelativeTime(dateString: string): string {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'ahora mismo';
        if (diffMins < 60) return `hace ${diffMins} min`;
        if (diffHours < 24) return `hace ${diffHours} h`;
        if (diffDays < 7) return `hace ${diffDays} días`;

        return formatDate(dateString);
    } catch {
        return '';
    }
}

/**
 * Truncate text to a maximum length.
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
}

/**
 * Validate URL format.
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Extract domain from URL.
 */
export function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

/**
 * Detect content type from URL.
 */
export function detectContentType(url: string): 'web' | 'youtube' | 'tiktok' | 'twitter' {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
        return 'youtube';
    }
    if (urlLower.includes('tiktok.com')) {
        return 'tiktok';
    }
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
        return 'twitter';
    }

    return 'web';
}

/**
 * Calculate reading time in minutes.
 */
export function calculateReadingTime(text: string, wordsPerMinute: number = 200): number {
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
}

/**
 * Debounce function.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Generate a random ID.
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 9);
}

/**
 * Capitalize first letter.
 */
export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get icon name for content type.
 */
export function getContentTypeIcon(type: string): string {
    const icons: Record<string, string> = {
        web: 'FileText',
        youtube: 'Youtube',
        tiktok: 'Music',
        twitter: 'Twitter',
    };
    return icons[type] || 'FileText';
}

/**
 * Get color for content type.
 */
export function getContentTypeColor(type: string): string {
    const colors: Record<string, string> = {
        web: 'blue',
        youtube: 'red',
        tiktok: 'pink',
        twitter: 'sky',
    };
    return colors[type] || 'gray';
}
