const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export type ApiError = {
  detail?: string;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `API error ${response.status}`;
    try {
      const data = (await response.json()) as ApiError;
      if (data.detail) {
        message = data.detail;
      }
    } catch {
      // Keep default error message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem('datasphere_access_token');
  },
  set(token: string): void {
    localStorage.setItem('datasphere_access_token', token);
  },
  clear(): void {
    localStorage.removeItem('datasphere_access_token');
  },
};
