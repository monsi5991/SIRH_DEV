# API Endpoints

## Regles globales

- Base URL actuelle: pas de prefixe `/api`
- Auth: `Authorization: Bearer <keycloak_access_token>`
- Profil metier: `GET /me`
- Sync mobile: `GET /sync/changes`

## Session / auth

| Methode | Endpoint | Auth | Reponse principale |
|---|---|---|---|
| GET | `/me` | oui | `{ user }` |

## Dashboard

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/dashboard/summary` | `team_read` ou `all` | KPI synthese globaux |
| GET | `/dashboard/month-summary` | `team_read` ou `all` | KPI mensuels |
| GET | `/dashboard/employee` | `self_read` ou `all` | dashboard employe |
| GET | `/dashboard/manager` | `team_read` ou `all` | dashboard manager |
| GET | `/dashboard/hr` | `directory_read` / `admin_read` / `all` | dashboard RH |

## Sync mobile

| Methode | Endpoint | Scope | Reponse principale |
|---|---|---|---|
| GET | `/sync/changes?since=ISO&entity_types=...` | scope backend applique | `{ sync_timestamp, changes, has_more }` |

## People

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/people/employees` | backend scope-aware | `{ employees }` ou `{ items, total }` selon appelant |
| GET | `/people/employees/:id` | backend scope-aware | `{ employee }` ou objet employe |
| POST | `/people/employees` | `all` | employe cree |
| PUT | `/people/employees/:id` | `all` | employe mis a jour |
| PATCH | `/people/employees/:id` | `all` | employe mis a jour |
| DELETE | `/people/employees/:id` | `all` | `{ ok: true }` |
| POST | `/people/employees/:id/documents` | `all` | document cree |
| DELETE | `/people/documents/:docId` | `all` | `{ ok: true }` |
| GET | `/people/counters/directory` | backend scope-aware | compteurs annuaire |
| GET | `/people/counters/performance` | backend scope-aware | compteurs performance |
| GET | `/people/counters/training` | backend scope-aware | compteurs formation |

## Leaves

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/operations/leaves/types` | auth | `{ items }` ou tableau types |
| GET | `/operations/leaves/balances` | auth scope-aware | `{ items }` balances |
| GET | `/operations/leaves` | auth scope-aware | `{ leaves, total }` |
| GET | `/operations/leaves/:id` | auth scope-aware | leave detail |
| GET | `/operations/leaves/:id/comments` | auth scope-aware | `{ items }` |
| POST | `/operations/leaves/:id/comments` | `operations_write` ou `self_write` | commentaire cree |
| POST | `/operations/leaves` | `operations_write` ou `self_write` | leave cree |
| PUT | `/operations/leaves/:id` | `operations_write` | leave mis a jour |
| PUT | `/operations/leaves/:id/status` | `operations_write` / `approvals_write` / `team_write` / `admin_read` | leave mis a jour |
| POST | `/operations/leaves/:id/escalate-to-hr` | auth scope-aware | escalation |
| PUT | `/operations/leaves/bulk-status` | `operations_bulk_update` ou `operations_write` | `{ ok, count }` |
| GET | `/operations/leaves/export.csv` | auth scope-aware | CSV |
| GET | `/operations/leaves/stats` | auth scope-aware | stats module |
| POST | `/operations/leaves/validate` | `operations_write` | resultat validation |
| DELETE | `/operations/leaves/:id` | `operations_write` | `{ ok: true }` |

## Timesheets

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/operations/timesheets` | auth scope-aware | `{ timesheets }` |
| POST | `/operations/timesheets` | `operations_write` ou `self_write` | timesheet cree |
| GET | `/operations/timesheets/clock/today` | auth | synthese pointage jour |
| POST | `/operations/timesheets/clock/in` | auth | pointage entree |
| POST | `/operations/timesheets/clock/out` | auth | pointage sortie |
| GET | `/operations/timesheets/anomalies/self` | self | `{ items }` |
| GET | `/operations/timesheets/anomalies` | team/company | `{ items }` |
| POST | `/operations/timesheets/anomalies/remind` | team/company | `{ ok }` |
| POST | `/operations/timesheets/anomalies/escalate-to-hr` | team/company | `{ ok }` |
| PUT | `/operations/timesheets/:id` | `operations_write` | timesheet mis a jour |
| PUT | `/operations/timesheets/:id/status` | `operations_write` | timesheet mis a jour |
| DELETE | `/operations/timesheets/:id` | `operations_write` | `{ ok: true }` |

