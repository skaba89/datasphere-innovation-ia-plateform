import EmptyState from '../components/EmptyState';
import { useI18n } from '../i18n/index';
/**
 * InvoicingPage — Devis & Facturation premium
 */
import { useEffect, useState, useCallback } from 'react';
import {
  ArrowRight, CheckCircle2, Clock, Download, Euro,
  FileText, FilePlus, Plus, RefreshCw, TrendingUp,
  AlertTriangle, Receipt, ChevronRight, Sparkles,
} from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

type Tab = 'overview' | 'quotes' | 'invoices' | 'new-quote' | 'new-invoice';

interface Stats {
  quotes_total: number; quotes_ht: number;
  invoices_pending: number; invoices_pending_ttc: number;
  invoices_paid: number; invoices_paid_ttc: number;
  invoices_overdue: number;
}
interface Quote   { id:number; reference:string; title:string; client_name:string; status:string; amount_ht:number; amount_ttc:number; valid_until?:string; created_at:string; }
interface Invoice { id:number; reference:string; title:string; client_name:string; status:string; amount_ht:number; amount_ttc:number; due_date?:string; paid_at?:string; created_at:string; }

const QUOTE_STATUS: Record<string, {label:string; color:string; bg:string}> = {
  draft:     { label: 'Brouillon',  color: '#64748b', bg: 'rgba(100,116,139,.08)' },
  sent:      { label: 'Envoyé',    color: '#3b82f6', bg: 'rgba(59,130,246,.08)'  },
  accepted:  { label: 'Accepté',   color: '#22c55e', bg: 'rgba(34,197,94,.08)'   },
  rejected:  { label: 'Refusé',    color: '#ef4444', bg: 'rgba(239,68,68,.08)'   },
  converted: { label: 'Converti',  color: '#8b5cf6', bg: 'rgba(139,92,246,.08)'  },
};
const INVOICE_STATUS: Record<string, {label:string; color:string; bg:string}> = {
  draft:     { label: 'Brouillon',  color: '#64748b', bg: 'rgba(100,116,139,.08)' },
  sent:      { label: 'Émise',     color: '#3b82f6', bg: 'rgba(59,130,246,.08)'  },
  paid:      { label: 'Payée',     color: '#22c55e', bg: 'rgba(34,197,94,.08)'   },
  overdue:   { label: 'En retard', color: '#ef4444', bg: 'rgba(239,68,68,.08)'   },
  cancelled: { label: 'Annulée',   color: '#94a3b8', bg: 'rgba(148,163,184,.08)' },
};

function fmtEur(n: number) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n); }
function fmtDate(s?: string) { return s ? new Date(s).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'2-digit' }) : '—'; }

