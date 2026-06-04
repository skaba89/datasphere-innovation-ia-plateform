import { useState } from 'react';
import { Building2, Kanban, Target, Users } from 'lucide-react';
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
    transition: 'all 0.18s',
  });

  return (
    <div style={{
      padding: 'clamp(16px,3vw,32px) clamp(16px,4vw,40px)',
      maxWidth: 1400,
      minHeight: '100vh',
      display: 'grid',
      gap: 28,
      alignContent: 'start',
    }}>
      {/* Page header */}
      <div>
        <div style={{
          fontFamily: 'var(--font-head, Syne, sans-serif)',
          fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: '#facc15', marginBottom: 8,
        }}>
          Commercial
        </div>
        <h1 style={{
          fontFamily: 'var(--font-head, Syne, sans-serif)',
          fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8,
        }}>
          Pipeline & CRM
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: 560, lineHeight: 1.7 }}>
          Visualisez votre pipeline commercial sur le kanban, déplacez les opportunités
          d'une étape à l'autre et gérez vos contacts clients.
        </p>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ background: 'rgba(15,30,54,0.85)', border: '1px solid rgba(250,204,21,0.15)', borderRadius: 14, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Target size={20} color="#facc15" />
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kanban pipeline</div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Déplacer les opportunités par clic</div>
          </div>
        </div>
        <div style={{ background: 'rgba(15,30,54,0.85)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 14, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users size={20} color="#93c5fd" />
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CRM Contacts</div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Annuaire qualifié par organisation</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div style={{
          display: 'flex', gap: 4,
          borderBottom: '1px solid rgba(148,163,184,0.1)',
          marginBottom: 28,
        }}>
          <button style={tabBtn('pipeline')} onClick={() => setTab('pipeline')}>
            <Kanban size={15} />
            Pipeline commercial
          </button>
          <button style={tabBtn('contacts')} onClick={() => setTab('contacts')}>
            <Users size={15} />
            Contacts CRM
          </button>
        </div>

        {tab === 'pipeline' && <KanbanPipeline />}
        {tab === 'contacts' && <ContactsPanel />}
      </div>
    </div>
  );
}
