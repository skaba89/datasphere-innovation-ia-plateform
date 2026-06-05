import { useState } from 'react';

import { apiRequest } from '../api/client';
import type { ComplianceMatrixItem, GoNoGoCriterion } from '../api/domainTypes';
import { can } from '../auth/rbac';

type Props = {
  token: string;
  role?: string | null;
};

export function TenderAutomationPanel({ token, role }: Props) {
  const [tenderId, setTenderId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canWriteTenders = can(role, 'tenders:write');

  function getValidatedTenderId(): string | null {
    const cleaned = tenderId.trim();
    if (!cleaned) {
      setError("Renseigne d'abord l'ID de l'appel d'offres.");
      return null;
    }
    if (!/^\d+$/.test(cleaned) || Number(cleaned) <= 0) {
      setError("L'ID de l'appel d'offres doit être un nombre positif.");
      return null;
    }
    return cleaned;
  }

  async function runAction(action: 'goNoGo' | 'compliance') {
    setMessage(null);
    setError(null);

    if (!canWriteTenders) {
      setError("Ton rôle ne permet pas d'exécuter les automatisations d'appels d'offres.");
      return;
    }

    const validTenderId = getValidatedTenderId();
    if (!validTenderId) return;

    setLoading(true);
    try {
      if (action === 'goNoGo') {
        const created = await apiRequest<GoNoGoCriterion[]>(
          `/tender-templates/tenders/${validTenderId}/go-no-go/default`,
          { method: 'POST' },
          token,
        );
        setMessage(`${created.length} critère(s) Go / No-Go ajouté(s).`);
      } else {
        const created = await apiRequest<ComplianceMatrixItem[]>(
          `/tender-templates/tenders/${validTenderId}/compliance/from-requirements`,
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

  return (
    <section className="panel automation-panel">
      <div>
        <p className="eyebrow">Automatisation contrôlée</p>
        <h2>Accélérer la préparation d'un appel d'offres</h2>
        <p className="subtitle compact-subtitle">
          Renseigne l'ID du tender, puis applique les templates standards. Les doublons sont évités côté backend.
        </p>
      </div>

      {!canWriteTenders && (
        <p className="error">Ton rôle permet de consulter ce module, mais pas d'exécuter les automatisations.</p>
      )}

      <div className="automation-actions">
        <label>
          ID appel d'offres
          <input
            value={tenderId}
            onChange={(event) => setTenderId(event.target.value)}
            placeholder="Ex: 1"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-invalid={Boolean(error)}
            disabled={!canWriteTenders || loading}
          />
        </label>
        <button disabled={!canWriteTenders || loading} onClick={() => runAction('goNoGo')} type="button">
          {loading ? 'Traitement…' : 'Appliquer Go / No-Go'}
        </button>
        <button disabled={!canWriteTenders || loading} onClick={() => runAction('compliance')} type="button">
          {loading ? 'Traitement…' : 'Générer conformité'}
        </button>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
