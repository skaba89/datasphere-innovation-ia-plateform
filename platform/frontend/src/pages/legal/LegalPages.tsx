/**
 * LegalPages — CGU, CGV, Politique de confidentialité, Mentions légales
 *
 * Accessibles sans authentification via /#/legal/{slug}
 * Affichées aussi depuis le footer de l'app (lien dans Settings/Profile)
 */
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export type LegalSlug = 'cgu' | 'cgv' | 'confidentialite' | 'mentions-legales';

const COMPANY = {
  name: 'DataSphere Innovation',
  legalForm: 'SASU', // À ajuster selon la forme juridique réelle
  siret: '[SIRET à compléter]',
  rcs: '[RCS Ville à compléter]',
  capital: '[Capital social à compléter]',
  address: '[Adresse siège social à compléter], France',
  email: 'contact@datasphere-innovation.fr',
  supportEmail: 'support@datasphere-innovation.fr',
  dpoEmail: 'dpo@datasphere-innovation.fr',
  host: 'Render Services, Inc.',
  hostAddress: '525 Brannan Street, Suite 300, San Francisco, CA 94107, USA',
  director: '[Nom du représentant légal à compléter]',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9', marginBottom: 10 }}>{title}</h2>
      <div style={{ color: '#94a3b8', fontSize: '.88rem', lineHeight: 1.75 }}>{children}</div>
    </section>
  );
}

function LegalLayout({ title, updated, children, onBack }: {
  title: string; updated: string; children: React.ReactNode; onBack?: () => void;
}) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <div style={{ minHeight: '100dvh', background: '#060d1a', padding: '0 0 80px' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(6,13,26,.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(148,163,184,.08)',
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {onBack && (
          <button onClick={onBack} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
            borderRadius: 9, border: '1px solid rgba(148,163,184,.15)',
            background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '.82rem',
          }}>
            <ArrowLeft size={14} /> Retour
          </button>
        )}
        <div style={{ fontSize: '.7rem', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#facc15' }}>
          DataSphere Innovation
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(24px,4vw,48px) 20px' }}>
        <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, color: '#f1f5f9', marginBottom: 6, letterSpacing: '-.03em' }}>
          {title}
        </h1>
        <p style={{ color: '#475569', fontSize: '.8rem', marginBottom: 36 }}>
          Dernière mise à jour : {updated}
        </p>
        {children}
      </div>
    </div>
  );
}

// ── CGU — Conditions Générales d'Utilisation ────────────────────────────────
function CGUPage({ onBack }: { onBack?: () => void }) {
  return (
    <LegalLayout title="Conditions Générales d'Utilisation" updated="30 juin 2026" onBack={onBack}>
      <Section title="1. Objet">
        <p>
          Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la
          plateforme {COMPANY.name} (ci-après « la Plateforme »), accessible à l'adresse
          datasphere-frontend-n1mb.onrender.com et ses sous-domaines, éditée par {COMPANY.name},
          {COMPANY.legalForm} immatriculée sous le numéro {COMPANY.siret}.
        </p>
        <p>
          Toute utilisation de la Plateforme implique l'acceptation pleine et entière des présentes CGU.
          Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser la Plateforme.
        </p>
      </Section>

      <Section title="2. Description du service">
        <p>
          La Plateforme propose des outils d'intelligence artificielle destinés aux professionnels de la
          réponse aux appels d'offres et du conseil : veille d'appels d'offres, scoring Go/No-Go assisté par IA,
          génération de livrables (mémoires techniques, propositions commerciales), gestion de pipeline CRM,
          et outils analytiques associés.
        </p>
      </Section>

      <Section title="3. Inscription et compte utilisateur">
        <p>
          L'accès à certaines fonctionnalités nécessite la création d'un compte. L'utilisateur s'engage à
          fournir des informations exactes et à jour, et à préserver la confidentialité de ses identifiants
          de connexion. Toute action effectuée depuis un compte est réputée effectuée par son titulaire.
        </p>
        <p>
          {COMPANY.name} se réserve le droit de suspendre ou résilier un compte en cas de violation des
          présentes CGU, d'usage frauduleux, ou de non-paiement des sommes dues.
        </p>
      </Section>

      <Section title="4. Utilisation des fonctionnalités d'intelligence artificielle">
        <p>
          La Plateforme intègre des modèles de langage tiers (notamment Groq, Google Gemini, et autres
          fournisseurs compatibles) pour générer du contenu (scores, recommandations, livrables rédigés).
          Ce contenu est généré automatiquement et <strong>doit faire l'objet d'une relecture et validation
          par l'utilisateur</strong> avant tout usage commercial ou contractuel. {COMPANY.name} ne garantit
          pas l'exactitude, l'exhaustivité ou la pertinence du contenu généré par IA.
        </p>
      </Section>

      <Section title="5. Propriété intellectuelle">
        <p>
          La Plateforme, son code source, son design et sa marque sont la propriété exclusive de {COMPANY.name}.
          Le contenu généré par l'utilisateur (documents importés, livrables créés) reste la propriété de
          l'utilisateur ou de son organisation, sous réserve des droits nécessaires à {COMPANY.name} pour
          fournir le service (hébergement, traitement IA).
        </p>
      </Section>

      <Section title="6. Obligations de l'utilisateur">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>Ne pas utiliser la Plateforme à des fins illégales ou frauduleuses</li>
          <li>Ne pas tenter de contourner les mesures de sécurité ou d'accéder à des données d'autres utilisateurs</li>
          <li>Ne pas surcharger volontairement l'infrastructure (attaque par déni de service, scraping massif)</li>
          <li>Respecter les droits de propriété intellectuelle des tiers dans les contenus importés</li>
        </ul>
      </Section>

      <Section title="7. Disponibilité du service">
        <p>
          {COMPANY.name} met en œuvre les moyens raisonnables pour assurer la disponibilité de la Plateforme,
          sans garantie de continuité absolue. Des interruptions pour maintenance peuvent survenir, avec
          information préalable lorsque possible.
        </p>
      </Section>

      <Section title="8. Limitation de responsabilité">
        <p>
          {COMPANY.name} ne saurait être tenue responsable des dommages indirects résultant de l'utilisation
          de la Plateforme, notamment les pertes de chiffre d'affaires, de marché, ou de données résultant
          d'une décision prise sur la base d'un contenu généré par IA non vérifié par l'utilisateur.
        </p>
      </Section>

      <Section title="9. Modification des CGU">
        <p>
          {COMPANY.name} se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs
          seront informés de toute modification substantielle par notification dans l'application ou par email.
        </p>
      </Section>

      <Section title="10. Droit applicable et juridiction">
        <p>
          Les présentes CGU sont régies par le droit français. Tout litige relatif à leur interprétation ou
          exécution relève de la compétence exclusive des tribunaux français, sauf disposition légale impérative
          contraire applicable aux consommateurs.
        </p>
      </Section>

      <Section title="Contact">
        <p>Pour toute question relative aux présentes CGU : {COMPANY.email}</p>
      </Section>
    </LegalLayout>
  );
}

