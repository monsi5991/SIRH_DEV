// src/data/mock.js

// Mock authentication data

export const mockUsers = [
  {
    id: '1',
    email: 'marie@acme.sn',
    password: 'password123',
    firstName: 'Marie',
    lastName: 'Diop',
    role: 'RH',
    avatar: null,
    permissions: ['all'],
    tenant: {
      id: 'acme-sn',
      name: 'Acme Sénégal SA',
      country: 'SN',
      currency: 'XOF',
      plan: 'growth',
      addons: ['whatsapp']
    },
    entity: {
      id: 'acme-sn-sa',
      name: 'Acme Sénégal SA',
      country: 'SN',
      site: 'Dakar'
    }
  },
  {
    id: '2',
    email: 'amadou@acme.sn',
    password: 'password123',
    firstName: 'Amadou',
    lastName: 'Ba',
    role: 'Manager',
    permissions: ['operations_read', 'operations_write', 'people_read', 'analytics_limited'],
    tenant: {
      id: 'acme-sn',
      name: 'Acme Sénégal SA',
      country: 'SN',
      currency: 'XOF',
      plan: 'growth',
      addons: ['whatsapp']
    },
    entity: {
      id: 'acme-sn-sa',
      name: 'Acme Sénégal SA',
      country: 'SN',
      site: 'Dakar'
    },
    team: ['3', '4', '5'] // Employee IDs under management
  },
  {
    id: '3',
    email: 'fatou@acme.sn',
    password: 'password123',
    firstName: 'Fatou',
    lastName: 'Sow',
    role: 'Employee',
    permissions: ['self_read', 'self_write', 'directory_read'],
    tenant: {
      id: 'acme-sn',
      name: 'Acme Sénégal SA',
      country: 'SN',
      currency: 'XOF',
      plan: 'growth',
      addons: ['whatsapp']
    },
    entity: {
      id: 'acme-sn-sa',
      name: 'Acme Sénégal SA',
      country: 'SN',
      site: 'Dakar'
    },
    manager: '2', // Reports to Amadou Ba
    department: 'Marketing',
    position: 'Responsable Marketing'
  }
];

export const mockTenants = [
  {
    id: 'acme-sn',
    name: 'Acme Sénégal SA',
    country: 'SN',
    currency: 'XOF',
    plan: 'growth',
    addons: ['whatsapp'],
    branding: {
      logo: null,
      primaryColor: '#059669',
      secondaryColor: '#10b981'
    },
    entities: [
      {
        id: 'acme-sn-sa',
        name: 'Acme Sénégal SA',
        country: 'SN',
        site: 'Dakar'
      },
      {
        id: 'acme-sn-thies',
        name: 'Acme Thiès',
        country: 'SN',
        site: 'Thiès'
      }
    ]
  }
];

// Role-based dashboard configurations
export const roleDashboards = {
  RH: {
    modules: [
      'home', 'operations', 'documents', 'people', 
      'resources', 'analytics', 'admin'
    ],
    kpis: [
      'totalEmployees', 'activeEmployees', 'onLeave', 
      'newHires', 'pendingValidations', 'upcomingBirthdays'
    ],
    actions: [
      'createLeaveRequest', 'createExpenseReport', 'addEmployee',
      'createWorkflow', 'uploadDocument', 'scheduleInterview'
    ]
  },
  Manager: {
    modules: [
      'home', 'operations', 'people', 'analytics'
    ],
    kpis: [
      'teamSize', 'teamOnLeave', 'teamPendingRequests', 'teamPerformance'
    ],
    actions: [
      'createLeaveRequest', 'createExpenseReport', 
      'scheduleInterview', 'createWorkflow'
    ]
  },
  Employee: {
    modules: [
      'home', 'operations_self', 'people_directory'
    ],
    kpis: [
      'myLeaveBalance', 'myPendingRequests', 'upcomingEvents'
    ],
    actions: [
      'createLeaveRequest', 'createExpenseReport', 'uploadDocument'
    ]
  }
};