## Expenses

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/operations/expenses` | auth scope-aware | `{ expenses }` |
| POST | `/operations/expenses` | `operations_write` | expense cree |
| PUT | `/operations/expenses/:id` | `operations_write` | expense mis a jour |
| PUT | `/operations/expenses/:id/status` | `operations_write` | expense mis a jour |
| DELETE | `/operations/expenses/:id` | `operations_write` | `{ ok: true }` |

## Events / planning

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/operations/events` | auth scope-aware | `{ events }` ou tableau |
| POST | `/operations/events` | `operations_write` | event cree |
| DELETE | `/operations/events/:id` | `operations_write` | `{ ok: true }` |

## Performance

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/performance/cycles` | auth | `{ items }` ou tableau |
| POST | `/performance/cycles` | `all` | cycle cree |
| GET | `/performance/goals` | auth scope-aware | `{ items }` ou tableau |
| GET | `/performance/goals/:id` | auth scope-aware | goal detail |
| POST | `/performance/goals` | `all` | goal cree |
| PUT | `/performance/goals/:id` | `all` | goal mis a jour |
| DELETE | `/performance/goals/:id` | `all` | `{ ok: true }` |

## Training

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/training/certifications/expiring` | auth scope-aware | `{ items }` ou tableau |
| GET | `/training/courses` | auth | `{ items }` ou tableau |
| POST | `/training/courses` | `all` | course cree |
| GET | `/training/sessions` | auth scope-aware | `{ items }` ou tableau |
| GET | `/training/sessions/:id` | auth scope-aware | session detail |
| POST | `/training/sessions` | `all` | session cree |
| PUT | `/training/sessions/:id` | `all` | session mise a jour |
| POST | `/training/sessions/:id/enroll` | `all` | inscription(s) |
| DELETE | `/training/sessions/:id/enroll/:employeeId` | `all` | `{ ok: true }` |
| POST | `/training/sessions/:id/duplicate` | `all` | session clonee |
| POST | `/training/sessions/:id/cancel` | `all` | session annulee |
| POST | `/training/sessions/:id/attendance` | `all` | attendance enregistree |

## Documents / onboarding / offboarding

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/documents/templates` | auth | `{ templates }` ou `{ onboarding, offboarding }` |
| GET | `/documents/onboarding/cases` | auth scope-aware | `{ items }` |
| GET | `/documents/onboarding/cases/:id` | auth scope-aware | `{ item }` |
| POST | `/documents/onboarding/start` | auth scope-aware | onboarding case cree |
| PUT | `/documents/onboarding/cases/:id` | auth scope-aware | case mise a jour |
| PUT | `/documents/onboarding/cases/:id/tasks/:taskId` | auth scope-aware | task mise a jour |
| GET | `/documents/offboarding/cases` | auth scope-aware | `{ items }` |
| GET | `/documents/offboarding/cases/:id` | auth scope-aware | `{ item }` |
| POST | `/documents/offboarding/start` | auth scope-aware | offboarding case cree |
| PUT | `/documents/offboarding/cases/:id` | auth scope-aware | case mise a jour |
| PUT | `/documents/offboarding/cases/:id/tasks/:taskId` | auth scope-aware | task mise a jour |
| POST | `/documents/upload` | auth | document upload |

## HR Requests

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/requests/hr` | auth scope-aware | `{ items, total }` |
| GET | `/requests/hr/:id` | auth scope-aware | `{ item }` |
| POST | `/requests/hr` | auth | request cree |
| POST | `/requests/hr/:id/approve` | manager / RH / scope | request mise a jour |
| POST | `/requests/hr/:id/reject` | manager / RH / scope | request mise a jour |
| POST | `/requests/hr/:id/cancel` | demandeur / RH | request mise a jour |

