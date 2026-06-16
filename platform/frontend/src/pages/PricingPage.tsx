import { useI18n } from '../i18n/index';
/**
 * PricingPage — Plans et abonnements DataSphere
 *
 * Design : Noir & Or, luxury SaaS B2B
 * Layout : Header + 4 cards + FAQ + CTA
 * Logic  : Fetch plans from API, trigger Stripe checkout or mock upgrade
 */

import { useEffect, useState } from 'react';
import { Check, ChevronRight, Shield, Sparkles, Zap } from 'lucide-react';
import { apiRequest, tokenStorage } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanLimit { members: number; tenders: number; deliverables: number; ai_actions: number }
interface Plan {
  key:          string;
  label:        string;
  price_eur:    number;
  billing_note: string;
  highlight:    boolean;
  features:     string[];
  limits:       PlanLimit;
}

interface Props {
  workspaceId?: number;
  currentPlan?: string;
  onSuccess?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n === -1 ? '∞' : n.toLocaleString('fr-FR');

// ─── Component ────────────────────────────────────────────────────────────────

export default function PricingPage({ workspaceId, currentPlan = 'free', onSuccess }: Props) {
  const { t, lang } = useI18n();
  const token = tokenStorage.get();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [showEmailFor, setShowEmailFor] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ plans: Plan[]; stripe_enabled: boolean }>('/billing/plans', {})
      .then(d => { setPlans(d.plans); setStripeEnabled(d.stripe_enabled); })
      .catch(() => setError('Impossible de charger les plans'))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(planKey: string) {
    if (planKey === 'free' || planKey === currentPlan) return;
    if (planKey === 'enterprise') {
      window.open('mailto:hello@datasphere-innovation.fr?subject=Plan Entreprise', '_blank');
      return;
    }

    setError(null);

    if (!stripeEnabled) {
      // Demo mode: mock upgrade
      setCheckingOut(planKey);
      try {
        await apiRequest('/billing/mock-upgrade', {
          method: 'POST',
          body: JSON.stringify({ workspace_id: workspaceId ?? 1, plan: planKey }),
        }, token);
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally { setCheckingOut(null); }
      return;
    }

    // Stripe mode: need email first
    if (!email) { setShowEmailFor(planKey); return; }
    setCheckingOut(planKey);

    try {
      const res = await apiRequest<{ url: string }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId ?? 1,
          plan: planKey,
          billing_cycle: cycle,
          customer_email: email,
        }),
      }, token);
      window.location.href = res.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur paiement');
    } finally { setCheckingOut(null); setShowEmailFor(null); }
  }

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const gold = '#facc15';
  const s = {
    page: {
      minHeight: '100vh',
      padding: 'clamp(32px,5vw,64px) clamp(16px,4vw,40px)',
      maxWidth: 1160,
      margin: '0 auto',
    } as React.CSSProperties,
    toggle: {
      display: 'inline-flex',
      background: 'rgba(255,255,255,.05)',
      border: '1px solid rgba(148,163,184,.12)',
      borderRadius: 99,
      padding: 4,
      gap: 4,
    } as React.CSSProperties,
    toggleBtn: (active: boolean): React.CSSProperties => ({
      padding: '7px 18px', borderRadius: 99, border: 'none', cursor: 'pointer',
      fontWeight: 700, fontSize: '.82rem', fontFamily: 'Syne, sans-serif',
      background: active ? gold : 'transparent',
      color: active ? '#060e18' : '#64748b',
      transition: 'all .2s',
    }),
    card: (highlighted: boolean, isCurrent: boolean): React.CSSProperties => ({
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      padding: 'clamp(22px,3vw,32px)',
      borderRadius: 20,
      border: `1px solid ${highlighted ? 'rgba(250,204,21,.4)' : isCurrent ? 'rgba(34,197,94,.3)' : 'rgba(148,163,184,.12)'}`,
      background: highlighted
        ? 'linear-gradient(135deg, rgba(250,204,21,.06), rgba(245,158,11,.03))'
        : 'rgba(12,20,37,.9)',
      backdropFilter: 'blur(12px)',
      boxShadow: highlighted ? '0 0 60px rgba(250,204,21,.08)' : 'none',
      transition: 'transform .2s, box-shadow .2s',
    }),
    badge: {
      position: 'absolute' as const,
      top: -12, left: '50%', transform: 'translateX(-50%)',
      background: gold, color: '#060e18',
      padding: '3px 14px', borderRadius: 99,
      fontSize: '.72rem', fontWeight: 900, letterSpacing: '.06em', whiteSpace: 'nowrap' as const,
      fontFamily: 'Syne, sans-serif',
    },
    price: {
      display: 'flex', alignItems: 'baseline', gap: 4,
      margin: '20px 0 24px',
    } as React.CSSProperties,
    btn: (highlighted: boolean, disabled: boolean): React.CSSProperties => ({
      width: '100%', padding: '12px', marginTop: 'auto', paddingTop: 12,
      border: highlighted ? 'none' : '1px solid rgba(148,163,184,.2)',
      borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 800, fontSize: '.88rem', fontFamily: 'Syne, sans-serif',
      background: highlighted ? gold : 'rgba(255,255,255,.05)',
      color: highlighted ? '#060e18' : '#94a3b8',
      opacity: disabled ? .5 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'opacity .15s',
    }),
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0', color: '#64748b' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid #facc15', borderTopColor: 'transparent', animation: 'ds-spin .7s linear infinite' }} />
      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: 'rgba(250,204,21,.08)', border: '1px solid rgba(250,204,21,.2)', borderRadius: 99, marginBottom: 18 }}>
          <Sparkles size={12} color={gold} />
          <span style={{ fontSize: '.74rem', color: '#fde68a', fontWeight: 700, letterSpacing: '.06em', fontFamily: 'monospace' }}>PLANS & TARIFS</span>
        </div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: 'clamp(1.8rem,5vw,3rem)', margin: '0 0 14px', letterSpacing: '-.04em', lineHeight: 1 }}>
          Choisissez votre plan
        </h1>
        <p style={{ color: '#64748b', fontSize: 'clamp(.9rem,2vw,1rem)', maxWidth: 480, margin: '0 auto 28px' }}>
          Commencez gratuitement. Passez au Pro quand votre activité décolle.
        </p>

        {/* Billing toggle */}
        <div style={s.toggle}>
          <button style={s.toggleBtn(cycle === 'monthly')} onClick={() => setCycle('monthly')}>Mensuel</button>
          <button style={s.toggleBtn(cycle === 'yearly')} onClick={() => setCycle('yearly')}>
            Annuel
            <span style={{ marginLeft: 6, fontSize: '.68rem', background: 'rgba(34,197,94,.15)', color: '#86efac', padding: '1px 6px', borderRadius: 99 }}>-20%</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, color: '#fca5a5', fontSize: '.83rem', marginBottom: 24, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Plans grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%), 1fr))', gap: 20, marginBottom: 48 }}>
        {plans.map(plan => {
          const isCurrent = plan.key === currentPlan;
          const isChecking = checkingOut === plan.key;
          const yearlyPrice = plan.price_eur > 0 ? Math.round(plan.price_eur * 0.8) : plan.price_eur;
          const displayPrice = cycle === 'yearly' ? yearlyPrice : plan.price_eur;
          const isEnterprise = plan.key === 'enterprise';

          return (
            <div key={plan.key} style={s.card(plan.highlight, isCurrent)}>
              {plan.highlight && <div style={s.badge}>⭐ Recommandé</div>}
              {isCurrent && !plan.highlight && (
                <div style={{ ...s.badge, background: 'rgba(34,197,94,.2)', color: '#86efac', border: '1px solid rgba(34,197,94,.3)' }}>
                  Plan actuel
                </div>
              )}

              <div>
                <div style={{ fontSize: '.72rem', color: '#64748b', fontWeight: 700, letterSpacing: '.08em', fontFamily: 'monospace', textTransform: 'uppercase' }}>{plan.key}</div>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.2rem', margin: '4px 0 0', color: plan.highlight ? gold : '#f1f5f9' }}>
                  {plan.label}
                </h3>
              </div>

              <div style={s.price}>
                {isEnterprise ? (
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#64748b' }}>Sur devis</span>
                ) : displayPrice === 0 ? (
                  <span style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'Syne, sans-serif' }}>Gratuit</span>
                ) : (
                  <>
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, fontFamily: 'Syne, sans-serif', color: plan.highlight ? gold : '#f1f5f9' }}>
                      {displayPrice}€
                    </span>
                    <span style={{ color: '#475569', fontSize: '.82rem' }}>{plan.billing_note}</span>
                  </>
                )}
              </div>

              {/* Limits */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 6, marginBottom: 20, padding: '12px', background: 'rgba(0,0,0,.2)', borderRadius: 10 }}>
                {[
                  { label: 'Membres',      v: plan.limits.members },
                  { label: 'AO/mois',      v: plan.limits.tenders },
                  { label: 'Livrables',    v: plan.limits.deliverables },
                  { label: 'Actions IA',   v: plan.limits.ai_actions },
                ].map(l => (
                  <div key={l.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 900, fontSize: '1rem', color: plan.highlight ? gold : '#e2e8f0', fontFamily: 'Syne, sans-serif' }}>{fmt(l.v)}</div>
                    <div style={{ fontSize: '.66rem', color: '#475569' }}>{l.label}</div>
                  </div>
                ))}
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gap: 8, flex: 1 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: '.82rem', color: '#94a3b8' }}>
                    <Check size={13} color={plan.highlight ? gold : '#22c55e'} style={{ flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Email input for Stripe */}
              {showEmailFor === plan.key && (
                <div style={{ marginBottom: 12, display: 'grid', gap: 8 }}>
                  <input
                    type="email"
                    placeholder="votre@email.fr"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(148,163,184,.2)', borderRadius: 9, color: '#f1f5f9', fontSize: '.85rem', outline: 'none', width: '100%' }}
                    autoFocus
                  />
                </div>
              )}

              <button
                style={s.btn(plan.highlight, isCurrent && !isEnterprise)}
                onClick={() => {
                  if (isCurrent || plan.key === 'free') return;
                  if (showEmailFor === plan.key) { handleUpgrade(plan.key); return; }
                  if (plan.key === 'enterprise') { handleUpgrade(plan.key); return; }
                  if (stripeEnabled) { setShowEmailFor(plan.key); } else { handleUpgrade(plan.key); }
                }}
                disabled={isCurrent || isChecking}
              >
                {isChecking ? (
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(0,0,0,.3)', borderTopColor: '#060e18', animation: 'ds-spin .7s linear infinite' }} />
                ) : null}
                {isCurrent ? t('pricing.current') :
                  plan.key === 'free' ? 'Commencer gratuit' :
                  isEnterprise ? t('pricing.contact') :
                  showEmailFor === plan.key ? 'Procéder au paiement →' :
                  stripeEnabled ? `Passer au ${plan.label}` : `Activer ${plan.label} (demo)`}
                {!isCurrent && !isChecking && !isEnterprise && <ChevronRight size={14} />}
              </button>
            </div>
          );
        })}
      </div>

      {/* Trust badges */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(16px,4vw,40px)', flexWrap: 'wrap', marginBottom: 48 }}>
        {[
          { icon: Shield, text: 'Paiement sécurisé Stripe' },
          { icon: Zap,    text: 'Activation instantanée' },
          { icon: Check,  text: 'Résiliation à tout moment' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: '.82rem' }}>
            <Icon size={14} color="#64748b" /> {text}
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem', marginBottom: 20, textAlign: 'center' }}>Questions fréquentes</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {[
            { q: 'Puis-je changer de plan à tout moment ?', a: 'Oui, le changement est immédiat. Vous êtes crédité au prorata si vous réduisez votre plan.' },
            { q: 'Qu\'arrive-t-il à mes données si j\'annule ?', a: 'Vos données sont conservées 30 jours après annulation. Vous pouvez exporter tout à tout moment.' },
            { q: 'Les prix incluent-ils la TVA ?', a: 'Non, les prix affichés sont HT. La TVA (20%) s\'ajoute pour les clients français.' },
            { q: 'Le plan Gratuit a-t-il une limite de temps ?', a: 'Non, le plan Gratuit est permanent. Pas de carte bancaire requise.' },
          ].map(({ q, a }) => (
            <details key={q} style={{ background: 'rgba(12,20,37,.9)', border: '1px solid rgba(148,163,184,.1)', borderRadius: 12, padding: '14px 18px' }}>
              <summary style={{ fontWeight: 700, fontSize: '.88rem', cursor: 'pointer', color: '#e2e8f0', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {q} <ChevronRight size={14} style={{ flexShrink: 0, color: '#64748b' }} />
              </summary>
              <p style={{ margin: '10px 0 0', color: '#64748b', fontSize: '.83rem', lineHeight: 1.6 }}>{a}</p>
            </details>
          ))}
        </div>
      </div>

      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
