# Mapping des champs API -> Flutter

## Convention generale

- API actuelle: majoritairement `camelCase`
- Dates: ISO string cote transport
- Enums: souvent stockes en majuscules Prisma ou strings metier (`Pending`, `Submitted`, `ACTIVE`, ...)
- Recommandation Flutter:
  - conserver les noms Dart en `camelCase`
  - mapper les enums backend vers enums Dart dedies

## User (/me)

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| email | string | email | requis |
| firstName | string | firstName | requis |
| lastName | string | lastName | requis |
| employeeId | string|null | employeeId | lien employe |
| tenantId | string | tenantId | requis |
| tenant.id | string | tenantId | sous-objet |
| tenant.name | string | tenantName | sous-objet |
| roles | string[] | roles | `ADMIN`, `HR`, `MANAGER`, `EMPLOYEE`, `FINANCE`, `IT` |
| permissions | string[] | permissions | permissions metier |

## Employee

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| tenantId | string | tenantId | requis |
| firstName | string | firstName | requis |
| lastName | string | lastName | requis |
| email | string | email | requis |
| phone | string|null | phone | nullable |
| phoneWhatsApp | string|null | phoneWhatsApp | nullable |
| country | string | country | default `SN` |
| department | string|null | department | nullable |
| site | string|null | site | nullable |
| position | string|null | position | nullable |
| status | enum | status | `ACTIVE` / `INACTIVE` |
| joinDate | date|null | joinDate | nullable |
| endDate | date|null | endDate | nullable |
| contractType | enum|null | contractType | `CDI`, `CDD`, `STAGE`, `INTERIM`, `APPRENTISSAGE` |
| baseSalary | int|null | baseSalary | sensible RH |
| userId | string|null | userId | liaison auth |
| cnss | string|null | cnss | sensible |
| ipres | string|null | ipres | sensible |
| bankName | string|null | bankName | sensible |
| bankIban | string|null | bankIban | sensible |
| bankAccount | string|null | bankAccount | sensible |
| managerId | string|null | managerId | scope manager |
| createdAt | date | createdAt | requis |
| updatedAt | date | updatedAt | requis |

## Leave

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| employee | string | employeeLabel | nom libre / legacy |
| employeeId | string|null | employeeId | scope |
| start | date | startDate | mapper en `DateTime` |
| end | date | endDate | mapper en `DateTime` |
| type | string | leaveTypeCode | ex. `CP` |
| paid | boolean | paid | requis |
| halfDay | string|null | halfDay | nullable |
| status | string | status | ex. `Pending`, `Approved`, `Rejected` |
| createdAt | date | createdAt | requis |
| updatedAt | date | updatedAt | requis |

## LeaveType

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| code | string | code | requis |
| label | string | label | requis |
| category | enum | category | `VACATION`, `RTT`, `SICK`, `PARENTAL`, `EXCEPTIONAL`, `UNPAID`, `OTHER` |
| unit | enum | unit | `DAY`, `HOUR` |
| defaultAnnualAllowance | float | defaultAnnualAllowance | requis |
| carryoverLimit | float|null | carryoverLimit | nullable |
| requiresDocument | boolean | requiresDocument | requis |
| isActive | boolean | isActive | requis |
| country | string|null | country | nullable |

## EmployeeLeaveBalance

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| employeeId | string | employeeId | requis |
| leaveTypeId | string | leaveTypeId | requis |
| periodYear | int | periodYear | requis |
| openingBalance | float | openingBalance | requis |
| accrued | float | accrued | requis |
| consumed | float | consumed | requis |
| pending | float | pending | requis |
| adjustments | float | adjustments | requis |
| available | float | available | requis |

## Timesheet

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| employee | string | employeeLabel | legacy |
| employeeId | string|null | employeeId | scope |
| date | date | date | requis |
| hours | float | hours | requis |
| project | string|null | project | nullable |
| note | string|null | note | nullable |
| status | string | status | ex. `Submitted`, `Approved`, `Rejected` |
| approvedBy | string|null | approvedBy | nullable |
| approvedAt | date|null | approvedAt | nullable |
| type | string | entryType | ex. `REG` |
| premium | float|null | premium | nullable |
| createdAt | date | createdAt | requis |

