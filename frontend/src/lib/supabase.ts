/**
 * Auth token management (replaces Supabase client).
 * Stores JWT tokens in localStorage.
 */

const TOKEN_KEY = 'kbia_access_token';
const REFRESH_TOKEN_KEY = 'kbia_refresh_token';

export function getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Legacy compatibility - routes supabase.from() calls to FastAPI backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function createQueryBuilder(table: string) {
    let method = 'GET';
    let body: any = undefined;
    const filters: string[] = [];
    let selectCols = '*';
    let ordering = '';
    let rangeFrom = 0;
    let rangeEnd = 999999;
    let limitVal = 0;
    let isSingle = false;
    let countMode = '';

    const builder: any = {
        select(columns?: string, opts?: { count?: string }) {
            selectCols = columns || '*';
            if (opts?.count) countMode = opts.count;
            return builder;
        },
        insert(data: any) { method = 'POST'; body = data; return builder; },
        update(data: any) { method = 'PATCH'; body = data; return builder; },
        upsert(data: any) { method = 'POST'; body = data; return builder; },
        delete() { method = 'DELETE'; return builder; },
        eq(col: string, val: any) { filters.push(`${col}=eq.${val}`); return builder; },
        neq(col: string, val: any) { filters.push(`${col}=neq.${val}`); return builder; },
        gt(col: string, val: any) { filters.push(`${col}=gt.${val}`); return builder; },
        gte(col: string, val: any) { filters.push(`${col}=gte.${val}`); return builder; },
        lt(col: string, val: any) { filters.push(`${col}=lt.${val}`); return builder; },
        lte(col: string, val: any) { filters.push(`${col}=lte.${val}`); return builder; },
        in(col: string, vals: any[]) { filters.push(`${col}=in.(${vals.join(',')})`); return builder; },
        is(col: string, val: any) { filters.push(`${col}=is.${val}`); return builder; },
        ilike(col: string, val: string) { filters.push(`${col}=ilike.${val}`); return builder; },
        contains(col: string, val: any) { filters.push(`${col}=cs.${JSON.stringify(val)}`); return builder; },
        or(expr: string) { filters.push(`or=(${expr})`); return builder; },
        not(col: string, op: string, val: any) { filters.push(`${col}=not.${op}.${val}`); return builder; },
        order(col: string, opts?: { ascending?: boolean }) {
            ordering = `${col}.${opts?.ascending ? 'asc' : 'desc'}`;
            return builder;
        },
        range(from: number, to: number) { rangeFrom = from; rangeEnd = to; return builder; },
        limit(n: number) { limitVal = n; return builder; },
        single() { isSingle = true; return builder; },
        maybeSingle() { isSingle = true; return builder; },
        textSearch(col: string, query: string) { filters.push(`${col}=fts.${query}`); return builder; },
        then(resolve: any, reject?: any) {
            return builder.execute().then(resolve, reject);
        },
        async execute() {
            const token = getAccessToken();
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const params = new URLSearchParams();
            if (selectCols !== '*') params.set('select', selectCols);
            filters.forEach(f => {
                const [key, ...rest] = f.split('=');
                params.set(key, rest.join('='));
            });
            if (ordering) params.set('order', ordering);
            if (limitVal) params.set('limit', String(limitVal));

            const url = `${API_URL}/rest/v1/${table}?${params.toString()}`;

            try {
                const response = await fetch(url, {
                    method,
                    headers,
                    body: body ? JSON.stringify(body) : undefined,
                });

                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    return { data: null, error: { message: data?.detail || 'Error', code: String(response.status) }, count: 0 };
                }

                if (isSingle && Array.isArray(data)) {
                    return { data: data[0] || null, error: null, count: data.length };
                }

                return { data, error: null, count: Array.isArray(data) ? data.length : 0 };
            } catch (err: any) {
                return { data: null, error: { message: err.message || 'Network error' }, count: 0 };
            }
        }
    };
    return builder;
}

export const supabase: any = {
    auth: {
        getSession: async () => {
            const token = getAccessToken();
            if (token) {
                return { data: { session: { access_token: token, user: null } } };
            }
            return { data: { session: null } };
        },
        onAuthStateChange: (_callback: any) => {
            return { data: { subscription: { unsubscribe: () => {} } } };
        },
        signInWithPassword: async (_creds: any) => ({ error: new Error('Use API login') }),
        signUp: async (_creds: any) => ({ error: new Error('Use API register') }),
        signOut: async () => { clearTokens(); },
    },
    from: (table: string) => createQueryBuilder(table),
    rpc: async (name: string, params?: any) => {
        const token = getAccessToken();
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        try {
            const response = await fetch(`${API_URL}/rest/v1/rpc/${name}`, {
                method: 'POST', headers, body: JSON.stringify(params || {}),
            });
            const data = await response.json().catch(() => null);
            return { data, error: response.ok ? null : { message: data?.detail || 'Error' } };
        } catch (err: any) {
            return { data: null, error: { message: err.message } };
        }
    },
};
