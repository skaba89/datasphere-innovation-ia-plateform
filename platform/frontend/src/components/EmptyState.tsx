/**
 * EmptyState — Composant d'état vide illustré
 * Utilisé sur toutes les pages sans données pour guider l'utilisateur.
 */
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;          // Emoji ou SVG
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
  compact?: boolean;
}

export default function EmptyState({
  icon, title, description, action, secondaryAction, size = 'md',
  compact,
}: EmptyStateProps) {
  const padding = size === 'sm' ? '32px 24px' : size === 'lg' ? '64px 40px' : '48px 32px';
  const iconSize = size === 'sm' ? '2rem' : size === 'lg' ? '3.5rem' : '2.8rem';
  const titleSize = size === 'sm' ? '.9rem' : size === 'lg' ? '1.2rem' : '1rem';

  return (
    <div style={{
      textAlign: 'center', padding,
      background: 'rgba(10,18,38,.6)',
      border: '1px dashed rgba(148,163,184,.12)',
      borderRadius: 16,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      {/* Icon */}
      <div style={{
        width: size === 'sm' ? 48 : 64, height: size === 'sm' ? 48 : 64,
        borderRadius: '50%',
        background: 'rgba(148,163,184,.06)',
        border: '1px solid rgba(148,163,184,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: iconSize,
      }}>
        {icon}
      </div>

      {/* Text */}
      <div>
        <h3 style={{ margin: '0 0 6px', fontSize: titleSize, fontWeight: 800, color: '#e2e8f0' }}>
          {title}
        </h3>
        <p style={{ margin: 0, fontSize: '.8rem', color: '#475569', lineHeight: 1.6, maxWidth: 320 }}>
          {description}
        </p>
      </div>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          {action && (
            <button onClick={action.onClick} style={{
              padding: '9px 20px', borderRadius: 10, border: 'none',
              background: action.variant === 'secondary'
                ? 'rgba(148,163,184,.1)' : 'linear-gradient(135deg,#facc15,#f59e0b)',
              color: action.variant === 'secondary' ? '#94a3b8' : '#0f172a',
              fontWeight: 800, cursor: 'pointer', fontSize: '.84rem',
            }}>
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button onClick={secondaryAction.onClick} style={{
              padding: '9px 20px', borderRadius: 10,
              border: '1px solid rgba(148,163,184,.15)',
              background: 'none', color: '#64748b',
              cursor: 'pointer', fontSize: '.84rem',
            }}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Presets pour les pages principales
export const EMPTY_STATES = {
  tenders: {
    icon: '📋',
    title: 'Aucun appel d\'offres',
    description: 'Importez des AOs depuis BOAMP, TED ou saisissez-en un manuellement. L\'IA analysera votre adéquation en quelques secondes.',
  },
  deliverables: {
    icon: '📄',
    title: 'Bibliothèque vide',
    description: 'Créez votre premier livrable IA — mémoire technique, proposition commerciale ou note de cadrage. Généré en 30 secondes.',
  },
  organizations: {
    icon: '🏢',
    title: 'Aucune organisation',
    description: 'Importez des AOs pour peupler automatiquement votre CRM, ou créez une organisation manuellement.',
  },
  opportunities: {
    icon: '💼',
    title: 'Pipeline vide',
    description: 'Votre pipeline se remplit automatiquement dès qu\'un AO est importé. L\'agent CRM crée les opportunités pour vous.',
  },
  contacts: {
    icon: '👤',
    title: 'Aucun contact',
    description: 'Les contacts sont extraits automatiquement depuis les textes d\'AOs (emails, téléphones). Importez aussi un CSV.',
  },
  analytics: {
    icon: '📊',
    title: 'Données insuffisantes',
    description: 'Les graphiques s\'alimentent au fur et à mesure. Importez des AOs et créez des livrables pour voir vos métriques.',
  },
  notifications: {
    icon: '🔔',
    title: 'Tout est à jour',
    description: 'Aucune notification pour le moment. Vous serez alerté pour les deadlines AO, approbations et mises à jour workflow.',
  },
  invoices: {
    icon: '💰',
    title: 'Aucune facture',
    description: 'Créez un devis depuis un AO gagné pour l\'envoyer à votre client. Convertissez-le en facture en un clic.',
  },
  linkedin: {
    icon: '💼',
    title: 'Aucun post planifié',
    description: 'Générez un calendrier éditorial 30 jours en un clic. L\'IA crée des posts Data Engineering adaptés à votre audience.',
  },
  search: {
    icon: '🔍',
    title: 'Aucun résultat',
    description: 'Essayez avec d\'autres mots-clés. La recherche couvre AOs, livrables, contacts et organisations.',
  },
};
