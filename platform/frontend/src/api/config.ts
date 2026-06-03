/**
 * API configuration — single source of truth for the base URL.
 * Import this instead of repeating the inline fallback everywhere.
 */
export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8000/api/v1';
