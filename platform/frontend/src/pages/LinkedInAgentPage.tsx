import { useEffect, useState } from 'react';
import { Copy, ExternalLink, RefreshCw, Send, Sparkles, Zap } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface GeneratedPost {
  content: string; topic: string; topic_type: string;
  provider: string; word_count: number; char_count: number;
  hashtags: string[]; generated_at: string;
}

const TOPIC_TYPES = [
  { key: 'data_engineering', label: '⚡ Data Engineering', desc: 'Snowflake, dbt, Airflow, architecture' },
  { key: 'ao_insight',       label: '📋 Insight AO',        desc: 'Retour d\'expérience anonymisé' },
  { key: 'market_trend',     label: '📈 Tendance marché',   desc: 'Data France & Afrique 2025' },
];

const QUICK_TOPICS = [
  'dbt Core vs SQL Mesh : le match',
  'Snowflake Data Cloud en marché public',
  'Medallion Architecture retour terrain',
  'Data Engineering freelance France 2025',
  'Apache Airflow vs Prefect : mon choix',
  'IA générative en data : cas réels',
  'Data Engineering en Afrique francophone',
  'PySpark Kubernetes en production',
];

const S = {
  primary: { display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.84rem' } as React.CSSProperties,
  outline: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(148,163,184,.2)', background: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem' } as React.CSSProperties,
  linkedin: { display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, border: 'none', background: '#0077b5', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '.84rem' } as React.CSSProperties,
};

