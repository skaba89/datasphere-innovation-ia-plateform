export type UserRole =
  | 'superadmin'
  | 'admin'
  | 'director'
  | 'manager'
  | 'commercial'
  | 'consultant'
  | 'auditor'
  | 'reader'
  | 'client'
  | string;

export type AppPermission =
  | 'dashboard:read'
  | 'crm:read'
  | 'crm:write'
  | 'tenders:read'
  | 'tenders:write'
  | 'profiles:read'
  | 'profiles:write'
  | 'deliverables:read'
  | 'deliverables:write'
  | 'commercial:read'
  | 'commercial:write'
  | 'operations:read'
  | 'operations:write'
  | 'team:read'
  | 'team:write'
  | 'audit:read'
  | 'workspaces:read'
  | 'workspaces:write'
  | 'profile:read';

const allPermissions: AppPermission[] = [
  'dashboard:read',
  'crm:read',
  'crm:write',
  'tenders:read',
  'tenders:write',
  'profiles:read',
  'profiles:write',
  'deliverables:read',
  'deliverables:write',
  'commercial:read',
  'commercial:write',
  'operations:read',
  'operations:write',
  'team:read',
  'team:write',
  'audit:read',
  'workspaces:read',
  'workspaces:write',
  'profile:read',
];

const rolePermissions: Record<string, AppPermission[]> = {
  superadmin: allPermissions,
  admin: allPermissions,
  director: [
    'dashboard:read',
    'crm:read',
    'crm:write',
    'tenders:read',
    'tenders:write',
    'profiles:read',
    'deliverables:read',
    'deliverables:write',
    'commercial:read',
    'commercial:write',
    'operations:read',
    'operations:write',
    'team:read',
    'audit:read',
    'workspaces:read',
    'profile:read',
  ],
  manager: [
    'dashboard:read',
    'crm:read',
    'crm:write',
    'tenders:read',
    'tenders:write',
    'profiles:read',
    'deliverables:read',
    'deliverables:write',
    'commercial:read',
    'operations:read',
    'operations:write',
    'team:read',
    'audit:read',
    'workspaces:read',
    'profile:read',
  ],
  commercial: [
    'dashboard:read',
    'crm:read',
    'crm:write',
    'tenders:read',
    'tenders:write',
    'profiles:read',
    'deliverables:read',
    'commercial:read',
    'commercial:write',
    'workspaces:read',
    'profile:read',
  ],
  consultant: [
    'dashboard:read',
    'crm:read',
    'tenders:read',
    'profiles:read',
    'deliverables:read',
    'deliverables:write',
    'operations:read',
    'workspaces:read',
    'profile:read',
  ],
  auditor: [
    'dashboard:read',
    'crm:read',
    'tenders:read',
    'profiles:read',
    'deliverables:read',
    'operations:read',
    'audit:read',
    'profile:read',
  ],
  reader: [
    'dashboard:read',
    'crm:read',
    'tenders:read',
    'profiles:read',
    'deliverables:read',
    'commercial:read',
    'operations:read',
    'workspaces:read',
    'profile:read',
  ],
  client: [
    'dashboard:read',
    'deliverables:read',
    'profile:read',
  ],
};

// Mapping backend roles → frontend permission groups
// Backend emits: admin, manager, consultant, viewer
// Frontend extends: director, commercial, auditor, reader, client, superadmin
const ROLE_ALIASES: Record<string, string> = {
  // Backend → Frontend equivalences
  viewer:    'reader',    // backend "viewer" = frontend "reader"
  // identical roles (pass through)
  admin:     'admin',
  manager:   'manager',
  consultant: 'consultant',
  // Extended frontend roles (used when set directly)
  superadmin: 'superadmin',
  director:   'director',
  commercial: 'commercial',
  auditor:    'auditor',
  reader:     'reader',
  client:     'client',
};

export function normalizeRole(role?: string | null): string {
  const lower = (role || 'client').trim().toLowerCase();
  return ROLE_ALIASES[lower] ?? 'client';
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

export function isAdminRole(role?: string | null): boolean {
  return ['superadmin', 'admin'].includes(normalizeRole(role));
}
