# Analyse Backend

## Architecture

- FRONTEND_FRAMEWORK: React 19 + Vite + React Router 7
- BACKEND_FRAMEWORK: Express 4 (ESM)
- DATABASE_ORM: Prisma 5
- DATABASE: PostgreSQL
- MONOREPO: oui
  - `frontend/` application web
  - `backend/` API + Prisma
  - `mobile/` scaffold Flutter ajoute dans cette execution

## URLs

- DEV_API_URL: `http://localhost:4000`
- PREPROD_API_URL: `https://api-preprod.sirh.example.com`
- PROD_API_URL: `https://api.sirh.example.com`

Notes:
- l'API actuelle n'utilise pas de prefixe `/api`
- les routes sont exposees directement a la racine (`/me`, `/people/employees`, `/operations/leaves`, ...)

## Authentification

- Type: Keycloak / OIDC + JWT Bearer
- Header: `Authorization: Bearer <access_token>`
- Refresh token: aucun endpoint backend dedie detecte
- Token refresh: gere cote frontend via `keycloak.updateToken(...)`
- Token expiry: non detecte dans le code backend; controle delegue a Keycloak
- PKCE: oui (`pkceMethod: "S256"` dans le frontend web)
- Cookie: non pour l'auth API

## Format du token / mapping identite

- Verifie via `jose.jwtVerify`
- Claims critiques utilises:
  - `sub`
  - `email`
  - `iss`
  - `aud`
  - `azp`
  - `realm_access.roles`
  - `resource_access[CLIENT_ID].roles`
- Mapping DB:
  - priorite sur `User.keycloakSub + User.keycloakIssuer`
  - fallback sur `User.email`
  - liaison automatique en base si `keycloakSub` / `keycloakIssuer` manquent

## WebSocket

- Supporte: non detecte
- URL WS: absente
- Commentaire: aucune infrastructure `ws` / `WebSocketServer` n'est presente dans le backend actuel
- Alternative disponible: flux SSE protege sur `GET /notifications/stream` pour les notifications temps reel legeres

## Endpoint sync differentielle

- `GET /sync/changes`: ajoute dans cette execution
- Query:
  - `since=ISO_TIMESTAMP`
  - `entity_types=employees,leaves,timesheets,expenses,requests,documents,goals,notifications,onboarding,offboarding`
- Reponse:
  - `sync_timestamp`
  - `since`
  - `entity_types`
  - `changes`
  - `has_more`

## Decision auth Flutter

- Package recommande: `flutter_appauth + flutter_secure_storage + dio`
- Raisons:
  - backend protege par Bearer Keycloak
  - besoin PKCE
  - besoin de stocker access / refresh token cote mobile
  - besoin de recharger `/me` apres login pour obtenir roles + permissions metier

## Permissions par role

### RH
- Roles typiques: `HR`, `ADMIN`
- Scope: `COMPANY`
- Peut voir:
  - annuaire complet
  - contrats
  - documents
  - performance
  - dashboards RH
  - conformite
  - policies
  - journal d'audit
- Peut faire:
  - creer / modifier employes
  - approuver operations
  - lancer onboarding / offboarding
  - publier des politiques
  - gerer les workflows

### Manager
- Role typique: `MANAGER`
- Scope: `TEAM` + soi-meme
- Peut voir:
  - equipe
  - validations
  - presence / temps / depenses equipe
  - objectifs et entretiens de son perimetre
- Peut faire:
  - approuver conges / temps / depenses / demandes RH de l'equipe
- Restrictions:
  - pas de lecture remuneration / banque dans l'UI web
  - pas de lecture company-wide hors droits explicites

### Employe
- Role typique: `EMPLOYEE`
- Scope: `SELF`
- Peut voir:
  - `/dashboard/employee`
  - profil personnel
  - conges / documents / demandes / bulletins
  - objectifs et formations personnels
- Peut faire:
  - soumettre des demandes
  - soumettre conges / temps / depenses selon permissions

### Roles secondaires detectes
- `FINANCE`
- `IT`

## Permissions metier detectees

- `all`
- `admin_read`
- `analytics_read`
- `directory_read`
- `directory_write`
- `operations_read`
- `operations_write`
- `operations_bulk_update`
- `approvals_read`
- `approvals_write`
- `team_read`
- `team_write`
- `self_read`
- `self_write`

## Scope technique

- Resolution du scope via `resolveAccessContext(req)`
- Scopes disponibles:
  - `SELF`
  - `TEAM`
  - `COMPANY`
- Le scope manager inclut son equipe et lui-meme
- Le filtrage est applique cote backend pour `employees`, `leaves`, `timesheets`, `expenses`, `documents`, `hrRequests`, `interviews`, etc.

## Erreurs API

- 401: `Unauthorized`, `Missing Bearer token`, `Invalid token`, `User not found in DB`, ...
- 403: `Forbidden`
- 404: `Not found`, `employee_not_found`, `notification_not_found`, ...
- 409: conflits metier ponctuels (ex. policy title)
- 429: `Too many requests`
- 500: erreurs metier suffixees `_failed` ou message brut Prisma / Express

## Design system web de reference

- Fond principal: blanc
- Foreground principal: quasi noir (`hsl(0 0% 3.9%)`)
- Primary: quasi noir (`hsl(0 0% 9%)`)
- Border / input: gris clair (`hsl(0 0% 89.8%)`)
- Radius principal: `0.5rem`
- Focus ring: gris moyen (`hsl(0 0% 63%)`)
- Accent fonctionnel recurrent:
  - vert emeraude pour etats positifs / focus / surlignage
  - tons rouge / ambre pour alertes et exceptions
- Typographie:
  - stack systeme sans-serif
- Composants recurrents:
  - KPI cards
  - badges de statut
  - cartes sectionnees
  - tableaux RH
  - empty states
  - panneaux de validation

## Backend notes utiles pour Flutter

- `/me` est la source de verite pour le profil metier mobile
- les dashboards sont deja separes par role:
  - `/dashboard/employee`
  - `/dashboard/manager`
  - `/dashboard/hr`
- `notifications` est deja mobile-friendly:
  - `/notifications/stream`
  - `/notifications/mine`
  - `/notifications/mine/unread-count`
  - `/notifications/mine/:id/read`
  - `/notifications/mine/read-all`
- le backend expose maintenant un temps reel leger via SSE pour les notifications
- la sync differentielle est maintenant disponible via `/sync/changes`
