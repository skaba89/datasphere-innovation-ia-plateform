import { useI18n } from '../i18n/index';
import { useEffect, useState } from 'react';
import {
  Award, Briefcase, ChevronDown, ChevronUp, Copy, Download,
  FileText, GraduationCap, Globe, Loader2, Sparkles, User, X, Zap
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';
import ExperienceManager from '../components/ExperienceManager';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PersonalInfo {
  first_name: string; last_name: string; title: string;
  email: string; phone: string; location: string; linkedin: string; availability: string;
}
interface Experience {
  company: string; sector: string; title: string;
  start_date: string; end_date: string; location: string;
  context: string; achievements: string[]; stack: string[];
}
interface Skills {
  languages_prog: string[]; data_stack: string[]; cloud: string[];
  tools: string[]; methodologies: string[];
}
interface Education { degree: string; school: string; year: string; mention?: string; }
interface Certification { name: string; issuer: string; year: string; }
interface Language { language: string; level: string; }
interface CV {
  personal: PersonalInfo; summary: string; experiences: Experience[];
  skills: Skills; education: Education[]; certifications: Certification[];
  languages: Language[]; interests: string[];
}
interface CVResult {
  id: number; cv: CV; domain: string; domain_label: string;
  provider: string; generated_at: string; years_experience: number; real_experiences_used?: number;
}
interface Domain { key: string; label: string; roles: string[]; stack: string[]; }

// ── Styles ────────────────────────────────────────────────────────────────────
const pill = (color: string) => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: '.72rem',
  fontWeight: 600, background: `rgba(${color},.1)`, border: `1px solid rgba(${color},.2)`,
  color: `rgb(${color})`, margin: '2px',
} as React.CSSProperties);

