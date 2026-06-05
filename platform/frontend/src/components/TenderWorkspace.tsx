import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '../api/client';
import FileAttachments from './FileAttachments';
import { can } from '../auth/rbac';
import type {
  ComplianceMatrixItem,
  ComplianceSummary,
  GoNoGoCriterion,
  GoNoGoSummary,
  Opportunity,
  Tender,
  TenderRequirement,
} from '../api/domainTypes';

type Props = { token: string; role?: string | null };

const initialTenderForm = {
  opportunity_id: '',
  reference: '',
  title: '',
  buyer_name: '',
  source_url: '',
  summary: '',
  go_no_go_score: '0',
  go_no_go_decision: 'TO_QUALIFY',
  status: 'analysis',
};

const initialRequirementForm = {
  requirement_code: '',
  section: '',
  description: '',
  requirement_type: 'Technique',
  response_strategy: '',
  proof_or_deliverable: '',
  owner_name: '',
  status: 'to_analyze',
  comments: '',
};

const initialCriterionForm = {
  name: '',
  description: '',
  score: '3',
  weight: '1',
  max_score: '5',
  rationale: '',
  recommendation: 'neutral',
};

const initialComplianceForm = {
  requirement_id: '',
  requirement_code: '',
  requirement_summary: '',
  compliance_status: 'to_review',
  response_location: '',
  evidence: '',
  gap: '',
  action_plan: '',
  owner_name: '',
  comments: '',
};

