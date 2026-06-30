/**
 * CookieConsent — Bandeau RGPD de consentement aux cookies
 *
 * Stocke le choix dans localStorage. Distingue cookies essentiels
 * (toujours actifs, nécessaires à l'authentification) et cookies
 * de mesure d'audience (optionnels).
 */
import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'ds_cookie_consent';

type ConsentState = {
  essential: true; // toujours true, non désactivable
  analytics: boolean;
  decided: boolean;
};

export function getCookieConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { essential: true, analytics: false, decided: false };
}

function saveConsent(state: ConsentState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function CookieConsent({ onShowPrivacy }: { onShowPrivacy?: () => void }) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(false);

  useEffect(() => {
    const consent = getCookieConsent();
    if (!consent.decided) setVisible(true);
  }, []);

  function acceptAll() {
    saveConsent({ essential: true, analytics: true, decided: true });
    setVisible(false);
  }

  function rejectOptional() {
    saveConsent({ essential: true, analytics: false, decided: true });
    setVisible(false);
  }

  function saveCustom() {
    saveConsent({ essential: true, analytics: analyticsChoice, decided: true });
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10000,
      background: 'linear-gradient(180deg, rgba(13,27,46,.98), rgba(6,13,26,.99))',
      borderTop: '1px solid rgba(250,204,21,.15)',
      boxShadow: '0 -8px 40px rgba(0,0,0,.5)',
      padding: 'clamp(16px,3vw,24px)',
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'rgba(250,204,21,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Cookie size={18} color="#facc15" />
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ margin: '0 0 4px', fontSize: '.86rem', fontWeight: 700, color: '#f1f5f9' }}>
              Gestion des cookies
            </p>
            <p style={{ margin: 0, fontSize: '.8rem', color: '#94a3b8', lineHeight: 1.55 }}>
              Nous utilisons des cookies essentiels au fonctionnement de la plateforme (authentification, sécurité)
              et, avec votre accord, des cookies de mesure d'audience anonymisée pour améliorer le service.{' '}
              {onShowPrivacy && (
                <button onClick={onShowPrivacy} style={{
                  background: 'none', border: 'none', color: '#facc15', cursor: 'pointer',
                  textDecoration: 'underline', fontSize: '.8rem', padding: 0,
                }}>
                  En savoir plus
                </button>
              )}
            </p>

            {expanded && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem', color: '#64748b' }}>
                  <input type="checkbox" checked disabled style={{ accentColor: '#facc15' }} />
                  Cookies essentiels (toujours actifs — authentification, sécurité)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem', color: '#94a3b8', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={analyticsChoice}
                    onChange={e => setAnalyticsChoice(e.target.checked)}
                    style={{ accentColor: '#facc15' }}
                  />
                  Cookies de mesure d'audience (anonymisés)
                </label>
              </div>
            )}
          </div>

          <button onClick={rejectOptional} aria-label="Fermer" style={{
            background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 4,
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!expanded ? (
            <>
              <button onClick={() => setExpanded(true)} style={{
                padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)',
                background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '.82rem',
              }}>
                Personnaliser
              </button>
              <button onClick={rejectOptional} style={{
                padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(148,163,184,.15)',
                background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '.82rem',
              }}>
                Refuser les optionnels
              </button>
              <button onClick={acceptAll} style={{
                padding: '9px 18px', borderRadius: 9, border: 'none',
                background: 'linear-gradient(135deg,#facc15,#f59e0b)', color: '#0f172a',
                fontWeight: 800, cursor: 'pointer', fontSize: '.82rem',
              }}>
                Tout accepter
              </button>
            </>
          ) : (
            <button onClick={saveCustom} style={{
              padding: '9px 18px', borderRadius: 9, border: 'none',
              background: 'linear-gradient(135deg,#facc15,#f59e0b)', color: '#0f172a',
              fontWeight: 800, cursor: 'pointer', fontSize: '.82rem',
            }}>
              Enregistrer mes choix
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
