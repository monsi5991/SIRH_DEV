# OVH Cloud - Plan de mise en place des environnements SIRH

## Décision

Oui, il faut prendre OVH en compte **maintenant**, mais de façon pragmatique:

- **Maintenant**: mettre en place le socle `dev / preprod / prod` (DB, auth, DNS, secrets, pipeline migration).
- **Après**: optimisation coût/perf, autoscaling, tuning observabilité avancée.

## Ce qu'on fait tout de suite (ordre recommandé)

1. Finaliser le code local et verrouiller la sécurité (déjà engagé).
2. Mettre en place **preprod** sur OVH en premier (pas la prod complète tout de suite).
3. Créer la DB preprod + realm Keycloak preprod + domaines preprod.
4. Brancher CI/CD avec `env:check` + `prisma migrate deploy`.
5. Valider les parcours RH/Manager/Employé en preprod.
6. Ouvrir prod seulement après recette validée.

## Cible d'architecture

- **dev**: local (docker) + données demo.
- **preprod**: OVH cloud, proche prod, données anonymisées/synthétiques.
- **prod**: OVH cloud isolé, données réelles, stricte gouvernance.

## Ressources OVH à provisionner maintenant

1. PostgreSQL
- 1 instance non-prod (préprod) + 1 instance prod, ou 1 cluster avec DB isolées et users séparés.
- DB:
  - `sirh_preprod`
  - `sirh_prod`
- users dédiés:
  - `sirh_preprod_user`
  - `sirh_prod_user`

2. Compute (API + Front)
- preprod: 1 serveur/app service.
- prod: 1 serveur/app service dédié.

3. Réseau / DNS / TLS
- Domaines:
  - `api-preprod.<votre-domaine>`
  - `preprod.<votre-domaine>`
  - `api.<votre-domaine>`
  - `app.<votre-domaine>`
- TLS via certificats valides.

4. Stockage documents
- Object Storage OVH recommandé pour prod/preprod (au lieu stockage disque local).
- Buckets séparés:
  - `sirh-preprod-docs`
  - `sirh-prod-docs`

5. Secret management
- Secrets séparés par environnement:
  - `DATABASE_URL`
  - `KEYCLOAK_*`
  - `NOTIFICATIONS_*`
  - tokens API externes

## Keycloak (important)

- Realms séparés:
  - `SIRH-dev`
  - `SIRH-preprod`
  - `SIRH-prod`
- Clients séparés:
  - `sirh-frontend` (dev)
  - `sirh-frontend-preprod`
  - `sirh-frontend-prod`

## Pipeline minimal recommandé

1. Build
- `npm --prefix frontend run build`
- `npm --prefix backend run prisma:generate`

2. Check env
- Backend:
  - `npm --prefix backend run env:check:preprod`
  - `npm --prefix backend run env:check:prod`
- Frontend:
  - `npm --prefix frontend run env:check:preprod`
  - `npm --prefix frontend run env:check:prod`

Frontend Vite:
- publier des variables `VITE_*` sur preprod/prod
- activer une redirection SPA vers `index.html` sur le domaine frontend pour supporter les deep links React Router

3. Migrations
- `npm --prefix backend run prisma:migrate:deploy`

4. Seed
- preprod/prod:
  - `npm --prefix backend run prisma:seed:reference`
- dev uniquement:
  - `npm --prefix backend run prisma:seed:demo`

## Ce qu'on peut repousser après la 1ère mise en ligne

- Autoscaling.
- Read replicas PostgreSQL.
- CDN avancé.
- SIEM/SOC complet.
- Observabilité avancée (APM distribué complet).

## Go/No-Go checklist préprod

- [ ] Variables env complètes et valides (`env:check` OK)
- [ ] Migrations déployées (`migrate deploy` OK)
- [ ] Uploads privés actifs (`UPLOADS_PUBLIC=false`)
- [ ] Auth Keycloak realm preprod opérationnelle
- [ ] RBAC testé RH/Manager/Employé/IT
- [ ] Workflows onboarding/offboarding testés end-to-end
- [ ] Sauvegardes DB testées (restore smoke test)