export function TenderWorkspace({ token, role }: Props) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<number | null>(null);
  const [requirements, setRequirements] = useState<TenderRequirement[]>([]);
  const [criteria, setCriteria] = useState<GoNoGoCriterion[]>([]);
  const [complianceItems, setComplianceItems] = useState<ComplianceMatrixItem[]>([]);
  const [goNoGoSummary, setGoNoGoSummary] = useState<GoNoGoSummary | null>(null);
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);
  const [tenderForm, setTenderForm] = useState(initialTenderForm);
  const [requirementForm, setRequirementForm] = useState(initialRequirementForm);
  const [criterionForm, setCriterionForm] = useState(initialCriterionForm);
  const [complianceForm, setComplianceForm] = useState(initialComplianceForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreatingTender, setIsCreatingTender] = useState(false);
  const [isCreatingRequirement, setIsCreatingRequirement] = useState(false);
  const [isCreatingCriterion, setIsCreatingCriterion] = useState(false);
  const [isCreatingCompliance, setIsCreatingCompliance] = useState(false);
  const canWriteTenders = can(role, 'tenders:write');

  const selectedTender = useMemo(
    () => tenders.find((item) => item.id === selectedTenderId) || null,
    [selectedTenderId, tenders],
  );

  const refreshTenders = useCallback(async () => {
    const [opps, tenderList] = await Promise.all([
      apiRequest<Opportunity[]>('/opportunities', {}, token),
      apiRequest<Tender[]>('/tenders', {}, token),
    ]);
    setOpportunities(opps);
    setTenders(tenderList);
    if (!selectedTenderId && tenderList.length > 0) {
      setSelectedTenderId(tenderList[0].id);
    }
  }, [selectedTenderId, token]);

  const refreshGovernance = useCallback(async () => {
    if (!selectedTenderId) return;
    const [reqs, crits, goSummary, compItems, compSummary] = await Promise.all([
      apiRequest<TenderRequirement[]>(`/tenders/${selectedTenderId}/requirements`, {}, token),
      apiRequest<GoNoGoCriterion[]>(`/tender-governance/tenders/${selectedTenderId}/go-no-go`, {}, token),
      apiRequest<GoNoGoSummary>(`/tender-governance/tenders/${selectedTenderId}/go-no-go/summary`, {}, token),
      apiRequest<ComplianceMatrixItem[]>(`/tender-governance/tenders/${selectedTenderId}/compliance`, {}, token),
      apiRequest<ComplianceSummary>(`/tender-governance/tenders/${selectedTenderId}/compliance/summary`, {}, token),
    ]);
    setRequirements(reqs);
    setCriteria(crits);
    setGoNoGoSummary(goSummary);
    setComplianceItems(compItems);
    setComplianceSummary(compSummary);
  }, [selectedTenderId, token]);

  useEffect(() => {
    refreshTenders().catch((err: Error) => setError(err.message));
  }, [refreshTenders]);

  useEffect(() => {
    refreshGovernance().catch((err: Error) => setError(err.message));
  }, [refreshGovernance]);

  function denyWrite() {
    setError("Ton rôle permet de consulter les appels d'offres, mais pas de modifier ce module.");
  }

  async function createTender(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteTenders) return denyWrite();
    if (isCreatingTender) return;
    setError(null);
    setSuccess(null);
    setIsCreatingTender(true);
    try {
      const tender = await apiRequest<Tender>('/tenders', {
        method: 'POST',
        body: JSON.stringify({
          opportunity_id: Number(tenderForm.opportunity_id),
          reference: tenderForm.reference || null,
          title: tenderForm.title.trim(),
          buyer_name: tenderForm.buyer_name || null,
          source_url: tenderForm.source_url || null,
          summary: tenderForm.summary || null,
          go_no_go_score: Number(tenderForm.go_no_go_score),
          go_no_go_decision: tenderForm.go_no_go_decision,
          status: tenderForm.status,
        }),
      }, token);
      setTenderForm(initialTenderForm);
      await refreshTenders();
      setSelectedTenderId(tender.id);
      setSuccess("Appel d'offres créé avec succès.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur création appel d'offres");
    } finally {
      setIsCreatingTender(false);
    }
  }

  async function createRequirement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteTenders) return denyWrite();
    if (!selectedTenderId || isCreatingRequirement) return;
    setError(null);
    setSuccess(null);
    setIsCreatingRequirement(true);
    try {
      await apiRequest<TenderRequirement>(`/tenders/${selectedTenderId}/requirements`, {
        method: 'POST',
        body: JSON.stringify({ tender_id: selectedTenderId, ...requirementForm, description: requirementForm.description.trim() }),
      }, token);
      setRequirementForm(initialRequirementForm);
      await refreshGovernance();
      setSuccess('Exigence ajoutée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur création exigence');
    } finally {
      setIsCreatingRequirement(false);
    }
  }

  async function createCriterion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteTenders) return denyWrite();
    if (!selectedTenderId || isCreatingCriterion) return;
    setError(null);
    setSuccess(null);
    setIsCreatingCriterion(true);
    try {
      await apiRequest<GoNoGoCriterion>(`/tender-governance/tenders/${selectedTenderId}/go-no-go`, {
        method: 'POST',
        body: JSON.stringify({
          tender_id: selectedTenderId,
          name: criterionForm.name.trim(),
          description: criterionForm.description || null,
          score: Number(criterionForm.score),
          weight: Number(criterionForm.weight),
          max_score: Number(criterionForm.max_score),
          rationale: criterionForm.rationale || null,
          recommendation: criterionForm.recommendation,
        }),
      }, token);
      setCriterionForm(initialCriterionForm);
      await refreshGovernance();
      setSuccess('Critère Go / No-Go ajouté.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur création critère');
    } finally {
      setIsCreatingCriterion(false);
    }
  }

  async function createComplianceItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteTenders) return denyWrite();
    if (!selectedTenderId || isCreatingCompliance) return;
    setError(null);
    setSuccess(null);
    setIsCreatingCompliance(true);
    try {
      await apiRequest<ComplianceMatrixItem>(`/tender-governance/tenders/${selectedTenderId}/compliance`, {
        method: 'POST',
        body: JSON.stringify({
          tender_id: selectedTenderId,
          requirement_id: complianceForm.requirement_id ? Number(complianceForm.requirement_id) : null,
          requirement_code: complianceForm.requirement_code || null,
          requirement_summary: complianceForm.requirement_summary.trim(),
          compliance_status: complianceForm.compliance_status,
          response_location: complianceForm.response_location || null,
          evidence: complianceForm.evidence || null,
          gap: complianceForm.gap || null,
          action_plan: complianceForm.action_plan || null,
          owner_name: complianceForm.owner_name || null,
          comments: complianceForm.comments || null,
        }),
      }, token);
      setComplianceForm(initialComplianceForm);
      await refreshGovernance();
      setSuccess('Ligne de conformité ajoutée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur création conformité');
    } finally {
      setIsCreatingCompliance(false);
    }
  }

  return (
    <section className="workspace-stack tender-workspace">
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      {!canWriteTenders && <p className="error">Lecture seule : ton rôle ne permet pas de modifier les appels d'offres.</p>}

      <section className="split-layout tender-split-layout">
        {canWriteTenders ? (
          <form className="panel form compact-form" onSubmit={createTender} aria-busy={isCreatingTender}>
            <h2>Nouvel appel d'offres</h2>
            <label>Opportunité<select required value={tenderForm.opportunity_id} onChange={(event) => setTenderForm({ ...tenderForm, opportunity_id: event.target.value })} disabled={isCreatingTender}><option value="">Sélectionner</option>{opportunities.map((opp) => <option key={opp.id} value={opp.id}>{opp.title}</option>)}</select></label>
            <label>Référence<input value={tenderForm.reference} onChange={(event) => setTenderForm({ ...tenderForm, reference: event.target.value })} disabled={isCreatingTender} /></label>
            <label>Titre<input required value={tenderForm.title} onChange={(event) => setTenderForm({ ...tenderForm, title: event.target.value })} disabled={isCreatingTender} /></label>
            <label>Acheteur<input value={tenderForm.buyer_name} onChange={(event) => setTenderForm({ ...tenderForm, buyer_name: event.target.value })} disabled={isCreatingTender} /></label>
            <label>URL source<input value={tenderForm.source_url} onChange={(event) => setTenderForm({ ...tenderForm, source_url: event.target.value })} disabled={isCreatingTender} /></label>
            <label>Résumé<textarea value={tenderForm.summary} onChange={(event) => setTenderForm({ ...tenderForm, summary: event.target.value })} disabled={isCreatingTender} /></label>
            <button type="submit" disabled={opportunities.length === 0 || isCreatingTender}>{isCreatingTender ? 'Création…' : "Créer appel d'offres"}</button>
          </form>
        ) : (
          <section className="panel"><h2>Lecture seule</h2><p className="subtitle">Tu peux consulter les appels d'offres, mais pas en créer.</p></section>
        )}

        <section className="panel">
          <h2>Appels d'offres</h2>
          <div className="table">
            {tenders.map((tender) => (
              <button key={tender.id} className={`row-card row-button tender-list-card ${selectedTenderId === tender.id ? 'selected' : ''}`} onClick={() => setSelectedTenderId(tender.id)} type="button">
                <strong>{tender.title}</strong>
                <span className="tender-meta">{tender.reference || 'Sans référence'} · {tender.status} · {tender.buyer_name || 'Acheteur non renseigné'}</span>
              </button>
            ))}
            {tenders.length === 0 && <p>Aucun appel d'offres pour le moment.</p>}
          </div>
        </section>
      </section>

      {selectedTender && (
        <>
          <section className="stats">
            <article><strong>{goNoGoSummary?.percentage ?? 0}%</strong><span>Score Go / No-Go</span></article>
            <article><strong>{goNoGoSummary?.recommendation ?? 'N/A'}</strong><span>Décision recommandée</span></article>
            <article><strong>{complianceSummary?.compliance_rate ?? 0}%</strong><span>Taux de conformité</span></article>
          </section>

          <section className="panel tender-selected-header">
            <div>
              <strong>{selectedTender.title}</strong>
              <div className="tender-meta">{selectedTender.reference || 'N/A'} · {selectedTender.buyer_name || 'Acheteur inconnu'}</div>
            </div>
            <a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'}/deliverables/tenders/${selectedTender.id}/mission-report`} target="_blank" rel="noreferrer" className="tender-report-link">📄 Rapport de mission complet</a>
          </section>
          <section className="tender-attachments-wrap"><FileAttachments resourceType="tender" resourceId={selectedTender.id} /></section>

          {canWriteTenders && (
            <>
              <section className="split-layout tender-split-layout">
                <form className="panel form compact-form" onSubmit={createRequirement} aria-busy={isCreatingRequirement}>
                  <h2>Ajouter une exigence</h2>
                  <label>Code<input value={requirementForm.requirement_code} onChange={(event) => setRequirementForm({ ...requirementForm, requirement_code: event.target.value })} disabled={isCreatingRequirement} /></label>
                  <label>Section<input value={requirementForm.section} onChange={(event) => setRequirementForm({ ...requirementForm, section: event.target.value })} disabled={isCreatingRequirement} /></label>
                  <label>Description<textarea required value={requirementForm.description} onChange={(event) => setRequirementForm({ ...requirementForm, description: event.target.value })} disabled={isCreatingRequirement} /></label>
                  <label>Type<input value={requirementForm.requirement_type} onChange={(event) => setRequirementForm({ ...requirementForm, requirement_type: event.target.value })} disabled={isCreatingRequirement} /></label>
                  <label>Stratégie<textarea value={requirementForm.response_strategy} onChange={(event) => setRequirementForm({ ...requirementForm, response_strategy: event.target.value })} disabled={isCreatingRequirement} /></label>
                  <button type="submit" disabled={isCreatingRequirement}>{isCreatingRequirement ? 'Ajout…' : 'Ajouter exigence'}</button>
                </form>
                <section className="panel"><h2>Exigences</h2><div className="table">{requirements.map((item) => <article key={item.id} className="row-card tender-list-card"><strong>{item.requirement_code || `REQ-${item.id}`}</strong><span className="tender-meta">{item.description}</span></article>)}{requirements.length === 0 && <p>Aucune exigence.</p>}</div></section>
              </section>

              <section className="split-layout tender-split-layout">
                <form className="panel form compact-form" onSubmit={createCriterion} aria-busy={isCreatingCriterion}>
                  <h2>Critère Go / No-Go</h2>
                  <label>Nom<input required value={criterionForm.name} onChange={(event) => setCriterionForm({ ...criterionForm, name: event.target.value })} disabled={isCreatingCriterion} /></label>
                  <label>Description<textarea value={criterionForm.description} onChange={(event) => setCriterionForm({ ...criterionForm, description: event.target.value })} disabled={isCreatingCriterion} /></label>
                  <label>Score<input type="number" min="0" value={criterionForm.score} onChange={(event) => setCriterionForm({ ...criterionForm, score: event.target.value })} disabled={isCreatingCriterion} /></label>
                  <label>Poids<input type="number" min="1" value={criterionForm.weight} onChange={(event) => setCriterionForm({ ...criterionForm, weight: event.target.value })} disabled={isCreatingCriterion} /></label>
                  <label>Score max<input type="number" min="1" value={criterionForm.max_score} onChange={(event) => setCriterionForm({ ...criterionForm, max_score: event.target.value })} disabled={isCreatingCriterion} /></label>
                  <label>Rationale<textarea value={criterionForm.rationale} onChange={(event) => setCriterionForm({ ...criterionForm, rationale: event.target.value })} disabled={isCreatingCriterion} /></label>
                  <button type="submit" disabled={isCreatingCriterion}>{isCreatingCriterion ? 'Ajout…' : 'Ajouter critère'}</button>
                </form>
                <section className="panel"><h2>Go / No-Go</h2><div className="table">{criteria.map((item) => <article key={item.id} className="row-card tender-list-card"><strong>{item.name}</strong><span className="tender-meta">Score {item.score}/{item.max_score} · poids {item.weight}</span></article>)}{criteria.length === 0 && <p>Aucun critère.</p>}</div></section>
              </section>

              <section className="split-layout tender-split-layout">
                <form className="panel form compact-form" onSubmit={createComplianceItem} aria-busy={isCreatingCompliance}>
                  <h2>Ligne de conformité</h2>
                  <label>Exigence<select value={complianceForm.requirement_id} onChange={(event) => setComplianceForm({ ...complianceForm, requirement_id: event.target.value })} disabled={isCreatingCompliance}><option value="">Libre</option>{requirements.map((req) => <option key={req.id} value={req.id}>{req.requirement_code || `REQ-${req.id}`}</option>)}</select></label>
                  <label>Code<input value={complianceForm.requirement_code} onChange={(event) => setComplianceForm({ ...complianceForm, requirement_code: event.target.value })} disabled={isCreatingCompliance} /></label>
                  <label>Résumé exigence<textarea required value={complianceForm.requirement_summary} onChange={(event) => setComplianceForm({ ...complianceForm, requirement_summary: event.target.value })} disabled={isCreatingCompliance} /></label>
                  <label>Statut<select value={complianceForm.compliance_status} onChange={(event) => setComplianceForm({ ...complianceForm, compliance_status: event.target.value })} disabled={isCreatingCompliance}><option value="to_review">À revoir</option><option value="compliant">Conforme</option><option value="partial">Partiel</option><option value="gap">Écart</option><option value="not_applicable">Non applicable</option></select></label>
                  <label>Emplacement réponse<input value={complianceForm.response_location} onChange={(event) => setComplianceForm({ ...complianceForm, response_location: event.target.value })} disabled={isCreatingCompliance} /></label>
                  <label>Plan action<textarea value={complianceForm.action_plan} onChange={(event) => setComplianceForm({ ...complianceForm, action_plan: event.target.value })} disabled={isCreatingCompliance} /></label>
                  <button type="submit" disabled={isCreatingCompliance}>{isCreatingCompliance ? 'Ajout…' : 'Ajouter conformité'}</button>
                </form>
                <section className="panel"><h2>Matrice de conformité</h2><div className="table">{complianceItems.map((item) => <article key={item.id} className="row-card tender-list-card"><strong>{item.requirement_code || `ITEM-${item.id}`} · {item.compliance_status}</strong><span className="tender-meta">{item.requirement_summary}</span></article>)}{complianceItems.length === 0 && <p>Aucune ligne de conformité.</p>}</div></section>
              </section>
            </>
          )}

          {!canWriteTenders && (
            <section className="panel"><h2>Détails en lecture seule</h2><p className="subtitle">Exigences, Go / No-Go et conformité restent consultables via les listes chargées, mais les formulaires d'ajout sont masqués pour ton rôle.</p></section>
          )}
        </>
      )}
    </section>
  );
}
