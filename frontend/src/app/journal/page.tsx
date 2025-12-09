'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * /journal now redirects to /notes (unified notes page)
 * Preserves query params for backwards compatibility
 */
export default function JournalRedirect() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Build the redirect URL preserving any query params
        const params = new URLSearchParams(searchParams.toString());
        const redirectUrl = params.toString() ? `/notes?${params.toString()}` : '/notes';
        router.replace(redirectUrl);
    }, [router, searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Redirigiendo a Notas...</p>
            </div>
        </div>
    );
}
