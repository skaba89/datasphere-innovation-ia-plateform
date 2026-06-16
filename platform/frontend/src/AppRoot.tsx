
import React from 'react';
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#fca5a5', fontWeight: 700 }}>Une erreur est survenue</p>
        <p style={{ color: '#64748b', fontSize: '.82rem' }}>{this.state.error.message}</p>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1e40af', color: 'white', cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>
    );
    return this.props.children;
  }
}

import { useEffect, useState } from 'react';
import {
  Brain, LayoutDashboard, Target, FileText, Briefcase, Building2, TrendingUp,
  Settings, Download, Share2, UserCheck, Bell, Search, Zap, Users, Shield,
  Layers, UserCircle, LogOut, ChevronLeft, Menu, X, ChevronRight,
} from 'lucide-react';

import { apiRequest, tokenStorage } from './api/client';
import { getUserName } from './api/userContext';
import type { CurrentUser, LoginResult } from './api/authTypes';
import { can, type AppPermission } from './auth/rbac';

import AuditLogPage from './pages/AuditLogPage';
import CommercialPage from './pages/CommercialPage';
import ConsultantProfilesPage from './pages/ConsultantProfilesPage';
import NotificationsPage from './pages/NotificationsPage';
import SearchPage from './pages/SearchPage';
import AIProvidersPage from './pages/AIProvidersPage';
import IntelligencePage from './pages/IntelligencePage';
import DashboardPage from './pages/DashboardPage';
import DeliverablePage from './pages/DeliverablePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import OperationsPage from './pages/OperationsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TeamPage from './pages/TeamPage';
import TenderPage from './pages/TenderPage';
import UserProfilePage from './pages/UserProfilePage';
import WorkspacesPage from './pages/WorkspacesPage';
import WorkspaceSwitcher from './components/WorkspaceSwitcher';
import SettingsPage from './pages/SettingsPage';
import CalculatorPage from './pages/CalculatorPage';
import InvoicingPage from './pages/InvoicingPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PricingPage from './pages/PricingPage';
import DataExportPage from './pages/DataExportPage';
import LinkedInAgentPage from './pages/LinkedInAgentPage';
import OnboardingWizard, { shouldShowOnboarding, markOnboardingDone } from './components/OnboardingWizard';
import ToastContainer from './components/ToastContainer';
import { LangToggle, useI18n } from './i18n';
import { useRealtimeToasts } from './hooks/useRealtimeToasts';
import { useWorkflowSSE } from './hooks/useWorkflowSSE';
import type { ToastEvent } from './hooks/useRealtimeToasts';
import { CrmWorkspace } from './components/CrmWorkspace';
import GlobalSearchBar from './components/GlobalSearchBar';
import NotificationBell from './components/NotificationBell';
import NotificationsPanel from './components/NotificationsPanel';

import './root.css';

type AuthView = 'login' | 'forgot' | 'reset';
type RootView =
  | 'dashboard'
  | 'organizations'
  | 'opportunities'
  | 'tenders'
  | 'profiles'
  | 'deliverables'
  | 'commercial'
  | 'operations'
  | 'team'
  | 'audit'
  | 'profile'
  | 'workspaces'
  | 'data-export'
  | 'linkedin'
  | 'consultant-profiles'
  | 'notifications'
  | 'search'
  | 'ai-providers'
  | 'intelligence'
  | 'settings'
  | 'calculator'
  | 'pricing'
  | 'invoicing'
  | 'analytics';

type NavTab = {
  key: RootView;
  label: string;
  permission: AppPermission;
};


