# SIRH UI & Permissions Conventions

## UI conventions
- Reuse existing primitives from `src/components/ui/*` (Button, Card, Badge, Tabs, Dialog, Input, Skeleton).
- Keep existing design tokens (`index.css`) and avoid introducing another design system.
- Prefer local page-level refactors over global CSS changes.
- Standard page structure:
  - `PageHeader` for title, description, actions
  - `SectionCard` for section blocks
  - `EmptyState` for empty/error fallback
  - `Skeletons` for loading states
- Keep micro-interactions subtle (`duration-150`) and accessible (`focus-visible`).

## Dashboard pattern (action-first)
- Top: greeting + contextual search.
- Priority section: `À faire` list with actionable rows.
- Overview sections: holidays, birthdays, who is away, approvals snapshot.
- Role-aware display:
  - EMPLOYEE: self scope
  - MANAGER: team scope (`managerId`)
  - HR/ADMIN: company scope

## Permissions & scopes
- Roles normalized in `src/lib/permissions.js`: `ADMIN`, `HR`, `MANAGER`, `EMPLOYEE`, `FINANCE`.
- Scopes:
  - `SELF`
  - `TEAM`
  - `COMPANY`
- Core helpers:
  - `checkPermission(...)`
  - `<Can ...>`
  - `<ScopeRoute ...>`
- Supported signatures:
  - `checkPermission({ user, requiredPermissions, requiredScope, targetEmployeeId, ... })`
  - `checkPermission(user, permission, { scope, resourceOwnerId, ... })`
- Permission aliases:
  - Business permissions (`employee.self.read`, `timeoff.approve.team`, `security.audit.read.company`, etc.) are mapped to legacy permissions (`self_read`, `operations_write`, `admin_read`, ...) for incremental migration.

## Routing migration strategy
- Keep legacy routes and redirect progressively to new business labels.
- Current redirects include:
  - `/resources/compliance` -> `/admin/workflows`
  - `/resources/policies` -> `/admin/policies`
  - `/admin/structure` -> `/admin/organization`
  - `/admin/permissions` -> `/admin/roles-permissions`
  - `/manager/approvals` -> `/manager/approvals-manager`

## Non-goals
- No payroll module expansion.
- No global redesign rewrite.
