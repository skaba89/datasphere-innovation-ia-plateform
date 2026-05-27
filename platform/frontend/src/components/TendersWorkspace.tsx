import { useEffect, useState } from 'react';

import { apiRequest } from '../api/client';
import type { CurrentUser } from '../api/authTypes';
import type { Opportunity, Tender, TenderRequirement } from '../api/domainTypes';

type Props = {
  token: string;
  user: CurrentUser | null;
  opportunities: Opportunity[];
  tenders: Tender[];
  onTendersChange: (items: Tender[]) => void;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
};

export function TendersWorkspace({
  token,
  user,
  opportunities,
  tenders,
  onTendersChange,
  onMessage,
  onError,
}: Props) {
  const [requirements, setRequirements] = useState<TenderRequirement[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<number | null>(() => tenders[0]?.id || null);
  const [tenderTitle, setTenderTitle] = useState('');
  const [tenderReference, setTenderReference] = useState('');
  const [tenderBuyer, setTenderBuyer] = useState('');
  const [tenderOpportunityId, setTenderOpportunityId] = useState('');
  const [requirementDescription, setRequirementDescription] = useState('');
  const [requirementCode, setRequirementCode] = useState('');
  const [requirementSection, setRequirementSection] = useState('');

  const selectedTender = tenders.find((item) => item.id === selectedTenderId) || null;

  useEffect(() => {
    if (!selectedTenderId && tenders.length > 0) {
      setSelectedTenderId(tenders[0].id);
    }
  }, [selectedTenderId, tenders]);

  useEffect(() => {
    if (!selectedTenderId) {
      setRequirements([]);
      return;
    }

    apiRequest<TenderRequirement[]>(`/tenders/${selectedTenderId}/requirements`, {}, token)
      .then(setRequirements)
      .catch((err: Error) => onError(err.message));
  }, [selectedTenderId, token, onError]);

  async function createTender(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await apiRequest<Tender>('/tenders', {
        method: 'POST',
        body: JSON.stringify({
          opportunity_id: Number(tenderOpportunityId),
          reference: tenderReference || null,
          title: tenderTitle,
          buyer_name: tenderBuyer || null,
          publication_date: null,
          submission_deadline: null,
          source_url: null,
          summary: null,
          go_no_go_score: null,
          go_no_go_decision: 'A qualifier',
          status: 'draft',
        }),
      }, token);

      onTendersChange([created, ...tenders]);
      setSelectedTenderId(created.id);
      setTenderTitle('');
      setTenderReference('');
      setTenderBuyer('');
      setTenderOpportunityId('');
      onMessage('Appel d offres cree avec succes.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erreur creation appel d offres');
    }
  }

  async function createRequirement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenderId) return;

    try {
      const created = await apiRequest<TenderRequirement>(`/tenders/${selectedTenderId}/requirements`, {
        method: 'POST',
        body: JSON.stringify({
          tender_id: selectedTenderId,
          requirement_code: requirementCode || null,
          section: requirementSection || null,
          description: requirementDescription,
          requirement_type: 'Obligatoire',
          response_strategy: null,
          proof_or_deliverable: null,
          owner_name: user?.first_name || null,
          status: 'A traiter',
          comments: null,
        }),
      }, token);

      setRequirements([created, ...requirements]);
      setRequirementCode('');
      setRequirementSection('');
      setRequirementDescription('');
      onMessage('Exigence ajoutee avec succes.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erreur creation exigence');
    }
  }

  return (
    <section className="split-layout">
      <div className="workspace-stack">
        <section className="panel">
          <h2>Nouvel appel d offres</h2>
          <form className="form compact-form" onSubmit={createTender}>
            <label>
              Opportunite liee
              <select value={tenderOpportunityId} onChange={(event) => setTenderOpportunityId(event.target.value)} required>
                <option value="">Choisir une opportunite</option>
                {opportunities.map((opp) => (
                  <option key={opp.id} value={opp.id}>{opp.title}</option>
                ))}
              </select>
            </label>
            <label>
              Titre
              <input value={tenderTitle} onChange={(event) => setTenderTitle(event.target.value)} required />
            </label>
            <label>
              Reference
              <input value={tenderReference} onChange={(event) => setTenderReference(event.target.value)} />
            </label>
            <label>
              Acheteur / institution
              <input value={tenderBuyer} onChange={(event) => setTenderBuyer(event.target.value)} />
            </label>
            <button type="submit" disabled={opportunities.length === 0}>Creer l appel d offres</button>
          </form>
        </section>

        <section className="panel">
          <h2>Appels d offres</h2>
          <div className="table">
            {tenders.map((tender) => (
              <button
                key={tender.id}
                className={`row-card row-button ${selectedTenderId === tender.id ? 'selected' : ''}`}
                onClick={() => setSelectedTenderId(tender.id)}
                type="button"
              >
                <strong>{tender.title}</strong>
                <span>{tender.reference || 'Sans reference'} · {tender.buyer_name || 'Acheteur non renseigne'} · {tender.status}</span>
              </button>
            ))}
            {tenders.length === 0 && <p>Aucun appel d offres pour le moment.</p>}
          </div>
        </section>
      </div>

      <div className="workspace-stack">
        <section className="panel">
          <h2>{selectedTender ? selectedTender.title : 'Exigences'}</h2>
          {selectedTender ? (
            <p className="subtitle">
              {selectedTender.reference || 'Sans reference'} · Decision {selectedTender.go_no_go_decision || 'A qualifier'}
            </p>
          ) : (
            <p>Selectionne un appel d offres pour gerer ses exigences.</p>
          )}
        </section>

        {selectedTender && (
          <section className="panel">
            <h2>Nouvelle exigence</h2>
            <form className="form compact-form" onSubmit={createRequirement}>
              <label>
                Code exigence
                <input value={requirementCode} onChange={(event) => setRequirementCode(event.target.value)} />
              </label>
              <label>
                Section
                <input value={requirementSection} onChange={(event) => setRequirementSection(event.target.value)} />
              </label>
              <label>
                Description
                <textarea value={requirementDescription} onChange={(event) => setRequirementDescription(event.target.value)} required />
              </label>
              <button type="submit">Ajouter l exigence</button>
            </form>
          </section>
        )}

        <section className="panel">
          <h2>Exigences</h2>
          <div className="table">
            {requirements.map((requirement) => (
              <article key={requirement.id} className="row-card">
                <strong>{requirement.requirement_code || 'Exigence sans code'}</strong>
                <span>{requirement.section || 'Section non renseignee'} · {requirement.status}</span>
                <p>{requirement.description}</p>
              </article>
            ))}
            {selectedTender && requirements.length === 0 && <p>Aucune exigence pour cet appel d offres.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}
