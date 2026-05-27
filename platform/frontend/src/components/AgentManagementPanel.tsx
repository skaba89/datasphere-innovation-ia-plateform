import { useEffect, useState } from 'react';
import { Bot, RefreshCw, Sparkles } from 'lucide-react';

import { apiRequest } from '../api/client';
import type { AgentProfile } from '../api/domainTypes';

type Props = {
  token: string;
};

export function AgentManagementPanel({ token }: Props) {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [defaultAgents, setDefaultAgents] = useState<AgentProfile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refreshAgents() {
    setError(null);
    const [allProfiles, installedDefaults] = await Promise.all([
      apiRequest<AgentProfile[]>('/agents', {}, token),
      apiRequest<AgentProfile[]>('/agents/defaults', {}, token),
    ]);
    setAgents(allProfiles);
    setDefaultAgents(installedDefaults);
  }

  useEffect(() => {
    refreshAgents().catch((err: Error) => setError(err.message));
  }, [token]);

  async function installDefaults() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const installed = await apiRequest<AgentProfile[]>('/agents/defaults/install', { method: 'POST' }, token);
      setMessage(`${installed.length} profil(s) consultant/agent disponible(s). Installation idempotente : aucun doublon cree.`);
      await refreshAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur installation profils agents');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel automation-panel">
      <div>
        <p className="eyebrow">Agents specialises</p>
        <h2>Catalogue des consultants augmentes</h2>
        <p className="subtitle compact-subtitle">
          Installe les profils par defaut pour demarrer rapidement : Data Architect, Reponse AO, Gouvernance, Business Analyst et Documentation.
        </p>
      </div>

      <div className="agent-summary-grid">
        <article className="row-card">
          <Bot size={24} />
          <strong>{agents.length}</strong>
          <span>Profils agents au total</span>
        </article>
        <article className="row-card">
          <Sparkles size={24} />
          <strong>{defaultAgents.length}</strong>
          <span>Profils standards installes</span>
        </article>
      </div>

      <div className="automation-actions agent-actions-line">
        <button disabled={loading} onClick={installDefaults} type="button">
          <Sparkles size={18} /> Installer les profils standards
        </button>
        <button disabled={loading} onClick={() => refreshAgents().catch((err: Error) => setError(err.message))} type="button">
          <RefreshCw size={18} /> Actualiser
        </button>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="table">
        {agents.map((agent) => (
          <article key={agent.id} className="row-card">
            <strong>{agent.name}</strong>
            <span>{agent.domain} · {agent.seniority} · {agent.languages}</span>
            <p>{agent.description || 'Profil specialise pret a etre affecte a une mission.'}</p>
          </article>
        ))}
        {agents.length === 0 && <p>Aucun profil agent installe pour le moment.</p>}
      </div>
    </section>
  );
}
