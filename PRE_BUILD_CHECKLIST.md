# Pre-build checklist - Validation avant developpement Flutter

## Donnees maitrisees

- [x] Tous les modeles de donnees principaux lus et cartographies
- [x] `FIELD_MAPPING.md` cree
- [x] Enums et valeurs majeures documentees
- [x] Relations critiques documentees

## API maitrisee

- [x] `API_ENDPOINTS.md` cree
- [x] Base URL reelle identifiee
- [x] Format de reponse principal documente pour les modules critiques
- [x] Gestion des erreurs API documentee
- [x] Endpoint de sync differentielle ajoute: `GET /sync/changes`
- [x] Flux SSE notification ajoute: `GET /notifications/stream`

## Auth maitrisee

- [x] Type d'auth identifie: Keycloak / OIDC / Bearer JWT
- [x] Mapping JWT -> utilisateur DB documente
- [x] Strategy Flutter retenue: `flutter_appauth + flutter_secure_storage + dio`
- [x] Absence d'endpoint backend login/refresh/logout explicitee

## Permissions maitrisees

- [x] Regles SELF / TEAM / COMPANY documentees
- [x] Roles RH / Manager / Employe documentes
- [x] Champs sensibles identifies: salaire, banque, CNSS, IPRES

## Business logic maitrisee

- [x] Dashboards par role identifies (`/dashboard/employee`, `/dashboard/manager`, `/dashboard/hr`)
- [x] Flux d'approbation principaux identifies (conges, temps, frais, demandes RH)
- [x] Modules documents / onboarding / offboarding identifies
- [x] Notifications in-app documentees

## Design maitrise

- [x] Palette principale extraite
- [x] Radius / focus / composants recurrents identifies
- [x] Identite visuelle web exploitable pour le mobile

## Points d'attention avant phase Flutter avancee

- [ ] WebSocket backend natif absent (remplace pour l'instant par SSE sur les notifications)
- [ ] Offline-first local complet (Drift + queue de conflit) non implemente dans le mobile genere ici
- [ ] Aucun SDK Flutter local detecte sur cette machine pour valider la compilation

## Decision

- Le prompt peut etre execute de facon pragmatique:
  - audit web boucle
  - base Flutter scaffoldable
  - sync differentielle backend preparee
- Le temps reel notification est couvert par SSE; le WebSocket generalise et la persistence offline complete restent a finir dans une phase mobile suivante.
