'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MobileHomePage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/m/notes');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
        </div>
    );
}
