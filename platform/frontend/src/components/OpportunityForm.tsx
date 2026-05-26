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
};

export function OpportunityForm({ form, setForm, organizations, onSubmit }: Props) {
  return (
    <form className="panel form compact-form" onSubmit={onSubmit}>
      <h2>Nouvelle opportunite</h2>
      <label>
        Organisation
        <select required value={form.organization_id} onChange={(event) => setForm({ ...form, organization_id: event.target.value })}>
          <option value="">Selectionner</option>
          {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
      </label>
      <label>Titre<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>Type<input value={form.opportunity_type} onChange={(event) => setForm({ ...form, opportunity_type: event.target.value })} /></label>
      <label>Pays<input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label>
      <label>Secteur<input value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} /></label>
      <label>Statut<input value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} /></label>
      <label>Priorite<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Moyenne</option><option>Haute</option><option>Basse</option></select></label>
      <label>Probabilite<input type="number" min="0" max="100" value={form.probability} onChange={(event) => setForm({ ...form, probability: event.target.value })} /></label>
      <label>Responsable<input value={form.owner_name} onChange={(event) => setForm({ ...form, owner_name: event.target.value })} /></label>
      <label>Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      <button type="submit" disabled={organizations.length === 0}>Creer opportunite</button>
    </form>
  );
}

export function OpportunitiesList({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <section className="panel">
      <h2>Opportunites</h2>
      <div className="table">
        {opportunities.map((opp) => (
          <article key={opp.id} className="row-card">
            <strong>{opp.title}</strong>
            <span>{opp.status} · Priorite {opp.priority} · Probabilite {opp.probability}%</span>
          </article>
        ))}
        {opportunities.length === 0 && <p>Aucune opportunite pour le moment.</p>}
      </div>
    </section>
  );
}