function StatusBadge({ status, map }: { status: string; map: Record<string, {label:string;color:string;bg:string}> }) {
  const cfg = map[status] ?? { label: status, color: '#64748b', bg: 'rgba(100,116,139,.08)' };
  return <span style={{ fontSize: '.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}25`, whiteSpace: 'nowrap' }}>{cfg.label}</span>;
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label:string; value:string; sub?:string; color:string }) {
  return (
    <div style={{ background: 'rgba(12,22,45,.85)', border: `1px solid ${color}15`, borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, backdropFilter: 'blur(24px)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}12`, border: `1px solid ${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-.04em', color: '#f1f5f9' }}>{value}</div>
        <div style={{ fontSize: '.74rem', color: '#475569', marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: '.7rem', color: '#334155', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Formulaire devis ──────────────────────────────────────────────────────────
function QuoteForm({ token, onSaved }: { token: string|null; onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', client_name: '', client_email: '', client_address: '', daily_rate: '', days_count: '', tva_rate: '20', notes: '', valid_until: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const ht  = parseFloat(form.daily_rate || '0') * parseFloat(form.days_count || '0');
  const ttc = ht * (1 + parseFloat(form.tva_rate || '20') / 100);

  async function submit() {
    if (!form.title || !form.client_name) { setError('Titre et client requis.'); return; }
    setSaving(true); setError(null);
    try {
      await apiRequest('/invoices/quotes', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          daily_rate: parseFloat(form.daily_rate) || null,
          days_count: parseFloat(form.days_count) || null,
          tva_rate: parseFloat(form.tva_rate),
          amount_ht: ht,
        }),
      }, token);
      onSaved();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 13px', borderRadius: 9, border: '1.5px solid rgba(148,163,184,.15)', background: 'rgba(255,255,255,.04)', color: '#f1f5f9', fontSize: '.86rem', outline: 'none', boxSizing: 'border-box' as const };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '.72rem', fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '.05em' };

  return (
    <div style={{ maxWidth: '100%', display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>Intitulé de la mission *</label>
          <input style={inp} value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Mission Data Engineering — Client XYZ" />
        </div>
        <div>
          <label style={lbl}>Nom du client *</label>
          <input style={inp} value={form.client_name} onChange={e => setForm(f=>({...f,client_name:e.target.value}))} placeholder="SACEM / Thales Group" />
        </div>
        <div>
          <label style={lbl}>Email client</label>
          <input style={inp} type="email" value={form.client_email} onChange={e => setForm(f=>({...f,client_email:e.target.value}))} placeholder="achat@client.fr" />
        </div>
        <div>
          <label style={lbl}>TJM (€ HT / jour)</label>
          <input style={inp} type="number" value={form.daily_rate} onChange={e => setForm(f=>({...f,daily_rate:e.target.value}))} placeholder="750" />
        </div>
        <div>
          <label style={lbl}>Nombre de jours</label>
          <input style={inp} type="number" value={form.days_count} onChange={e => setForm(f=>({...f,days_count:e.target.value}))} placeholder="20" />
        </div>
        <div>
          <label style={lbl}>TVA (%)</label>
          <select style={{ ...inp }} value={form.tva_rate} onChange={e => setForm(f=>({...f,tva_rate:e.target.value}))}>
            <option value="0">0% (exonéré)</option>
            <option value="20">20% (standard)</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Valable jusqu'au</label>
          <input style={inp} type="date" value={form.valid_until} onChange={e => setForm(f=>({...f,valid_until:e.target.value}))} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>{lang === 'en' ? 'Client address' : 'Adresse client'}</label>
          <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' as const }} value={form.client_address} onChange={e => setForm(f=>({...f,client_address:e.target.value}))} placeholder="10 rue de la Paix, 75001 Paris" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={lbl}>Notes & conditions</label>
          <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' as const }} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder={lang === "en" ? "Payment terms, conditions, etc." : "Conditions de paiement, modalités, etc."} />
        </div>
      </div>

      {/* Aperçu montant */}
      {ht > 0 && (
        <div style={{ display: 'flex', gap: 20, padding: '14px 18px', background: 'rgba(250,204,21,.05)', border: '1px solid rgba(250,204,21,.15)', borderRadius: 12 }}>
          <div><div style={{ fontSize: '.72rem', color: '#64748b' }}>Montant HT</div><div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{fmtEur(ht)}</div></div>
          <div style={{ width: 1, background: 'rgba(148,163,184,.1)' }} />
          <div><div style={{ fontSize: '.72rem', color: '#64748b' }}>TVA ({form.tva_rate}%)</div><div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{fmtEur(ttc - ht)}</div></div>
          <div style={{ width: 1, background: 'rgba(148,163,184,.1)' }} />
          <div><div style={{ fontSize: '.72rem', color: '#facc15', fontWeight: 700 }}>Total TTC</div><div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#facc15' }}>{fmtEur(ttc)}</div></div>
        </div>
      )}

      {error && <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: '.82rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSaved} style={{ padding: '10px 18px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.84rem' }}>Annuler</button>
        <button onClick={submit} disabled={saving || !form.title || !form.client_name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060d1a', cursor: 'pointer', fontWeight: 800, fontSize: '.86rem', opacity: (!form.title || !form.client_name) ? .5 : 1 }}>
          {saving ? <RefreshCw size={13} style={{ animation: 'invSpin .7s linear infinite' }} /> : <FilePlus size={13} />}
          {saving ? 'Création…' : 'Créer le devis'}
        </button>
      </div>
    </div>
  );
}

// ── Liste documents ───────────────────────────────────────────────────────────
function DocRow({ doc, type, token, onRefresh }: { doc: Quote|Invoice; type: 'quote'|'invoice'; token: string|null; onRefresh: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [converting, setConverting] = useState(false);

  async function exportPdf() {
    setExporting(true);
    try {
      const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const endpoint = type === 'quote' ? `/invoices/quotes/${doc.id}/export` : `/invoices/invoices/${doc.id}/export`;
      const resp = await fetch(`${API}${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const ct = resp.headers.get('content-type') || '';
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = ct.includes('pdf') ? `${(doc as any).reference}.pdf` : `${(doc as any).reference}.html`;
      a.click(); URL.revokeObjectURL(url);
    } catch { }
    finally { setExporting(false); }
  }

  async function convertToInvoice() {
    setConverting(true);
    try {
      await apiRequest(`/invoices/quotes/${doc.id}/convert`, { method: 'POST' }, token);
      onRefresh();
    } catch { }
    finally { setConverting(false); }
  }

  const statusMap = type === 'quote' ? QUOTE_STATUS : INVOICE_STATUS;
  const d = doc as any;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(148,163,184,.06)', borderRadius: 12, transition: 'background .15s', flexWrap: 'wrap' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
    >
      <div style={{ fontSize: '.7rem', color: '#334155', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, minWidth: 100 }}>{d.reference}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '.84rem', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
        <div style={{ fontSize: '.72rem', color: '#475569', marginTop: 1 }}>{d.client_name} · {fmtDate(d.created_at)}</div>
      </div>
      <StatusBadge status={d.status} map={statusMap} />
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 100 }}>
        <div style={{ fontSize: '.84rem', fontWeight: 800, color: '#f1f5f9' }}>{fmtEur(d.amount_ttc)}</div>
        <div style={{ fontSize: '.7rem', color: '#475569' }}>TTC</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
        {type === 'quote' && d.status === 'accepted' && (
          <button onClick={convertToInvoice} disabled={converting} title={lang === "en" ? "Convert to invoice" : "Convertir en facture"}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(139,92,246,.25)', background: 'rgba(139,92,246,.08)', color: '#c4b5fd', cursor: 'pointer', fontSize: '.74rem', fontWeight: 600 }}>
            <ArrowRight size={11} /> Facturer
          </button>
        )}
        <button onClick={exportPdf} disabled={exporting} title="Exporter PDF"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.74rem' }}>
          {exporting ? <RefreshCw size={11} style={{ animation: 'invSpin .7s linear infinite' }} /> : <Download size={11} />}
          PDF
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function InvoicingPage() {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [tab, setTab]         = useState<Tab>('overview');
  const [stats, setStats]     = useState<Stats | null>(null);
  const [quotes, setQuotes]   = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, q, i] = await Promise.all([
        apiRequest<Stats>('/invoices/stats', {}, token),
        apiRequest<Quote[]>('/invoices/quotes?limit=20', {}, token),
        apiRequest<Invoice[]>('/invoices/invoices?limit=20', {}, token),
      ]);
      setStats(s); setQuotes(Array.isArray(q)?q:[]); setInvoices(Array.isArray(i)?i:[]);
    } catch { }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const tabBtn = (t: Tab, label: string, Icon: React.ElementType) => (
    <button onClick={() => setTab(t)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: `1px solid ${tab===t?'rgba(250,204,21,.25)':'rgba(148,163,184,.1)'}`, background: tab===t?'rgba(250,204,21,.07)':'none', color: tab===t?'#facc15':'#64748b', cursor: 'pointer', fontSize: '.82rem', fontWeight: tab===t?700:600, transition: 'all .15s' }}>
      <Icon size={13} /> {label}
    </button>
  );

  return (
    <div style={{ padding: 'clamp(20px,3vw,40px) clamp(16px,3vw,40px)', maxWidth: 1100, display: 'grid', gap: 20 }}>
      <style>{`@keyframes invSpin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#facc15', marginBottom: 8 }}>Gestion commerciale</div>
          <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, letterSpacing: '-.04em', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Receipt size={24} color="#facc15" /> Devis & Facturation
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, border: '1px solid rgba(148,163,184,.12)', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '.8rem' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'invSpin .7s linear infinite' : 'none' }} />
          </button>
          {tabBtn('new-quote',   t('invoicing.new_quote'),    FilePlus)}
          {tabBtn('new-invoice', t('invoicing.new_invoice'), Plus)}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tabBtn('overview',  'Vue d\'ensemble', TrendingUp)}
        {tabBtn('quotes',    t('invoicing.quotes'),           FileText)}
        {tabBtn('invoices',  t('invoicing.invoices'),        Receipt)}
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            <KpiCard icon={FileText}     label="Devis créés"          value={String(stats.quotes_total)}       color="#3b82f6" sub={fmtEur(stats.quotes_ht) + ' HT total'} />
            <KpiCard icon={Clock}        label="Factures en attente"  value={String(stats.invoices_pending)}   color="#f59e0b" sub={fmtEur(stats.invoices_pending_ttc) + ' TTC'} />
            <KpiCard icon={CheckCircle2} label="Factures payées"      value={String(stats.invoices_paid)}      color="#22c55e" sub={fmtEur(stats.invoices_paid_ttc) + ' TTC encaissés'} />
            <KpiCard icon={AlertTriangle}label="Factures en retard"   value={String(stats.invoices_overdue)}   color="#ef4444" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Derniers devis */}
            <div style={{ background: 'rgba(10,18,38,.85)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={14} color="#3b82f6" />
                <span style={{ fontWeight: 700, fontSize: '.86rem' }}>{lang === 'en' ? 'Latest quotes' : 'Derniers devis'}</span>
                <button onClick={() => setTab('quotes')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#facc15', cursor: 'pointer', fontSize: '.74rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>Voir tout <ChevronRight size={11} /></button>
              </div>
              <div style={{ padding: '8px 12px', display: 'grid', gap: 4 }}>
                {quotes.slice(0, 4).map(q => (
                  <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#e2e8f0' }}>{q.title.slice(0,35)}</div>
                      <div style={{ fontSize: '.7rem', color: '#475569' }}>{q.client_name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge status={q.status} map={QUOTE_STATUS} />
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#facc15' }}>{fmtEur(q.amount_ttc)}</span>
                    </div>
                  </div>
                ))}
                {quotes.length === 0 && <p style={{ padding: '12px 6px', color: '#334155', fontSize: '.82rem' }}><EmptyState
              icon="💶"
              title={lang === "en" ? "No billing documents" : "Aucun document de facturation"}
              description="Créez votre premier devis depuis une mission ou un AO remporté. Il sera converti en facture une fois validé."
              action={{ label: '+ Nouveau devis', onClick: () => {} }}
              compact
            /> encore.</p>}
              </div>
            </div>
            {/* Dernières factures */}
            <div style={{ background: 'rgba(10,18,38,.85)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(148,163,184,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Receipt size={14} color="#22c55e" />
                <span style={{ fontWeight: 700, fontSize: '.86rem' }}>{lang === 'en' ? 'Latest invoices' : 'Dernières factures'}</span>
                <button onClick={() => setTab('invoices')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#facc15', cursor: 'pointer', fontSize: '.74rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>Voir tout <ChevronRight size={11} /></button>
              </div>
              <div style={{ padding: '8px 12px', display: 'grid', gap: 4 }}>
                {invoices.slice(0, 4).map(inv => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 6px', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#e2e8f0' }}>{inv.title.slice(0,35)}</div>
                      <div style={{ fontSize: '.7rem', color: '#475569' }}>{inv.client_name} {inv.due_date ? `· échéance ${fmtDate(inv.due_date)}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusBadge status={inv.status} map={INVOICE_STATUS} />
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#facc15' }}>{fmtEur(inv.amount_ttc)}</span>
                    </div>
                  </div>
                ))}
                {invoices.length === 0 && <p style={{ padding: '12px 6px', color: '#334155', fontSize: '.82rem' }}><EmptyState
              icon="💶"
              title={lang === "en" ? "No billing documents" : "Aucun document de facturation"}
              description="Créez votre premier devis depuis une mission ou un AO remporté. Il sera converti en facture une fois validé."
              action={{ label: '+ Nouveau devis', onClick: () => {} }}
              compact
            /> encore.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'quotes' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {quotes.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#334155' }}>
              <Sparkles size={32} style={{ margin: '0 auto 12px', opacity: .2 }} />
              <p style={{ margin: 0, fontSize: '.88rem' }}>{lang === 'en' ? 'No quotes yet — create one to get started.' : 'Aucun devis — créez-en un pour commencer.'}</p>
            </div>
          ) : quotes.map(q => <DocRow key={q.id} doc={q} type="quote" token={token} onRefresh={load} />)}
        </div>
      )}

      {tab === 'invoices' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {invoices.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#334155' }}>
              <Receipt size={32} style={{ margin: '0 auto 12px', opacity: .2 }} />
              <p style={{ margin: 0, fontSize: '.88rem' }}>Aucune facture — convertissez un devis ou créez directement.</p>
            </div>
          ) : invoices.map(i => <DocRow key={i.id} doc={i} type="invoice" token={token} onRefresh={load} />)}
        </div>
      )}

      {tab === 'new-quote' && (
        <div style={{ background: 'rgba(10,18,38,.85)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 16, padding: '24px 28px' }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilePlus size={16} color="#facc15" /> Nouveau devis
          </h2>
          <QuoteForm token={token} onSaved={() => { load(); setTab('quotes'); }} />
        </div>
      )}

      {tab === 'new-invoice' && (
        <div style={{ background: 'rgba(10,18,38,.85)', border: '1px solid rgba(148,163,184,.08)', borderRadius: 16, padding: '24px 28px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 800 }}>Nouvelle facture</h2>
          <p style={{ color: '#64748b', fontSize: '.84rem', marginBottom: 20 }}>
            Recommandé : créez d&apos;abord un devis et convertissez-le en facture.
            Ou créez directement depuis <strong style={{ color: '#94a3b8' }}>Devis → Accepté → Facturer</strong>.
          </p>
          <button onClick={() => setTab('new-quote')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, border: 'none', background: '#facc15', color: '#060d1a', cursor: 'pointer', fontWeight: 800, fontSize: '.86rem' }}>
            <FilePlus size={14} /> Créer un devis d&apos;abord
          </button>
        </div>
      )}
    </div>
  );
}
