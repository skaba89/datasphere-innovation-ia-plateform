/**
 * useTenders — liste des AOs avec refresh automatique
 * useWorkflow — état du workflow avec polling
 * useBoamp — recherche BOAMP
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TenderSummary {
  id:        number;
  title:     string;
  status?:   string;
  buyer_name?: string;
}

export interface WorkflowStep {
  id:               number;
  step_key:         string;
  step_label:       string;
  order_index:      number;
  status:           string;
  status_label:     string;
  requires_approval: boolean;
  result_summary?:  string;
  approved_by?:     string;
  artifact_type?:   string;
  artifact_id?:     number;
}

export interface WorkflowState {
  tender_id:      number;
  status:         string;
  status_label:   string;
  progress_pct:   number;
  steps_done:     number;
  steps_total:    number;
  error_message?: string;
  steps:          WorkflowStep[];
}

// ── useTenders ───────────────────────────────────────────────────────────────

export function useTenders(token: string | null) {
  const [tenders, setTenders]   = useState<TenderSummary[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiRequest<TenderSummary[]>('/tenders?limit=50', {}, token);
      setTenders(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement AOs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return { tenders, loading, error, reload: load };
}

// ── useWorkflow ──────────────────────────────────────────────────────────────

export function useWorkflow(tenderId: number | null, token: string | null) {
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null);
  const [loading,  setLoading]  = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!tenderId || !token) return;
    try {
      const data = await apiRequest<WorkflowState>(`/workflow/${tenderId}`, {}, token);
      setWorkflow(data);
      return data;
    } catch { return null; }
  }, [tenderId, token]);

  // Auto-poll every 3s while running
  useEffect(() => {
    if (!tenderId || !token) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [tenderId, token, load]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (workflow?.status === 'running') {
      pollRef.current = setInterval(load, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [workflow?.status, load]);

  const start = useCallback(async (forceReset = false) => {
    if (!tenderId || !token) return;
    const data = await apiRequest<WorkflowState>(`/workflow/${tenderId}/start`, {
      method: 'POST',
      body: JSON.stringify({ force_reset: forceReset }),
    }, token);
    setWorkflow(data);
  }, [tenderId, token]);

  const approve = useCallback(async (stepId: number) => {
    if (!token) return;
    await apiRequest(`/workflow/steps/${stepId}/approve`, { method: 'POST' }, token);
    await load();
  }, [token, load]);

  const reject = useCallback(async (stepId: number, reason: string) => {
    if (!token) return;
    await apiRequest(`/workflow/steps/${stepId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }, token);
    await load();
  }, [token, load]);

  const unstuck = useCallback(async () => {
    if (!tenderId || !token) return;
    await apiRequest(`/workflow/${tenderId}/reset-stuck`, { method: 'POST' }, token);
    await load();
  }, [tenderId, token, load]);

  return { workflow, loading, reload: load, start, approve, reject, unstuck };
}

// ── usePendingApprovals ──────────────────────────────────────────────────────

export function usePendingApprovals(token: string | null) {
  const [count,  setCount]  = useState(0);
  const [steps,  setSteps]  = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    apiRequest<{ count: number; pending: any[] }>('/workflow/approvals/pending', {}, token)
      .then(r => { setCount(r?.count ?? 0); setSteps(r?.pending ?? []); })
      .catch(() => {});
  }, [token]);

  return { count, steps };
}
