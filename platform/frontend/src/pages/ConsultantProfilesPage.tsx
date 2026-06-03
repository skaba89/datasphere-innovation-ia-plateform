import { useEffect, useState } from 'react';
import { API_BASE } from '../api/config';
import { FileDown, Loader, User, Briefcase, Star, Languages, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { tokenStorage } from '../api/client';
import { getUserName } from '../api/userContext';
import { AgentManagementPanel } from '../components/AgentManagementPanel';
import { AgentOperationsPanel } from '../components/AgentOperationsPanel';


interface Experience {
  title: string;
  company: string;
  period: string;
  description: string;
}

interface CVForm {
  name: string;
  title: string;
  summary: string;
  experience_years: string;
  daily_rate: string;
  skills: string;
  languages: string;
  experiences: Experience[];
  education: string;
  certifications: string;
}

// ── CV Generator Modal ────────────────────────────────────────────────────────
function CVGeneratorModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<CVForm>({
    name: getUserName(),
    title: 'Senior Data Engineer / Lead Data Architect',
    summary: '',
    experience_years: '8',
    daily_rate: '650-800 € HT/jour',
    skills: 'Snowflake, dbt Core, Apache Airflow, PySpark, Python, SQL, AWS, GCP, Azure, Medallion Architecture',
    languages: 'Français (natif), Anglais (courant)',
    experiences: [
      { title: 'Senior Data Engineer', company: '', period: '', description: '' },
    ],
    education: 'Master 2 SID, Université Paris 1 Panthéon-Sorbonne',
    certifications: '',
  });

  function addExperience() {
    setForm(f => ({ ...f, experiences: [...f.experiences, { title: '', company: '', period: '', description: '' }] }));
  }

  function removeExperience(i: number) {
    setForm(f => ({ ...f, experiences: f.experiences.filter((_, idx) => idx !== i) }));
  }

  function updateExp(i: number, field: keyof Experience, val: string) {
    setForm(f => {
      const exps = [...f.experiences];
      exps[i] = { ...exps[i], [field]: val };
      return { ...f, experiences: exps };
    });
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const consultant = {
        name: form.name,
        title: form.title,
        summary: form.summary,
        experience_years: form.experience_years ? parseInt(form.experience_years) : undefined,
        daily_rate: form.daily_rate,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        languages: form.languages.split(',').map(s => s.trim()).filter(Boolean),
        experiences: form.experiences.filter(e => e.company || e.title),
        education: form.education.split('\n').map(s => s.trim()).filter(Boolean).map(e => ({ degree: e, school: '', year: '' })),
        certifications: form.certifications.split(',').map(s => s.trim()).filter(Boolean),
      };
      const resp = await fetch(`${API_BASE}/deliverables/cv/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ consultant }),
      });
      if (!resp.ok) throw new Error('Erreur lors de la génération');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cv_${form.name.toLowerCase().replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(148,163,184,.15)',
    borderRadius: 8, color: '#f1f5f9', fontSize: '.84rem', outline: 'none', fontFamily: 'inherit',
    transition: 'border-color .15s',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '.7rem', fontWeight: 700, color: '#64748b',
    marginBottom: 4, letterSpacing: '.05em', textTransform: 'uppercase', fontFamily: 'monospace',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div style={{ background: '#0c1425', border: '1px solid rgba(148,163,184,.15)', borderRadius: 18, maxWidth: 600, width: '100%', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(148,163,184,.1)', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, background: '#0c1425', zIndex: 1 }}>
          <FileDown size={18} color="#facc15" />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem' }}>Générer un CV consultant</div>
            <div style={{ fontSize: '.72rem', color: '#64748b' }}>Étape {step}/2 — {step === 1 ? 'Profil & compétences' : 'Expériences & formation'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.2rem' }}>✕</button>
        </div>

        <form onSubmit={handleGenerate} style={{ padding: 24, display: 'grid', gap: 14 }}>
          {step === 1 && (
            <>
              {/* Infos de base */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}><User size={10} style={{ display: 'inline', marginRight: 4 }} />Nom complet *</label>
                  <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom du consultant" required
                    onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}><Briefcase size={10} style={{ display: 'inline', marginRight: 4 }} />Titre / Poste *</label>
                  <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Senior Data Architect / Lead Data Engineer" required
                    onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
                </div>
                <div>
                  <label style={lbl}>Années d'expérience</label>
                  <input style={inp} type="number" min="1" max="40" value={form.experience_years}
                    onChange={e => setForm(f => ({ ...f, experience_years: e.target.value }))} placeholder="8"
                    onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
                </div>
                <div>
                  <label style={lbl}>TJM</label>
                  <input style={inp} value={form.daily_rate} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))} placeholder="650-800 € HT/jour"
                    onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
                </div>
              </div>
              <div>
                <label style={lbl}>Résumé du profil</label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={form.summary}
                  onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  placeholder="Expert Data Engineering & Architecture Data avec 8+ ans d'expérience sur Snowflake, dbt, Airflow..."
                  onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
              </div>
              <div>
                <label style={lbl}><Star size={10} style={{ display: 'inline', marginRight: 4 }} />Compétences techniques (séparées par virgules)</label>
                <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.skills}
                  onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
              </div>
              <div>
                <label style={lbl}><Languages size={10} style={{ display: 'inline', marginRight: 4 }} />Langues (séparées par virgules)</label>
                <input style={inp} value={form.languages} onChange={e => setForm(f => ({ ...f, languages: e.target.value }))} placeholder="Français (natif), Anglais (courant)"
                  onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Expériences */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <label style={{ ...lbl, margin: 0 }}><Briefcase size={10} style={{ display: 'inline', marginRight: 4 }} />Expériences professionnelles</label>
                  <button type="button" onClick={addExperience}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(250,204,21,.25)', background: 'rgba(250,204,21,.06)', color: '#fde68a', cursor: 'pointer', fontSize: '.72rem' }}>
                    <Plus size={10} /> Ajouter
                  </button>
                </div>
                {form.experiences.map((exp, i) => (
                  <div key={i} style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(148,163,184,.1)', marginBottom: 10, display: 'grid', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input style={inp} value={exp.title} onChange={e => updateExp(i, 'title', e.target.value)} placeholder="Titre du poste"
                        onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')} onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
                      <input style={inp} value={exp.company} onChange={e => updateExp(i, 'company', e.target.value)} placeholder="Entreprise / Client"
                        onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')} onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
                      <input style={inp} value={exp.period} onChange={e => updateExp(i, 'period', e.target.value)} placeholder="2022 – 2024"
                        onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')} onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
                      <button type="button" onClick={() => removeExperience(i)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,.08)', color: '#fca5a5', cursor: 'pointer', fontSize: '.72rem' }}>
                        <Trash2 size={11} /> Supprimer
                      </button>
                    </div>
                    <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={exp.description}
                      onChange={e => updateExp(i, 'description', e.target.value)} placeholder="Description des missions et réalisations..."
                      onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')} onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
                  </div>
                ))}
              </div>
              <div>
                <label style={lbl}><GraduationCap size={10} style={{ display: 'inline', marginRight: 4 }} />Formation (une par ligne)</label>
                <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={form.education}
                  onChange={e => setForm(f => ({ ...f, education: e.target.value }))}
                  placeholder="Master 2 SID, Université Paris 1&#10;Licence Informatique, ..."
                  onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
              </div>
              <div>
                <label style={lbl}>Certifications (séparées par virgules)</label>
                <input style={inp} value={form.certifications} onChange={e => setForm(f => ({ ...f, certifications: e.target.value }))}
                  placeholder="AWS Solutions Architect, Snowflake SnowPro Core..."
                  onFocus={e => (e.target.style.borderColor = 'rgba(250,204,21,.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(148,163,184,.15)')} />
              </div>
            </>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4, paddingTop: 12, borderTop: '1px solid rgba(148,163,184,.08)' }}>
            {step === 2 && (
              <button type="button" onClick={() => setStep(1)}
                style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(148,163,184,.2)', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '.82rem' }}>
                ← Précédent
              </button>
            )}
            <button type="button" onClick={onClose}
              style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '.82rem' }}>
              Annuler
            </button>
            {step === 1 ? (
              <button type="button" onClick={() => setStep(2)}
                style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060e18', cursor: 'pointer', fontWeight: 800, fontSize: '.82rem', fontFamily: 'Syne, sans-serif' }}>
                Suivant : Expériences →
              </button>
            ) : (
              <button type="submit" disabled={generating}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: generating ? 'rgba(250,204,21,.4)' : '#facc15', color: '#060e18', cursor: generating ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '.82rem', fontFamily: 'Syne, sans-serif' }}>
                {generating ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileDown size={13} />}
                {generating ? 'Génération…' : 'Générer le CV (.docx)'}
              </button>
            )}
          </div>
        </form>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ConsultantProfilesPage() {
  const token = tokenStorage.get();
  const [showCV, setShowCV] = useState(false);

  if (!token) {
    return (
      <main className="app-shell">
        <section className="panel">
          <p className="eyebrow">Consultants augmentés</p>
          <h1>Profils consultants</h1>
          <p>Connecte-toi pour accéder au catalogue de profils.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {showCV && <CVGeneratorModal token={token} onClose={() => setShowCV(false)} />}
      <section className="panel">
        <p className="eyebrow">Consultants augmentés</p>
        <h1>Profils consultants</h1>
        <p className="subtitle">
          Installe les profils standards, affecte-les aux missions, génère les actions gouvernées et crée ton CV professionnel.
        </p>
        <button
          onClick={() => setShowCV(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: '1px solid rgba(250,204,21,.3)', background: 'rgba(250,204,21,.08)', color: '#facc15', cursor: 'pointer', fontWeight: 700, fontSize: '.82rem', marginTop: 12 }}
        >
          <FileDown size={14} /> Générer un CV consultant (.docx)
        </button>
      </section>
      <AgentManagementPanel token={token} />
      <AgentOperationsPanel token={token} />
    </main>
  );
}
