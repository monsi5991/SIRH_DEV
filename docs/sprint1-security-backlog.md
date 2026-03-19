# Sprint 1 - Hardening sécurité (SIRH)

## Objectif
Fermer les failles d'exposition inter-rôles avant recette preprod.

## Terminés dans ce sprint
- Scope `self/team/company` appliqué sur `performance` (goals list + detail).
- Scope `self/team/company` appliqué sur `training` (certifications + sessions list/detail).
- Verrouillage de création d'entretien: impossible de cibler un employé hors périmètre.
- Verrouillage `workflows`:
  - lecture des instances limitée à `assignedToId` / `requestedById` hors admin RH,
  - action d'approbation/rejet/réassignation limitée à l'approbateur assigné.
- `dashboard/summary` et `dashboard/month-summary` rendus scope-aware (plus de métriques globales pour un manager hors de son périmètre).
- Logs debug auth désactivés par défaut (`AUTH_DEBUG=true` requis).

## À faire ensuite (Sprint 1.2)
- Ajouter tests d'autorisation API (matrice RH/Manager/Employé/IT) sur les routes sensibles.
- Ajouter protection explicite sur exports CSV/PDF si disponibles côté routes analytics/people.
- Vérifier tous les endpoints legacy alias pour s'assurer qu'ils héritent du même scope.
- Ajouter audit log dédié sur actions workflow critiques (`APPROVE`, `REJECT`, `CANCEL`, `REASSIGN`).

## Go/No-Go sécurité preprod
- [ ] Aucun endpoint sensible ne retourne des données hors scope utilisateur.
- [ ] Aucun document RH n'est accessible sans auth.
- [ ] Tokens Keycloak valides uniquement pour le client attendu.
- [ ] Seed destructif interdit hors dev.
- [ ] Tests d'accès rôle/scopes passants.
