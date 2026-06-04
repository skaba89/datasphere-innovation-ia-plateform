/**
 * DataSphere Innovation — API Client
 *
 * Features:
 * - Automatic JWT refresh on 401
 * - Retry once on 401 with fresh token
 * - Persistent token storage (access + refresh)
 * - File upload support with refresh handling
 * - Consistent FastAPI error messages
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

type ApiErrorDetail = string | { msg?: string; message?: string; loc?: unknown[] }[] | Record<string, unknown>;
export type ApiError = { detail?: ApiErrorDetail; message?: string };

function getErrorMessage(status: number, data?: ApiError | null): string {
  const detail = data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => {
        const location = Array.isArray(item.loc) ? item.loc.join('.') : '';
        const message = item.msg || item.message || 'Champ invalide';
        return location ? `${location}: ${message}` : message;
      })
      .join(' · ');
  }
  if (data?.message) return data.message;

  if (status === 401) return 'Session expirée. Merci de te reconnecter.';
  if (status === 403) return "Tu n'as pas les droits nécessaires pour cette action.";
  if (status === 404) return 'Ressource introuvable.';
  if (status >= 500) return 'Erreur serveur. Merci de réessayer plus tard.';
  return `Erreur API ${status}`;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ApiError;
    return getErrorMessage(response.status, data);
  } catch {
    return getErrorMessage(response.status);
  }
}

export const tokenStorage = {
  getAccess(): string | null {
    return localStorage.getItem('ds_access_token');
  },
  getRefresh(): string | null {
    return localStorage.getItem('ds_refresh_token');
  },
  setAccess(t: string): void {
    localStorage.setItem('ds_access_token', t);
    localStorage.setItem('datasphere_access_token', t);
  },
  setRefresh(t: string): void {
    localStorage.setItem('ds_refresh_token', t);
  },
  set(access: string, refresh?: string): void {
    this.setAccess(access);
    if (refresh) this.setRefresh(refresh);
  },
  clear(): void {
    localStorage.removeItem('ds_access_token');
    localStorage.removeItem('ds_refresh_token');
    localStorage.removeItem('datasphere_access_token');
  },
  get(): string | null {
    return localStorage.getItem('ds_access_token')
      ?? localStorage.getItem('datasphere_access_token');
  },
};

let _refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
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
      const data = await res.json() as { access_token: string; refresh_token?: string };
      tokenStorage.set(data.access_token, data.refresh_token);
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
  let response = await _fetch(path, options, activeToken);

  if (response.status === 401 && tokenStorage.getRefresh()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await _fetch(path, options, newToken);
    }
  }

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function uploadWithToken(path: string, file: File, token: string | null): Promise<Response> {
  const form = new FormData();
  form.append('file', file);

  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: form,
  });
}

export async function uploadFile<T>(
  path: string,
  file: File,
  token?: string | null,
): Promise<T> {
  const activeToken = token ?? tokenStorage.get();
  let response = await uploadWithToken(path, file, activeToken);

  if (response.status === 401 && tokenStorage.getRefresh()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await uploadWithToken(path, file, newToken);
    }
  }

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
