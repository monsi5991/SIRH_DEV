// Pricing matrix and configuration data

export const COUNTRIES = [
  { 
    code: 'SN', 
    name: { fr: 'Sénégal', en: 'Senegal' }, 
    currency: 'XOF', 
    flag: '🇸🇳'
  },
  { 
    code: 'BF', 
    name: { fr: 'Burkina Faso', en: 'Burkina Faso' }, 
    currency: 'XOF', 
    flag: '🇧🇫'
  },
  { 
    code: 'CI', 
    name: { fr: 'Côte d\'Ivoire', en: 'Ivory Coast' }, 
    currency: 'XOF', 
    flag: '🇨🇮'
  },
  { 
    code: 'BJ', 
    name: { fr: 'Bénin', en: 'Benin' }, 
    currency: 'XOF', 
    flag: '🇧🇯'
  },
  { 
    code: 'GN', 
    name: { fr: 'Guinée', en: 'Guinea' }, 
    currency: 'GNF', 
    flag: '🇬🇳'
  }
];

export const EMPLOYEE_TIERS = [
  { min: 1, max: 25, label: '1-25' },
  { min: 26, max: 50, label: '26-50' },
  { min: 51, max: 100, label: '51-100' },
  { min: 101, max: 250, label: '101-250' },
  { min: 251, max: 500, label: '251-500' },
  { min: 501, max: 999999, label: '500+' }
];

export const PLANS = {
  essential: {
    key: 'essential',
    basePrice: {
      XOF: 25000, // Base price per month in XOF
      GNF: 250000 // Base price per month in GNF
    },
    pricePerEmployee: {
      XOF: 2500, // Price per employee per month in XOF
      GNF: 25000 // Price per employee per month in GNF
    },
    features: [
      'coreHr',
      'leaves', 
      'documents',
      'basicWorkflows',
      'emailSupport'
    ],
    maxEmployees: 1000 // No limit for Essential
  },
  growth: {
    key: 'growth',
    basePrice: {
      XOF: 45000,
      GNF: 450000
    },
    pricePerEmployee: {
      XOF: 3500,
      GNF: 35000
    },
    features: [
      'essential',
      'timeTracking',
      'expenses',
      'performance', 
      'standardIntegrations',
      'prioritySupport'
    ],
    maxEmployees: 1000
  },
  panafrica: {
    key: 'panafrica',
    basePrice: {
      XOF: 85000,
      GNF: 850000
    },
    pricePerEmployee: {
      XOF: 5000,
      GNF: 50000
    },
    features: [
      'growth',
      'multiEntity',
      'accountingExports',
      'publicApi',
      'advancedAnalytics',
      'phoneSupport'
    ],
    maxEmployees: 1000
  },
  enterprise: {
    key: 'enterprise',
    basePrice: {
      XOF: 'custom',
      GNF: 'custom'
    },
    pricePerEmployee: {
      XOF: 'custom',
      GNF: 'custom'  
    },
    features: [
      'panafrica',
      'onSiteDeployment',
      'privateCloud',
      'ssoScim',
      'sla999',
      'dedicatedTraining',
      'accountManager'
    ],
    minEmployees: 101 // Enterprise starts at 101 employees
  }
};

export const ADDONS = {
  mobileMoney: {
    key: 'mobileMoney',
    price: {
      XOF: 15000, // Per month
      GNF: 150000
    }
  },
  whatsapp: {
    key: 'whatsapp', 
    price: {
      XOF: 12000,
      GNF: 120000
    }
  },
  ewa: {
    key: 'ewa',
    price: {
      XOF: 20000,
      GNF: 200000
    }
  },
  sso: {
    key: 'sso',
    price: {
      XOF: 35000,
      GNF: 350000
    }
  },
  hosting: {
    key: 'hosting',
    price: {
      XOF: 50000,
      GNF: 500000
    }
  },
  sla: {
    key: 'sla',
    price: {
      XOF: 25000,
      GNF: 250000
    }
  }
};

export const BILLING_CYCLES = {
  monthly: {
    key: 'monthly',
    multiplier: 1,
    discount: 0
  },
  annual: {
    key: 'annual', 
    multiplier: 12,
    discount: 0.15 // 15% discount for annual billing
  }
};

// Pricing calculator utility functions
export const calculatePlanPrice = (plan, employeeCount, currency, billingCycle = 'monthly') => {
  if (plan === 'enterprise') {
    return { type: 'custom', value: 0 };
  }

  const planConfig = PLANS[plan];
  if (!planConfig) return { type: 'error', value: 0 };

  const basePrice = planConfig.basePrice[currency];
  const pricePerEmployee = planConfig.pricePerEmployee[currency];
  
  const monthlyTotal = basePrice + (pricePerEmployee * employeeCount);
  
  const cycleConfig = BILLING_CYCLES[billingCycle];
  let total = monthlyTotal * cycleConfig.multiplier;
  
  // Apply discount for annual billing
  if (cycleConfig.discount > 0) {
    total = total * (1 - cycleConfig.discount);
  }

  return {
    type: 'price',
    monthly: monthlyTotal,
    total: total,
    basePrice: basePrice,
    employeeCost: pricePerEmployee * employeeCount,
    discount: cycleConfig.discount
  };
};

export const calculateAddonsPrice = (addons, currency, billingCycle = 'monthly') => {
  let monthlyTotal = 0;
  
  addons.forEach(addonKey => {
    const addon = ADDONS[addonKey];
    if (addon && addon.price[currency]) {
      monthlyTotal += addon.price[currency];
    }
  });

  const cycleConfig = BILLING_CYCLES[billingCycle];
  let total = monthlyTotal * cycleConfig.multiplier;
  
  if (cycleConfig.discount > 0) {
    total = total * (1 - cycleConfig.discount);
  }

  return {
    monthly: monthlyTotal,
    total: total
  };
};

export const calculateTotalPrice = (plan, employeeCount, currency, billingCycle, addons = []) => {
  const planPrice = calculatePlanPrice(plan, employeeCount, currency, billingCycle);
  const addonsPrice = calculateAddonsPrice(addons, currency, billingCycle);

  if (planPrice.type === 'custom') {
    return { type: 'custom', planPrice, addonsPrice };
  }

  return {
    type: 'price',
    plan: planPrice,
    addons: addonsPrice,
    total: {
      monthly: planPrice.monthly + addonsPrice.monthly,
      total: planPrice.total + addonsPrice.total
    }
  };
};

export const formatCurrency = (amount, currency) => {
  if (amount === 'custom') {
    return 'Sur devis';
  }

  const formatOptions = {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  };

  // Use appropriate locale for currency
  const locale = currency === 'XOF' ? 'fr-SN' : 'fr-GN';
  
  return new Intl.NumberFormat(locale, formatOptions).format(amount);
};

export const shouldShowEnterprise = (employeeCount) => {
  return employeeCount > 100;
};

export const getEmployeeTier = (employeeCount) => {
  return EMPLOYEE_TIERS.find(tier => 
    employeeCount >= tier.min && employeeCount <= tier.max
  );
};