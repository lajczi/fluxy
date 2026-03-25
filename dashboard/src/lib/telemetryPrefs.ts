const KEY = 'fluxy_analytics_opt_in_v1';

const listeners = new Set<(enabled: boolean | null) => void>();

export function getAnalyticsOptIn(): boolean | null {
    try {
        const v = localStorage.getItem(KEY);
        if (v === 'true') return true;
        if (v === 'false') return false;
        return null;
    } catch {
        return null;
    }
}

export function setAnalyticsOptIn(value: boolean): void {
    try {
        localStorage.setItem(KEY, String(value));
    } catch {
    }
    listeners.forEach(fn => fn(value));
}

export function onAnalyticsPrefChange(fn: (v: boolean | null) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
