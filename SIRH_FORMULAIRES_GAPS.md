# Audit des formulaires SIRH (état actuel + ajouts recommandés)

## 1) Formulaires déjà en place (base solide)

- **Congés** : formulaire modal dédié (`LeaveFormDialog`) avec validations minimales et submit clair.
- **Annuaire / Employés** : création/édition via `EmployeeFormDialog` + `EmployeeForm`.
- **Performance** : création d’objectif (`GoalFormDialog`) et écrans de détail.
- **Formation** : planification de session (`SessionFormDialog`).
- **Documents** : démarrage onboarding/offboarding avec champs employé + templates + checklist.
- **Policies** : formulaire de création d’une policy (titre/catégorie/version/url).

## 2) Gaps principaux détectés (priorisés)

## P0 — À corriger en premier (impact direct UX/fiabilité)

1. **Ops / Dépenses : création via `prompt()`**
   - Actuel : création faite par popups navigateur.
   - Problème : UX fragile, pas de validation riche, pas de pièces jointes justificatives.
   - À ajouter : `ExpenseFormDialog` (employé, date, catégorie, montant, devise, traitement fiscal, commentaire, upload justificatif).

2. **Ops / Timesheets : création via `prompt()`**
   - Actuel : saisie des feuilles de temps en popups.
   - Problème : même limites UX/validation.
   - À ajouter : `TimesheetFormDialog` (employé, date, heures, type, premium, projet, note).

3. **Ops / Planning : création d’évènement via `prompt()`**
   - Actuel : titre/date/heure/type/etc en popups.
   - Problème : pas de contrôle robuste des champs (emails participants, date/heure, type).
   - À ajouter : `EventFormDialog` (avec validation et pré-remplissage).

4. **Incohérence API front/back sur la mise à jour de statut (timesheets/expenses)**
   - Front appelle `PUT /operations/*/:id/status`.
   - Back expose `PUT /operations/*/:id`.
   - Action recommandée : aligner les endpoints (adapter front vers `/:id` ou ajouter routes `/:id/status` côté back).

## P1 — Forte valeur fonctionnelle RH

5. **Performance : édition d’objectif non branchée**
   - Actuel : bouton éditer affiche “Édition à connecter”.
   - Back dispose déjà de `PUT /performance/goals/:id`.
   - À ajouter : `GoalEditDialog` (statut, progression, dates, titre).

6. **Performance : création de cycles non exposée en UI**
   - Back expose `POST /performance/cycles` mais pas de formulaire dédié visible.
   - À ajouter : `CycleFormDialog` (nom, période, start/end dates).

7. **Compliance : preuve par URL via `prompt()` alors que l’upload fichier existe côté backend**
   - Actuel : ajout de preuve par URL uniquement.
   - Back expose `POST /resources/compliance/tasks/:id/evidence` (upload fichier).
   - À ajouter : `EvidenceUploadDialog` (fichier + commentaire + fallback URL).

8. **Compliance : création de tâche conformité non visible dans l’écran principal**
   - Back expose `POST /resources/compliance/tasks`.
   - À ajouter : `ComplianceTaskFormDialog` (titre, échéance, owner, criticité, obligation liée).

## P2 — Industrialisation documentaire

9. **Policies : formulaire trop minimal pour un cycle de vie documentaire RH**
   - Actuel : titre/catégorie/version/fileUrl.
   - À ajouter : champs `effectiveDate`, audience (entité/département), rappel d’ack, fichier upload (pas seulement URL), owner.

10. **Onboarding/Offboarding : remplacer les inputs inline par un vrai form composable**
   - Actuel : champs inline + bouton action.
   - À ajouter : `EmployeeIdentityForm` réutilisable (validations zod/react-hook-form), avec assignee RH, date d’entrée/sortie, manager, site, contrat.

## 3) Roadmap d’implémentation suggérée

### Sprint 1 (P0)
- Créer `ExpenseFormDialog`, `TimesheetFormDialog`, `EventFormDialog`.
- Corriger l’alignement endpoints `/:id` vs `/:id/status`.
- Ajouter validations front (zod + messages FR).

### Sprint 2 (P1)
- `GoalEditDialog` + `CycleFormDialog`.
- `EvidenceUploadDialog` + `ComplianceTaskFormDialog`.

### Sprint 3 (P2)
- Enrichissement Policies.
- Factorisation formulaires onboarding/offboarding.

## 4) KPIs de suivi (pour vérifier l’impact)

- Taux d’erreur de saisie par module (avant/après).
- Temps moyen de création d’une demande (dépense/temps/évènement).
- Taux de complétion des champs obligatoires.
- Taux de conformité documentaire (proof upload / tâches dues).
