# SIRH - Hardening sécurité + stratégie d'environnements

## 1) Décisions sécurité implémentées

- **Uploads privés par défaut**: `/uploads/*` n'est plus exposé en public.
  - Accès via authentification Keycloak + RBAC + scope employé.
  - Exception locale possible uniquement avec `UPLOADS_PUBLIC=true` et hors production.
- **Scope onboarding/offboarding**:
  - `team_read` et `team_write` limités aux employés du périmètre manager.
  - Les dossiers sans `employeeId` ne sont lisibles/modifiables qu'en scope company.
- **Keycloak audience durcie**:
  - Token accepté seulement si `aud` contient le client **ou** `azp === KEYCLOAK_CLIENT_ID`.
  - `aud=account` n'est plus accepté sauf option explicite `KEYCLOAK_ALLOW_ACCOUNT_AUD=true`.
- **Binding d'identité Keycloak**:
  - Ajout `User.keycloakSub` + `User.keycloakIssuer`.
  - Mapping DB prioritaire sur `sub+issuer`, fallback email avec liaison automatique au premier login.
- **Upload validation**:
  - Taille max configurable (`MAX_UPLOAD_SIZE_MB`).
  - Types MIME autorisés (PDF, images, DOC/DOCX selon module).
- **Garde-fou seed**:
  - `seed.js` destructif uniquement si `ALLOW_DESTRUCTIVE_SEED=true` ou mode dev/test.
  - `seed.reference.js` non destructif disponible pour préprod/prod.

## 2) Environnements cibles

## dev
- Realm: `SIRH-dev`
- DB: `sirh_dev`
- Seed demo autorisé
- `UPLOADS_PUBLIC=true` possible pour confort local

## preprod
- Realm: `SIRH-preprod`
- DB: `sirh_preprod`
- Données anonymisées/synthétiques
- `UPLOADS_PUBLIC=false` obligatoire
- Migrations via `prisma migrate deploy`

## prod
- Realm: `SIRH-prod`
- DB: `sirh_prod`
- Aucun seed demo
- Uploads privés, backups, monitoring, alerting
- Migrations via `prisma migrate deploy` avec fenêtre de changement

## 3) PostgreSQL

Minimum requis:
- 1 base séparée par environnement (`sirh_dev`, `sirh_preprod`, `sirh_prod`)
- 1 utilisateur DB séparé par environnement

Recommandation forte:
- prod sur instance/cluster dédié
- dev/preprod peuvent partager un serveur non-prod **uniquement** si bases + users + backups séparés

## 4) Variables d'environnement minimales

Backend:
- `DATABASE_URL`
- `KEYCLOAK_ISSUER`
- `KEYCLOAK_CLIENT_ID`
- `CORS_ALLOWED_ORIGINS`
- `UPLOADS_PUBLIC`
- `MAX_UPLOAD_SIZE_MB`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `NOTIFICATIONS_*`

Frontend:
- `VITE_API_URL`
- `VITE_KEYCLOAK_URL`
- `VITE_KEYCLOAK_REALM`
- `VITE_KEYCLOAK_CLIENT_ID`

## 5) Runbook minimal

1. Copier les templates `.env.*.example` dans chaque environnement.
2. Créer realm Keycloak dédié + client dédié.
3. Exécuter migration:
   - `npx prisma migrate deploy`
4. Seed:
   - dev: `npm run prisma:seed:demo`
   - preprod/prod: `npm run prisma:seed:reference`
5. Vérifier accès fichiers:
   - sans token => refus
   - avec token et scope conforme => accès OK
6. Vérifier la config env:
   - backend: `npm --prefix backend run env:check:preprod` puis `env:check:prod`
   - frontend: `npm --prefix frontend run env:check:preprod` puis `env:check:prod`
   - les scripts utilisent `.env.preprod/.env.production` si présents, sinon fallback vers `*.example`.
