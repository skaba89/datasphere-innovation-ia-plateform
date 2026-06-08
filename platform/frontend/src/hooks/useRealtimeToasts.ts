/**
 * useRealtimeToasts — Hook SSE pour les toasts temps réel
 *
 * Ouvre une connexion SSE et affiche un toast quand un événement arrive.
 * Utilisé dans AppRoot pour couvrir toute l'application.
 *
 * Événements supportés :
 *   - notification : message générique
 *   - agent_action_completed : action IA terminée
 *   - deliverable_approved : livrable approuvé
 *   - boamp_match : AO BOAMP détecté
 */

import { useEffect, useRef } from 'react';

const API_BASE = (import.meta as { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL
  || 'http://localhost:8000/api/v1';

export interface ToastEvent {
  id:      string;
  type:    'success' | 'info' | 'warning' | 'error';
  title:   string;
  message: string;
  at:      number;
}

type ToastHandler = (event: ToastEvent) => void;

export function useRealtimeToasts(token: string | null, onToast: ToastHandler) {
  const esRef    = useRef<EventSource | null>(null);
  const handlerRef = useRef(onToast);
  handlerRef.current = onToast;

  useEffect(() => {
    if (!token) return;

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    function connect() {
      if (!active) return;
      try {
        const es = new EventSource(`${API_BASE}/notifications/stream?token=${token}`);
        esRef.current = es;

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (!data || data.type === 'ping' || data.type === 'connected') return;
            handlerRef.current(buildToast(data));
          } catch { /* ignore parse errors */ }
        };

        es.addEventListener('notification', (e) => {
          try {
            const data = JSON.parse((e as MessageEvent).data);
            handlerRef.current(buildToast(data));
          } catch { /* ignore */ }
        });

        es.onerror = () => {
          es.close();
          esRef.current = null;
          if (active) {
            retryTimer = setTimeout(connect, 5000);
          }
        };
      } catch { /* SSE not supported */ }
    }

    connect();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [token]);
}

function buildToast(data: Record<string, unknown>): ToastEvent {
  const eventType = String(data.event_type || data.type || 'notification');
  const title = String(data.title || data.message || 'Notification');
  const message = String(data.body || data.detail || '');

  const typeMap: Record<string, ToastEvent['type']> = {
    agent_action_completed: 'success',
    deliverable_approved:   'success',
    boamp_match:            'info',
    error:                  'error',
    warning:                'warning',
  };

  return {
    id:      `${Date.now()}-${Math.random()}`,
    type:    typeMap[eventType] ?? 'info',
    title,
    message,
    at:      Date.now(),
  };
}