## Expense

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| employee | string | employeeLabel | legacy |
| employeeId | string|null | employeeId | scope |
| date | date | date | requis |
| category | string | category | requis |
| amount | int | amount | requis |
| currency | string | currency | default `XOF` |
| taxTreatment | string | taxTreatment | default `REIMBURSEMENT` |
| status | string | status | ex. `Submitted`, `Approved`, `Rejected` |
| createdAt | date | createdAt | requis |
| updatedAt | date | updatedAt | requis |

## HrRequest

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| requesterUserId | string|null | requesterUserId | nullable |
| employeeId | string|null | employeeId | nullable |
| type | enum | type | `ATTESTATION`, `DATA_CHANGE`, `REMOTE_WORK`, `IT_ACCESS`, `PAYROLL_SUPPORT`, `OTHER` |
| title | string | title | requis |
| description | string|null | description | nullable |
| payload | json|null | payload | details metier |
| status | enum | status | `DRAFT`, `SUBMITTED`, `PENDING_MANAGER`, `PENDING_HR`, `APPROVED`, `REJECTED`, `CANCELED`, `CLOSED` |
| priority | enum | priority | `LOW`, `NORMAL`, `HIGH`, `URGENT` |
| currentApproverId | string|null | currentApproverId | nullable |
| slaDueAt | date|null | slaDueAt | nullable |
| submittedAt | date | submittedAt | requis |
| resolvedAt | date|null | resolvedAt | nullable |
| updatedAt | date | updatedAt | requis |

## Goal

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| employeeId | string | employeeId | requis |
| cycleId | string|null | cycleId | nullable |
| title | string | title | requis |
| status | string | status | default `on_track` |
| progress | int | progress | 0..100 |
| startDate | date|null | startDate | nullable |
| endDate | date|null | endDate | nullable |
| createdAt | date | createdAt | requis |
| updatedAt | date | updatedAt | requis |

## Document

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| employeeId | string | employeeId | requis |
| label | string | label | requis |
| type | string|null | type | nullable |
| url | string | url | securise via `/uploads/*` |
| expiresAt | date|null | expiresAt | nullable |
| createdAt | date | createdAt | requis |

## Notification

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| userId | string|null | userId | destinataire |
| actorId | string|null | actorId | emetteur |
| channel | enum | channel | `IN_APP`, `EMAIL`, `SMS`, `WHATSAPP`, `PUSH` |
| type | string | type | libre |
| title | string | title | requis |
| body | string | body | requis |
| data | json|null | data | deep-link / contexte |
| status | enum | status | `PENDING`, `SENT`, `DELIVERED`, `FAILED`, `READ` |
| readAt | date|null | readAt | nullable |
| sentAt | date|null | sentAt | nullable |
| createdAt | date | createdAt | requis |

## OnboardingCase

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| employeeId | string|null | employeeId | nullable |
| employeeName | string | employeeName | snapshot |
| employeeFirstName | string|null | employeeFirstName | snapshot |
| employeeLastName | string|null | employeeLastName | snapshot |
| employeeEmail | string|null | employeeEmail | snapshot |
| employeePosition | string|null | employeePosition | snapshot |
| status | string | status | `open`, `closed`, `draft` |
| currentStep | string | currentStep | ex. `collect`, `docs`, `validate`, `done` |
| templates | json|null | templates | dynamique |
| checklist | json|null | checklist | dynamique |
| updatedAt | date | updatedAt | requis |

## OffboardingCase

| Champ API | Type API | Champ Dart Flutter | Notes |
|---|---|---|---|
| id | string | id | requis |
| employeeId | string|null | employeeId | nullable |
| employeeName | string | employeeName | snapshot |
| employeeFirstName | string|null | employeeFirstName | snapshot |
| employeeLastName | string|null | employeeLastName | snapshot |
| employeeEmail | string|null | employeeEmail | snapshot |
| reason | string|null | reason | nullable |
| status | string | status | `open`, ... |
| currentStep | string | currentStep | ex. `letter` |
| templates | json|null | templates | dynamique |
| checklist | json|null | checklist | dynamique |
| updatedAt | date | updatedAt | requis |
