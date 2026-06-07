import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../api/config';

import { apiRequest } from '../api/client';
import FileAttachments from './FileAttachments';
import TenderAutoImportPanel from './TenderAutoImportPanel';
import type {
  ComplianceMatrixItem,
  ComplianceSummary,
  GoNoGoCriterion,
  GoNoGoSummary,
  Opportunity,
  Tender,
  TenderRequirement,
} from '../api/domainTypes';

type Props = { token: string };

type ConsultantProfile = {
  id: number;
  full_name: string;
  role: string;
  seniority: string;
  daily_rate: number;
  availability_percent: number;
  location: string;
  skills: string[];
  certifications: string[];
  languages: string[];
  references: string[];
};

type ConsultantMatch = {
  consultant: ConsultantProfile;
  match_score: number;
  matched_terms: string[];
  recommendation: string;
  rationale: string[];
};

type StaffingRecommendation = {
  tender_id: number;
  tender_title: string;
  recommended_team: ConsultantMatch[];
  global_team_score: number;
  summary: string;
};

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

export function TenderWorkspace({ token }: Props) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<number | null>(null);
  const [requirements, setRequirements] = useState<TenderRequirement[]>([]);
  const [criteria, setCriteria] = useState<GoNoGoCriterion[]>([]);
  const [complianceItems, setComplianceItems] = useState<ComplianceMatrixItem[]>([]);
  const [goNoGoSummary, setGoNoGoSummary] = useState<GoNoGoSummary | null>(null);
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary | null>(null);
  const [staffingRecommendation, setStaffingRecommendation] = useState<StaffingRecommendation | null>(null);
  const [loadingStaffing, setLoadingStaffing] = useState(false);
  const [tenderForm, setTenderForm] = useState(initialTenderForm);
  const [requirementForm, setRequirementForm] = useState(initialRequirementForm);
  const [criterionForm, setCriterionForm] = useState(initialCriterionForm);
  const [complianceForm, setComplianceForm] = useState(initialComplianceForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingTenders, setLoadingTenders] = useState(false);
  const [loadingGovernance, setLoadingGovernance] = useState(false);

  const selectedTender = useMemo(
    () => tenders.find((item) => item.id === selectedTenderId) || null,
    [selectedTenderId, tenders],
  );

  const refreshTenders = useCallback(async (preferredTenderId?: number) => {
    setLoadingTenders(true);
    try {
      const [opps, tenderList] = await Promise.all([
        apiRequest<Opportunity[]>('/opportunities', {}, token),
        apiRequest<Tender[]>('/tenders', {}, token),
      ]);
      setOpportunities(opps);
      setTenders(tenderList);
      if (preferredTenderId) {
        setSelectedTenderId(preferredTenderId);
      } else if (!selectedTenderId && tenderList.length > 0) {
        setSelectedTenderId(tenderList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement AO');
    } finally {
      setLoadingTenders(false);
    }
  }, [selectedTenderId, token]);

  const refreshGovernance = useCallback(async () => {
    if (!selectedTenderId) return;
    setLoadingGovernance(true);
    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement gouvernance');
    } finally {
      setLoadingGovernance(false);
    }
  }, [selectedTenderId, token]);

  const refreshStaffing = useCallback(async () => {
    if (!selectedTenderId) {
      setStaffingRecommendation(null);
      return;
    }
    setLoadingStaffing(true);
    try {
      const recommendation = await apiRequest<StaffingRecommendation>(`/staffing/tenders/${selectedTenderId}/match`, {}, token);
      setStaffingRecommendation(recommendation);
    } catch (err) {
      setStaffingRecommendation(null);
      setError(err instanceof Error ? err.message : 'Erreur chargement equipe IA');
    } finally {
      setLoadingStaffing(false);
    }
  }, [selectedTenderId, token]);

  useEffect(() => {
    refreshTenders();
  }, [refreshTenders]);

  useEffect(() => {
    refreshGovernance();
  }, [refreshGovernance]);

  useEffect(() => {
    refreshStaffing();
  }, [refreshStaffing]);

  async function handleAutoImportDone(tenderId?: number) {
    await refreshTenders(tenderId);
    if (tenderId) {
      setSelectedTenderId(tenderId);
      setSuccess('Veille AO importée et dernier appel d’offres sélectionné.');
    }
  }

  async function createTender(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const tender = await apiRequest<Tender>('/tenders', {
        method: 'POST',
        body: JSON.stringify({
          opportunity_id: Number(tenderForm.opportunity_id),
          reference: tenderForm.reference || null,
          title: tenderForm.title,
          buyer_name: tenderForm.buyer_name || null,
          source_url: tenderForm.source_url || null,
          summary: tenderForm.summary || null,
          go_no_go_score: Number(tenderForm.go_no_go_score),
          go_no_go_decision: tenderForm.go_no_go_decision,
          status: tenderForm.status,
        }),
      }, token);
      setTenderForm(initialTenderForm);
      await refreshTenders(tender.id);
      setSelectedTenderId(tender.id);
      setSuccess('Appel d offres cree avec succes.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur creation appel d offres');
    }
  }

  async function createRequirement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenderId) return;
    setError(null);
    setSuccess(null);
    try {
      await apiRequest<TenderRequirement>(`/tenders/${selectedTenderId}/requirements`, {
        method: 'POST',
        body: JSON.stringify({ tender_id: selectedTenderId, ...requirementForm }),
      }, token);
      setRequirementForm(initialRequirementForm);
      await refreshGovernance();
      await refreshStaffing();
      setSuccess('Exigence ajoutee.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur creation exigence');
    }
  }

  async function createCriterion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenderId) return;
    setError(null);
    setSuccess(null);
    try {
      await apiRequest<GoNoGoCriterion>(`/tender-governance/tenders/${selectedTenderId}/go-no-go`, {
        method: 'POST',
        body: JSON.stringify({
          tender_id: selectedTenderId,
          name: criterionForm.name,
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
      setSuccess('Critere Go / No-Go ajoute.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur creation critere');
    }
  }

  async function createComplianceItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenderId) return;
    setError(null);
    setSuccess(null);
    try {
      await apiRequest<ComplianceMatrixItem>(`/tender-governance/tenders/${selectedTenderId}/compliance`, {
        method: 'POST',
        body: JSON.stringify({
          tender_id: selectedTenderId,
          requirement_id: complianceForm.requirement_id ? Number(complianceForm.requirement_id) : null,
          requirement_code: complianceForm.requirement_code || null,
          requirement_summary: complianceForm.requirement_summary,
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
      setSuccess('Ligne de conformite ajoutee.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur creation conformite');
    }
  }

  return (
    <section className="workspace-stack">
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      <TenderAutoImportPanel token={token} onImported={handleAutoImportDone} />

      <section className="split-layout">
        <form className="panel form compact-form" onSubmit={createTender}>
          <h2>Nouvel appel d offres</h2>
          <label>Opportunite<select required value={tenderForm.opportunity_id} onChange={(event) => setTenderForm({ ...tenderForm, opportunity_id: event.target.value })}><option value="">Selectionner</option>{opportunities.map((opp) => <option key={opp.id} value={opp.id}>{opp.title}</option>)}</select></label>
          <label>Reference<input value={tenderForm.reference} onChange={(event) => setTenderForm({ ...tenderForm, reference: event.target.value })} /></label>
          <label>Titre<input required value={tenderForm.title} onChange={(event) => setTenderForm({ ...tenderForm, title: event.target.value })} /></label>
          <label>Acheteur<input value={tenderForm.buyer_name} onChange={(event) => setTenderForm({ ...tenderForm, buyer_name: event.target.value })} /></label>
          <label>URL source<input value={tenderForm.source_url} onChange={(event) => setTenderForm({ ...tenderForm, source_url: event.target.value })} /></label>
          <label>Resume<textarea value={tenderForm.summary} onChange={(event) => setTenderForm({ ...tenderForm, summary: event.target.value })} /></label>
          <button type="submit" disabled={opportunities.length === 0}>Creer appel d offres</button>
        </form>

        <section className="panel">
          <h2>Appels d offres</h2>
          <div className="table">
            {tenders.map((tender) => (
              <button key={tender.id} className={`row-card row-button ${selectedTenderId === tender.id ? 'selected' : ''}`} onClick={() => setSelectedTenderId(tender.id)} type="button">
                <strong>{tender.title}</strong>
                <span>{tender.reference || 'Sans reference'} · {tender.status} · {tender.buyer_name || 'Acheteur non renseigne'}</span>
              </button>
            ))}
            {loadingTenders && <p style={{ color: '#64748b', fontSize: '.82rem', padding: '8px 0' }}>Chargement…</p>}
            {!loadingTenders && tenders.length === 0 && <p style={{ color: '#64748b', fontSize: '.82rem' }}>Aucun appel d offres pour le moment.</p>}
          </div>
        </section>
      </section>

      {selectedTender && (
        <>
          <section className="stats">
            <article><strong>{goNoGoSummary?.percentage ?? 0}%</strong><span>Score Go / No-Go</span></article>
            <article><strong>{goNoGoSummary?.recommendation ?? 'N/A'}</strong><span>Decision recommandee</span></article>
            <article><strong>{complianceSummary?.compliance_rate ?? 0}%</strong><span>Taux de conformite</span></article>
            <article><strong>{staffingRecommendation?.global_team_score ?? 0}%</strong><span>Score equipe IA</span></article>
          </section>

          <section className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <strong style={{ fontFamily: 'var(--font-head, Syne, sans-serif)', fontSize: '.95rem' }}>{selectedTender.title}</strong>
              <div style={{ fontSize: '.78rem', color: '#64748b', marginTop: 3 }}>
                {selectedTender.reference || 'N/A'} · {selectedTender.buyer_name || 'Acheteur inconnu'}
              </div>
            </div>
            <button
              type="button"
              onClick={refreshStaffing}
              disabled={loadingStaffing}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
                background: 'rgba(59,130,246,.12)',
                border: '1px solid rgba(59,130,246,.25)',
                color: '#93c5fd', fontWeight: 700, fontSize: '.82rem',
              }}
            >
              🤖 {loadingStaffing ? 'Matching…' : 'Actualiser staffing IA'}
            </button>
            <a
              href={`${API_BASE}/deliverables/tenders/${selectedTender.id}/mission-report`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
                background: 'rgba(250,204,21,.12)',
                border: '1px solid rgba(250,204,21,.25)',
                color: '#facc15', fontWeight: 700, fontSize: '.82rem', textDecoration: 'none',
                transition: 'all .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(250,204,21,.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(250,204,21,.12)')}
            >
              📄 Rapport de mission complet
            </a>
          </section>
          <section style={{ padding: '0 0 16px' }}>
            <FileAttachments resourceType="tender" resourceId={selectedTender.id} />
          </section>

          <section className="panel">
            <div className="dashboard-header">
              <div>
                <p className="eyebrow">Staffing IA</p>
                <h2>Equipe recommandee</h2>
                <p className="compact-subtitle">
                  {loadingStaffing ? 'Calcul de compatibilite en cours…' : staffingRecommendation?.summary || 'Aucune recommandation disponible pour cet AO.'}
                </p>
              </div>
            </div>
            <div className="table">
              {staffingRecommendation?.recommended_team.map((match) => (
                <article key={match.consultant.id} className="row-card">
                  <strong>{match.consultant.full_name} · {match.consultant.role}</strong>
                  <span>
                    Score {match.match_score}/100 · {match.recommendation} · Disponibilite {match.consultant.availability_percent}% · TJM {match.consultant.daily_rate.toLocaleString('fr-FR')} EUR
                  </span>
                  <span className="crm-card-meta">
                    {match.consultant.seniority} · {match.consultant.location} · {match.consultant.languages.join(', ')}
                  </span>
                  <span className="crm-card-meta">
                    Competences : {match.consultant.skills.slice(0, 8).join(', ')}
                  </span>
                  {match.matched_terms.length > 0 && (
                    <span className="crm-card-meta">Mots-cles matches : {match.matched_terms.slice(0, 10).join(', ')}</span>
                  )}
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#64748b', fontSize: '.8rem' }}>
                    {match.rationale.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </article>
              ))}
              {!loadingStaffing && (!staffingRecommendation || staffingRecommendation.recommended_team.length === 0) && <p>Aucune equipe recommandee.</p>}
            </div>
          </section>

          <section className="split-layout">
            <form className="panel form compact-form" onSubmit={createRequirement}>
              <h2>Ajouter une exigence</h2>
              <label>Code<input value={requirementForm.requirement_code} onChange={(event) => setRequirementForm({ ...requirementForm, requirement_code: event.target.value })} /></label>
              <label>Section<input value={requirementForm.section} onChange={(event) => setRequirementForm({ ...requirementForm, section: event.target.value })} /></label>
              <label>Description<textarea required value={requirementForm.description} onChange={(event) => setRequirementForm({ ...requirementForm, description: event.target.value })} /></label>
              <label>Type<input value={requirementForm.requirement_type} onChange={(event) => setRequirementForm({ ...requirementForm, requirement_type: event.target.value })} /></label>
              <label>Strategie<textarea value={requirementForm.response_strategy} onChange={(event) => setRequirementForm({ ...requirementForm, response_strategy: event.target.value })} /></label>
              <button type="submit">Ajouter exigence</button>
            </form>
            <section className="panel"><h2>Exigences</h2><div className="table">{requirements.map((item) => <article key={item.id} className="row-card"><strong>{item.requirement_code || `REQ-${item.id}`}</strong><span>{item.description}</span></article>)}{requirements.length === 0 && <p>Aucune exigence.</p>}</div></section>
          </section>

          <section className="split-layout">
            <form className="panel form compact-form" onSubmit={createCriterion}>
              <h2>Critere Go / No-Go</h2>
              <label>Nom<input required value={criterionForm.name} onChange={(event) => setCriterionForm({ ...criterionForm, name: event.target.value })} /></label>
              <label>Description<textarea value={criterionForm.description} onChange={(event) => setCriterionForm({ ...criterionForm, description: event.target.value })} /></label>
              <label>Score<input type="number" min="0" value={criterionForm.score} onChange={(event) => setCriterionForm({ ...criterionForm, score: event.target.value })} /></label>
              <label>Poids<input type="number" min="1" value={criterionForm.weight} onChange={(event) => setCriterionForm({ ...criterionForm, weight: event.target.value })} /></label>
              <label>Score max<input type="number" min="1" value={criterionForm.max_score} onChange={(event) => setCriterionForm({ ...criterionForm, max_score: event.target.value })} /></label>
              <label>Rationale<textarea value={criterionForm.rationale} onChange={(event) => setCriterionForm({ ...criterionForm, rationale: event.target.value })} /></label>
              <button type="submit">Ajouter critere</button>
            </form>
            <section className="panel"><h2>Go / No-Go</h2><div className="table">{criteria.map((item) => <article key={item.id} className="row-card"><strong>{item.name}</strong><span>Score {item.score}/{item.max_score} · poids {item.weight}</span></article>)}{criteria.length === 0 && <p>Aucun critere.</p>}</div></section>
          </section>

          <section className="split-layout">
            <form className="panel form compact-form" onSubmit={createComplianceItem}>
              <h2>Ligne de conformite</h2>
              <label>Exigence<select value={complianceForm.requirement_id} onChange={(event) => setComplianceForm({ ...complianceForm, requirement_id: event.target.value })}><option value="">Libre</option>{requirements.map((req) => <option key={req.id} value={req.id}>{req.requirement_code || `REQ-${req.id}`}</option>)}</select></label>
              <label>Code<input value={complianceForm.requirement_code} onChange={(event) => setComplianceForm({ ...complianceForm, requirement_code: event.target.value })} /></label>
              <label>Resume exigence<textarea required value={complianceForm.requirement_summary} onChange={(event) => setComplianceForm({ ...complianceForm, requirement_summary: event.target.value })} /></label>
              <label>Statut<select value={complianceForm.compliance_status} onChange={(event) => setComplianceForm({ ...complianceForm, compliance_status: event.target.value })}><option value="to_review">A revoir</option><option value="compliant">Conforme</option><option value="partial">Partiel</option><option value="gap">Ecart</option><option value="not_applicable">Non applicable</option></select></label>
              <label>Emplacement reponse<input value={complianceForm.response_location} onChange={(event) => setComplianceForm({ ...complianceForm, response_location: event.target.value })} /></label>
              <label>Plan action<textarea value={complianceForm.action_plan} onChange={(event) => setComplianceForm({ ...complianceForm, action_plan: event.target.value })} /></label>
              <button type="submit">Ajouter conformite</button>
            </form>
            <section className="panel"><h2>Matrice de conformite</h2><div className="table">{complianceItems.map((item) => <article key={item.id} className="row-card"><strong>{item.requirement_code || `ITEM-${item.id}`} · {item.compliance_status}</strong><span>{item.requirement_summary}</span></article>)}{complianceItems.length === 0 && <p>Aucune ligne de conformite.</p>}</div></section>
          </section>
        </>
      )}
    </section>
  );
}
