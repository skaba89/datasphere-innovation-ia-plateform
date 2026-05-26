import { useState } from 'react';

import { apiRequest } from '../api/client';
import type { ComplianceMatrixItem, GoNoGoCriterion } from '../api/domainTypes';

type Props = {
  token: string;
};

export function TenderAutomationPanel({ token }: Props) {
  const [tenderId, setTenderId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAction(action: 'goNoGo' | 'compliance') {
    setMessage(null);
    setError(null);

    if (!tenderId) {
      setError('Renseigne d abord l ID de l appel d offres.');
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
        setMessage(`${created.length} critere(s) Go / No-Go ajoute(s).`);
      } else {
        const created = await apiRequest<ComplianceMatrixItem[]>(
          `/tender-templates/tenders/${tenderId}/compliance/from-requirements`,
          { method: 'POST' },
          token,
        );
        setMessage(`${created.length} ligne(s) de conformite generee(s).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur pendant l automatisation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel automation-panel">
      <div>
        <p className="eyebrow">Automatisation controlee</p>
        <h2>Accelerer la preparation d un appel d offres</h2>
        <p className="subtitle compact-subtitle">
          Renseigne l ID du tender, puis applique les templates standards. Les doublons sont evites cote backend.
        </p>
      </div>

      <div className="automation-actions">
        <label>
          ID appel d offres
          <input value={tenderId} onChange={(event) => setTenderId(event.target.value)} placeholder="Ex: 1" inputMode="numeric" />
        </label>
        <button disabled={loading} onClick={() => runAction('goNoGo')} type="button">
          Appliquer Go / No-Go
        </button>
        <button disabled={loading} onClick={() => runAction('compliance')} type="button">
          Generer conformite
        </button>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