// Generate mock data for employee dashboard
export const getEmployeeDashboardData = (userId) => {
  return {
    leaveBalance: {
      annual: { total: 30, used: 8, remaining: 22 },
      sick: { total: 15, used: 2, remaining: 13 },
      personal: { total: 5, used: 1, remaining: 4 }
    },
    myRequests: [
      {
        id: '1',
        type: 'leave',
        title: 'Congé annuel - 3 jours',
        status: 'pending',
        date: '2025-01-15',
        description: 'Congé personnel'
      },
      {
        id: '2',
        type: 'expense',
        title: 'Note de frais - Transport',
        status: 'approved',
        date: '2025-01-10',
        amount: 25000
      }
    ],
    upcomingEvents: [
      {
        id: '1',
        title: 'Entretien annuel',
        date: '2025-01-25',
        time: '14:00',
        type: 'meeting'
      },
      {
        id: '2',
        title: 'Formation sécurité',
        date: '2025-01-30',
        time: '09:00',
        type: 'training'
      }
    ]
  };
};

// Generate mock data for manager dashboard
export const getManagerDashboardData = (userId) => {
  return {
    teamStats: {
      totalTeamMembers: 8,
      onLeave: 2,
      pendingRequests: 3,
      upcomingReviews: 2
    },
    teamRequests: [
      {
        id: '1',
        employeeName: 'Fatou Sow',
        type: 'leave',
        title: 'Congé maladie - 2 jours',
        status: 'pending',
        date: '2025-01-20'
      },
      {
        id: '2',
        employeeName: 'Omar Ndiaye',
        type: 'expense',
        title: 'Déplacement client',
        status: 'pending',
        amount: 45000,
        date: '2025-01-21T10:00:00Z' // ✅ ajouté (ISO)
      }
    ],
    teamPerformance: {
      averageRating: 4.2,
      completedGoals: 85,
      onTrack: 6,
      needsAttention: 1
    }
  };
}; // Mock data for demo purposes

export * from './authMock';

export const mockValidationItems = {
  leaves: [
    {
      id: '1',
      employeeName: 'Amadou Ba',
      type: 'annual',
      startDate: '2025-01-15',
      endDate: '2025-01-22',
      duration: '7 jours',
      status: 'pending',
      requestDate: '2025-01-10T10:00:00Z'
    },
    {
      id: '2', 
      employeeName: 'Fatou Sow',
      type: 'sick',
      startDate: '2025-01-20',
      endDate: '2025-01-22',
      duration: '2 jours',
      status: 'pending',
      requestDate: '2025-01-18T14:30:00Z'
    },
    {
      id: '3',
      employeeName: 'Omar Ndiaye',
      type: 'personal',
      startDate: '2025-02-01',
      endDate: '2025-02-03',
      duration: '2 jours',
      status: 'pending',
      requestDate: '2025-01-25T09:15:00Z'
    }
  ],
  expenses: [
    {
      id: '1',
      employeeName: 'Aminata Diallo',
      category: 'Transport',
      amount: 25000,
      currency: 'XOF',
      date: '2025-01-18',
      status: 'pending',
      description: 'Taxi Dakar-Thiès'
    },
    {
      id: '2',
      employeeName: 'Moussa Kane',
      category: 'Repas',
      amount: 15000,
      currency: 'XOF', 
      date: '2025-01-19',
      status: 'pending',
      description: 'Déjeuner client'
    },
    {
      id: '3',
      employeeName: 'Aissatou Fall',
      category: 'Hébergement',
      amount: 85000,
      currency: 'XOF',
      date: '2025-01-17',
      status: 'pending',
      description: 'Hôtel Saly 2 nuits'
    },
    {
      id: '4',
      employeeName: 'Cheikh Diop',
      category: 'Transport',
      amount: 45000,
      currency: 'XOF',
      date: '2025-01-16',
      status: 'pending',
      description: 'Billet avion Dakar-Bamako'
    },
    {
      id: '5',
      employeeName: 'Mariama Sy',
      category: 'Matériel',
      amount: 35000,
      currency: 'XOF',
      date: '2025-01-15',
      status: 'pending',
      description: 'Fournitures bureau'
    }
  ],
  timeAnomalies: [
    {
      id: '1',
      employeeName: 'Ibrahima Sarr',
      type: 'overtime',
      date: '2025-01-18',
      hours: '2h30',
      status: 'pending'
    },
    {
      id: '2',
      employeeName: 'Coumba Diouf',
      type: 'late_arrival',
      date: '2025-01-19',
      hours: '45min',
      status: 'pending'
    }
  ],
  workflows: [
    {
      id: '1',
      name: 'Validation congés managers',
      type: 'leave_approval',
      status: 'pending',
      assignedTo: 'Marie Diop',
      dueDate: '2025-01-25'
    }
  ]
};

