import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PlayCircle, RefreshCw, Route, WandSparkles } from 'lucide-react';

import { apiRequest } from '../api/client';
import type { AgentAction, AgentAssignment, AgentProfile, Opportunity, Tender } from '../api/domainTypes';

type Props = {
  token: string;
};

type TargetKind = 'opportunity' | 'tender';

export function AgentOperationsPanel({ token }: Props) {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [targetKind, setTargetKind] = useState<TargetKind>('opportunity');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [objective, setObjective] = useState('Analyser le contexte et proposer les prochaines actions de livraison.');
  const [expectedDeliverable, setExpectedDeliverable] = useState('Plan d action priorise avec livrables attendus.');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const targetOptions = useMemo(() => {
    return targetKind === 'opportunity'
      ? opportunities.map((item) => ({ id: item.id, label: item.title }))
      : tenders.map((item) => ({ id: item.id, label: item.title }));
  }, [opportunities, targetKind, tenders]);

  async function refreshData() {
    setError(null);
    const [profiles, opps, tenderItems, assignmentItems, actionItems] = await Promise.all([
      apiRequest<AgentProfile[]>('/agents', {}, token),
      apiRequest<Opportunity[]>('/opportunities', {}, token),
      apiRequest<Tender[]>('/tenders', {}, token),
      apiRequest<AgentAssignment[]>('/agents/assignments/list', {}, token),
      apiRequest<AgentAction[]>('/agent-actions', {}, token),
    ]);
    setAgents(profiles);
    setOpportunities(opps);
    setTenders(tenderItems);
    setAssignments(assignmentItems);
    setActions(actionItems);
  }

  useEffect(() => {
    refreshData().catch((err: Error) => setError(err.message));
  }, [token]);

  async function createAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const payload = {
        agent_id: Number(selectedAgentId),
        opportunity_id: targetKind === 'opportunity' ? Number(selectedTargetId) : null,
        tender_id: targetKind === 'tender' ? Number(selectedTargetId) : null,
        assignment_type: targetKind === 'tender' ? 'tender_delivery' : 'opportunity_analysis',
        objective,
        expected_deliverable: expectedDeliverable,
        priority: 'Haute',
        status: 'planned',
        human_reviewer: 'Sekouna',
      };

      const created = await apiRequest<AgentAssignment>('/agents/assignments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token);
      setSelectedAssignmentId(String(created.id));
      setMessage('Affectation creee. Tu peux maintenant planifier les actions automatiques.');
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur creation affectation');
    } finally {
      setLoading(false);
    }
  }

  async function planActions() {
    if (!selectedAssignmentId) return;
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const planned = await apiRequest<AgentAction[]>('/agent-actions/plan', {
        method: 'POST',
        body: JSON.stringify({ assignment_id: Number(selectedAssignmentId), mode: 'safe_auto' }),
      }, token);
      setMessage(`${planned.length} action(s) planifiee(s). La planification est idempotente.`);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur planification actions');
    } finally {
      setLoading(false);
    }
  }

  async function approveAction(actionId: number) {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await apiRequest<AgentAction>(`/agent-actions/${actionId}/approve?actor_name=Sekouna`, { method: 'POST' }, token);
      setMessage('Action approuvee.');
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur approbation action');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(actionId: number) {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await apiRequest<AgentAction>('/agent-actions/run', {
        method: 'POST',
        body: JSON.stringify({ action_id: actionId, actor_name: 'frontend', force: false }),
      }, token);
      setMessage('Action lancee avec succes.');
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur execution action');
    } finally {
      setLoading(false);
    }
  }

  const filteredActions = selectedAssignmentId
    ? actions.filter((action) => action.assignment_id === Number(selectedAssignmentId))
    : actions;

  return (
    <section className="panel automation-panel">
      <div>
        <p className="eyebrow">Pilotage operationnel</p>
        <h2>Affecter un profil et generer les actions</h2>
        <p className="subtitle compact-subtitle">
          Cree une affectation, planifie les actions recommandees, puis approuve ou lance les actions selon la gouvernance.
        </p>
      </div>

      <form className="form compact-form" onSubmit={createAssignment}>
        <label>
          Profil consultant
          <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)} required>
            <option value="">Choisir un profil</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
        </label>
        <label>
          Cible
          <select value={targetKind} onChange={(event) => { setTargetKind(event.target.value as TargetKind); setSelectedTargetId(''); }}>
            <option value="opportunity">Opportunite</option>
            <option value="tender">Appel d offres</option>
          </select>
        </label>
        <label>
          Element cible
          <select value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)} required>
            <option value="">Choisir une cible</option>
            {targetOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>
          Objectif
          <textarea value={objective} onChange={(event) => setObjective(event.target.value)} required />
        </label>
        <label>
          Livrable attendu
          <textarea value={expectedDeliverable} onChange={(event) => setExpectedDeliverable(event.target.value)} />
        </label>
        <button disabled={loading || agents.length === 0 || targetOptions.length === 0} type="submit">
          <Route size={18} /> Creer l affectation
        </button>
      </form>

      <div className="automation-actions agent-actions-line">
        <select value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
          <option value="">Toutes les affectations</option>
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>Affectation #{assignment.id} · {assignment.assignment_type}</option>
          ))}
        </select>
        <button disabled={loading || !selectedAssignmentId} onClick={planActions} type="button">
          <WandSparkles size={18} /> Planifier les actions
        </button>
        <button disabled={loading} onClick={() => refreshData().catch((err: Error) => setError(err.message))} type="button">
          <RefreshCw size={18} /> Actualiser
        </button>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="table">
        {filteredActions.map((action) => (
          <article key={action.id} className="row-card">
            <strong>{action.title}</strong>
            <span>{action.action_type} · {action.priority} · {action.status}</span>
            <p>{action.description || 'Action recommandee par le moteur de planification.'}</p>
            {action.result_summary && <p>{action.result_summary}</p>}
            <div className="automation-actions agent-actions-line">
              <button disabled={loading || action.status === 'approved' || action.status === 'done'} onClick={() => approveAction(action.id)} type="button">
                <CheckCircle2 size={16} /> Approuver
              </button>
              <button disabled={loading || action.status === 'done'} onClick={() => runAction(action.id)} type="button">
                <PlayCircle size={16} /> Lancer
              </button>
            </div>
          </article>
        ))}
        {filteredActions.length === 0 && <p>Aucune action planifiee pour le moment.</p>}
      </div>
    </section>
  );
}
