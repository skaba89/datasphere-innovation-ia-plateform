/**
 * AIAssistant — Assistant IA contextuel DataSphere
 *
 * Chat en langage naturel pour interroger la plateforme :
 * - "Quels sont mes AOs avec deadline cette semaine ?"
 * - "Génère un résumé du pipeline pour ma réunion"
 * - "Compare mon win rate data vs conseil"
 * - "Quel livrable a le meilleur score ?"
 *
 * Branché sur le RAG + les données en base via l'endpoint /rag/chat
 */
import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { tokenStorage } from '../api/client';
import { useI18n } from '../i18n';

const API = () => import.meta.env.VITE_API_BASE_URL || '/api/v1';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
};

const QUICK_QUESTIONS = [
  'Quels AOs ont une deadline cette semaine ?',
  'Mon win rate actuel ?',
  'Quel est mon pipeline estimé ?',
  'Livrables en attente d\'approbation ?',
  'Résumé de l\'activité récente',
];

export default function AIAssistant() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: lang === 'en'
        ? '👋 Hi! I\'m your DataSphere AI assistant. Ask me anything about your tenders, deliverables, pipeline or CRM.'
        : '👋 Bonjour ! Je suis votre assistant IA DataSphere. Posez-moi des questions sur vos AOs, livrables, pipeline ou CRM.',
      ts: Date.now(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text?: string) {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: q, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const resp = await fetch(`${API()}/rag/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: q, history: messages.slice(-6) }),
      });
      const data = await resp.json();
      const answer = data.response || data.answer || data.content || 'Je n\'ai pas pu répondre à cette question.';
      setMessages(prev => [...prev, { role: 'assistant', content: answer, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Connexion au backend impossible. Vérifiez que le serveur est démarré.',
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Assistant IA DataSphere"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: 'linear-gradient(135deg,#facc15,#f59e0b)',
          color: '#0f172a', cursor: 'pointer', boxShadow: '0 4px 20px rgba(250,204,21,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform .2s, box-shadow .2s',
        }}
        onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)'; }}
        onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      >
        <Sparkles size={22} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
      width: 'min(400px, calc(100vw - 32px))',
      height: 'min(560px, calc(100vh - 80px))',
      background: 'linear-gradient(180deg,#0d1b2e 0%,#060d1a 100%)',
      border: '1px solid rgba(250,204,21,.2)',
      borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.6)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid rgba(148,163,184,.08)',
        background: 'rgba(250,204,21,.04)',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#facc15,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={16} color="#0f172a" />
        </div>
        <div>
          <div style={{ fontSize: '.85rem', fontWeight: 800, color: '#f1f5f9' }}>Assistant IA</div>
          <div style={{ fontSize: '.68rem', color: '#64748b' }}>DataSphere Intelligence</div>
        </div>
        <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? 'linear-gradient(135deg,#facc15,#f59e0b)' : 'rgba(30,41,59,.9)',
              border: msg.role === 'assistant' ? '1px solid rgba(148,163,184,.1)' : 'none',
              color: msg.role === 'user' ? '#0f172a' : '#e2e8f0',
              fontSize: '.82rem', lineHeight: 1.55, whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#475569', fontSize: '.78rem' }}>
            <Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} />
            Analyse en cours…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUICK_QUESTIONS.map((q, i) => (
            <button key={i} onClick={() => send(q)} style={{
              padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(148,163,184,.12)',
              background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.7rem',
              transition: 'all .15s',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(250,204,21,.3)'; (e.currentTarget as HTMLElement).style.color = '#facc15'; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,.12)'; (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
            >{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(148,163,184,.08)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Posez une question…"
          disabled={loading}
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 10,
            border: '1px solid rgba(148,163,184,.15)',
            background: 'rgba(12,22,45,.9)', color: '#f1f5f9',
            fontSize: '.82rem', outline: 'none',
          }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{
          padding: '9px 13px', borderRadius: 10, border: 'none',
          background: input.trim() ? 'linear-gradient(135deg,#facc15,#f59e0b)' : 'rgba(30,41,59,.5)',
          color: input.trim() ? '#0f172a' : '#334155',
          cursor: input.trim() ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center',
        }}>
          <Send size={15} />
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
