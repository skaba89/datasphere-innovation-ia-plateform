import { useEffect, useState } from 'react';

import { apiRequest } from '../api/client';
import type { ComplianceMatrixItem, GoNoGoCriterion } from '../api/domainTypes';
import { can } from '../auth/rbac';

type Props = {
  token: string;
  role?: string | null;
};

interface TenderOption {
  id:        number;
  title:     string;
  reference: string;
  status:    string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon', go: 'Go', no_go: 'No-Go',
  submitted: 'Soumis', won: 'Gagné', lost: 'Perdu',
};

export function TenderAutomationPanel({ token, role }: Props) {
  const [tenders,  setTenders]  = useState<TenderOption[]>([]);
  const [tenderId, setTenderId] = useState<string>('');
  const [message,  setMessage]  = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const canWriteTenders = can(role, 'tenders:write');

  // Load all tenders and auto-select the first
  useEffect(() => {
    if (!token) return;
    setLoadingList(true);
    apiRequest<TenderOption[]>('/tenders?limit=50', {}, token)
      .then(list => {
        if (!list?.length) { setLoadingList(false); return; }
        setTenders(list);
        setTenderId(String(list[0].id));   // auto-select first
      })
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, [token]);

  async function runAction(action: 'goNoGo' | 'compliance') {
    setMessage(null);
    setError(null);

    if (!canWriteTenders) {
      setError("Ton rôle ne permet pas d'exécuter les automatisations d'appels d'offres.");
      return;
    }
    if (!tenderId) {
      setError("Aucun appel d'offres disponible. Créez-en un d'abord.");
      return;
    }

    setLoading(true);
    try {
      if (action === 'goNoGo') {
        const created = await apiRequest<GoNoGoCriterion[]>(
          `/tender-templates/tenders/${tenderId}/go-no-go/default`,
          { method: 'POST' },
          token,
        );
        setMessage(`${created.length} critère(s) Go / No-Go ajouté(s).`);
      } else {
        const created = await apiRequest<ComplianceMatrixItem[]>(
          `/tender-templates/tenders/${tenderId}/compliance/from-requirements`,
          { method: 'POST' },
          token,
        );
        setMessage(`${created.length} ligne(s) de conformité générée(s).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur pendant l'automatisation.");
    } finally {
      setLoading(false);
    }
  }

  const selectedTender = tenders.find(t => String(t.id) === tenderId);

  return (
    <section className="panel automation-panel">
      <div>
        <p className="eyebrow">Automatisation contrôlée</p>
        <h2>Accélérer la préparation d'un appel d'offres</h2>
        <p className="subtitle compact-subtitle">
          Sélectionne un AO, puis applique les templates standards.
          Les doublons sont évités côté backend.
        </p>
      </div>

      {!canWriteTenders && (
        <p className="error">Ton rôle permet de consulter ce module, mais pas d'exécuter les automatisations.</p>
      )}

      <div className="automation-actions">
        <label>
          Appel d'offres
          {loadingList ? (
            <select disabled>
              <option>Chargement…</option>
            </select>
          ) : tenders.length === 0 ? (
            <select disabled>
              <option>— Aucun AO disponible —</option>
            </select>
          ) : (
            <select
              value={tenderId}
              onChange={e => { setTenderId(e.target.value); setMessage(null); setError(null); }}
              disabled={!canWriteTenders || loading}
              aria-label="Sélectionner un appel d'offres"
            >
              {tenders.map(t => (
                <option key={t.id} value={String(t.id)}>
                  #{t.id} — {t.title}
                  {t.reference ? ` (${t.reference})` : ''}
                  {t.status ? ` · ${STATUS_LABEL[t.status] ?? t.status}` : ''}
                </option>
              ))}
            </select>
          )}
        </label>

        <button
          disabled={!canWriteTenders || loading || !tenderId}
          onClick={() => runAction('goNoGo')}
          type="button"
        >
          {loading ? 'Traitement…' : 'Appliquer Go / No-Go'}
        </button>
        <button
          disabled={!canWriteTenders || loading || !tenderId}
          onClick={() => runAction('compliance')}
          type="button"
        >
          {loading ? 'Traitement…' : 'Générer conformité'}
        </button>
      </div>

      {message && <p className="success">{message}</p>}
      {error   && <p className="error">{error}</p>}
    </section>
  );
}
