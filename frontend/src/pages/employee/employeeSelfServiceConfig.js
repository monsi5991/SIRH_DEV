export const EMPLOYEE_REQUEST_SERVICES = [
  {
    id: "attestation",
    label: "Attestation",
    backendType: "ATTESTATION",
    title: "Demande d'attestation",
    description: "Attestation d'emploi, de salaire ou document administratif standard.",
    payloadFields: [
      { id: "documentType", label: "Type d'attestation", type: "text", placeholder: "Ex. attestation d'emploi" },
      { id: "neededBefore", label: "Besoin pour le", type: "date" },
    ],
  },
  {
    id: "data_change",
    label: "Modification de données",
    backendType: "DATA_CHANGE",
    title: "Demande de mise à jour du dossier salarié",
    description: "Corriger ou faire valider une information administrative ou contractuelle.",
    payloadFields: [
      { id: "fieldConcerned", label: "Champ concerné", type: "text", placeholder: "Ex. adresse, état civil" },
      { id: "requestedValue", label: "Nouvelle valeur", type: "textarea", placeholder: "Décrivez la modification attendue" },
    ],
  },
  {
    id: "payroll_question",
    label: "Question paie",
    backendType: "PAYROLL_SUPPORT",
    title: "Question sur ma paie",
    description: "Clarification sur un bulletin, un calcul ou un élément de rémunération.",
    payloadFields: [
      { id: "payrollPeriod", label: "Période concernée", type: "month" },
      { id: "topic", label: "Sujet", type: "text", placeholder: "Ex. retenue, prime, heures supplémentaires" },
    ],
  },
  {
    id: "leave_question",
    label: "Question congés",
    backendType: "OTHER",
    title: "Question sur mes congés",
    description: "Demande d'aide sur un solde, une validation ou une règle d'absence.",
    payloadFields: [
      { id: "leaveTopic", label: "Sujet", type: "text", placeholder: "Ex. solde CP, demi-journée, validation" },
      { id: "leavePeriod", label: "Période concernée", type: "date" },
    ],
  },
  {
    id: "contract_question",
    label: "Question contrat",
    backendType: "OTHER",
    title: "Question sur mon contrat",
    description: "Besoin d'éclaircissement sur votre contrat, avenant ou statut.",
    payloadFields: [
      { id: "contractTopic", label: "Sujet", type: "text", placeholder: "Ex. avenant, date de fin, clause" },
    ],
  },
  {
    id: "salary_advance",
    label: "Avance sur salaire",
    backendType: "PAYROLL_SUPPORT",
    title: "Demande d'avance sur salaire",
    description: "Demande exceptionnelle transmise aux équipes paie/RH selon les règles internes.",
    payloadFields: [
      { id: "requestedAmount", label: "Montant souhaité", type: "number", placeholder: "Ex. 150000" },
      { id: "neededBy", label: "Besoin pour le", type: "date" },
    ],
  },
  {
    id: "general_support",
    label: "Support RH général",
    backendType: "OTHER",
    title: "Demande RH générale",
    description: "Question ou besoin non couvert par les services fréquents.",
    payloadFields: [
      { id: "topic", label: "Sujet", type: "text", placeholder: "Ex. organisation, onboarding, process" },
    ],
  },
];

export const HR_FAQ_ITEMS = [
  {
    id: "profile-update",
    question: "Comment mettre à jour mes coordonnées et mes informations bancaires ?",
    answer: "Utilisez la page Mon profil. Les champs autorisés sont sauvegardés directement. Pour les données non modifiables, ouvrez une demande RH.",
  },
  {
    id: "missing-timesheet",
    question: "Que faire si mon pointage ou mes temps sont incomplets ?",
    answer: "Rendez-vous dans Temps & absences pour pointer, vérifier les anomalies puis relancer votre manager ou escalader aux RH si nécessaire.",
  },
  {
    id: "payslip-delay",
    question: "Je ne vois pas mon bulletin de paie, que faire ?",
    answer: "Vérifiez d'abord l'onglet Paie & documents. Si rien n'est publié, ouvrez une demande de type Question paie.",
  },
  {
    id: "contract-docs",
    question: "Où trouver mon contrat et mes documents signés ?",
    answer: "Ils sont centralisés dans Paie & documents, rubrique Mes documents.",
  },
  {
    id: "leave-balance",
    question: "Comment comprendre mon solde de congés ?",
    answer: "La page Temps & absences affiche le disponible, l'en attente et vos prochaines absences. Si un écart persiste, créez une demande RH.",
  },
];

export const PAYROLL_FAQ_ITEMS = [
  {
    id: "gross-net",
    title: "Comprendre le brut et le net",
    text: "Le brut correspond à la rémunération avant retenues. Le net correspond au montant versé après cotisations et ajustements.",
  },
  {
    id: "overtime",
    title: "Lire les heures supplémentaires",
    text: "Les heures supplémentaires proviennent des temps validés. En cas d'écart, vérifiez vos anomalies de temps avant la clôture paie.",
  },
  {
    id: "banking",
    title: "Modifier les coordonnées de paiement",
    text: "Les coordonnées bancaires et Mobile Money se mettent à jour depuis Mon profil, onglet Banque & paiement.",
  },
];
