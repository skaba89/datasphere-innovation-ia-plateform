import type { FormEvent } from 'react';
import type { Opportunity, Organization } from '../api/domainTypes';

type OpportunityFormState = {
  organization_id: string;
  title: string;
  opportunity_type: string;
  country: string;
  sector: string;
  status: string;
  priority: string;
  probability: string;
  owner_name: string;
  notes: string;
};

type Props = {
  form: OpportunityFormState;
  setForm: (value: OpportunityFormState) => void;
  organizations: Organization[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
};

export function OpportunityForm({ form, setForm, organizations, onSubmit, isSubmitting = false }: Props) {
  const isDisabled = isSubmitting || organizations.length === 0;

  return (
    <form className="panel form compact-form" onSubmit={onSubmit} aria-busy={isSubmitting}>
      <h2>Nouvelle opportunité</h2>
      <label>
        Organisation
        <select required value={form.organization_id} onChange={(event) => setForm({ ...form, organization_id: event.target.value })} disabled={isSubmitting}>
          <option value="">Sélectionner</option>
          {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
      </label>
      <label>Titre<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} disabled={isSubmitting} /></label>
      <label>Type<input value={form.opportunity_type} onChange={(event) => setForm({ ...form, opportunity_type: event.target.value })} disabled={isSubmitting} /></label>
      <label>Pays<input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} disabled={isSubmitting} /></label>
      <label>Secteur<input value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} disabled={isSubmitting} /></label>
      <label>Statut<input value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} disabled={isSubmitting} /></label>
      <label>Priorité<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} disabled={isSubmitting}><option>Moyenne</option><option>Haute</option><option>Basse</option></select></label>
      <label>Probabilité<input type="number" min="0" max="100" value={form.probability} onChange={(event) => setForm({ ...form, probability: event.target.value })} disabled={isSubmitting} /></label>
      <label>Responsable<input value={form.owner_name} onChange={(event) => setForm({ ...form, owner_name: event.target.value })} disabled={isSubmitting} /></label>
      <label>Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} disabled={isSubmitting} /></label>
      <button type="submit" disabled={isDisabled}>{isSubmitting ? 'Création…' : 'Créer opportunité'}</button>
    </form>
  );
}

export function OpportunitiesList({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <section className="panel">
      <h2>Opportunités</h2>
      <div className="table">
        {opportunities.map((opp) => (
          <article key={opp.id} className="row-card crm-list-card">
            <strong>{opp.title}</strong>
            <span className="crm-card-meta">{opp.status} · Priorité {opp.priority} · Probabilité {opp.probability}%</span>
          </article>
        ))}
        {opportunities.length === 0 && <p>Aucune opportunité pour le moment.</p>}
      </div>
    </section>
  );
}
