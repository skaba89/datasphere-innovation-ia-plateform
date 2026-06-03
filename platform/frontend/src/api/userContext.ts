/**
 * User context helpers — read current user from localStorage.
 * Set at login, cleared at logout. Used across all components.
 */

export interface StoredUser {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_active: boolean;
}

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('ds_user');
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

/** Returns "Prénom Nom" or email or "Utilisateur" */
export function getUserName(): string {
  const user = getStoredUser();
  if (!user) return 'Utilisateur';
  if (user.first_name || user.last_name) {
    return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  }
  return user.email;
}

/** Returns "Prénom" only */
export function getUserFirstName(): string {
  const user = getStoredUser();
  return user?.first_name || user?.email?.split('@')[0] || 'vous';
}
