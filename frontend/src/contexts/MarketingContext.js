import React, { createContext, useContext, useState } from 'react';
import marketingFr from '../i18n/marketing-fr.json';
import marketingEn from '../i18n/marketing-en.json';

const MarketingContext = createContext();

export const useMarketing = () => {
  const context = useContext(MarketingContext);
  if (!context) {
    throw new Error('useMarketing must be used within a MarketingProvider');
  }
  return context;
};

export const MarketingProvider = ({ children }) => {
  const [language, setLanguage] = useState('fr');
  const [selectedCountry, setSelectedCountry] = useState('SN');
  const [employeeCount, setEmployeeCount] = useState(25);
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedAddons, setSelectedAddons] = useState([]);

  const translations = {
    fr: marketingFr,
    en: marketingEn
  };

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    if (typeof value === 'string' && params) {
      return value.replace(/\{(\w+)\}/g, (match, param) => params[param] || match);
    }
    
    return value || key;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'fr' ? 'en' : 'fr');
  };

  const getCurrency = () => {
    return selectedCountry === 'GN' ? 'GNF' : 'XOF';
  };

  const toggleAddon = (addonKey) => {
    setSelectedAddons(prev => 
      prev.includes(addonKey)
        ? prev.filter(key => key !== addonKey)
        : [...prev, addonKey]
    );
  };

  const resetPricingState = () => {
    setEmployeeCount(25);
    setSelectedPlan('growth');
    setBillingCycle('monthly');
    setSelectedAddons([]);
  };

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    selectedCountry,
    setSelectedCountry,
    employeeCount,
    setEmployeeCount,
    selectedPlan,
    setSelectedPlan,
    billingCycle,
    setBillingCycle,
    selectedAddons,
    setSelectedAddons,
    toggleAddon,
    resetPricingState,
    t,
    getCurrency
  };

  return (
    <MarketingContext.Provider value={value}>
      {children}
    </MarketingContext.Provider>
  );
};