export default function LinkedInAgentPage() {
  const token = tokenStorage.get();
  const [topicType,    setTopicType]    = useState('data_engineering');
  const [customTopic,  setCustomTopic]  = useState('');
  const [tenders,      setTenders]      = useState<{id:number;title:string}[]>([]);
  const [selectedAO,   setSelectedAO]   = useState<number|null>(null);
  const [generating,   setGenerating]   = useState(false);
  const [post,         setPost]         = useState<GeneratedPost|null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [copied,       setCopied]       = useState(false);
  const [publishing,   setPublishing]   = useState(false);
  const [pubResult,    setPubResult]    = useState<{success:boolean;message:string}|null>(null);
  const [liToken,      setLiToken]      = useState('');
  const [showLiConfig, setShowLiConfig] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest<{id:number;title:string}[]>('/tenders?limit=30', {}, token)
      .then(list => setTenders(list?.filter(t => t.title) ?? []))
      .catch(() => {});
  }, [token]);

  async function generate() {
    setGenerating(true); setPost(null); setPubResult(null);
    try {
      let result: GeneratedPost;
      if (topicType === 'ao_insight' && selectedAO) {
        result = await apiRequest<GeneratedPost>('/linkedin/generate-from-ao', {
          method: 'POST', body: JSON.stringify({ tender_id: selectedAO }),
        }, token);
      } else {
        result = await apiRequest<GeneratedPost>('/linkedin/generate', {
          method: 'POST',
          body: JSON.stringify({ topic_type: topicType, topic: customTopic || undefined }),
        }, token);
      }
      setPost(result);
      setEditedContent(result.content);
    } catch (e) { alert('Erreur génération : ' + String(e)); }
    finally { setGenerating(false); }
  }

  async function publish() {
    if (!liToken.trim()) { setShowLiConfig(true); return; }
    setPublishing(true); setPubResult(null);
    try {
      const r = await apiRequest<{success:boolean;url?:string}>('/linkedin/publish', {
        method: 'POST',
        body: JSON.stringify({ content: editedContent, access_token: liToken }),
      }, token);
      setPubResult({ success: true, message: `Publié ! ${r.url || ''}` });
    } catch (e) {
      setPubResult({ success: false, message: String(e).slice(0, 120) });
    } finally { setPublishing(false); }
  }

  function copy() {
    navigator.clipboard.writeText(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const charLimit = 3000;
  const charCount = editedContent.length;
  const charColor = charCount > charLimit ? '#fca5a5' : charCount > charLimit * 0.9 ? '#fde68a' : '#86efac';

  if (!token) return (
    <main className="app-shell"><section className="panel"><h1>Agent LinkedIn</h1><p>Connecte-toi d'abord.</p></section></main>
  );

  return (
    <main className="app-shell">
      {/* Header */}
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">IA Contenu</p>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ExternalLink size={24} color="#0077b5" />
              Agent LinkedIn
            </h1>
            <p className="subtitle">
              Génère des posts Data Engineering percutants depuis tes AOs ou des sujets tendance.
              Publie directement sur LinkedIn ou copie pour poster manuellement.
            </p>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'start' }}>

        {/* Left — Configuration */}
        <div style={{ display: 'grid', gap: 12 }}>

          {/* Type de post */}
          <section className="panel">
            <h3 style={{ margin: '0 0 14px', fontSize: '.9rem', fontWeight: 800 }}>Type de contenu</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {TOPIC_TYPES.map(t => (
                <button key={t.key} onClick={() => setTopicType(t.key)}
                  style={{ padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${topicType===t.key?'rgba(250,204,21,.4)':'rgba(148,163,184,.12)'}`, background: topicType===t.key?'rgba(250,204,21,.06)':'none', color: topicType===t.key?'#facc15':'#64748b', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: '.84rem' }}>{t.label}</span>
                  <span style={{ fontSize: '.72rem', color: '#475569' }}>{t.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* AO selector (if ao_insight) */}
          {topicType === 'ao_insight' && (
            <section className="panel">
              <h3 style={{ margin: '0 0 10px', fontSize: '.86rem', fontWeight: 700 }}>AO source</h3>
              <select value={selectedAO ?? ''} onChange={e => setSelectedAO(Number(e.target.value) || null)}
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, color: '#e2e8f0', fontSize: '.82rem' }}>
                <option value="">— Choisir un AO —</option>
                {tenders.map(t => <option key={t.id} value={t.id}>#{t.id} {t.title.slice(0, 50)}</option>)}
              </select>
            </section>
          )}

          {/* Sujet custom */}
          {topicType !== 'ao_insight' && (
            <section className="panel">
              <h3 style={{ margin: '0 0 10px', fontSize: '.86rem', fontWeight: 700 }}>Sujet (optionnel)</h3>
              <input value={customTopic} onChange={e => setCustomTopic(e.target.value)}
                placeholder="Laissez vide pour sélection automatique"
                style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, color: '#e2e8f0', fontSize: '.82rem', boxSizing: 'border-box' as const }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {QUICK_TOPICS.map(topic => (
                  <button key={topic} onClick={() => setCustomTopic(topic)}
                    style={{ padding: '3px 9px', borderRadius: 99, border: '1px solid rgba(148,163,184,.12)', background: customTopic===topic?'rgba(250,204,21,.08)':'none', color: customTopic===topic?'#facc15':'#475569', cursor: 'pointer', fontSize: '.7rem', fontWeight: 600 }}>
                    {topic.slice(0, 35)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Generate button */}
          <button onClick={generate} disabled={generating || (topicType==='ao_insight'&&!selectedAO)} style={{ ...S.primary, justifyContent: 'center', width: '100%', padding: '12px', fontSize: '.9rem', opacity: (topicType==='ao_insight'&&!selectedAO)?0.5:1 }}>
            {generating
              ? <><RefreshCw size={15} style={{ animation: 'ds-spin .7s linear infinite' }} /> Génération en cours…</>
              : <><Sparkles size={15} /> Générer le post</>}
          </button>
        </div>

        {/* Right — Preview + Edit */}
        <div style={{ display: 'grid', gap: 12 }}>
          {post ? (
            <>
              <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(148,163,184,.08)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.74rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(0,119,181,.1)', color: '#93c5fd', border: '1px solid rgba(0,119,181,.2)' }}>
                    {post.topic_type}
                  </span>
                  <span style={{ fontSize: '.72rem', color: '#475569' }}>via {post.provider}</span>
                  <span style={{ fontSize: '.72rem', color: charColor, marginLeft: 'auto' }}>
                    {charCount}/{charLimit} caractères
                  </span>
                </div>

                {/* Editor */}
                <div style={{ padding: '16px 18px' }}>
                  <textarea value={editedContent} onChange={e => setEditedContent(e.target.value)}
                    rows={14}
                    style={{ width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,.2)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 9, color: '#f1f5f9', fontSize: '.84rem', fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box' as const }} />
                </div>

                {/* Hashtags */}
                {post.hashtags.length > 0 && (
                  <div style={{ padding: '0 18px 14px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {post.hashtags.map(h => (
                      <span key={h} style={{ fontSize: '.7rem', padding: '2px 7px', borderRadius: 99, background: 'rgba(0,119,181,.06)', color: '#93c5fd', border: '1px solid rgba(0,119,181,.15)' }}>{h}</span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(148,163,184,.08)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={copy} style={S.outline}>
                    {copied ? <><Copy size={13} style={{ color: '#86efac' }} /> Copié !</> : <><Copy size={13} /> Copier</>}
                  </button>
                  <button onClick={generate} disabled={generating} style={S.outline}>
                    <RefreshCw size={13} style={{ animation: generating ? 'ds-spin .7s linear infinite' : 'none' }} /> Régénérer
                  </button>
                  <a href={`https://www.linkedin.com/post/new/?shareText=${encodeURIComponent(editedContent.slice(0, 700))}`}
                    target="_blank" rel="noopener noreferrer" style={{ ...S.outline, textDecoration: 'none', color: '#0077b5', borderColor: 'rgba(0,119,181,.25)' }}>
                    <ExternalLink size={13} /> Ouvrir LinkedIn
                  </a>
                  <button onClick={publish} disabled={publishing} style={{ ...S.linkedin, marginLeft: 'auto' }}>
                    {publishing
                      ? <><RefreshCw size={13} style={{ animation: 'ds-spin .7s linear infinite' }} /> Publication…</>
                      : <><Send size={13} /> Publier sur LinkedIn</>}
                  </button>
                </div>
              </section>

              {/* Publish result */}
              {pubResult && (
                <div style={{ padding: '12px 16px', borderRadius: 9, background: pubResult.success ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', border: `1px solid ${pubResult.success ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`, color: pubResult.success ? '#86efac' : '#fca5a5', fontSize: '.82rem' }}>
                  {pubResult.message}
                </div>
              )}

              {/* LinkedIn token config */}
              {showLiConfig && (
                <section className="panel">
                  <h3 style={{ margin: '0 0 10px', fontSize: '.86rem', fontWeight: 700 }}>🔑 Token LinkedIn</h3>
                  <p style={{ fontSize: '.76rem', color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>
                    Obtenez un token sur <a href="https://developers.linkedin.com" target="_blank" rel="noopener noreferrer" style={{ color: '#facc15' }}>developers.linkedin.com</a> ou ajoutez <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>LINKEDIN_ACCESS_TOKEN</code> dans Render → Environment.
                  </p>
                  <input type="password" value={liToken} onChange={e => setLiToken(e.target.value)}
                    placeholder="Token LinkedIn OAuth2..."
                    style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, color: '#e2e8f0', fontSize: '.82rem', boxSizing: 'border-box' as const }} />
                  <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 8 }}>
                    Alternative : cliquez "Ouvrir LinkedIn" pour poster manuellement avec le texte copié.
                  </div>
                </section>
              )}
            </>
          ) : (
            <section className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 12, textAlign: 'center' }}>
              <ExternalLink size={48} color="#0077b5" style={{ opacity: .3 }} />
              <p style={{ color: '#475569', fontSize: '.88rem', maxWidth: 280, lineHeight: 1.6 }}>
                Choisissez un type de contenu et cliquez <strong style={{ color: '#facc15' }}>Générer le post</strong>
              </p>
              <p style={{ color: '#334155', fontSize: '.76rem' }}>
                L'IA génère un post optimisé LinkedIn basé sur votre expertise Data Engineering
              </p>
            </section>
          )}
        </div>
      </div>

      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  );
}
