import { useMemo, useState } from 'react';
import { RefreshCw, Search, Sparkles } from 'lucide-react';

import { apiRequest } from '../api/client';
import type { Opportunity, Organization, Tender } from '../api/domainTypes';

type Props = {
  token: string;
  onImported: (tenderId?: number) => Promise<void> | void;
};

type AutoTenderCandidate = {
  title: string;
  reference: string;
  buyer_name: string;
  country: string;
  sector: string;
  source_url: string;
  summary: string;
  estimated_value: number;
  deadline?: string;
  requirements: string[];
};

const DEFAULT_CANDIDATES: AutoTenderCandidate[] = [
  {
    title: 'Modernisation de la plateforme data et analytique nationale',
    reference: `AUTO-DATA-${new Date().getFullYear()}-001`,
    buyer_name: 'Banque Centrale de Guinée',
    country: 'Guinée',
    sector: 'Banque / Institution publique',
    source_url: 'https://example.local/ao/bcrg-data-platform',
    estimated_value: 850000,
    summary:
      'Projet de modernisation data : ingestion multi-sources, entrepôt de données, tableaux de bord, gouvernance et assistance IA.',
    requirements: [
      'Mettre en place une architecture data sécurisée et scalable.',
      'Intégrer les sources internes et externes dans un pipeline fiable.',
      'Produire des tableaux de bord exécutifs et opérationnels.',
      'Prévoir la gouvernance, l’audit et la traçabilité des données.',
    ],
  },
  {
    title: 'Mise en œuvre d’un portail numérique de services publics',
    reference: `AUTO-GOV-${new Date().getFullYear()}-002`,
    buyer_name: 'Ministère de la Transformation Digitale',
    country: 'Guinée',
    sector: 'Administration publique',
    source_url: 'https://example.local/ao/portail-services-publics',
    estimated_value: 620000,
    summary:
      'Plateforme web et mobile pour digitaliser les démarches administratives, avec back-office, authentification et reporting.',
    requirements: [
      'Concevoir un portail web responsive et un back-office sécurisé.',
      'Mettre en place l’authentification et la gestion des rôles.',
      'Suivre les demandes citoyennes via des workflows configurables.',
      'Fournir des indicateurs de performance et de qualité de service.',
    ],
  },
  {
    title: 'Déploiement d’une solution IA pour l’analyse documentaire',
    reference: `AUTO-AI-${new Date().getFullYear()}-003`,
    buyer_name: 'Agence Nationale de Digitalisation',
    country: 'Guinée',
    sector: 'IA / Transformation digitale',
    source_url: 'https://example.local/ao/analyse-documentaire-ia',
    estimated_value: 430000,
    summary:
      'Solution d’analyse automatique de documents, extraction d’informations, recherche sémantique et génération de synthèses.',
    requirements: [
      'Indexer les documents PDF, DOCX et tableurs.',
      'Mettre en place une recherche sémantique avec contrôle des accès.',
      'Générer des résumés, risques et recommandations.',
      'Assurer la confidentialité et la journalisation des usages IA.',
    ],
  },
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export default function TenderAutoImportPanel({ token, onImported }: Props) {
  const [query, setQuery] = useState('data IA digitalisation Guinée');
  const [candidates, setCandidates] = useState<AutoTenderCandidate[]>(DEFAULT_CANDIDATES);
  const [selectedRefs, setSelectedRefs] = useState<string[]>(DEFAULT_CANDIDATES.map(item => item.reference));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidates = useMemo(
    () => candidates.filter(candidate => selectedRefs.includes(candidate.reference)),
    [candidates, selectedRefs],
  );

  function simulateSearch() {
    const suffix = Date.now().toString(36).toUpperCase();
    setCandidates(
      DEFAULT_CANDIDATES.map((candidate, index) => ({
        ...candidate,
        reference: `${candidate.reference}-${suffix}-${index + 1}`,
        summary: `${candidate.summary} Recherche simulée : ${query}.`,
      })),
    );
    setSelectedRefs(DEFAULT_CANDIDATES.map((candidate, index) => `${candidate.reference}-${suffix}-${index + 1}`));
    setMessage('Recherche automatique simulée terminée. Les AO sont prêts à être importés.');
    setError(null);
  }

  async function createOrFindOrganization(candidate: AutoTenderCandidate): Promise<Organization> {
    const organizations = await apiRequest<Organization[]>('/organizations', {}, token);
    const existing = organizations.find(org => normalize(org.name) === normalize(candidate.buyer_name));
    if (existing) return existing;

    return apiRequest<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify({
        name: candidate.buyer_name,
        country: candidate.country,
        sector: candidate.sector,
        organization_type: 'Acheteur public / institution',
        website: '',
        description: `Organisation créée automatiquement depuis la veille AO : ${candidate.title}`,
      }),
    }, token);
  }

  async function createOpportunity(candidate: AutoTenderCandidate, organizationId: number): Promise<Opportunity> {
    return apiRequest<Opportunity>('/opportunities', {
      method: 'POST',
      body: JSON.stringify({
        organization_id: organizationId,
        title: `Opportunité - ${candidate.title}`,
        opportunity_type: 'Appel d’offres',
        country: candidate.country,
        sector: candidate.sector,
        status: 'Qualification',
        priority: 'Haute',
        probability: 45,
        owner_name: 'Agent AO',
        notes: `Créée automatiquement depuis la veille AO. Valeur estimée : ${candidate.estimated_value} EUR.`,
      }),
    }, token);
  }

  async function createTender(candidate: AutoTenderCandidate, opportunityId: number): Promise<Tender> {
    return apiRequest<Tender>('/tenders', {
      method: 'POST',
      body: JSON.stringify({
        opportunity_id: opportunityId,
        reference: candidate.reference,
        title: candidate.title,
        buyer_name: candidate.buyer_name,
        source_url: candidate.source_url,
        summary: candidate.summary,
        submission_deadline: candidate.deadline ?? null,
        go_no_go_score: 0,
        go_no_go_decision: 'TO_QUALIFY',
        status: 'analysis',
      }),
    }, token);
  }

  async function createDefaultRequirements(candidate: AutoTenderCandidate, tenderId: number) {
    await Promise.all(
      candidate.requirements.map((description, index) =>
        apiRequest(`/tenders/${tenderId}/requirements`, {
          method: 'POST',
          body: JSON.stringify({
            tender_id: tenderId,
            requirement_code: `AUTO-${index + 1}`,
            section: 'Exigences importées automatiquement',
            description,
            requirement_type: 'Technique / Fonctionnelle',
            response_strategy: 'À analyser par l’équipe avant-vente.',
            proof_or_deliverable: 'Mémoire technique / matrice de conformité',
            owner_name: 'Agent AO',
            status: 'to_analyze',
            comments: 'Créée automatiquement depuis la veille AO.',
          }),
        }, token),
      ),
    );
  }

  async function importSelected() {
    if (selectedCandidates.length === 0) {
      setError('Sélectionne au moins un appel d’offres à importer.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      let lastTenderId: number | undefined;
      for (const candidate of selectedCandidates) {
        const organization = await createOrFindOrganization(candidate);
        const opportunity = await createOpportunity(candidate, organization.id);
        const tender = await createTender(candidate, opportunity.id);
        await createDefaultRequirements(candidate, tender.id);
        lastTenderId = tender.id;
      }
      setMessage(`${selectedCandidates.length} AO importé(s) avec organisation, opportunité et exigences.`);
      await onImported(lastTenderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur pendant l’import automatique des AO.');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(reference: string) {
    setSelectedRefs(current =>
      current.includes(reference)
        ? current.filter(item => item !== reference)
        : [...current, reference],
    );
  }

  return (
    <section className="panel workspace-stack">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Veille AO automatisée</p>
          <h2>Recherche et création automatique</h2>
          <p className="compact-subtitle">
            Simule une veille AO, puis crée automatiquement l’organisation, l’opportunité, l’AO et les premières exigences.
          </p>
        </div>
        <button className="team-primary-button" type="button" onClick={importSelected} disabled={loading}>
          <Sparkles size={14} /> {loading ? 'Import…' : 'Importer la sélection'}
        </button>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="compact-form">
        <label>
          Mots-clés de veille
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="data, IA, digitalisation, Guinée…" />
        </label>
        <button type="button" onClick={simulateSearch} disabled={loading}>
          <Search size={14} /> Chercher les AO
        </button>
        <button type="button" onClick={() => setCandidates(DEFAULT_CANDIDATES)} disabled={loading}>
          <RefreshCw size={14} /> Réinitialiser
        </button>
      </div>

      <div className="table">
        {candidates.map(candidate => (
          <article key={candidate.reference} className="row-card">
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedRefs.includes(candidate.reference)}
                onChange={() => toggleSelection(candidate.reference)}
                style={{ marginTop: 4 }}
              />
              <span>
                <strong>{candidate.title}</strong>
                <span className="crm-card-meta">
                  {candidate.reference} · {candidate.buyer_name} · {candidate.sector} · {candidate.country}
                </span>
                <span style={{ display: 'block', marginTop: 6, color: '#64748b', fontSize: '.82rem' }}>{candidate.summary}</span>
              </span>
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}