const pillBlue  = pill('59,130,246');
const pillGreen = pill('34,197,94');
const pillAmber = pill('245,158,11');
const pillSlate = pill('148,163,184');

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ConsultantProfilesPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [cvTab, setCvTab] = useState<'generate' | 'experiences'>('experiences');

  // Form state
  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]         = useState('');
  const [domain,          setDomain]           = useState('data_engineering');
  const [yearsExp,        setYearsExp]         = useState(7);
  const [missionCtx,      setMissionCtx]       = useState('');
  const [showAdvanced,    setShowAdvanced]     = useState(false);

  // Data state
  const [domains,         setDomains]          = useState<Domain[]>([]);
  const [cvResult,        setCvResult]         = useState<CVResult | null>(null);
  const [cvList,          setCvList]           = useState<{id:number;name:string;title:string;domain:string}[]>([]);
  const [generating,      setGenerating]       = useState(false);
  const [error,           setError]            = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary','experiences','skills']));
  const [copied,           setCopied]          = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest<{domains:Domain[]}>('/cv/domains', {}, token)
      .then(d => setDomains(d.domains ?? []))
      .catch(() => {});
    loadCvList();
  }, [token]);

  async function loadCvList() {
    try {
      const list = await apiRequest<{id:number;name:string;title:string;domain:string}[]>('/cv', {}, token);
      setCvList(list ?? []);
    } catch {}
  }

  async function generate() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Prénom et nom sont obligatoires');
      return;
    }
    setGenerating(true); setError(''); setCvResult(null);
    try {
      const result = await apiRequest<CVResult>('/cv/generate', {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          domain,
          years_experience: yearsExp,
          mission_context: missionCtx.trim() || undefined,
        }),
      }, token);
      setCvResult(result);
      loadCvList();
      setExpandedSections(new Set(['summary','experiences','skills','education','certifications','languages']));
    } catch (e) {
      setError(String(e).slice(0, 150));
    } finally {
      setGenerating(false);
    }
  }

  function toggleSection(s: string) {
    setExpandedSections(prev => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  }

  async function loadCv(id: number) {
    // Reload by regenerating — store in memory per session
    setCvResult(null);
  }

  async function exportMd() {
    if (!cvResult) return;
    const r = await fetch(`/api/v1/cv/${cvResult.id}/export/md`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `CV_${cvResult.cv.personal.last_name}_${cvResult.cv.personal.first_name}.md`;
    a.click();
  }

  async function exportPdf() {
    if (!cvResult) return;
    try {
      const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const r = await fetch(`${API}/cv/${cvResult.id}/export/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ct = r.headers.get('content-type') || '';
      a.href = url;
      a.download = `CV_${cvResult.cv.personal.last_name}_${cvResult.cv.personal.first_name}.${ct.includes('pdf') ? 'pdf' : 'html'}`;
      a.click(); URL.revokeObjectURL(url);
    } catch { alert('Erreur export PDF'); }
  }

  async function exportHtml() {
    if (!cvResult) return;
    const r = await fetch(`/api/v1/cv/${cvResult.id}/export/html`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `CV_${cvResult.cv.personal.last_name}_${cvResult.cv.personal.first_name}.html`;
    a.click();
  }

  function copyText() {
    if (!cvResult) return;
    const p = cvResult.cv.personal;
    const text = [
      `${p.first_name} ${p.last_name} — ${p.title}`,
      `📍 ${p.location} | ✅ ${p.availability}`,
      '',
      '📋 RÉSUMÉ',
      cvResult.cv.summary,
      '',
      '💼 EXPÉRIENCES',
      ...cvResult.cv.experiences.map(e =>
        `${e.title} @ ${e.company} (${e.start_date}–${e.end_date})\n${e.achievements.slice(0,2).join('\n')}`
      ),
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const SectionHeader = ({ id, icon, title }: { id: string; icon: React.ReactNode; title: string }) => (
    <button onClick={() => toggleSection(id)}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8,
               padding: '10px 0', background: 'none', border: 'none',
               cursor: 'pointer', color: '#e2e8f0', fontWeight: 700, fontSize: '.9rem' }}>
      {icon}
      <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
      {expandedSections.has(id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  );

  if (!token) return (
    <main className="app-shell"><section className="panel"><p>Connecte-toi d'abord.</p></section></main>
  );

  const hasExperiences = true; // Will be determined by ExperienceManager

  return (
    <main className="app-shell">
      {/* Tab bar */}
      <section className="panel" style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setCvTab('experiences')}
            style={{ padding: '7px 16px', borderRadius: 8, fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', border: `1px solid ${cvTab === 'experiences' ? 'rgba(250,204,21,.3)' : 'rgba(148,163,184,.1)'}`, background: cvTab === 'experiences' ? 'rgba(250,204,21,.07)' : 'transparent', color: cvTab === 'experiences' ? '#facc15' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            📁 Mes expériences
          </button>
          <button onClick={() => setCvTab('generate')}
            style={{ padding: '7px 16px', borderRadius: 8, fontWeight: 700, fontSize: '.8rem', cursor: 'pointer', border: `1px solid ${cvTab === 'generate' ? 'rgba(250,204,21,.3)' : 'rgba(148,163,184,.1)'}`, background: cvTab === 'generate' ? 'rgba(250,204,21,.07)' : 'transparent', color: cvTab === 'generate' ? '#facc15' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            ✨ Générer CV IA
          </button>
        </div>
      </section>

      {/* Experiences tab */}
      {cvTab === 'experiences' && (
        <section className="panel">
          <ExperienceManager token={token} />
        </section>
      )}

      {/* CV Generation tab */}
      {cvTab === 'generate' && <>
      {/* Header */}
      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p className="eyebrow">Agent IA</p>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <User size={22} color="#facc15" /> Agent Génération de CV
            </h1>
            <p className="subtitle">
              Entrez le prénom et nom du consultant — l'IA génère un CV complet
              avec 6+ ans d'expérience, projets data, compétences et certifications.
            </p>
          </div>
          {cvList.length > 0 && (
            <div style={{ fontSize: '.75rem', color: '#64748b', textAlign: 'right' }}>
              {cvList.length} CV{cvList.length > 1 ? 's' : ''} générés
            </div>
          )}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT PANEL : Form ────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gap: 12 }}>

          {/* Identité */}
          <section className="panel">
            <h3 style={{ margin: '0 0 14px', fontSize: '.88rem', fontWeight: 800, color: '#facc15' }}>
              👤 Identité du consultant
            </h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={{ fontSize: '.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  PRÉNOM *
                </label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Cheickna" autoFocus
                  onKeyDown={e => e.key === 'Enter' && generate()}
                  style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)',
                           border: '1px solid rgba(148,163,184,.2)', borderRadius: 8,
                           color: '#f1f5f9', fontSize: '.88rem', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ fontSize: '.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  NOM *
                </label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="KABA"
                  onKeyDown={e => e.key === 'Enter' && generate()}
                  style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,.06)',
                           border: '1px solid rgba(148,163,184,.2)', borderRadius: 8,
                           color: '#f1f5f9', fontSize: '.88rem', boxSizing: 'border-box' as const }} />
              </div>
            </div>
          </section>

          {/* Domaine */}
          <section className="panel">
            <h3 style={{ margin: '0 0 12px', fontSize: '.88rem', fontWeight: 800, color: '#e2e8f0' }}>
              🎯 Domaine de compétence
            </h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {domains.length > 0 ? domains.map(d => (
                <button key={d.key} onClick={() => setDomain(d.key)}
                  style={{ padding: '10px 12px', borderRadius: 9,
                           border: `1.5px solid ${domain === d.key ? 'rgba(250,204,21,.4)' : 'rgba(148,163,184,.12)'}`,
                           background: domain === d.key ? 'rgba(250,204,21,.06)' : 'none',
                           color: domain === d.key ? '#facc15' : '#64748b',
                           cursor: 'pointer', textAlign: 'left' as const }}>
                  <div style={{ fontWeight: 700, fontSize: '.82rem' }}>{d.label}</div>
                  <div style={{ fontSize: '.7rem', color: '#475569', marginTop: 2 }}>
                    {d.stack.slice(0,4).join(' · ')}
                  </div>
                </button>
              )) : (
                ['data_engineering','data_science','bi_analytics','data_governance'].map(k => (
                  <button key={k} onClick={() => setDomain(k)}
                    style={{ padding: '10px 12px', borderRadius: 9,
                             border: `1.5px solid ${domain === k ? 'rgba(250,204,21,.4)' : 'rgba(148,163,184,.12)'}`,
                             background: domain === k ? 'rgba(250,204,21,.06)' : 'none',
                             color: domain === k ? '#facc15' : '#64748b',
                             cursor: 'pointer', textAlign: 'left' as const }}>
                    <div style={{ fontWeight: 700, fontSize: '.82rem' }}>
                      {k === 'data_engineering' ? 'Data Engineering' : k === 'data_science' ? 'Data Science / ML' : k === 'bi_analytics' ? 'BI / Analytics' : 'Data Governance'}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Advanced */}
          <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                       display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                       color: '#64748b', fontSize: '.82rem', fontWeight: 600 }}>
              <Zap size={13} />
              Paramètres avancés
              {showAdvanced ? <ChevronUp size={13} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={13} style={{ marginLeft: 'auto' }} />}
            </button>
            {showAdvanced && (
              <div style={{ padding: '0 16px 16px', display: 'grid', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    ANNÉES D'EXPÉRIENCE : {yearsExp} ans
                  </label>
                  <input type="range" min={6} max={20} value={yearsExp}
                    onChange={e => setYearsExp(Number(e.target.value))}
                    style={{ width: '100%' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: '#475569' }}>
                    <span>6 ans</span><span>20 ans</span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    CONTEXTE MISSION (optionnel)
                  </label>
                  <textarea value={missionCtx} onChange={e => setMissionCtx(e.target.value)}
                    placeholder="Collez ici le résumé de la mission ou de l'AO pour aligner le CV..."
                    rows={4}
                    style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,.05)',
                             border: '1px solid rgba(148,163,184,.15)', borderRadius: 8,
                             color: '#e2e8f0', fontSize: '.78rem', resize: 'vertical',
                             boxSizing: 'border-box' as const }} />
                </div>
              </div>
            )}
          </section>

          {/* Generate button */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)',
                          border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: '.8rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <X size={13} style={{ marginTop: 2, flexShrink: 0 }} />{error}
            </div>
          )}

          <button onClick={generate} disabled={generating || !firstName || !lastName}
            style={{ padding: '13px', borderRadius: 10, border: 'none',
                     background: generating || !firstName || !lastName ? '#334155' : '#facc15',
                     color: generating || !firstName || !lastName ? '#64748b' : '#060e18',
                     cursor: generating || !firstName || !lastName ? 'not-allowed' : 'pointer',
                     fontWeight: 800, fontSize: '.92rem',
                     display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {generating
              ? <><Loader2 size={15} style={{ animation: 'ds-spin .7s linear infinite' }} /> Génération en cours…</>
              : <><Sparkles size={15} /> Générer le CV</>}
          </button>

          {/* CV History */}
          {cvList.length > 0 && (
            <section className="panel">
              <h3 style={{ margin: '0 0 10px', fontSize: '.82rem', fontWeight: 700, color: '#64748b' }}>
                Historique ({cvList.length})
              </h3>
              <div style={{ display: 'grid', gap: 6 }}>
                {cvList.map(c => (
                  <button key={c.id}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.12)',
                             background: 'rgba(255,255,255,.02)', cursor: 'default',
                             textAlign: 'left' as const, color: '#e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: '.8rem' }}>{c.name}</div>
                    <div style={{ fontSize: '.7rem', color: '#475569' }}>{c.title} · {c.domain}</div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── RIGHT PANEL : CV Preview ──────────────────────────────────────── */}
        {cvResult ? (
          <div style={{ display: 'grid', gap: 12 }}>

            {/* CV Header */}
            <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px 16px', background: 'rgba(250,204,21,.04)',
                            borderBottom: '1px solid rgba(250,204,21,.1)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc' }}>
                      {cvResult.cv.personal.first_name} {cvResult.cv.personal.last_name}
                    </h2>
                    <p style={{ margin: '4px 0 0', color: '#facc15', fontWeight: 700, fontSize: '.95rem' }}>
                      {cvResult.cv.personal.title}
                    </p>
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', fontSize: '.78rem', color: '#64748b' }}>
                      {cvResult.cv.personal.email    && <span>📧 {cvResult.cv.personal.email}</span>}
                      {cvResult.cv.personal.phone    && <span>📱 {cvResult.cv.personal.phone}</span>}
                      {cvResult.cv.personal.location && <span>📍 {cvResult.cv.personal.location}</span>}
                      {cvResult.cv.personal.availability && (
                        <span style={{ color: '#86efac', fontWeight: 600 }}>✅ {cvResult.cv.personal.availability}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={copyText}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.2)',
                               background: 'none', color: copied ? '#86efac' : '#64748b', cursor: 'pointer',
                               display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', fontWeight: 600 }}>
                      <Copy size={12} />{copied ? 'Copié !' : 'Copier'}
                    </button>
                    <button onClick={exportPdf}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.06)', color: '#fca5a5', cursor: 'pointer', fontSize: '.78rem', fontWeight: 700 }}>
                      📄 PDF
                    </button>
                    <button onClick={exportMd}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.2)',
                               background: 'none', color: '#64748b', cursor: 'pointer',
                               display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', fontWeight: 600 }}>
                      <Download size={12} /> .md
                    </button>
                    <button onClick={exportHtml}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.2)',
                               background: 'none', color: '#64748b', cursor: 'pointer',
                               display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', fontWeight: 600 }}>
                      <FileText size={12} /> .html
                    </button>
                    <button onClick={generate} disabled={generating}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(250,204,21,.3)',
                               background: 'rgba(250,204,21,.08)', color: '#facc15', cursor: 'pointer',
                               display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', fontWeight: 700 }}>
                      <Sparkles size={12} /> Régénérer
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: '.72rem', color: '#475569' }}>
                  Généré via <strong style={{ color: '#94a3b8' }}>{cvResult.provider}</strong> · {cvResult.domain_label} · {cvResult.years_experience}+ ans{cvResult.real_experiences_used ? <> · <strong style={{ color: '#22c55e' }}>{cvResult.real_experiences_used} vraie{cvResult.real_experiences_used > 1 ? 's' : ''} expérience{cvResult.real_experiences_used > 1 ? 's' : ''}</strong></> : <> · <span style={{ color: '#64748b' }}>expériences générées</span></>}
                </div>
              </div>

              {/* Summary */}
              <div style={{ padding: '0 24px' }}>
                <div style={{ borderBottom: '1px solid rgba(148,163,184,.08)' }}>
                  <SectionHeader id="summary" icon={<User size={15} color="#facc15" />} title="Profil" />
                </div>
                {expandedSections.has('summary') && (
                  <div style={{ padding: '12px 0 16px', color: '#cbd5e1', fontSize: '.85rem', lineHeight: 1.7 }}>
                    {cvResult.cv.summary}
                  </div>
                )}
              </div>

              {/* Experiences */}
              <div style={{ padding: '0 24px' }}>
                <div style={{ borderBottom: '1px solid rgba(148,163,184,.08)' }}>
                  <SectionHeader id="experiences" icon={<Briefcase size={15} color="#60a5fa" />} title={`Expériences (${cvResult.cv.experiences.length})`} />
                </div>
                {expandedSections.has('experiences') && (
                  <div style={{ paddingBottom: 16 }}>
                    {cvResult.cv.experiences.map((exp, i) => (
                      <div key={i} style={{ padding: '14px 0', borderBottom: i < cvResult.cv.experiences.length - 1 ? '1px solid rgba(148,163,184,.06)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: '.9rem' }}>{exp.title}</div>
                            <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '.85rem' }}>{exp.company}</div>
                            <div style={{ fontSize: '.75rem', color: '#475569', marginTop: 2 }}>
                              {exp.sector && <span>{exp.sector} · </span>}{exp.location}
                            </div>
                          </div>
                          <div style={{ fontSize: '.75rem', color: '#64748b', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {exp.start_date} – {exp.end_date}
                          </div>
                        </div>
                        {exp.context && (
                          <p style={{ margin: '8px 0', fontSize: '.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            {exp.context}
                          </p>
                        )}
                        <ul style={{ margin: '8px 0', paddingLeft: 16 }}>
                          {exp.achievements.map((ach, j) => (
                            <li key={j} style={{ fontSize: '.82rem', color: '#cbd5e1', marginBottom: 4, lineHeight: 1.5 }}>
                              {ach}
                            </li>
                          ))}
                        </ul>
                        {exp.stack?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            {exp.stack.map(s => <span key={s} style={pillBlue}>{s}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Skills */}
              <div style={{ padding: '0 24px' }}>
                <div style={{ borderBottom: '1px solid rgba(148,163,184,.08)' }}>
                  <SectionHeader id="skills" icon={<Zap size={15} color="#a78bfa" />} title="Compétences techniques" />
                </div>
                {expandedSections.has('skills') && (
                  <div style={{ padding: '12px 0 16px', display: 'grid', gap: 8 }}>
                    {Object.entries({
                      'Langages': cvResult.cv.skills.languages_prog,
                      'Data Stack': cvResult.cv.skills.data_stack,
                      'Cloud': cvResult.cv.skills.cloud,
                      'Outils': cvResult.cv.skills.tools,
                      'Méthodes': cvResult.cv.skills.methodologies,
                    }).map(([label, items]) => items?.length > 0 && (
                      <div key={label} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '.72rem', color: '#475569', fontWeight: 700, minWidth: 80 }}>{label}</span>
                        <div>{items.map(s => <span key={s} style={label === 'Cloud' ? pillGreen : label === 'Méthodes' ? pillAmber : pillSlate}>{s}</span>)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Education */}
              {cvResult.cv.education?.length > 0 && (
                <div style={{ padding: '0 24px' }}>
                  <div style={{ borderBottom: '1px solid rgba(148,163,184,.08)' }}>
                    <SectionHeader id="education" icon={<GraduationCap size={15} color="#34d399" />} title="Formation" />
                  </div>
                  {expandedSections.has('education') && (
                    <div style={{ padding: '12px 0 16px' }}>
                      {cvResult.cv.education.map((edu, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#f1f5f9' }}>{edu.degree}</div>
                          <div style={{ fontSize: '.78rem', color: '#64748b' }}>
                            {edu.school} · {edu.year}{edu.mention ? ` · ${edu.mention}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Certifications */}
              {cvResult.cv.certifications?.length > 0 && (
                <div style={{ padding: '0 24px' }}>
                  <div style={{ borderBottom: '1px solid rgba(148,163,184,.08)' }}>
                    <SectionHeader id="certifications" icon={<Award size={15} color="#f59e0b" />} title={`Certifications (${cvResult.cv.certifications.length})`} />
                  </div>
                  {expandedSections.has('certifications') && (
                    <div style={{ padding: '12px 0 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {cvResult.cv.certifications.map((cert, i) => (
                        <div key={i} style={{ padding: '6px 10px', borderRadius: 8,
                                              background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)' }}>
                          <div style={{ fontWeight: 700, fontSize: '.78rem', color: '#fbbf24' }}>{cert.name}</div>
                          <div style={{ fontSize: '.7rem', color: '#64748b' }}>{cert.issuer} · {cert.year}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Languages */}
              {cvResult.cv.languages?.length > 0 && (
                <div style={{ padding: '0 24px 20px' }}>
                  <div style={{ borderBottom: '1px solid rgba(148,163,184,.08)' }}>
                    <SectionHeader id="languages" icon={<Globe size={15} color="#38bdf8" />} title="Langues" />
                  </div>
                  {expandedSections.has('languages') && (
                    <div style={{ padding: '12px 0 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {cvResult.cv.languages.map((lang, i) => (
                        <div key={i} style={{ padding: '6px 12px', borderRadius: 8,
                                              background: 'rgba(56,189,248,.06)', border: '1px solid rgba(56,189,248,.2)' }}>
                          <span style={{ fontWeight: 700, fontSize: '.8rem', color: '#38bdf8' }}>{lang.language}</span>
                          <span style={{ fontSize: '.74rem', color: '#64748b', marginLeft: 6 }}>{lang.level}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* Empty state */
          <section className="panel" style={{ display: 'flex', flexDirection: 'column',
                                               alignItems: 'center', justifyContent: 'center',
                                               minHeight: 450, gap: 14, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(250,204,21,.08)',
                          border: '1px solid rgba(250,204,21,.2)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center' }}>
              <User size={28} color="#facc15" style={{ opacity: .6 }} />
            </div>
            <div>
              <p style={{ color: '#e2e8f0', fontWeight: 700, margin: '0 0 6px', fontSize: '.95rem' }}>
                Remplissez le formulaire
              </p>
              <p style={{ color: '#475569', fontSize: '.82rem', maxWidth: 280, lineHeight: 1.6, margin: 0 }}>
                Entrez le prénom et nom du consultant, choisissez le domaine, et cliquez{' '}
                <strong style={{ color: '#facc15' }}>Générer le CV</strong>
              </p>
            </div>
            <div style={{ display: 'grid', gap: 8, width: '100%', maxWidth: 340 }}>
              {[
                '✅ Profil et résumé exécutif',
                '✅ 3-4 expériences projets data',
                '✅ Stack technique complète',
                '✅ Formation et certifications',
                '✅ Export Markdown et HTML',
              ].map(f => (
                <div key={f} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,.03)',
                                      border: '1px solid rgba(148,163,184,.08)', fontSize: '.8rem', color: '#64748b',
                                      textAlign: 'left' as const }}>
                  {f}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
      </>
    }
    </main>
  );
}
