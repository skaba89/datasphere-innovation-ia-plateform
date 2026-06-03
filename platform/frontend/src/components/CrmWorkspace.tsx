import { useCallback, useEffect, useState } from 'react';
import { Brain, BriefcaseBusiness, FileCheck2, ShieldCheck } from 'lucide-react';

import { apiRequest } from '../api/client';
import type { Opportunity, Organization } from '../api/domainTypes';
import { OpportunityForm, OpportunitiesList } from './OpportunityForm';
import { OrganizationForm, OrganizationsList } from './OrganizationForm';

type View = 'dashboard' | 'organizations' | 'opportunities';

type Props = {
  token: string;
  view: View;
};

const cards = [
  { title: 'CRM Opportunites', description: 'Suivre prospects, partenaires, appels d offres et pipeline commercial.', icon: BriefcaseBusiness },
  { title: 'Appels d offres', description: 'Analyser les cahiers des charges, produire matrices et livrables.', icon: FileCheck2 },
  { title: 'Agents IA', description: 'Utiliser des agents specialises supervises par des experts humains.', icon: Brain },
  { title: 'Gouvernance', description: 'Tracer les decisions, valider les livrables et securiser les donnees.', icon: ShieldCheck },
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
  owner_name: '',
  notes: '',
};

export function CrmWorkspace({ token, view }: Props) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [organizationForm, setOrganizationForm] = useState(initialOrganizationForm);
  const [opportunityForm, setOpportunityForm] = useState(initialOpportunityForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    setError(null);
    setSuccess(null);

    try {
      await apiRequest<Organization>('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: organizationForm.name,
          country: organizationForm.country || null,
          sector: organizationForm.sector || null,
          organization_type: organizationForm.organization_type || null,
          website: organizationForm.website || null,
          description: organizationForm.description || null,
        }),
      }, token);
      setOrganizationForm(initialOrganizationForm);
      await refreshData();
      setSuccess('Organisation creee avec succes.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur creation organisation');
    }
  }

  async function createOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await apiRequest<Opportunity>('/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: Number(opportunityForm.organization_id),
          title: opportunityForm.title,
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
      setSuccess('Opportunite creee avec succes.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur creation opportunite');
    }
  }

  return (
    <>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      {view === 'dashboard' && (
        <>
          <section className="stats">
            <article><strong>{organizations.length}</strong><span>Organisations</span></article>
            <article><strong>{opportunities.length}</strong><span>Opportunites</span></article>
            <article><strong>{opportunities.filter((item) => item.priority === 'Haute').length}</strong><span>Priorite haute</span></article>
          </section>
          <section className="grid">
            {cards.map((card) => {
              const Icon = card.icon;
              return <article key={card.title} className="card"><Icon size={28} /><h2>{card.title}</h2><p>{card.description}</p></article>;
            })}
          </section>
        </>
      )}

      {view === 'organizations' && (
        <section className="split-layout">
          <OrganizationForm form={organizationForm} setForm={setOrganizationForm} onSubmit={createOrganization} />
          <OrganizationsList organizations={organizations} />
        </section>
      )}

      {view === 'opportunities' && (
        <section className="split-layout">
          <OpportunityForm form={opportunityForm} setForm={setOpportunityForm} organizations={organizations} onSubmit={createOpportunity} />
          <OpportunitiesList opportunities={opportunities} />
        </section>
      )}
    </>
  );
}
