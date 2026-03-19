# Theme Keycloak SIRH

Ce dossier contient le theme de login moderne `sirh`.

## 1) Demarrer Keycloak avec le theme monte

Depuis `backend/` :

```bash
docker compose up -d keycloak
```

Le volume `./keycloak/themes` est monte vers `/opt/keycloak/themes`.
Les donnees Keycloak sont persistees dans le volume Docker `keycloak_data`.

## 2) Activer le theme dans le realm

1. Ouvrir `http://localhost:8080/admin`.
2. Aller dans le realm `SIRH`.
3. `Realm settings` -> `Themes`.
4. Choisir `Login theme = sirh`.
5. Enregistrer.

## Option rapide (auto-setup local)

Tu peux automatiser la creation/maj du realm, client et users demo :

```bash
./keycloak/bootstrap-local.sh
```

Ce script:
- cree/maj le realm `SIRH`
- applique `loginTheme=sirh`
- cree le client `sirh-frontend`
- cree les users demo `marie@acme.sn`, `amadou@acme.sn`, `fatou@acme.sn`, `ibrahima.sarr@acme.sn` (mot de passe `Demo2025!`)

## 3) Verifier

- Ouvrir la page de connexion du frontend.
- Faire un hard refresh (`Cmd+Shift+R`) si le style ne se met pas a jour.

## Notes dev

- Le `docker-compose.yml` desactive le cache de themes en local pour voir les changements CSS immediatement.
