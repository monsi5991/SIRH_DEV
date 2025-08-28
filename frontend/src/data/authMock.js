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
        amount: 45000
      }
    ],
    teamPerformance: {
      averageRating: 4.2,
      completedGoals: 85,
      onTrack: 6,
      needsAttention: 1
    }
  };
};