/**
 * ExperienceManager — Gestion des expériences professionnelles réelles
 *
 * Permet au consultant de saisir ses vraies expériences.
 * Ces expériences sont injectées dans le prompt de génération CV
 * pour remplacer les expériences fictives inventées par le LLM.
 */

import { useEffect, useState } from 'react';
import {
  Briefcase, Calendar, CheckCircle, ChevronDown, ChevronUp,
  Info, Loader2, MapPin, Plus, Star, Trash2, X,
} from 'lucide-react';
import { apiRequest } from '../api/client';

interface Experience {
  id:            number;
  company:       string;
  client_name:   string | null;
  role:          string;
  sector:        string | null;
  location:      string | null;
  project_type:  string | null;
  start_date:    string;
  end_date:      string | null;
  is_current:    boolean;
  context:       string | null;
  description:   string;
  achievements:  string | null;
  technologies:  string | null;
  methodologies: string | null;
  is_highlight:  boolean;
  display_order: number;
}

const EMPTY_FORM = {
  company: '', client_name: '', role: '', sector: '',
  location: 'Paris, France', project_type: '', start_date: '', end_date: '',
  is_current: false, context: '', description: '',
  achievements: '', technologies: '', methodologies: '', is_highlight: true,
};

export default function ExperienceManager({ token }: { token: string | null }) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState<number | null>(null);
  const [expanded,    setExpanded]    = useState<number | null>(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [error,       setError]       = useState('');

  async function load() {
    setLoading(true);
    try {
      const raw = await apiRequest<unknown>('/consultant/experiences', {}, token);
      setExperiences(Array.isArray(raw) ? raw as Experience[] : []);
    } catch { setExperiences([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token]);

  function openAdd() {
    setForm(EMPTY_FORM); setEditId(null); setShowForm(true); setError('');
  }

  function openEdit(exp: Experience) {
    setForm({
      company:       exp.company || '',
      client_name:   exp.client_name || '',
      role:          exp.role || '',
      sector:        exp.sector || '',
      location:      exp.location || '',
      project_type:  exp.project_type || '',
      start_date:    exp.start_date || '',
      end_date:      exp.end_date || '',
      is_current:    exp.is_current,
      context:       exp.context || '',
      description:   exp.description || '',
      achievements:  exp.achievements || '',
      technologies:  exp.technologies || '',
      methodologies: exp.methodologies || '',
      is_highlight:  exp.is_highlight,
    });
    setEditId(exp.id); setShowForm(true); setError('');
  }

  async function save() {
    if (!form.company || !form.role || !form.description || !form.start_date) {
      setError('Renseignez au minimum : entreprise, rôle, description, date de début');
      return;
    }
    setSaving(true); setError('');
    try {
      const body = JSON.stringify({ ...form, display_order: experiences.length });
      if (editId !== null) {
        await apiRequest(`/consultant/experiences/${editId}`, { method: 'PATCH', body }, token);
      } else {
        await apiRequest('/consultant/experiences', { method: 'POST', body }, token);
      }
      setShowForm(false); setEditId(null);
      await load();
    } catch (e) {
      setError('Erreur lors de la sauvegarde. Vérifiez les champs.');
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm('Supprimer cette expérience ?')) return;
    await apiRequest(`/consultant/experiences/${id}`, { method: 'DELETE' }, token);
    setExperiences(prev => prev.filter(e => e.id !== id));
  }

  async function toggleHighlight(exp: Experience) {
    await apiRequest(`/consultant/experiences/${exp.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_highlight: !exp.is_highlight }),
    }, token);
    setExperiences(prev => prev.map(e => e.id === exp.id ? { ...e, is_highlight: !e.is_highlight } : e));
  }

  const highlighted = experiences.filter(e => e.is_highlight).length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '.9rem', fontWeight: 800, color: '#f1f5f9' }}>
            Mes expériences professionnelles
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '.74rem', color: '#64748b' }}>
            {experiences.length} expérience{experiences.length > 1 ? 's' : ''} ·{' '}
            <span style={{ color: '#facc15' }}>{highlighted} incluse{highlighted > 1 ? 's' : ''} dans le CV</span>
          </p>
        </div>
        <button onClick={openAdd} style={primaryBtn}>
          <Plus size={14} /> Ajouter une expérience
        </button>
      </div>

      {/* Info banner */}
      <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)', display: 'flex', gap: 8, fontSize: '.76rem', color: '#93c5fd' }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Les expériences marquées <Star size={11} style={{ verticalAlign: 'middle', color: '#facc15' }} /> <strong>sont injectées dans le CV généré</strong> — le LLM les utilise telles quelles et les adapte à la mission cible, sans rien inventer.
        </span>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(15,23,42,.9)', border: '1px solid rgba(148,163,184,.15)', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '.85rem', fontWeight: 800, color: '#facc15' }}>
              {editId ? 'Modifier l\'expérience' : 'Nouvelle expérience'}
            </h4>
            <button onClick={() => { setShowForm(false); setEditId(null); }} style={iconBtn}>
              <X size={15} />
            </button>
          </div>

          {/* Row 1: company + role */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Entreprise *" value={form.company} onChange={v => setForm(p => ({ ...p, company: v }))} placeholder="DataSphere Conseil" />
            <Field label="Rôle / Titre *" value={form.role} onChange={v => setForm(p => ({ ...p, role: v }))} placeholder="Data Engineer Senior" />
          </div>

          {/* Row 2: client + sector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Client final (si ESN)" value={form.client_name} onChange={v => setForm(p => ({ ...p, client_name: v }))} placeholder="Banque de France" />
            <Field label="Secteur client" value={form.sector} onChange={v => setForm(p => ({ ...p, sector: v }))} placeholder="Banque / Finance" />
          </div>

          {/* Row 3: dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Date début *" value={form.start_date} onChange={v => setForm(p => ({ ...p, start_date: v }))} placeholder="01/2022" />
            <Field label="Date fin" value={form.end_date || ''} onChange={v => setForm(p => ({ ...p, end_date: v }))} placeholder="12/2023" disabled={form.is_current} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 20 }}>
              <input type="checkbox" checked={form.is_current} onChange={e => setForm(p => ({ ...p, is_current: e.target.checked, end_date: e.target.checked ? '' : p.end_date }))} style={{ accentColor: '#facc15', width: 15, height: 15 }} />
              <label style={{ fontSize: '.78rem', color: '#94a3b8' }}>En cours</label>
            </div>
          </div>

          {/* Row 4: location + project type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Localisation" value={form.location} onChange={v => setForm(p => ({ ...p, location: v }))} placeholder="Paris / Remote" />
            <Field label="Type de projet" value={form.project_type} onChange={v => setForm(p => ({ ...p, project_type: v }))} placeholder="Data Lake, Migration, BI..." />
          </div>

          {/* Context */}
          <TextArea label="Contexte (1-2 phrases)" value={form.context} onChange={v => setForm(p => ({ ...p, context: v }))} placeholder="Migration du SI data vers Snowflake pour une banque de 5000 collaborateurs." rows={2} />

          {/* Description */}
          <TextArea label="Description du poste *" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="Conception et développement des pipelines de données batch et streaming..." rows={3} />

          {/* Achievements */}
          <TextArea label="Réalisations clés (une par ligne)" value={form.achievements} onChange={v => setForm(p => ({ ...p, achievements: v }))} placeholder={"Réduction de 40% du temps de traitement des pipelines ETL\nMise en place d'une architecture ELT avec dbt Core (50+ modèles)\nFormation de 3 data analysts sur l'utilisation de dbt"} rows={4} />

          {/* Technologies */}
          <Field label="Technologies (séparées par virgules)" value={form.technologies} onChange={v => setForm(p => ({ ...p, technologies: v }))} placeholder="Snowflake, dbt Core, Apache Airflow, Python, SQL, AWS S3" />

          {/* Methodologies */}
          <Field label="Méthodologies" value={form.methodologies} onChange={v => setForm(p => ({ ...p, methodologies: v }))} placeholder="Agile Scrum, CI/CD, Git" />

          {/* Highlight */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(250,204,21,.05)', border: '1px solid rgba(250,204,21,.12)' }}>
            <input type="checkbox" checked={form.is_highlight} onChange={e => setForm(p => ({ ...p, is_highlight: e.target.checked }))} style={{ accentColor: '#facc15', width: 15, height: 15 }} />
            <label style={{ fontSize: '.78rem', color: '#facc15', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Star size={13} /> Inclure dans le CV généré
            </label>
          </div>

          {error && <p style={{ color: '#fca5a5', fontSize: '.78rem', margin: 0 }}>{error}</p>}

          {/* Save */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null); }} style={ghostBtn}>Annuler</button>
            <button onClick={save} disabled={saving} style={primaryBtn}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <CheckCircle size={13} />}
              {editId ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Loader2 size={18} color="#facc15" style={{ animation: 'spin .7s linear infinite', margin: '0 auto' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && experiences.length === 0 && !showForm && (
        <div style={{ padding: '30px 24px', textAlign: 'center', background: 'rgba(255,255,255,.02)', borderRadius: 12, border: '1px dashed rgba(148,163,184,.1)' }}>
          <Briefcase size={32} color="#334155" style={{ margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: '#94a3b8', fontWeight: 700, margin: '0 0 6px' }}>Aucune expérience saisie</p>
          <p style={{ color: '#64748b', fontSize: '.8rem', margin: '0 0 14px', lineHeight: 1.6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
            Ajoutez vos vraies expériences professionnelles. Elles seront utilisées par le CV Agent pour générer un CV authentique, sans données inventées.
          </p>
          <button onClick={openAdd} style={primaryBtn}><Plus size={13} /> Ajouter ma 1ère expérience</button>
        </div>
      )}

      {/* Experience list */}
      {!loading && experiences.map(exp => {
        const isOpen = expanded === exp.id;
        const techs  = exp.technologies?.split(',').map(t => t.trim()).filter(Boolean) ?? [];
        const achiev = exp.achievements?.split('\n').filter(Boolean) ?? [];
        const period = exp.is_current
          ? `${exp.start_date} → En cours`
          : `${exp.start_date} → ${exp.end_date || '?'}`;

        return (
          <div key={exp.id} style={{
            borderRadius: 11, overflow: 'hidden',
            border: `1px solid ${exp.is_highlight ? 'rgba(250,204,21,.2)' : 'rgba(148,163,184,.08)'}`,
            background: exp.is_highlight ? 'rgba(250,204,21,.02)' : 'rgba(255,255,255,.01)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              {/* Highlight toggle */}
              <button onClick={() => toggleHighlight(exp)} title={exp.is_highlight ? 'Exclure du CV' : 'Inclure dans le CV'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                <Star size={15} color={exp.is_highlight ? '#facc15' : '#334155'} fill={exp.is_highlight ? '#facc15' : 'none'} />
              </button>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: '.85rem', color: '#f1f5f9' }}>{exp.role}</span>
                  <span style={{ fontSize: '.72rem', color: '#64748b' }}>chez <strong style={{ color: '#94a3b8' }}>{exp.company}</strong>{exp.client_name && ` (client : ${exp.client_name})`}</span>
                </div>
                <div style={{ fontSize: '.72rem', color: '#475569', display: 'flex', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
                  <span><Calendar size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{period}</span>
                  {exp.location && <span><MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{exp.location}</span>}
                  {exp.sector && <span>· {exp.sector}</span>}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                <button onClick={() => openEdit(exp)} style={iconBtn} title="Modifier">✏️</button>
                <button onClick={() => remove(exp.id)} style={{ ...iconBtn, color: '#ef4444' }} title="Supprimer"><Trash2 size={13} /></button>
                <button onClick={() => setExpanded(isOpen ? null : exp.id)} style={iconBtn}>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            {/* Detail expanded */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(148,163,184,.06)', padding: '10px 14px 12px', display: 'grid', gap: 10 }}>
                {exp.context && <p style={{ margin: 0, fontSize: '.78rem', color: '#94a3b8', fontStyle: 'italic' }}>"{exp.context}"</p>}
                <p style={{ margin: 0, fontSize: '.78rem', color: '#64748b', lineHeight: 1.6 }}>{exp.description}</p>

                {achiev.length > 0 && (
                  <div>
                    <div style={sectionLabel}>Réalisations</div>
                    {achiev.map((a, i) => (
                      <div key={i} style={{ fontSize: '.75rem', color: '#94a3b8', padding: '2px 0', display: 'flex', gap: 6 }}>
                        <span style={{ color: '#22c55e', flexShrink: 0 }}>✓</span> {a}
                      </div>
                    ))}
                  </div>
                )}

                {techs.length > 0 && (
                  <div>
                    <div style={sectionLabel}>Technologies</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {techs.map(t => (
                        <span key={t} style={{ padding: '2px 8px', borderRadius: 6, fontSize: '.7rem', background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.15)', color: '#93c5fd' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function Field({ label, value, onChange, placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <label style={{ fontSize: '.7rem', fontWeight: 700, color: '#64748b', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.18)', background: 'rgba(15,23,42,.6)', color: '#e2e8f0', fontSize: '.8rem', outline: 'none', boxSizing: 'border-box', opacity: disabled ? .4 : 1 }} />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, rows }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <label style={{ fontSize: '.7rem', fontWeight: 700, color: '#64748b', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows || 3}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(148,163,184,.18)', background: 'rgba(15,23,42,.6)', color: '#e2e8f0', fontSize: '.8rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }} />
    </div>
  );
}

const primaryBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(250,204,21,.3)', background: 'rgba(250,204,21,.08)', color: '#facc15', cursor: 'pointer', fontWeight: 700, fontSize: '.8rem', marginLeft: 'auto' };
const ghostBtn:   React.CSSProperties = { padding: '7px 13px', borderRadius: 8, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.78rem', fontWeight: 600 };
const iconBtn:    React.CSSProperties = { width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(148,163,184,.1)', background: 'none', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' };
const sectionLabel: React.CSSProperties = { fontSize: '.65rem', fontWeight: 800, color: '#475569', letterSpacing: '.08em', textTransform: 'uppercase' as const, marginBottom: 5 };