## Notifications

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/notifications/stream` | self | flux SSE `ready/ping/notification.created/...` |
| GET | `/notifications/mine` | self | `{ items }` |
| GET | `/notifications/mine/unread-count` | self | `{ unreadCount }` |
| POST | `/notifications/mine/:id/read` | self | `{ ok: true }` |
| POST | `/notifications/mine/read-all` | self | `{ ok: true, count }` |
| POST | `/notifications/send` | admin / RH / system | `{ ok: true, count, ids }` |

## Resources / compliance

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/resources/compliance/summary` | auth | `{ kpis, overdue, ... }` |
| GET | `/resources/compliance/counters` | auth | compteurs |
| GET | `/resources/compliance/tasks` | auth scope-aware | `{ items }` |
| POST | `/resources/compliance/tasks` | `all` | task creee |
| PATCH | `/resources/compliance/tasks/:id` | `all` | task mise a jour |
| POST | `/resources/compliance/tasks/:id/evidence` | `all` | preuve ajoutee |
| GET | `/resources/compliance/obligations` | auth | `{ items }` |
| POST | `/resources/compliance/generate/onboarding` | `all` | generation checklist |
| GET | `/resources/compliance/tasks/export/csv` | auth | CSV |

## Resources / policies

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/resources/policies` | auth scope-aware | `{ items }` |
| GET | `/resources/policies/counters` | auth | `{ total, pendingAcks }` |
| GET | `/resources/policies/:id` | auth scope-aware | policy detail |
| GET | `/resources/policies/:id/acks` | `all` | `{ items }` |
| GET | `/resources/policies/:id/coverage` | `all` | `{ totalEmployees, acked, pendingCount, pending }` |
| POST | `/resources/policies` | `all` | `{ policy, version }` |
| POST | `/resources/policies/:id/publish` | `all` | policy publiee |
| POST | `/resources/policies/:id/ack` | self ou `all` | ack |
| POST | `/resources/policies/:id/acknowledge` | self ou `all` | ack |

## Workflows

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/workflows/definitions` | auth | `{ items }` |
| POST | `/workflows/definitions` | admin / RH | definition creee |
| POST | `/workflows/definitions/:id/steps` | admin / RH | step creee |
| GET | `/workflows/instances` | auth scope-aware | `{ items }` |
| GET | `/workflows/instances/:id` | auth scope-aware | instance detail |
| POST | `/workflows/instances` | auth | instance creee |
| POST | `/workflows/instances/:id/actions` | auth scope-aware | action appliquee |

## Interviews

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/interviews` | auth scope-aware | `{ items }` |
| POST | `/interviews` | manager / RH | interview cree |
| PATCH | `/interviews/:id` | manager / RH | interview mis a jour |
| POST | `/interviews/:id/complete` | manager / RH | interview cloture |
| GET | `/interviews/campaigns` | auth scope-aware | `{ items }` |
| POST | `/interviews/campaigns` | admin / RH | campagne creee |

## Admin / analytics / connectors / uploads

| Methode | Endpoint | Scope / permission | Reponse principale |
|---|---|---|---|
| GET | `/admin/organization` | admin / RH | synthese organisation |
| GET | `/admin/roles-permissions` | admin / RH | synthese roles / permissions |
| GET | `/admin/workflows` | admin / RH | synthese workflows |
| GET | `/admin/audit-log` | admin / RH | `{ items }` |
| GET | `/analytics/hr/overview` | analytics / admin | payload analytics RH |
| GET | `/connectors/catalog` | auth | connecteurs disponibles |
| GET | `/connectors/insights/dashboard` | auth | contexte externe dashboard |
| GET | `/connectors/country-profile` | auth | donnees pays |
| GET | `/connectors/fx` | auth | change |
| GET | `/connectors/holidays` | auth | jours feries |
| GET | `/connectors/macro` | auth | macro indicateurs |
| GET | `/connectors/payments/providers` | auth | providers paiement |
| GET | `/connectors/weather` | auth | meteo |
| GET | `/uploads/*` | auth + token query option | fichier prive securise |
