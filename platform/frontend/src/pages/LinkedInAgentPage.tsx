import { useEffect, useState, useCallback } from 'react';
import { Copy, ExternalLink, RefreshCw, Send, Sparkles, CheckCircle, Link2, LogOut, AlertTriangle } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

interface GeneratedPost {
  content: string; topic: string; topic_type: string;
  provider: string; word_count: number; char_count: number;
  hashtags: string[]; generated_at: string;
}

interface OAuthStatus {
  oauth_configured: boolean;
  has_token: boolean;
  is_expired: boolean;
  connect_url: string | null;
  manual_token_doc: string;
}

interface AuthUrlResponse {
  configured: boolean;
  auth_url?: string;
  message?: string;
}

const TOPIC_TYPES = [
  { key: 'data_engineering', label: '⚡ Data Engineering', desc: 'Snowflake, dbt, Airflow, architecture' },
  { key: 'ao_insight',       label: '📋 Insight AO',       desc: 'Retour d\'expérience anonymisé' },
  { key: 'market_trend',     label: '📈 Tendance marché',  desc: 'Data France & Afrique 2025' },
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
  primary:  { display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.84rem' } as React.CSSProperties,
  outline:  { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(148,163,184,.2)', background: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem' } as React.CSSProperties,
  linkedin: { display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, border: 'none', background: '#0077b5', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '.84rem' } as React.CSSProperties,
  danger:   { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: '1px solid rgba(239,68,68,.2)', background: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem' } as React.CSSProperties,
};

function OAuthPanel({ token, onStatusChange }: { token: string; onStatusChange: (s: OAuthStatus) => void }) {
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const s = await apiRequest<OAuthStatus>('/linkedin/oauth/status', {}, token);
      setStatus(s);
      onStatusChange(s);
    } catch { }
  }, [token, onStatusChange]);

  useEffect(() => {
    loadStatus();
    // Detect linkedin_connected=1 in URL (OAuth callback redirect)
    const params = new URLSearchParams(window.location.search);
    if (params.get('linkedin_connected') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      loadStatus();
    }
  }, [loadStatus]);

  async function connect() {
    setConnecting(true);
    try {
      const res = await apiRequest<AuthUrlResponse>('/linkedin/oauth/auth-url', {}, token);
      if (res.configured && res.auth_url) {
        window.location.href = res.auth_url;
      } else {
        alert(res.message ?? 'LinkedIn OAuth non configuré dans Render (LINKEDIN_CLIENT_ID manquant).');
      }
    } catch (e) { alert(String(e)); }
    finally { setConnecting(false); }
  }

  async function revoke() {
    setRevoking(true);
    try {
      await apiRequest('/linkedin/oauth/revoke', { method: 'POST' }, token);
      await loadStatus();
    } catch { }
    finally { setRevoking(false); }
  }

  if (!status) return <div style={{ height: 60, background: 'rgba(255,255,255,.02)', borderRadius: 10, animation: 'ds-pulse 1.5s ease-in-out infinite' }} />;

  if (status.has_token && !status.is_expired) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)' }}>
        <CheckCircle size={16} color="#22c55e" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#86efac' }}>Compte LinkedIn connecté</div>
          <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: 1 }}>Token OAuth2 actif — publication directe activée</div>
        </div>
        <button onClick={revoke} disabled={revoking} style={S.danger}>
          <LogOut size={13} /> Déconnecter
        </button>
      </div>
    );
  }

  if (status.has_token && status.is_expired) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)' }}>
        <AlertTriangle size={16} color="#f59e0b" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#fde68a' }}>Token LinkedIn expiré</div>
          <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: 1 }}>Reconnectez-vous pour republier directement</div>
        </div>
        <button onClick={connect} disabled={connecting} style={S.linkedin}>
          <Link2 size={13} /> Reconnecter
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(0,119,181,.05)', border: '1px solid rgba(0,119,181,.15)' }}>
      <div style={{ fontSize: '.82rem', fontWeight: 700, color: '#93c5fd', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link2 size={14} /> Connexion LinkedIn requise pour la publication directe
      </div>
      <div style={{ fontSize: '.74rem', color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
        {status.oauth_configured
          ? 'Autorisez DataSphere à publier en votre nom via OAuth2 LinkedIn.'
          : 'OAuth non configuré dans Render. Ajoutez LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET, ou utilisez "Copier + poster manuellement".'
        }
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {status.oauth_configured && (
          <button onClick={connect} disabled={connecting} style={S.linkedin}>
            {connecting ? <RefreshCw size={13} style={{ animation: 'ds-spin .7s linear infinite' }} /> : <Link2 size={13} />}
            Connecter LinkedIn
          </button>
        )}
        <a href="https://developers.linkedin.com" target="_blank" rel="noopener noreferrer" style={{ ...S.outline, textDecoration: 'none', color: '#64748b' }}>
          <ExternalLink size={13} /> Documentation
        </a>
      </div>
    </div>
  );
}

export default function LinkedInAgentPage() {
  const token = tokenStorage.get() ?? '';
  const [pageView, setPageView] = useState<PageView>('generate');
  const [topicType,      setTopicType]      = useState('data_engineering');
  const [customTopic,    setCustomTopic]    = useState('');
  const [tenders,        setTenders]        = useState<{id:number;title:string}[]>([]);
  const [selectedAO,     setSelectedAO]     = useState<number|null>(null);
  const [generating,     setGenerating]     = useState(false);
  const [post,           setPost]           = useState<GeneratedPost|null>(null);
  const [editedContent,  setEditedContent]  = useState('');
  const [copied,         setCopied]         = useState(false);
  const [publishing,     setPublishing]     = useState(false);
  const [pubResult,      setPubResult]      = useState<{success:boolean;message:string}|null>(null);
  const [oauthStatus,    setOauthStatus]    = useState<OAuthStatus|null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<{id:number;title:string}[]>('/tenders?limit=30', {}, token)
      .then(list => setTenders(Array.isArray(list) ? list.filter(t => t.title) : []))
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
    if (!oauthStatus?.has_token || oauthStatus.is_expired) {
      alert('Connectez d\'abord votre compte LinkedIn via OAuth.');
      return;
    }
    setPublishing(true); setPubResult(null);
    try {
      const r = await apiRequest<{success:boolean;url?:string;post_id?:string}>('/linkedin/publish', {
        method: 'POST',
        body: JSON.stringify({ content: editedContent }),
      }, token);
      setPubResult({ success: true, message: `✅ Publié ! ${r.url ? `Voir : ${r.url}` : ''}` });
    } catch (e) {
      setPubResult({ success: false, message: `❌ ${String(e).slice(0, 150)}` });
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
  const canPublish = oauthStatus?.has_token && !oauthStatus.is_expired;

  if (!token) return <main className="app-shell"><section className="panel"><h1>Agent LinkedIn</h1><p>Connectez-vous d'abord.</p></section></main>;

  return (
    <main className="app-shell">
      <section className="panel" style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['generate','calendar'] as PageView[]).map(v => (
            <button key={v} onClick={() => setPageView(v)} style={{
              padding: '7px 16px', borderRadius: 8, border: `1px solid ${pageView===v?'rgba(250,204,21,.3)':'rgba(148,163,184,.1)'}`,
              background: pageView===v?'rgba(250,204,21,.07)':'none', color: pageView===v?'#facc15':'#64748b',
              cursor: 'pointer', fontSize: '.8rem', fontWeight: pageView===v?700:500,
            }}>
              {v === 'generate' ? '✍️ Générer & Publier' : '📅 Calendrier éditorial'}
            </button>
          ))}
        </div>
      </section>
      {pageView === 'calendar' && <LinkedInCalendar token={token} />}
      {pageView === 'generate' && <>
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">IA Contenu</p>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ExternalLink size={24} color="#0077b5" /> Agent LinkedIn
            </h1>
            <p className="subtitle">
              Génère des posts Data Engineering percutants depuis tes AOs ou des sujets tendance. Publie directement via OAuth2.
            </p>
          </div>
        </div>
      </section>

      {/* OAuth Status Banner */}
      <section className="panel" style={{ paddingTop: 12, paddingBottom: 12 }}>
        <OAuthPanel token={token} onStatusChange={setOauthStatus} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        {/* Left — Config */}
        <div style={{ display: 'grid', gap: 12 }}>
          <section className="panel">
            <h3 style={{ margin: '0 0 14px', fontSize: '.9rem', fontWeight: 800 }}>Type de contenu</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {TOPIC_TYPES.map(t => (
                <button key={t.key} onClick={() => setTopicType(t.key)} style={{
                  padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${topicType===t.key?'rgba(250,204,21,.4)':'rgba(148,163,184,.12)'}`,
                  background: topicType===t.key?'rgba(250,204,21,.06)':'none', color: topicType===t.key?'#facc15':'#64748b',
                  cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column' as const, gap: 3,
                }}>
                  <span style={{ fontWeight: 700, fontSize: '.84rem' }}>{t.label}</span>
                  <span style={{ fontSize: '.72rem', color: '#475569' }}>{t.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {topicType === 'ao_insight' && (
            <section className="panel">
              <h3 style={{ margin: '0 0 10px', fontSize: '.86rem', fontWeight: 700 }}>AO source</h3>
              <select value={selectedAO ?? ''} onChange={e => setSelectedAO(Number(e.target.value) || null)}
                style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, color: '#e2e8f0', fontSize: '.82rem' }}>
                <option value="">— Choisir un AO —</option>
                {tenders.map(t => <option key={t.id} value={t.id}>#{t.id} {t.title.slice(0,50)}</option>)}
              </select>
            </section>
          )}

          {topicType !== 'ao_insight' && (
            <section className="panel">
              <h3 style={{ margin: '0 0 10px', fontSize: '.86rem', fontWeight: 700 }}>Sujet (optionnel)</h3>
              <input value={customTopic} onChange={e => setCustomTopic(e.target.value)}
                placeholder="Laissez vide pour sélection automatique"
                style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.15)', borderRadius: 8, color: '#e2e8f0', fontSize: '.82rem', boxSizing: 'border-box' as const }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {QUICK_TOPICS.map(topic => (
                  <button key={topic} onClick={() => setCustomTopic(topic)} style={{
                    padding: '3px 9px', borderRadius: 99, border: '1px solid rgba(148,163,184,.12)',
                    background: customTopic===topic?'rgba(250,204,21,.08)':'none', color: customTopic===topic?'#facc15':'#475569',
                    cursor: 'pointer', fontSize: '.7rem', fontWeight: 600,
                  }}>{topic.slice(0,35)}</button>
                ))}
              </div>
            </section>
          )}

          <button onClick={generate} disabled={generating || (topicType==='ao_insight'&&!selectedAO)} style={{
            ...S.primary, justifyContent: 'center', width: '100%', padding: '12px', fontSize: '.9rem',
            opacity: (topicType==='ao_insight'&&!selectedAO) ? 0.5 : 1,
          }}>
            {generating
              ? <><RefreshCw size={15} style={{ animation: 'ds-spin .7s linear infinite' }}/> Génération…</>
              : <><Sparkles size={15}/> Générer le post</>}
          </button>
        </div>

        {/* Right — Preview */}
        <div style={{ display: 'grid', gap: 12 }}>
          {post ? (
            <>
              <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(148,163,184,.08)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '.74rem', padding: '2px 8px', borderRadius: 99, background: 'rgba(0,119,181,.1)', color: '#93c5fd', border: '1px solid rgba(0,119,181,.2)' }}>
                    {post.topic_type}
                  </span>
                  <span style={{ fontSize: '.72rem', color: '#475569' }}>via {post.provider}</span>
                  <span style={{ fontSize: '.72rem', color: charColor, marginLeft: 'auto' }}>{charCount}/{charLimit} car.</span>
                </div>
                <div style={{ padding: '16px 18px' }}>
                  <textarea value={editedContent} onChange={e => setEditedContent(e.target.value)} rows={14}
                    style={{ width: '100%', padding: '12px 14px', background: 'rgba(0,0,0,.2)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 9, color: '#f1f5f9', fontSize: '.84rem', outline: 'none', resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box' as const }} />
                </div>
                {post.hashtags.length > 0 && (
                  <div style={{ padding: '0 18px 14px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {post.hashtags.map(h => (
                      <span key={h} style={{ fontSize: '.7rem', padding: '2px 7px', borderRadius: 99, background: 'rgba(0,119,181,.06)', color: '#93c5fd', border: '1px solid rgba(0,119,181,.15)' }}>{h}</span>
                    ))}
                  </div>
                )}
                <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(148,163,184,.08)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={copy} style={S.outline}>
                    {copied ? <><Copy size={13} style={{ color: '#86efac' }}/> Copié !</> : <><Copy size={13}/> Copier</>}
                  </button>
                  <button onClick={generate} disabled={generating} style={S.outline}>
                    <RefreshCw size={13} style={{ animation: generating ? 'ds-spin .7s linear infinite' : 'none' }}/> Régénérer
                  </button>
                  <a href={`https://www.linkedin.com/post/new/?shareText=${encodeURIComponent(editedContent.slice(0,700))}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ ...S.outline, textDecoration: 'none', color: '#0077b5', borderColor: 'rgba(0,119,181,.25)' }}>
                    <ExternalLink size={13}/> Ouvrir LinkedIn
                  </a>
                  <button onClick={publish} disabled={publishing || !canPublish}
                    title={!canPublish ? 'Connectez d\'abord votre compte LinkedIn' : ''}
                    style={{ ...S.linkedin, marginLeft: 'auto', opacity: !canPublish ? .5 : 1 }}>
                    {publishing
                      ? <><RefreshCw size={13} style={{ animation: 'ds-spin .7s linear infinite' }}/> Publication…</>
                      : <><Send size={13}/> Publier sur LinkedIn</>}
                  </button>
                </div>
              </section>
              {pubResult && (
                <div style={{
                  padding: '12px 16px', borderRadius: 9, fontSize: '.82rem',
                  background: pubResult.success ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)',
                  border: `1px solid ${pubResult.success ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
                  color: pubResult.success ? '#86efac' : '#fca5a5',
                }}>{pubResult.message}</div>
              )}
            </>
          ) : (
            <section className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 12, textAlign: 'center' }}>
              <ExternalLink size={48} color="#0077b5" style={{ opacity: .3 }}/>
              <p style={{ color: '#475569', fontSize: '.88rem', maxWidth: 280, lineHeight: 1.6 }}>
                Choisissez un type de contenu et cliquez <strong style={{ color: '#facc15' }}>Générer le post</strong>
              </p>
            </section>
          )}
        </div>
      </div>

      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}} @keyframes ds-pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
      </>}
    </main>
  );
}

// ── Calendrier éditorial ──────────────────────────────────────────────────────
function LinkedInCalendar({ token }: { token: string }) {
  const [posts, setPosts]   = useState<any[]>([]);
  const [stats, setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ok:boolean;text:string}|null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        apiRequest<any[]>('/linkedin/schedule', {}, token),
        apiRequest<any>('/linkedin/schedule/stats', {}, token),
      ]);
      setPosts(Array.isArray(p) ? p : []);
      setStats(s);
    } catch { }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function generateCalendar() {
    setGenerating(true); setMsg(null);
    try {
      const r = await apiRequest<{created:number}>('/linkedin/schedule/calendar', { method: 'POST', body: JSON.stringify({ auto_generate: false }) }, token);
      setMsg({ ok: true, text: `✅ ${r.created} posts planifiés sur 30 jours` });
      load();
    } catch (e) { setMsg({ ok: false, text: String(e) }); }
    finally { setGenerating(false); }
  }

  async function publishNow(id: number) {
    setPublishing(id); setMsg(null);
    try {
      const r = await apiRequest<any>(`/linkedin/schedule/${id}/publish-now`, { method: 'POST' }, token);
      setMsg({ ok: true, text: `✅ Publié : ${r.content}` });
      load();
    } catch (e) { setMsg({ ok: false, text: String(e).slice(0, 100) }); }
    finally { setPublishing(null); }
  }

  async function cancel(id: number) {
    try {
      await apiRequest(`/linkedin/schedule/${id}`, { method: 'DELETE' }, token);
      setPosts(p => p.filter(x => x.id !== id));
    } catch { }
  }

  const STATUS_CFG: Record<string, {color:string;label:string}> = {
    pending:   { color: '#f59e0b', label: 'Planifié' },
    generated: { color: '#3b82f6', label: 'Généré' },
    published: { color: '#22c55e', label: 'Publié' },
    failed:    { color: '#ef4444', label: 'Échoué' },
    cancelled: { color: '#64748b', label: 'Annulé' },
  };

  function fmtDt(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total planifiés', val: stats.total,          color: '#64748b' },
            { label: 'Publiés',         val: stats.published,      color: '#22c55e' },
            { label: 'En attente',      val: stats.pending,        color: '#f59e0b' },
            { label: 'Échecs',          val: stats.failed,         color: '#ef4444' },
            { label: 'Taux publication', val: `${stats.publication_rate}%`, color: '#facc15' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 12, padding: '12px 18px' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={generateCalendar} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: 'none', background: '#facc15', color: '#060d1a', cursor: 'pointer', fontWeight: 800, fontSize: '.86rem' }}>
          {generating ? '⏳ Génération…' : '📅 Générer calendrier 30 jours'}
        </button>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.82rem' }}>
          🔄 Actualiser
        </button>
        {stats?.next_scheduled_at && (
          <span style={{ fontSize: '.76rem', color: '#475569' }}>
            Prochain post : <strong style={{ color: '#e2e8f0' }}>{fmtDt(stats.next_scheduled_at)}</strong>
          </span>
        )}
      </div>

      {msg && (
        <div style={{ padding: '11px 16px', borderRadius: 10, background: msg.ok?'rgba(34,197,94,.07)':'rgba(239,68,68,.07)', border: `1px solid ${msg.ok?'rgba(34,197,94,.2)':'rgba(239,68,68,.2)'}`, color: msg.ok?'#86efac':'#fca5a5', fontSize: '.84rem' }}>
          {msg.text}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div style={{ color: '#475569', padding: 24, textAlign: 'center' }}>Chargement…</div>
      ) : posts.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#334155' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📅</div>
          <p style={{ margin: 0, fontSize: '.88rem' }}>Aucun post planifié. Cliquez sur "Générer calendrier 30 jours".</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {posts.map(p => {
            const sc = STATUS_CFG[p.status] ?? { color: '#64748b', label: p.status };
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.07)', borderRadius: 12, transition: 'background .15s' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color, flexShrink: 0, marginTop: 6, boxShadow: `0 0 6px ${sc.color}` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '.74rem', fontWeight: 700, color: '#64748b', background: 'rgba(255,255,255,.04)', padding: '2px 8px', borderRadius: 6 }}>{p.topic_type}</span>
                    <span style={{ fontSize: '.72rem', color: sc.color, fontWeight: 700 }}>{sc.label}</span>
                    <span style={{ fontSize: '.7rem', color: '#475569', marginLeft: 'auto' }}>{fmtDt(p.scheduled_at)}</span>
                  </div>
                  {p.content ? (
                    <p style={{ margin: 0, fontSize: '.78rem', color: '#64748b', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {p.content}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: '.74rem', color: '#334155', fontStyle: 'italic' }}>Contenu généré à la publication</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {p.status === 'pending' && (
                    <>
                      <button onClick={() => publishNow(p.id)} disabled={publishing === p.id} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(0,119,181,.25)', background: 'rgba(0,119,181,.08)', color: '#93c5fd', cursor: 'pointer', fontSize: '.74rem', fontWeight: 600 }}>
                        {publishing === p.id ? '⏳' : '▶ Publier'}
                      </button>
                      <button onClick={() => cancel(p.id)} style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(239,68,68,.15)', background: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '.72rem' }}>
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
