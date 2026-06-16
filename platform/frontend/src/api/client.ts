/**
 * DataSphere Innovation — API Client
 *
 * Features:
 * - Automatic JWT refresh (silent token renewal before 401)
 * - Retry once on 401 with fresh token
 * - Persistent token storage (access + refresh)
 * - File upload support (multipart/form-data)
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export type ApiError = { detail?: string };

/**
 * Emitted when a 401 cannot be recovered by token refresh.
 * App-level listeners can use this to redirect to login.
 */
export const authEvents = {
  _listeners: new Set<() => void>(),
  onLogout(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  },
  emit()      { this._listeners.forEach(fn => fn()); },
};

// ── Token storage ──────────────────────────────────────────────────────────────
export const tokenStorage = {
  getAccess(): string | null {
    return localStorage.getItem('ds_access_token');
  },
  getRefresh(): string | null {
    return localStorage.getItem('ds_refresh_token');
  },
  setAccess(t: string): void {
    localStorage.setItem('ds_access_token', t);
  },
  setRefresh(t: string): void {
    localStorage.setItem('ds_refresh_token', t);
  },
  set(access: string, refresh?: string): void {
    localStorage.setItem('ds_access_token', access);
    // Backwards-compat key used by older components
    localStorage.setItem('datasphere_access_token', access);
    if (refresh) localStorage.setItem('ds_refresh_token', refresh);
  },
  clear(): void {
    localStorage.removeItem('ds_access_token');
    localStorage.removeItem('ds_refresh_token');
    localStorage.removeItem('datasphere_access_token');
  },
  // Backwards-compat: old components call tokenStorage.get()
  get(): string | null {
    return localStorage.getItem('ds_access_token')
      ?? localStorage.getItem('datasphere_access_token');
  },
};

// ── Refresh logic ──────────────────────────────────────────────────────────────
let _refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh calls
  if (_refreshing) return _refreshing;

  _refreshing = (async () => {
    const refreshToken = tokenStorage.getRefresh();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        tokenStorage.clear();
        return null;
      }
      const data = await res.json() as { access_token: string };
      tokenStorage.set(data.access_token);
      return data.access_token;
    } catch {
      tokenStorage.clear();
      return null;
    } finally {
      _refreshing = null;
    }
  })();

  return _refreshing;
}

// ── Core request ──────────────────────────────────────────────────────────────
async function _fetch(
  path: string,
  options: RequestInit,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const activeToken = token ?? tokenStorage.get();
  let response: Response;
  try {
    response = await _fetch(path, options, activeToken);
  } catch (networkErr) {
    // Retry x1 après 2s (cold start Render free ~30-60s côté backend)
    await new Promise(r => setTimeout(r, 2000));
    try {
      response = await _fetch(path, options, activeToken);
    } catch {
      // Message plus informatif que "Failed to fetch"
      const msg = (networkErr as Error)?.message || 'Erreur réseau';
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        throw new Error('Serveur inaccessible — le backend démarre peut-être (30s). Réessayez dans un instant.');
      }
      throw networkErr;
    }
  }

  // Silent token refresh on 401
  if (response.status === 401 && tokenStorage.getRefresh()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await _fetch(path, options, newToken);
    } else {
      // Refresh failed → session terminée
      authEvents.emit();
    }
  }

  if (!response.ok) {
    if (response.status === 401) authEvents.emit();
    let message = `API error ${response.status}`;
    try {
      const data = (await response.json()) as ApiError;
      if (data.detail) message = data.detail;
    } catch { /* keep default */ }
    // Note: browser always logs failed HTTP responses — this is cosmetic, not a bug.
    // 401 on /auth/login = wrong credentials (expected behavior, not an error).
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ── File upload (multipart) ────────────────────────────────────────────────────
export async function uploadFile<T>(
  path: string,
  file: File,
  token?: string | null,
): Promise<T> {
  const activeToken = token ?? tokenStorage.get();
  const form = new FormData();
  form.append('file', file);

  const headers = new Headers();
  if (activeToken) headers.set('Authorization', `Bearer ${activeToken}`);
  // Do NOT set Content-Type — browser sets multipart boundary automatically

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (!response.ok) {
    let message = `Upload error ${response.status}`;
    try {
      const data = (await response.json()) as ApiError;
      if (data.detail) message = data.detail;
    } catch { /* keep default */ }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

// ── Keep-alive — évite le cold start Render free plan ────────────────────────
// Render free endort le container après 15 min d'inactivité.
// Un ping toutes les 10 min maintient le container éveillé.
// Uniquement activé en production (pas en dev local).
const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const IS_PROD = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');

if (IS_PROD) {
  const ping = () => {
    fetch(`${API_BASE_URL}/health`, { method: 'GET', cache: 'no-store' }).catch(() => {});
  };
  // Premier ping au chargement (réveille si endormi)
  ping();
  // Puis toutes les 10 minutes
  setInterval(ping, KEEPALIVE_INTERVAL_MS);
}