// ── CGV — Conditions Générales de Vente ─────────────────────────────────────
function CGVPage({ onBack }: { onBack?: () => void }) {
  return (
    <LegalLayout title="Conditions Générales de Vente" updated="30 juin 2026" onBack={onBack}>
      <Section title="1. Champ d'application">
        <p>
          Les présentes Conditions Générales de Vente (CGV) s'appliquent à toute souscription payante aux
          services de {COMPANY.name}, qu'il s'agisse d'un abonnement mensuel, annuel, ou d'une prestation
          ponctuelle facturée via la Plateforme.
        </p>
      </Section>

      <Section title="2. Offres et tarifs">
        <p>
          Les tarifs en vigueur sont indiqués sur la page Tarifs de la Plateforme, hors taxes sauf mention
          contraire. {COMPANY.name} se réserve le droit de modifier ses tarifs à tout moment ; toute
          modification ne s'applique pas aux abonnements en cours avant leur prochain renouvellement.
        </p>
        <p>
          Les prix sont exprimés en euros (€). Pour les clients hors zone euro, le règlement s'effectue
          également en euros via les moyens de paiement proposés (carte bancaire via Stripe).
        </p>
      </Section>

      <Section title="3. Modalités de paiement">
        <p>
          Le paiement s'effectue par carte bancaire via notre prestataire de paiement sécurisé Stripe.
          {COMPANY.name} ne stocke aucune donnée de carte bancaire ; ces informations sont traitées
          exclusivement par Stripe, certifié PCI-DSS.
        </p>
        <p>
          Les abonnements sont facturés par avance, selon la périodicité choisie (mensuelle ou annuelle),
          et se renouvellent automatiquement sauf résiliation par l'utilisateur avant la date de renouvellement.
        </p>
      </Section>

      <Section title="4. Droit de rétractation">
        <p>
          Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique
          pas aux services pleinement exécutés avant la fin du délai de rétractation avec l'accord exprès du
          consommateur. En souscrivant à un abonnement avec accès immédiat aux fonctionnalités, l'utilisateur
          reconnaît renoncer à son droit de rétractation pour la période déjà consommée.
        </p>
        <p>
          Pour les utilisateurs professionnels (B2B), le droit de rétractation du Code de la consommation
          ne s'applique pas par principe.
        </p>
      </Section>

      <Section title="5. Résiliation">
        <p>
          L'utilisateur peut résilier son abonnement à tout moment depuis son espace Paramètres → Facturation,
          ou via le portail client Stripe. La résiliation prend effet à la fin de la période déjà payée ;
          aucun remboursement au prorata n'est effectué sauf disposition légale contraire.
        </p>
      </Section>

      <Section title="6. Facturation">
        <p>
          Une facture est émise automatiquement à chaque paiement et disponible dans l'espace
          Facturation de la Plateforme. Pour toute demande de facture rectificative ou d'informations
          de facturation spécifiques (mentions TVA intracommunautaire, etc.), contactez {COMPANY.email}.
        </p>
      </Section>

      <Section title="7. Retard ou défaut de paiement">
        <p>
          En cas d'échec de paiement (carte expirée, fonds insuffisants), {COMPANY.name} se réserve le droit
          de suspendre l'accès aux fonctionnalités payantes après notification, jusqu'à régularisation.
        </p>
      </Section>

      <Section title="8. Garanties">
        <p>
          {COMPANY.name} s'engage à fournir le service avec diligence professionnelle. Aucune garantie de
          résultat commercial (taux de réussite aux appels d'offres) n'est apportée, les outils d'IA
          fournissant une aide à la décision et non une garantie de résultat.
        </p>
      </Section>

      <Section title="9. Droit applicable">
        <p>Les présentes CGV sont soumises au droit français.</p>
      </Section>

      <Section title="Contact facturation">
        <p>{COMPANY.email}</p>
      </Section>
    </LegalLayout>
  );
}

// ── Politique de confidentialité (RGPD) ─────────────────────────────────────
function PrivacyPage({ onBack }: { onBack?: () => void }) {
  return (
    <LegalLayout title="Politique de confidentialité" updated="30 juin 2026" onBack={onBack}>
      <Section title="1. Responsable du traitement">
        <p>
          {COMPANY.name}, {COMPANY.legalForm}, {COMPANY.address}, est responsable du traitement des données
          personnelles collectées via la Plateforme. Contact pour toute question relative à vos données :
          {' '}{COMPANY.dpoEmail}
        </p>
      </Section>

      <Section title="2. Données collectées">
        <p>Selon votre utilisation de la Plateforme, nous collectons :</p>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li><strong>Données de compte</strong> : nom, prénom, email professionnel, mot de passe (haché), rôle</li>
          <li><strong>Données de profil</strong> : compétences, expérience, disponibilité, TJM (si renseignés)</li>
          <li><strong>Données CRM</strong> : contacts, organisations, opportunités saisies ou importées par l'utilisateur</li>
          <li><strong>Données de facturation</strong> : traitées par Stripe, non stockées directement par nous</li>
          <li><strong>Données techniques</strong> : adresse IP, logs de connexion, identifiant de session (pour la sécurité)</li>
          <li><strong>Cookies</strong> : voir section dédiée ci-dessous</li>
        </ul>
      </Section>

      <Section title="3. Finalités du traitement">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>Fourniture et amélioration du service (base légale : exécution du contrat)</li>
          <li>Sécurité et prévention de la fraude (base légale : intérêt légitime)</li>
          <li>Facturation et gestion comptable (base légale : obligation légale)</li>
          <li>Communication relative au service — alertes, notifications (base légale : exécution du contrat)</li>
          <li>Amélioration des modèles IA internes, de façon anonymisée lorsque possible (base légale : intérêt légitime)</li>
        </ul>
      </Section>

      <Section title="4. Sous-traitants et transferts de données">
        <p>
          Nous faisons appel aux sous-traitants suivants, chacun engagé contractuellement au respect du RGPD :
        </p>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li><strong>Render Services, Inc.</strong> — hébergement de l'application et de la base de données (UE — région Frankfurt)</li>
          <li><strong>Stripe, Inc.</strong> — traitement des paiements (certifié PCI-DSS, transferts encadrés par les clauses contractuelles types UE)</li>
          <li><strong>Groq / Google Gemini / OpenAI</strong> — traitement IA des contenus soumis pour analyse et génération (les requêtes peuvent transiter hors UE selon le fournisseur configuré)</li>
          <li><strong>Resend / fournisseur SMTP</strong> — envoi d'emails transactionnels</li>
        </ul>
        <p>
          Lorsque des données sont transférées hors Union Européenne, ces transferts s'appuient sur les
          clauses contractuelles types de la Commission européenne ou un mécanisme d'adéquation équivalent.
        </p>
      </Section>

      <Section title="5. Durée de conservation">
        <p>
          Les données de compte sont conservées pendant toute la durée de la relation contractuelle, puis
          archivées 3 ans à des fins de preuve, conformément aux obligations légales. Les données de
          facturation sont conservées 10 ans conformément aux obligations comptables. Les logs techniques
          sont conservés 12 mois maximum.
        </p>
      </Section>

      <Section title="6. Vos droits">
        <p>Conformément au RGPD (articles 15 à 22) et à la loi Informatique et Libertés, vous disposez des droits suivants :</p>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li>Droit d'accès à vos données</li>
          <li>Droit de rectification</li>
          <li>Droit à l'effacement (« droit à l'oubli »)</li>
          <li>Droit à la limitation du traitement</li>
          <li>Droit à la portabilité de vos données</li>
          <li>Droit d'opposition</li>
          <li>Droit de définir des directives relatives au sort de vos données après votre décès</li>
        </ul>
        <p>
          Pour exercer ces droits, contactez {COMPANY.dpoEmail}. Vous disposez également du droit
          d'introduire une réclamation auprès de la CNIL (www.cnil.fr) si vous êtes en France, ou de
          l'autorité de protection des données compétente dans votre pays de résidence.
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          La Plateforme utilise des cookies strictement nécessaires au fonctionnement (session
          d'authentification) ainsi que, sous réserve de votre consentement, des cookies de mesure
          d'audience anonymisée. Vous pouvez gérer vos préférences via le bandeau de consentement affiché
          lors de votre première visite, ou les paramètres de votre navigateur.
        </p>
      </Section>

      <Section title="8. Sécurité">
        <p>
          Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger
          vos données : chiffrement des mots de passe (bcrypt/argon2), connexions HTTPS exclusives,
          authentification par jetons JWT à expiration courte, isolation des données par espace de travail
          (« workspace »), et journalisation des accès sensibles.
        </p>
      </Section>

      <Section title="9. Mineurs">
        <p>La Plateforme est destinée à un usage professionnel et n'est pas conçue pour les mineurs de moins de 16 ans.</p>
      </Section>

      <Section title="10. Modification de cette politique">
        <p>
          Cette politique peut être mise à jour. La date de dernière mise à jour figure en haut de cette page.
          Les modifications substantielles vous seront notifiées.
        </p>
      </Section>
    </LegalLayout>
  );
}

// ── Mentions légales ─────────────────────────────────────────────────────────
function MentionsLegalesPage({ onBack }: { onBack?: () => void }) {
  return (
    <LegalLayout title="Mentions légales" updated="30 juin 2026" onBack={onBack}>
      <Section title="Éditeur du site">
        <p>
          {COMPANY.name}<br />
          Forme juridique : {COMPANY.legalForm}<br />
          Capital social : {COMPANY.capital}<br />
          Siège social : {COMPANY.address}<br />
          SIRET : {COMPANY.siret}<br />
          RCS : {COMPANY.rcs}<br />
          Représentant légal : {COMPANY.director}<br />
          Email : {COMPANY.email}
        </p>
      </Section>

      <Section title="Directeur de la publication">
        <p>{COMPANY.director}</p>
      </Section>

      <Section title="Hébergement">
        <p>
          {COMPANY.host}<br />
          {COMPANY.hostAddress}<br />
          Base de données et services applicatifs hébergés en région Europe (Frankfurt, Allemagne).
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L'ensemble des éléments du site (textes, graphismes, logo, icônes, structure, code source) est la
          propriété exclusive de {COMPANY.name}, sauf mention contraire, et est protégé par le droit
          d'auteur et le droit des marques. Toute reproduction, représentation, modification ou exploitation
          non autorisée est interdite.
        </p>
      </Section>

      <Section title="Données personnelles">
        <p>
          Le traitement de vos données personnelles est détaillé dans notre Politique de confidentialité,
          accessible depuis le pied de page de l'application.
        </p>
      </Section>

      <Section title="Crédits techniques">
        <p>
          Plateforme développée avec FastAPI, PostgreSQL, React et TypeScript. Hébergement Render Services, Inc.
          Paiements sécurisés par Stripe, Inc.
        </p>
      </Section>

      <Section title="Médiation et litiges">
        <p>
          Conformément à l'article L.616-1 du Code de la consommation, pour les utilisateurs ayant la
          qualité de consommateur, tout litige peut être soumis à un médiateur de la consommation. Les
          coordonnées du médiateur compétent seront communiquées sur demande.
        </p>
      </Section>
    </LegalLayout>
  );
}

const PAGES: Record<LegalSlug, React.ComponentType<{ onBack?: () => void }>> = {
  'cgu': CGUPage,
  'cgv': CGVPage,
  'confidentialite': PrivacyPage,
  'mentions-legales': MentionsLegalesPage,
};

export default function LegalPageRouter({ slug, onBack }: { slug: LegalSlug; onBack?: () => void }) {
  const Page = PAGES[slug];
  return <Page onBack={onBack} />;
}

export const LEGAL_LINKS: { slug: LegalSlug; label: string }[] = [
  { slug: 'mentions-legales', label: 'Mentions légales' },
  { slug: 'confidentialite', label: 'Confidentialité' },
  { slug: 'cgu', label: "CGU" },
  { slug: 'cgv', label: 'CGV' },
];
