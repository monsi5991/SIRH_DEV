# Frontend - migration CRA vers Vite

## 1) Etat actuel

- Stack frontend active: `Vite 7` + `@vitejs/plugin-react` + React 19 + React Router 7 + Tailwind 3
- Point d'entree: `frontend/index.html` + `frontend/src/main.jsx`
- Alias conserve: `@ -> src`
- Dossier de build conserve: `frontend/build/`
- Validation locale:
  - `npm --prefix frontend run build` OK
  - `npx --prefix frontend eslint frontend/src --ext .js,.jsx` OK
  - `npm --prefix frontend run test` OK (`passWithNoTests`)

## 2) Ce qui a ete migre

- suppression de `react-scripts`, `@craco/craco` et `cra-template`
- remplacement des scripts `start/build/test` par `vite`, `vite build` et `vitest`
- conservation des fichiers `.js` contenant du JSX via la config Vite
- remplacement du `public/index.html` CRA par un `frontend/index.html` natif Vite
- ajout d'un shim d'environnement dans `frontend/src/lib/env.js`

## 3) Environnement

Format prefere:

- `VITE_API_URL`
- `VITE_KEYCLOAK_URL`
- `VITE_KEYCLOAK_REALM`
- `VITE_KEYCLOAK_CLIENT_ID`

Compatibilite temporaire conservee:

- `REACT_APP_API_URL`
- `REACT_APP_KEYCLOAK_URL`
- `REACT_APP_KEYCLOAK_REALM`
- `REACT_APP_KEYCLOAK_CLIENT_ID`

Le script `frontend/scripts/env-check.mjs` accepte les deux formats et avertit lorsqu'un projet utilise encore les cles legacy `REACT_APP_*`.

## 4) Impacts de deploiement

- le build continue de sortir dans `frontend/build/` pour ne pas casser les runbooks existants
- le frontend doit servir `index.html` en fallback sur toutes les routes applicatives React Router
- les secrets frontend preprod/prod doivent desormais etre declares en `VITE_*`

## 5) Risques restants

- chunk principal encore volumineux (`~286 kB gzip`), sans blocage fonctionnel
- dependances frontend encore auditees avec vulnerabilites connues dans l'arbre npm
- aucune suite de tests frontend metier n'existe encore, seulement un runner `vitest` pret a l'emploi

## 6) Suite recommandee

1. Basculer les `.env` reels vers `VITE_*`
2. Ajouter un smoke test frontend sur login + routing protege
3. Introduire du code-splitting sur les gros modules RH/admin/analytics
4. Nettoyer ensuite les vulnerabilites npm restantes sans casser le produit
