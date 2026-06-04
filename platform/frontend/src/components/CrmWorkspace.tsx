import { useCallback, useEffect, useState } from 'react';
import { Brain, BriefcaseBusiness, FileCheck2, ShieldCheck } from 'lucide-react';

import { apiRequest } from '../api/client';
import type { Opportunity, Organization } from '../api/domainTypes';
import { can } from '../auth/rbac';
import { OpportunityForm, OpportunitiesList } from './OpportunityForm';
import { OrganizationForm, OrganizationsList } from './OrganizationForm';

type View = 'dashboard' | 'organizations' | 'opportunities';

type Props = {
  token: string;
  view: View;
  role?: string | null;
};

const cards = [
  { title: 'CRM Opportunités', description: 'Suivre prospects, partenaires, appels d offres et pipeline commercial.', icon: BriefcaseBusiness },
  { title: 'Appels d offres', description: 'Analyser les cahiers des charges, produire matrices et livrables.', icon: FileCheck2 },
  { title: 'Agents IA', description: 'Utiliser des agents spécialisés supervisés par des experts humains.', icon: Brain },
  { title: 'Gouvernance', description: 'Tracer les décisions, valider les livrables et sécuriser les données.', icon: ShieldCheck },
];

const initialOrganizationForm = {
  name: '',
  country: 'Guinee',
  sector: 'Public',
  organization_type: 'Institution publique',
  website: '',
  description: '',
};

const initialOpportunityForm = {
  organization_id: '',
  title: '',
  opportunity_type: 'Mission conseil Data / IT / IA',
  country: 'Guinee',
  sector: 'Public',
  status: 'Prospect identifie',
  priority: 'Moyenne',
  probability: '20',
  owner_name: 'Sekouna',
  notes: '',
};

export function CrmWorkspace({ token, view, role }: Props) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [organizationForm, setOrganizationForm] = useState(initialOrganizationForm);
  const [opportunityForm, setOpportunityForm] = useState(initialOpportunityForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);
  const [isCreatingOpportunity, setIsCreatingOpportunity] = useState(false);
  const canWriteCrm = can(role, 'crm:write');

  const refreshData = useCallback(async () => {
    const [orgs, opps] = await Promise.all([
      apiRequest<Organization[]>('/organizations', {}, token),
      apiRequest<Opportunity[]>('/opportunities', {}, token),
    ]);
    setOrganizations(orgs);
    setOpportunities(opps);
  }, [token]);

  useEffect(() => {
    refreshData().catch((err: Error) => setError(err.message));
  }, [refreshData]);

  async function createOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteCrm) {
      setError("Tu n'as pas les droits nécessaires pour créer une organisation.");
      return;
    }
    if (isCreatingOrganization) return;
    setError(null);
    setSuccess(null);
    setIsCreatingOrganization(true);

    try {
      await apiRequest<Organization>('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: organizationForm.name.trim(),
          country: organizationForm.country || null,
          sector: organizationForm.sector || null,
          organization_type: organizationForm.organization_type || null,
          website: organizationForm.website || null,
          description: organizationForm.description || null,
        }),
      }, token);
      setOrganizationForm(initialOrganizationForm);
      await refreshData();
      setSuccess('Organisation créée avec succès.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur création organisation');
    } finally {
      setIsCreatingOrganization(false);
    }
  }

  async function createOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteCrm) {
      setError("Tu n'as pas les droits nécessaires pour créer une opportunité.");
      return;
    }
    if (isCreatingOpportunity) return;
    setError(null);
    setSuccess(null);
    setIsCreatingOpportunity(true);

    try {
      await apiRequest<Opportunity>('/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: Number(opportunityForm.organization_id),
          title: opportunityForm.title.trim(),
          opportunity_type: opportunityForm.opportunity_type || null,
          country: opportunityForm.country || null,
          sector: opportunityForm.sector || null,
          status: opportunityForm.status,
          priority: opportunityForm.priority,
          probability: Number(opportunityForm.probability),
          owner_name: opportunityForm.owner_name || null,
          notes: opportunityForm.notes || null,
        }),
      }, token);
      setOpportunityForm(initialOpportunityForm);
      await refreshData();
      setSuccess('Opportunité créée avec succès.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur création opportunité');
    } finally {
      setIsCreatingOpportunity(false);
    }
  }

  return (
    <section className="crm-workspace" aria-label="CRM DataSphere">
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      {view === 'dashboard' && (
        <>
          <section className="stats crm-stats" aria-label="Indicateurs CRM">
            <article><strong>{organizations.length}</strong><span>Organisations</span></article>
            <article><strong>{opportunities.length}</strong><span>Opportunités</span></article>
            <article><strong>{opportunities.filter((item) => item.priority === 'Haute').length}</strong><span>Priorité haute</span></article>
          </section>
          <section className="grid crm-feature-grid">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="card crm-feature-card">
                  <Icon size={28} />
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                </article>
              );
            })}
          </section>
        </>
      )}

      {view === 'organizations' && (
        <section className="split-layout crm-split-layout">
          {canWriteCrm ? (
            <OrganizationForm form={organizationForm} setForm={setOrganizationForm} onSubmit={createOrganization} isSubmitting={isCreatingOrganization} />
          ) : (
            <section className="panel"><h2>Lecture seule</h2><p className="subtitle">Ton rôle permet de consulter les organisations, mais pas d'en créer.</p></section>
          )}
          <OrganizationsList organizations={organizations} />
        </section>
      )}

      {view === 'opportunities' && (
        <section className="split-layout crm-split-layout">
          {canWriteCrm ? (
            <OpportunityForm form={opportunityForm} setForm={setOpportunityForm} organizations={organizations} onSubmit={createOpportunity} isSubmitting={isCreatingOpportunity} />
          ) : (
            <section className="panel"><h2>Lecture seule</h2><p className="subtitle">Ton rôle permet de consulter les opportunités, mais pas d'en créer.</p></section>
          )}
          <OpportunitiesList opportunities={opportunities} />
        </section>
      )}
    </section>
  );
}
