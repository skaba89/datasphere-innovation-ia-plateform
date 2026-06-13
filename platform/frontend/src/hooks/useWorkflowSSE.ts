/**
 * useWorkflowSSE — Real-time workflow updates via Server-Sent Events
 *
 * Remplace le polling (setInterval 5s) par un stream permanent.
 * Le navigateur gère la reconnexion automatiquement (EventSource).
 *
 * Usage :
 *   const { lastEvent, connected } = useWorkflowSSE(token, onStepUpdate);
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type WorkflowEvent =
  | { type: 'workflow.step_done';      tender_id: number; step_key: string; step_label: string; status: string }
  | { type: 'workflow.step_awaiting';  tender_id: number; step_key: string; step_label: string; status: string }
  | { type: 'workflow.completed';      tender_id: number }
  | { type: 'notification';            id: number; title: string; priority: string }
  | { type: 'action_approved';         id: number; title: string }
  | { type: 'heartbeat';               ts: string }
  | { type: 'connected';               user_id: number };

interface UseWorkflowSSEOptions {
  token:         string | null;
  onEvent?:      (event: WorkflowEvent) => void;
  onConnect?:    () => void;
  onDisconnect?: () => void;
}

interface UseWorkflowSSEResult {
  connected:  boolean;
  lastEvent:  WorkflowEvent | null;
  reconnect:  () => void;
}

const SSE_URL = '/api/v1/notifications/stream';

export function useWorkflowSSE({
  token,
  onEvent,
  onConnect,
  onDisconnect,
}: UseWorkflowSSEOptions): UseWorkflowSSEResult {
  const [connected,  setConnected]  = useState(false);
  const [lastEvent,  setLastEvent]  = useState<WorkflowEvent | null>(null);
  const esRef        = useRef<EventSource | null>(null);
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount   = useRef(0);

  const connect = useCallback(() => {
    if (!token) return;
    if (esRef.current) {
      esRef.current.close();
    }

    // Append token as query param (EventSource doesn't support headers)
    const url = `${SSE_URL}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retryCount.current = 0;
      onConnect?.();
    };

    // Handle named events from the server
    const eventTypes = [
      'connected', 'heartbeat', 'notification',
      'workflow.step_done', 'workflow.step_awaiting', 'workflow.completed',
      'action_approved',
    ];

    eventTypes.forEach(type => {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as WorkflowEvent;
          setLastEvent(data);
          if (data.type !== 'heartbeat') {
            onEvent?.(data);
          }
        } catch {
          // ignore parse errors
        }
      });
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      onDisconnect?.();

      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * 2 ** retryCount.current, 30_000);
      retryCount.current++;
      retryTimeout.current = setTimeout(connect, delay);
    };
  }, [token, onEvent, onConnect, onDisconnect]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (retryTimeout.current) clearTimeout(retryTimeout.current);
    };
  }, [connect]);

  return { connected, lastEvent, reconnect: connect };
}

/**
 * useNotificationSSE — Simpler hook, just for notification toasts
 */
export function useNotificationSSE(token: string | null, onNotification: (n: { title: string; priority: string }) => void) {
  useWorkflowSSE({
    token,
    onEvent: (event) => {
      if (event.type === 'notification') {
        onNotification({ title: event.title, priority: event.priority });
      }
    },
  });
}