export const mockEmployees = [
  {
    id: '1',
    firstName: 'Amadou',
    lastName: 'Ba',
    email: 'amadou.ba@acme.sn',
    position: 'Développeur Senior',
    department: 'IT',
    location: 'Dakar',
    phone: '+221 77 123 45 67',
    avatar: null,
    joinDate: '2023-03-15',
    status: 'active',
    manager: 'Marie Diop'
  },
  {
    id: '2',
    firstName: 'Fatou',
    lastName: 'Sow',
    email: 'fatou.sow@acme.sn',
    position: 'Responsable Marketing',
    department: 'Marketing',
    location: 'Dakar',
    phone: '+221 76 234 56 78',
    avatar: null,
    joinDate: '2022-09-01',
    status: 'active',
    manager: 'Marie Diop'
  },
  {
    id: '3',
    firstName: 'Omar',
    lastName: 'Ndiaye',
    email: 'omar.ndiaye@acme.sn',
    position: 'Comptable',
    department: 'Finance',
    location: 'Dakar',
    phone: '+221 78 345 67 89',
    avatar: null,
    joinDate: '2023-01-10',
    status: 'active',
    manager: 'Aissatou Fall'
  },
  {
    id: '4',
    firstName: 'Aminata',
    lastName: 'Diallo',
    email: 'aminata.diallo@acme.sn',
    position: 'Commerciale',
    department: 'Ventes',
    location: 'Thiès',
    phone: '+221 77 456 78 90',
    avatar: null,
    joinDate: '2023-06-20',
    status: 'active',
    manager: 'Moussa Kane'
  },
  {
    id: '5',
    firstName: 'Moussa',
    lastName: 'Kane',
    email: 'moussa.kane@acme.sn',
    position: 'Manager Ventes',
    department: 'Ventes',
    location: 'Dakar',
    phone: '+221 76 567 89 01',
    avatar: null,
    joinDate: '2021-11-15',
    status: 'active',
    manager: 'Marie Diop'
  },
  {
    id: '6',
    firstName: 'Aissatou',
    lastName: 'Fall',
    email: 'aissatou.fall@acme.sn',
    position: 'Directrice Financière',
    department: 'Finance',
    location: 'Dakar',
    phone: '+221 78 678 90 12',
    avatar: null,
    joinDate: '2020-04-01',
    status: 'active',
    manager: 'Marie Diop'
  }
];

export const mockLeaveBalance = {
  annual: { total: 30, used: 5, remaining: 25 },
  sick: { total: 15, used: 2, remaining: 13 },
  personal: { total: 5, used: 1, remaining: 4 }
};

export const mockDashboardStats = {
  totalEmployees: 245,
  activeEmployees: 238,
  onLeave: 12,
  newHires: 8,
  pendingValidations: 11,
  upcomingBirthdays: 5
};

export const mockQuickActions = [
  { key: 'createLeaveRequest', icon: 'Calendar', color: 'blue' },
  { key: 'createExpenseReport', icon: 'Receipt', color: 'green' },
  { key: 'addEmployee', icon: 'UserPlus', color: 'purple' },
  { key: 'createWorkflow', icon: 'Workflow', color: 'orange' },
  { key: 'uploadDocument', icon: 'Upload', color: 'gray' },
  { key: 'scheduleInterview', icon: 'Clock', color: 'pink' }
];
