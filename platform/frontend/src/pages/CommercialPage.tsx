import { useState } from 'react';
import { Kanban, Target, Users } from 'lucide-react';
import ContactsPanel from '../components/ContactsPanel';
import KanbanPipeline from '../components/KanbanPipeline';

type Tab = 'pipeline' | 'contacts';

export default function CommercialPage() {
  const [tab, setTab] = useState<Tab>('pipeline');

  const tabBtn = (t: Tab): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontWeight: tab === t ? 700 : 500, fontSize: '0.88rem',
    background: tab === t ? 'rgba(250,204,21,0.12)' : 'none',
    color: tab === t ? '#facc15' : '#94a3b8',
    borderBottom: `2px solid ${tab === t ? '#facc15' : 'transparent'}`,
    transition: 'all 0.18s', whiteSpace: 'nowrap', flex: '0 0 auto',
  });

  return (
    <main className="app-shell commercial-page">
      <section className="panel">
        <p className="eyebrow">Commercial</p>
        <h1>Pipeline & CRM</h1>
        <p className="subtitle">
          Visualisez votre pipeline commercial sur le kanban, déplacez les opportunités d'une étape à l'autre et gérez vos contacts clients.
        </p>
      </section>

      <section className="commercial-stats-grid" aria-label="Indicateurs commerciaux">
        <article className="commercial-stat-card commercial-stat-card-yellow">
          <Target size={20} color="#facc15" />
          <div>
            <span>Kanban pipeline</span>
            <strong>Déplacer les opportunités par clic</strong>
          </div>
        </article>
        <article className="commercial-stat-card commercial-stat-card-blue">
          <Users size={20} color="#93c5fd" />
          <div>
            <span>CRM Contacts</span>
            <strong>Annuaire qualifié par organisation</strong>
          </div>
        </article>
      </section>

      <section className="panel commercial-workspace">
        <div className="commercial-tabs">
          <button style={tabBtn('pipeline')} onClick={() => setTab('pipeline')} type="button">
            <Kanban size={15} />
            Pipeline commercial
          </button>
          <button style={tabBtn('contacts')} onClick={() => setTab('contacts')} type="button">
            <Users size={15} />
            Contacts CRM
          </button>
        </div>

        <div className="commercial-panel-body">
          {tab === 'pipeline' && <KanbanPipeline />}
          {tab === 'contacts' && <ContactsPanel />}
        </div>
      </section>
    </main>
  );
}
