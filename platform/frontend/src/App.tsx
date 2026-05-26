import { Brain, BriefcaseBusiness, FileCheck2, ShieldCheck } from 'lucide-react';

const cards = [
  {
    title: 'CRM Opportunites',
    description: 'Suivre prospects, partenaires, appels d offres et pipeline commercial.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Appels d offres',
    description: 'Analyser les cahiers des charges, produire matrices et livrables.',
    icon: FileCheck2,
  },
  {
    title: 'Agents IA',
    description: 'Utiliser des agents specialises supervises par des experts humains.',
    icon: Brain,
  },
  {
    title: 'Gouvernance',
    description: 'Tracer les decisions, valider les livrables et securiser les donnees.',
    icon: ShieldCheck,
  },
];

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">DataSphere Innovation IA Platform</p>
        <h1>Cabinet de conseil Data, IT et IA augmente par agents specialises</h1>
        <p className="subtitle">
          MVP interne pour piloter les opportunites, appels d offres, agents IA,
          documents et validations humaines.
        </p>
        <div className="actions">
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
            Ouvrir API Docs
          </a>
          <a href="http://localhost:8000/api/v1/health" target="_blank" rel="noreferrer" className="secondary">
            Tester API Health
          </a>
        </div>
      </section>

      <section className="grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="card">
              <Icon size={28} />
              <h2>{card.title}</h2>
              <p>{card.description}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}

export default App;
