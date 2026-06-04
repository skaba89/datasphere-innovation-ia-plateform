export type UserRole = 'admin' | 'manager' | 'consultant' | 'auditor' | 'client' | string;

export type AppPermission =
  | 'dashboard:read'
  | 'crm:read'
  | 'crm:write'
  | 'tenders:read'
  | 'tenders:write'
  | 'deliverables:read'
  | 'deliverables:write'
  | 'commercial:read'
  | 'operations:read'
  | 'team:read'
  | 'audit:read';

const rolePermissions: Record<string, AppPermission[]> = {
  admin: [
    'dashboard:read',
    'crm:read',
    'crm:write',
    'tenders:read',
    'tenders:write',
    'deliverables:read',
    'deliverables:write',
    'commercial:read',
    'operations:read',
    'team:read',
    'audit:read',
  ],
  manager: [
    'dashboard:read',
    'crm:read',
    'crm:write',
    'tenders:read',
    'tenders:write',
    'deliverables:read',
    'deliverables:write',
    'commercial:read',
    'operations:read',
    'team:read',
    'audit:read',
  ],
  consultant: [
    'dashboard:read',
    'crm:read',
    'tenders:read',
    'deliverables:read',
    'deliverables:write',
    'operations:read',
  ],
  auditor: [
    'dashboard:read',
    'crm:read',
    'tenders:read',
    'deliverables:read',
    'audit:read',
  ],
  client: [
    'dashboard:read',
    'deliverables:read',
  ],
};

export function normalizeRole(role?: string | null): string {
  return (role || 'client').trim().toLowerCase();
}

export function getRolePermissions(role?: string | null): AppPermission[] {
  return rolePermissions[normalizeRole(role)] || rolePermissions.client;
}

export function can(role: string | null | undefined, permission: AppPermission): boolean {
  return getRolePermissions(role).includes(permission);
}

export function canAny(role: string | null | undefined, permissions: AppPermission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}
