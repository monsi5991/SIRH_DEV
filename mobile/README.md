# SIRH Mobile

Base Flutter mobile pour le SIRH web actuel.

## Ce qui est fourni ici

- configuration multi-environnement via `.env.*`
- auth Keycloak mobile via `flutter_appauth`
- stockage securise des tokens
- client Dio aligne sur l'API existante
- routing par role avec GoRouter
- dashboards mobiles de base pour RH, manager et employe
- repository de sync differentielle cible sur `GET /sync/changes`

## Prerequis

- Flutter 3.x
- Dart 3.x
- Xcode si tu compiles iOS sur macOS
- Android Studio ou les Android SDK command line tools si tu compiles Android
- VS Code avec l'extension Flutter

## Extensions VS Code a installer

- `Flutter` (`Dart-Code.flutter`)
- `Dart` (`Dart-Code.dart-code`)

L'extension Flutter installe aussi l'extension Dart si elle manque, mais je recommande de
les declarer toutes les deux dans le workspace pour eviter les postes incomplets.

## Important

Le SDK Flutter n'est pas present sur cette machine au moment de cette execution.
Le scaffold source est genere, mais les dossiers plateforme (`android/`, `ios/`) n'ont pas ete
crees ici automatiquement.

## Installation conseillee dans VS Code

1. Installe l'extension Flutter.
2. Ouvre la palette de commandes et lance `Flutter: New Project`.
3. Quand VS Code demande le SDK, choisis `Download SDK` si Flutter n'est pas encore installe.
4. Une fois le SDK en place, relance `Flutter: Run Flutter Doctor`.
5. Ouvre ensuite le dossier `mobile/` comme projet Flutter ou garde le mono-repo ouvert.

Apres installation de Flutter:

```bash
cd mobile
flutter create .
flutter pub get
flutter doctor
```

Puis lancer:

```bash
flutter run -t lib/main_dev.dart
```

## Temps reel backend

Le backend expose maintenant un flux SSE protege sur `GET /notifications/stream`.
Ce flux est prevu pour sortir du polling pur sur les notifications et completer
`GET /sync/changes` pour la sync differentielle mobile.
