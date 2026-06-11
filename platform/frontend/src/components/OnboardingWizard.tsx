// Shim — the full wizard is SetupWizard.tsx (shown in DashboardPage)
// AppRoot uses this lighter version for the initial setup flow

export function shouldShowOnboarding(): boolean {
  try { return sessionStorage.getItem('onboarding_done') !== 'true'; } catch { return false; }
}

export function markOnboardingDone(): void {
  try { sessionStorage.setItem('onboarding_done', 'true'); } catch {}
}

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  // Immediately complete — full onboarding is handled in DashboardPage via SetupWizard
  onComplete();
  return null;
}