// ── Écran changement MDP forcé (première connexion) ──────────────────────────
function ForcePasswordChange({
  token, user, onChanged,
}: {
  token: string;
  user: CurrentUser;
  onChanged: () => void;
}) {
  const [current, setCurrent]   = useState('');
  const [newPwd,  setNewPwd]    = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  const checks = [
    { label: '8+ caractères',      ok: newPwd.length >= 8 },
    { label: lang === 'en' ? 'Uppercase' : 'Majuscule',          ok: /[A-Z]/.test(newPwd) },
    { label: lang === 'en' ? 'Number' : 'Chiffre',            ok: /\d/.test(newPwd) },
    { label: lang === 'en' ? 'Special char' : 'Caractère spécial',  ok: /[^A-Za-z0-9]/.test(newPwd) },
  ];
  const strength = checks.filter(c => c.ok).length;
  const strengthColor = strength <= 1 ? '#ef4444' : strength <= 2 ? '#f59e0b' : strength <= 3 ? '#22c55e' : '#4ade80';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPwd !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (strength < 2)       { setError("Mot de passe trop faible."); return; }
    setSaving(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: newPwd }),
      }, token);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mot de passe actuel incorrect.');
    } finally { setSaving(false); }
  }

  const inp = (focused: boolean): React.CSSProperties => ({
    width: '100%', padding: '12px 16px',
    background: 'rgba(255,255,255,.04)',
    border: `1.5px solid ${focused ? 'rgba(250,204,21,.4)' : 'rgba(148,163,184,.12)'}`,
    borderRadius: 11, color: '#f1f5f9', fontSize: '.9rem', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'Inter, sans-serif',
    boxShadow: focused ? '0 0 0 3px rgba(250,204,21,.08)' : 'none',
  });

  const displayName = user.first_name
    ? user.first_name
    : user.email.split('@')[0];

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(12px,4vw,24px)', background: '#060d1a', position: 'relative', overflow: 'hidden',
    }}>
      {/* Glows */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(37,99,235,.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(250,204,21,.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1, animation: 'fpcFadeUp .4s cubic-bezier(0,0,.2,1) both', boxSizing: 'border-box' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(250,204,21,.2), rgba(250,204,21,.06))',
            border: '1.5px solid rgba(250,204,21,.3)', marginBottom: 18,
            boxShadow: '0 8px 32px rgba(250,204,21,.15)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div style={{ fontSize: '.68rem', fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(250,204,21,.7)', marginBottom: 10 }}>
            Première connexion
          </div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 900, letterSpacing: '-.04em', color: '#f1f5f9', lineHeight: 1.1, margin: '0 0 10px' }}>
            Bienvenue, {displayName} 👋
          </h1>
          <p style={{ color: '#475569', fontSize: '.85rem', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
            Pour des raisons de sécurité, vous devez définir un nouveau mot de passe personnel avant d&apos;accéder à la plateforme.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(12,20,40,.92)', border: '1px solid rgba(148,163,184,.1)',
          borderRadius: 20, padding: '32px 28px',
          backdropFilter: 'blur(32px)',
          boxShadow: '0 32px 100px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.04)',
        }}>
          <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>

            {/* Mot de passe provisoire */}
            <div>
              <label style={{ display: 'block', fontSize: '.72rem', fontWeight: 700, color: '#64748b', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Mot de passe provisoire (reçu de votre admin)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  style={{ ...inp(false), paddingRight: 44 }}
                  value={current} onChange={e => setCurrent(e.target.value)}
                  placeholder="Mot de passe reçu par email" required autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPwd
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
            </div>

            {/* Nouveau MDP */}
            <div>
              <label style={{ display: 'block', fontSize: '.72rem', fontWeight: 700, color: '#64748b', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Nouveau mot de passe
              </label>
              <input
                type="password" style={inp(newPwd.length > 0)}
                value={newPwd} onChange={e => setNewPwd(e.target.value)}
                placeholder="Choisissez un mot de passe fort" required autoComplete="new-password"
              />
              {newPwd.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {/* Barre de force */}
                  <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= strength ? strengthColor : 'rgba(148,163,184,.08)', transition: 'background .2s' }} />
                    ))}
                  </div>
                  {/* Checks */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {checks.map(c => (
                      <span key={c.label} style={{ fontSize: '.72rem', color: c.ok ? '#86efac' : '#334155', display: 'flex', alignItems: 'center', gap: 4, transition: 'color .2s' }}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          {c.ok
                            ? <><circle cx="6" cy="6" r="6" fill="#22c55e20"/><path d="M3.5 6l2 2 3-3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>
                            : <circle cx="6" cy="6" r="5" stroke="#1e293b" strokeWidth="1.5"/>}
                        </svg>
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirmer */}
            <div>
              <label style={{ display: 'block', fontSize: '.72rem', fontWeight: 700, color: '#64748b', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                style={{ ...inp(confirm.length > 0 && confirm === newPwd), borderColor: confirm.length > 0 && confirm !== newPwd ? 'rgba(239,68,68,.4)' : undefined }}
                value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Répéter le mot de passe" required autoComplete="new-password"
              />
              {confirm.length > 0 && confirm !== newPwd && (
                <p style={{ margin: '5px 0 0', fontSize: '.72rem', color: '#fca5a5' }}>Les mots de passe ne correspondent pas</p>
              )}
            </div>

            {/* Erreur */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderRadius: 10, background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: '.83rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={saving || !current || !newPwd || !confirm || newPwd !== confirm || strength < 2}
              style={{
                marginTop: 6, padding: '14px', borderRadius: 12, border: 'none',
                background: '#facc15', color: '#060d1a',
                fontWeight: 900, fontSize: '.92rem',
                cursor: 'pointer',
                opacity: (!current || !newPwd || !confirm || newPwd !== confirm || strength < 2) ? .45 : 1,
                transition: 'all .18s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 20px rgba(250,204,21,.2)',
                letterSpacing: '-.01em', fontFamily: 'Inter, sans-serif',
              }}>
              {saving ? (
                <>
                  <svg style={{ animation: 'fpcSpin .7s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Enregistrement…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Définir mon mot de passe
                </>
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.73rem', color: '#1e293b' }}>
          Ce mot de passe est personnel · Ne le partagez jamais
        </p>
      </div>

      <style>{`
        @keyframes fpcFadeUp { from { opacity:0; transform:translateY(20px) scale(.98); } to { opacity:1; transform:none; } }
        @keyframes fpcSpin   { to   { transform:rotate(360deg); } }
      `}</style>
    </main>
  );
}

function LoginPage({
  onLogin,
  onForgot,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onForgot: () => void;
}) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const [focused,  setFocused]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSlowServer(false);
    const slowTimer = setTimeout(() => setSlowServer(true), 5000);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email ou mot de passe incorrect');
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlowServer(false);
    }
  }

  const inp = (focused_key: string): React.CSSProperties => ({
    width: '100%', padding: '13px 16px',
    background: focused === focused_key ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.03)',
    border: `1.5px solid ${focused === focused_key ? 'rgba(250,204,21,.4)' : 'rgba(148,163,184,.12)'}`,
    borderRadius: 11, color: '#f1f5f9', fontSize: '.92rem', outline: 'none',
    transition: 'all .18s cubic-bezier(.4,0,.2,1)',
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box' as const,
    boxShadow: focused === focused_key ? '0 0 0 3px rgba(250,204,21,.08)' : 'none',
  });

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, position: 'relative', overflow: 'hidden',
      background: '#060d1a',
    }}>
      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(37,99,235,.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(250,204,21,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '40%', right: '20%', width: '30%', height: '30%', background: 'radial-gradient(circle, rgba(139,92,246,.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420, position: 'relative', zIndex: 1,
        animation: 'loginFadeUp .45s cubic-bezier(0,0,.2,1) both',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(250,204,21,.25), rgba(250,204,21,.08))',
            border: '1.5px solid rgba(250,204,21,.3)',
            marginBottom: 16, boxShadow: '0 8px 32px rgba(250,204,21,.15)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(250,204,21,.7)', marginBottom: 8 }}>
            DataSphere Innovation
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 900, letterSpacing: '-.04em', color: '#f1f5f9', lineHeight: 1.1, margin: 0 }}>
            Bon retour 👋
          </h1>
          <p style={{ color: '#475569', fontSize: '.86rem', marginTop: 8, lineHeight: 1.5 }}>
            Connectez-vous à votre espace IA
          </p>
        </div>

        {/* Form card */}
        <div style={{
          background: 'rgba(12,20,40,.9)',
          border: '1px solid rgba(148,163,184,.1)',
          borderRadius: 20,
          padding: '32px 28px',
          backdropFilter: 'blur(32px)',
          boxShadow: '0 32px 100px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04) inset',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Inner glow */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent)', pointerEvents: 'none' }} />

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '.75rem', fontWeight: 700, color: '#64748b', marginBottom: 7, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                Adresse email
              </label>
              <input
                style={inp('email')}
                type="email" value={email} required autoComplete="email" disabled={loading}
                placeholder="vous@datasphere.fr"
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Mot de passe
                </label>
                <button type="button" onClick={onForgot}
                  style={{ fontSize: '.74rem', color: 'rgba(250,204,21,.7)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Oublié ?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inp('password'), paddingRight: 44 }}
                  type={showPwd ? 'text' : 'password'} value={password} required autoComplete="current-password" disabled={loading}
                  placeholder="••••••••••"
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPwd
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#fca5a5', fontSize: '.83rem', lineHeight: 1.4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password}
              style={{
                marginTop: 4,
                padding: '13px',
                borderRadius: 11,
                border: 'none',
                background: loading ? 'rgba(250,204,21,.5)' : '#facc15',
                color: '#060d1a',
                fontWeight: 900,
                fontSize: '.92rem',
                cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
                opacity: !email || !password ? .5 : 1,
                transition: 'all .18s cubic-bezier(.4,0,.2,1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: loading ? 'none' : '0 4px 20px rgba(250,204,21,.25)',
                letterSpacing: '-.01em',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {loading ? (
                <>
                  <svg style={{ animation: 'loginSpin .7s linear infinite', flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Connexion en cours…
                </>
              ) : (
                <>
                  Se connecter
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>

            {slowServer && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 13px', borderRadius: 9, background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.15)', fontSize: '.77rem', color: '#94a3b8', lineHeight: 1.5 }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>⏳</span>
                <span>Le serveur démarre depuis le repos… cela peut prendre <strong style={{ color: '#fde68a' }}>jusqu&apos;à 30 secondes</strong>. Merci de patienter.</span>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.74rem', color: '#334155' }}>
          DataSphere Innovation · Plateforme IA confidentielle
        </p>
      </div>

      <style>{`
        @keyframes loginFadeUp {
          from { opacity: 0; transform: translateY(20px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes loginSpin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}


function ThemeToggle() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem('datasphere_theme') as 'dark' | 'light') || 'dark'; } catch { return 'dark'; }
  });
  function setTheme(t: 'dark' | 'light') {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('datasphere_theme', t); } catch {}
  }
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
      style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(148,163,184,.15)', background: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

export default function AppRoot() {
  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [mustChangePwd, setMustChangePwd] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(() =>
    new URLSearchParams(window.location.search).has('token') ? 'reset' : 'login',
  );
  const [view, setView] = useState<RootView>('dashboard');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarMini, setSidebarMini] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());
  const [toasts, setToasts] = useState<ToastEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const addToast = (t: ToastEvent) => setToasts(prev => [...prev.slice(-3), t]);
  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // Real-time SSE toasts
  useRealtimeToasts(token, addToast);

  // Workflow real-time events → toasts
  useWorkflowSSE({
    token,
    onEvent: (event) => {
      if (event.type === 'workflow.step_awaiting') {
        addToast({ id: `wf-${Date.now()}`, type: 'warning', title: '⏳ Validation requise',
          message: `Étape « ${(event as any).step_label || (event as any).step_key} » en attente de votre approbation`, at: Date.now() });
      } else if (event.type === 'workflow.step_done') {
        addToast({ id: `wf-${Date.now()}`, type: 'success', title: '✅ Étape terminée',
          message: `« ${(event as any).step_label || (event as any).step_key} » complétée`, at: Date.now() });
      } else if (event.type === 'workflow.completed') {
        addToast({ id: `wf-${Date.now()}`, type: 'success', title: '🎉 Workflow terminé !',
          message: 'Le mémoire technique est prêt à consulter', at: Date.now() });
      } else if (event.type === 'notification') {
        const priority = (event as any).priority || 'medium';
        addToast({ id: `notif-${Date.now()}`, type: priority === 'high' ? 'warning' : 'info',
          title: (event as any).title || 'Nouvelle notification',
          message: (event as any).message || '', at: Date.now() });
        setUnreadCount(c => c + 1);
      } else if (event.type === 'action_approved') {
        addToast({ id: `action-${Date.now()}`, type: 'success', title: '✅ Action approuvée',
          message: `« ${(event as any).title || 'Action'} » a été approuvée`, at: Date.now() });
      } else if ((event.type as string) === 'deliverable.approved') {
        addToast({ id: `deliv-${Date.now()}`, type: 'success', title: '📄 Livrable approuvé',
          message: `« ${(event as any).title || 'Livrable'} » vient d'être approuvé`, at: Date.now() });
      } else if ((event.type as string) === 'deliverable.created') {
        addToast({ id: `deliv-c-${Date.now()}`, type: 'info', title: '📝 Nouveau livrable',
          message: `« ${(event as any).title || 'Livrable'} » créé`, at: Date.now() });
      }
    },
  });

  // Charger le nombre de notifications non lues
  useEffect(() => {
    if (!token) return;
    apiRequest<any[]>('/notifications?limit=50', {}, token)
      .then(data => {
        const unread = Array.isArray(data) ? data.filter((n: any) => !n.is_read).length : 0;
        setUnreadCount(unread);
      })
      .catch(() => {});
  }, [token]);

  // Reset count quand on visite la page notifications
  useEffect(() => {
    if (view === 'notifications') setUnreadCount(0);
  }, [view]);

  useEffect(() => {
    if (!token) return;
    apiRequest<CurrentUser>('/auth/me', {}, token)
      .then(u => {
        setUser(u);
        localStorage.setItem('ds_user', JSON.stringify(u));
      })
      .catch(() => {
        tokenStorage.clear();
        localStorage.removeItem('ds_user');
        setToken(null);
        setUser(null);
      });
  }, [token]);

  async function handleLogin(email: string, password: string) {
    const coldStartWarning = setTimeout(() => {
      console.info('[DataSphere] Démarrage du serveur en cours (Render free plan)…');
    }, 5000);
    try {
      const result = await apiRequest<LoginResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      clearTimeout(coldStartWarning);
      tokenStorage.set(result.access_token, result.refresh_token);
      localStorage.setItem('ds_user', JSON.stringify(result.user));
      setToken(result.access_token);
      setUser(result.user);
      // Forcer changement MDP si l'admin a créé le compte avec MDP provisoire
      if (result.must_change_password || result.user?.must_change_password) {
        setMustChangePwd(true);
      }
    } catch (err) {
      clearTimeout(coldStartWarning);
      throw err;
    }
  }

  async function handlePasswordChanged() {
    setMustChangePwd(false);
  }

  function logout() {
    tokenStorage.clear();
    localStorage.removeItem('ds_user');
    setToken(null);
    setUser(null);
    setView('dashboard');
  }

  if (!token) {
    if (authView === 'forgot')
      return <ForgotPasswordPage onBack={() => setAuthView('login')} />;
    if (authView === 'reset')
      return (
        <ResetPasswordPage
          onSuccess={() => {
            window.history.replaceState({}, '', '/');
            setAuthView('login');
          }}
        />
      );
    return (
      <LoginPage
        onLogin={handleLogin}
        onForgot={() => setAuthView('forgot')}
      />
    );
  }

  const { t, lang } = useI18n(); // lang déclenche le re-render global

  // ── Navigation icon mapping ──────────────────────────────────
  const NAV_ICONS: Record<string, React.ReactElement> = {
    dashboard:            <LayoutDashboard size={16} />,
    tenders:              <Target size={16} />,
    deliverables:         <FileText size={16} />,
    commercial:           <Briefcase size={16} />,
    organizations:        <Building2 size={16} />,
    opportunities:        <TrendingUp size={16} />,
    operations:           <Settings size={16} />,
    'data-export':        <Download size={16} />,
    linkedin:             <Share2 size={16} />,
    'consultant-profiles':<UserCheck size={16} />,
    notifications: (
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6,
            background: '#ef4444', color: '#fff',
            borderRadius: '50%', width: 14, height: 14,
            fontSize: '.55rem', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, boxShadow: '0 0 0 2px #060d1a',
            pointerEvents: 'none',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
    ),
    search:               <Search size={16} />,
    'ai-providers':       <Zap size={16} />,
    'intelligence':       <Brain size={16} />,
    team:                 <Users size={16} />,
    audit:                <Shield size={16} />,
    workspaces:           <Layers size={16} />,
    profile:              <UserCircle size={16} />,
    settings:             <Settings size={16} />,
    calculator:           <Briefcase size={16} />,
    pricing:              <Zap size={16} />,
  };

  // ── Navigation groups ────────────────────────────────────────
  const NAV_GROUPS = [
    { label: t('common.view') || 'Principal', keys: ['dashboard', 'tenders', 'deliverables'] },
    { label: 'CRM',       keys: ['organizations', 'opportunities', 'commercial'] },
    { label: 'IA',        keys: ['intelligence', 'ai-providers', 'consultant-profiles', 'linkedin'] },
    { label: t('ops.title') || 'Opérations',keys: ['operations', 'data-export', 'calculator', 'pricing', 'invoicing'] },
    { label: lang === 'en' ? 'Admin' : 'Admin',     keys: ['team', 'audit', 'workspaces'] },
    { label: lang === 'en' ? 'Personal' : 'Personnel', keys: ['notifications', 'search', 'profile', 'settings'] },
  ];

  // Bottom bar items (mobile) — top 5 most used
  const BOTTOM_TABS = ['dashboard', 'tenders', 'deliverables', 'operations', 'search'];



  const tabs: NavTab[] = [
    { key: 'dashboard',     label: t('nav.dashboard'),            permission: 'dashboard:read' },
    { key: 'tenders',       label: t('nav.tenders'),     permission: 'tenders:read' },
    { key: 'profiles',      label: t('nav.profiles'),  permission: 'profiles:read' },
    { key: 'deliverables',  label: t('nav.deliverables'),            permission: 'deliverables:read' },
    { key: 'commercial',    label: t('nav.commercial'),           permission: 'commercial:read' },
    { key: 'organizations', label: t('nav.organizations'),        permission: 'crm:read' },
    { key: 'opportunities', label: t('nav.opportunities'),         permission: 'crm:read' },
    { key: 'operations',    label: t('nav.operations'),           permission: 'operations:read' },
    { key: 'data-export',   label: t('nav.data_export'),       permission: 'audit:read' },
    { key: 'linkedin',      label: t('nav.linkedin'),        permission: 'deliverables:write' },
    { key: 'consultant-profiles', label: t('nav.cv_consultant'),  permission: 'deliverables:write' },
    { key: 'notifications',       label: t('nav.notifications'),    permission: 'deliverables:read'  },
    { key: 'search',              label: t('nav.search'),           permission: 'deliverables:read'  },
    { key: 'ai-providers',        label: t('nav.ai_providers'),     permission: 'operations:read'              },
    { key: 'team',          label: t('nav.team'),               permission: 'team:read' },
    { key: 'audit',         label: t('nav.audit'),                permission: 'audit:read' },
    { key: 'workspaces',    label: t('nav.workspaces'),           permission: 'workspaces:read' },
    { key: 'profile',       label: t('nav.profile'),           permission: 'profile:read' },
    { key: 'settings',      label: t('nav.settings'),          permission: 'profile:read' },
    { key: 'calculator',    label: t('nav.calculator'),    permission: 'operations:read' },
    { key: 'pricing',       label: t('nav.pricing'),            permission: 'profile:read' },
  ];

  const userRole = user?.role;
  const visibleTabs = tabs.filter(tab => can(userRole, tab.permission));
  const selectedTab = visibleTabs.find(t => t.key === view) ?? visibleTabs[0];
  const activeView = selectedTab?.key ?? 'dashboard';
  const userName = getUserName();

  function openView(nextView: RootView) {
    if (!visibleTabs.some(tab => tab.key === nextView)) return;
    setView(nextView);
    setNavOpen(false);
  }

  const initials = userName?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || 'DS';

  return (
    <div className={`ds-app${sidebarMini ? ' ds-sidebar-mini' : ''}`}>

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="ds-header">
        {/* Logo */}
        <div className="ds-header-logo">
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#facc15,#f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '.7rem', fontWeight: 900, color: '#0a0f1a' }}>DS</span>
          </div>
          <div>
            <div className="ds-logo-text">DataSphere</div>
            <div className="ds-logo-badge">IA Platform</div>
          </div>
        </div>

        {/* Burger (mobile) */}
        <button className="ds-burger" onClick={() => setNavOpen(o => !o)} type="button" aria-label="Menu">
          {navOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Center */}
        <div className="ds-header-center">
          <WorkspaceSwitcher />
          <GlobalSearchBar onNavigate={(tab) => openView(tab as RootView)} />
        </div>

        {/* Right actions */}
        <div className="ds-header-right">
          <ThemeToggle />
          <LangToggle />
          <NotificationsPanel />
          <NotificationBell />

          {/* Sidebar collapse (desktop) */}
          <button
            className="ds-pin-btn"
            onClick={() => setSidebarMini(m => !m)}
            title={sidebarMini ? 'Développer le menu' : 'Réduire le menu'}
            type="button"
            style={{ display: 'none' }}
            id="ds-pin-btn-desktop"
          >
            {sidebarMini ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* User menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              type="button"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '5px 10px 5px 5px', borderRadius: 10,
                border: '1px solid rgba(148,163,184,.12)',
                background: 'rgba(255,255,255,.03)',
                cursor: 'pointer', color: '#cbd5e1',
              }}
            >
              <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#1e40af,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.65rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {initials}
              </div>
              <span style={{ fontSize: '.78rem', fontWeight: 600, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName}
              </span>
            </button>
            {userMenuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#0c1425', border: '1px solid rgba(148,163,184,.15)', borderRadius: 12, padding: 8, minWidth: 200, boxShadow: '0 12px 40px rgba(0,0,0,.5)', zIndex: 400 }}>
                <div style={{ padding: '6px 12px 10px', borderBottom: '1px solid rgba(148,163,184,.08)', marginBottom: 4 }}>
                  <div style={{ fontSize: '.7rem', color: '#64748b' }}>Connecté en tant que</div>
                  <div style={{ fontSize: '.82rem', color: '#f1f5f9', marginTop: 2, fontWeight: 600 }}>{user?.email}</div>
                  {user?.role && (
                    <span style={{ display: 'inline-block', marginTop: 4, padding: '1px 7px', borderRadius: 99, fontSize: '.67rem', background: 'rgba(250,204,21,.1)', color: '#facc15', border: '1px solid rgba(250,204,21,.2)', fontFamily: 'monospace' }}>
                      {user.role}
                    </span>
                  )}
                </div>
                <button onClick={() => { openView('profile'); setUserMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '.82rem', textAlign: 'left' }}>
                  <UserCircle size={13} /> Mon profil
                </button>
                <button onClick={() => { logout(); setUserMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: '.82rem', textAlign: 'left' }}>
                  <LogOut size={13} /> Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {userMenuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 399 }} onClick={() => setUserMenuOpen(false)} />}

      {/* ── Layout body ───────────────────────────────────────── */}
      <div className="ds-body">

        {/* Overlay mobile */}
        {navOpen && (
          <div className="ds-sidebar-overlay" onClick={() => setNavOpen(false)} />
        )}

        {/* ── Sidebar ──────────────────────────────────────────── */}
        <nav className={`ds-sidebar${navOpen ? ' ds-sidebar-open' : ''}`} aria-label="Navigation principale">
          <div className="ds-sidebar-scroll">
            {NAV_GROUPS.map((group) => {
              const groupItems = group.keys
                .map(key => visibleTabs.find(t => t.key === key))
                .filter(Boolean) as NavTab[];
              if (groupItems.length === 0) return null;
              return (
                <div key={group.label} className="ds-nav-group">
                  <div className="ds-nav-group-label">
                    <div className="ds-nav-group-divider" style={{ flex: 1 }} />
                    <span className="ds-nav-group-label-text">{group.label}</span>
                    <div className="ds-nav-group-divider" style={{ flex: 1 }} />
                  </div>
                  {groupItems.map(tab => (
                    <button
                      key={tab.key}
                      className={`ds-nav-item${activeView === tab.key ? ' active' : ''}`}
                      onClick={() => openView(tab.key)}
                      data-tooltip={tab.label}
                      type="button"
                    >
                      <span className="ds-nav-icon">
                        {NAV_ICONS[tab.key] ?? <Settings size={16} />}
                      </span>
                      <span className="ds-nav-label">{tab.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Sidebar footer — user + collapse */}
          <div className="ds-sidebar-footer">
            <button
              className="ds-user-pill"
              onClick={() => openView('profile')}
              type="button"
            >
              <div className="ds-user-avatar">{initials}</div>
              <div className="ds-user-info">
                <div className="ds-user-name">{userName}</div>
                <div className="ds-user-role">{user?.role}</div>
              </div>
            </button>
            {/* Collapse toggle (desktop) */}
            <button
              onClick={() => setSidebarMini(m => !m)}
              type="button"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100%', marginTop: 6, padding: '6px', borderRadius: 8,
                border: '1px solid rgba(148,163,184,.08)', background: 'none',
                color: '#334155', cursor: 'pointer', gap: 6, fontSize: '.72rem',
                transition: 'all .15s',
              }}
            >
              {sidebarMini ? <ChevronRight size={13} /> : <><ChevronLeft size={13} /><span style={{ opacity: 1 }}>Réduire</span></>}
            </button>
          </div>
        </nav>

        {/* ── Main ─────────────────────────────────────────────── */}
        <main className="ds-main">
          <ErrorBoundary>
            {activeView === 'dashboard'          && <DashboardPage />}
            {activeView === 'tenders'            && <TenderPage />}
            {activeView === 'profiles'           && <CrmWorkspace token={token} view='organizations' />}
            {activeView === 'deliverables'       && <DeliverablePage />}
            {activeView === 'commercial'         && <CommercialPage />}
            {activeView === 'organizations'      && <CrmWorkspace token={token} view='organizations' />}
            {activeView === 'opportunities'      && <CrmWorkspace token={token} view='opportunities' />}
            {activeView === 'operations'         && <OperationsPage />}
            {activeView === 'team'               && <TeamPage />}
            {activeView === 'audit'              && <AuditLogPage />}
            {activeView === 'profile'            && <UserProfilePage />}
            {activeView === 'workspaces'         && <WorkspacesPage />}
            {activeView === 'data-export'        && <DataExportPage />}
            {activeView === 'linkedin'           && <LinkedInAgentPage />}
            {activeView === 'consultant-profiles' && <ConsultantProfilesPage />}
            {activeView === 'notifications'      && <NotificationsPage />}
            {activeView === 'search'             && <SearchPage />}
            {activeView === 'ai-providers'       && <AIProvidersPage />}
            {activeView === 'intelligence'        && <IntelligencePage />}
            {activeView === 'settings'           && <SettingsPage />}
            {activeView === 'calculator'         && <CalculatorPage />}
            {activeView === 'pricing'            && <PricingPage />}
            {activeView === 'invoicing'          && <InvoicingPage />}
            {activeView === 'analytics'          && <AnalyticsPage />}
          </ErrorBoundary>
        </main>

        {/* ── Bottom tab bar (mobile only) ─────────────────────── */}
        <nav className="ds-bottom-bar" aria-label="Navigation rapide">
          {BOTTOM_TABS
            .map(key => visibleTabs.find(t => t.key === key))
            .filter(Boolean)
            .map(tab => tab && (
              <button
                key={tab.key}
                className={`ds-bottom-tab${activeView === tab.key ? ' active' : ''}`}
                onClick={() => openView(tab.key)}
                type="button"
              >
                <span style={{ fontSize: 20 }}>
                  {NAV_ICONS[tab.key] ?? <Settings size={20} />}
                </span>
                <span className="ds-bottom-tab-label">{tab.label}</span>
              </button>
            ))
          }
          {/* More button */}
          <button
            className={`ds-bottom-tab${navOpen ? ' active' : ''}`}
            onClick={() => setNavOpen(o => !o)}
            type="button"
          >
            {navOpen ? <X size={20} /> : <Menu size={20} />}
            <span className="ds-bottom-tab-label">Menu</span>
          </button>
        </nav>
      </div>

      {/* ── Toasts ───────────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {showOnboarding && (
        <OnboardingWizard onComplete={() => { markOnboardingDone(); setShowOnboarding(false); }} />
      )}
    </div>
  );
}
