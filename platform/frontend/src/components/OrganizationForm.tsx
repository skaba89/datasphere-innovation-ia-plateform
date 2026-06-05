import type { FormEvent } from 'react';
import type { Organization } from '../api/domainTypes';

type Props = {
  form: {
    name: string;
    country: string;
    sector: string;
    organization_type: string;
    website: string;
    description: string;
  };
  setForm: (value: Props['form']) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
};

export function OrganizationForm({ form, setForm, onSubmit, isSubmitting = false }: Props) {
  return (
    <form className="panel form compact-form" onSubmit={onSubmit} aria-busy={isSubmitting}>
      <h2>Nouvelle organisation</h2>
      <label>Nom<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={isSubmitting} /></label>
      <label>Pays<input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} disabled={isSubmitting} /></label>
      <label>Secteur<input value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} disabled={isSubmitting} /></label>
      <label>Type<input value={form.organization_type} onChange={(event) => setForm({ ...form, organization_type: event.target.value })} disabled={isSubmitting} /></label>
      <label>Site web<input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} disabled={isSubmitting} /></label>
      <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={isSubmitting} /></label>
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Création…' : 'Créer organisation'}</button>
    </form>
  );
}

export function OrganizationsList({ organizations }: { organizations: Organization[] }) {
  return (
    <section className="panel">
      <h2>Organisations</h2>
      <div className="table">
        {organizations.map((org) => (
          <article key={org.id} className="row-card crm-list-card">
            <strong>{org.name}</strong>
            <span className="crm-card-meta">{org.country || 'Pays non renseigné'} · {org.sector || 'Secteur non renseigné'}</span>
          </article>
        ))}
        {organizations.length === 0 && <p>Aucune organisation pour le moment.</p>}
      </div>
    </section>
  );
}
