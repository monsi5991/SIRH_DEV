import React, { useState, useEffect } from 'react';
import { useMarketing } from '../../contexts/MarketingContext';
import { 
  COUNTRIES, PLANS, ADDONS,
  calculateTotalPrice, formatCurrency, shouldShowEnterprise 
} from '../../data/pricingData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { 
  Users, Building2, Calculator, 
  Check, Zap, Crown, ArrowRight
} from 'lucide-react';

const PricingCalculator = () => {
  const {
    language,
    selectedCountry,
    setSelectedCountry,
    employeeCount,
    setEmployeeCount,
    selectedPlan,
    setSelectedPlan,
    billingCycle,
    setBillingCycle,
    selectedAddons,
    toggleAddon,
    t,
    getCurrency
  } = useMarketing();

  const [pricingResult, setPricingResult] = useState(null);
  const currency = getCurrency();
  const showEnterprise = shouldShowEnterprise(employeeCount);

  // Calculate pricing when dependencies change
  useEffect(() => {
    if (!showEnterprise) {
      const result = calculateTotalPrice(
        selectedPlan,
        employeeCount,
        currency,
        billingCycle,
        selectedAddons
      );
      setPricingResult(result);
    }
  }, [selectedPlan, employeeCount, currency, billingCycle, selectedAddons, showEnterprise]);

  const handleEmployeeCountChange = (value) => {
    const count = value[0];
    setEmployeeCount(count);
    
    // Auto-switch to enterprise for 100+ employees
    if (count > 100 && selectedPlan !== 'enterprise') {
      setSelectedPlan('enterprise');
    } else if (count <= 100 && selectedPlan === 'enterprise') {
      setSelectedPlan('growth');
    }
  };

  const PlanCard = ({ planKey, isEnterprise = false }) => {
    const plan = PLANS[planKey];
    const isSelected = selectedPlan === planKey;
    const isPopular = planKey === 'growth';
    
    let pricing = null;
    if (!isEnterprise && pricingResult?.plan) {
      pricing = pricingResult.plan;
    }

    return (
      <Card className={`relative transition-all duration-200 ${
        isSelected ? 'border-emerald-500 shadow-lg scale-105' : 'border-gray-200 hover:shadow-md'
      }`}>
        {isPopular && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <Badge className="bg-emerald-600 text-white">
              {t('common.popular')}
            </Badge>
          </div>
        )}
        
        <CardHeader className="text-center pb-4">
          <CardTitle className="flex items-center justify-center gap-2">
            {planKey === 'enterprise' && <Crown className="w-5 h-5 text-amber-500" />}
            {t(`pricing.plans.${planKey}.title`)}
          </CardTitle>
          <p className="text-gray-600 text-sm">
            {t(`pricing.plans.${planKey}.description`)}
          </p>
          
          <div className="mt-4">
            {isEnterprise ? (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {t('common.custom')}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {t('pricing.calculator.enterpriseNote')}
                </p>
              </div>
            ) : pricing ? (
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {formatCurrency(
                    billingCycle === 'annual' ? Math.round(pricing.total / 12) : pricing.monthly,
                    currency
                  )}
                  <span className="text-lg font-normal text-gray-500">
                    {t('common.perMonth')}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="text-sm text-emerald-600 font-medium">
                    {t('pricing.billingCycle.save')}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-400">
                {t('common.startingAt')} {formatCurrency(plan.basePrice[currency], currency)}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-3 mb-6">
            {plan.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-gray-700">
                  {t(`pricing.plans.${planKey}.features.${index}`)}
                </span>
              </div>
            ))}
          </div>

          <Button
            className={`w-full ${
              isSelected 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            }`}
            onClick={() => !isEnterprise && setSelectedPlan(planKey)}
            disabled={isEnterprise && employeeCount <= 100}
          >
            {isEnterprise ? (
              <>
                {t(`pricing.plans.${planKey}.cta`)}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              t(`pricing.plans.${planKey}.cta`)
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const AddonCard = ({ addonKey }) => {
    const addon = ADDONS[addonKey];
    const isSelected = selectedAddons.includes(addonKey);

    return (
      <Card className={`transition-all duration-200 ${
        isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="font-semibold text-gray-900">
                  {t(`pricing.addons.${addonKey}.title`)}
                </h4>
                <Switch
                  checked={isSelected}
                  onCheckedChange={() => toggleAddon(addonKey)}
                />
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {t(`pricing.addons.${addonKey}.description`)}
              </p>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(addon.price[currency], currency)}
                <span className="text-sm font-normal text-gray-500">
                  {t('common.perMonth')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* Configuration Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            {t('pricing.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Employee Count Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('pricing.employeeCount')}: {employeeCount}
            </label>
            <Slider
              value={[employeeCount]}
              onValueChange={handleEmployeeCountChange}
              max={1000}
              min={1}
              step={1}
              className="mb-2"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>100</span>
              <span>500</span>
              <span>1000+</span>
            </div>
          </div>

          {/* Country Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('pricing.country')}
            </label>
            <div className="grid grid-cols-5 gap-2">
              {COUNTRIES.map(country => (
                <Button
                  key={country.code}
                  variant={selectedCountry === country.code ? 'default' : 'outline'}
                  className="flex flex-col items-center gap-1 h-auto p-3"
                  onClick={() => setSelectedCountry(country.code)}
                >
                  <span className="text-lg">{country.flag}</span>
                  <span className="text-xs">{country.name[language]}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <span className={`text-sm font-medium ${
                billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-500'
              }`}>
                {t('pricing.billingCycle.monthly')}
              </span>
              <Switch
                checked={billingCycle === 'annual'}
                onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
              />
              <span className={`text-sm font-medium ${
                billingCycle === 'annual' ? 'text-gray-900' : 'text-gray-500'
              }`}>
                {t('pricing.billingCycle.annual')}
              </span>
            </div>
            {billingCycle === 'annual' && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                {t('pricing.billingCycle.save')}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {!showEnterprise ? (
          <>
            <PlanCard planKey="essential" />
            <PlanCard planKey="growth" />
            <PlanCard planKey="panafrica" />
          </>
        ) : (
          <div className="md:col-span-3 lg:col-span-4">
            <PlanCard planKey="enterprise" isEnterprise={true} />
          </div>
        )}
      </div>

      {/* Add-ons */}
      {!showEnterprise && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {t('pricing.addons.title')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(ADDONS).map(addonKey => (
              <AddonCard key={addonKey} addonKey={addonKey} />
            ))}
          </div>
        </div>
      )}

      {/* Pricing Breakdown */}
      {!showEnterprise && pricingResult && pricingResult.type === 'price' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              {t('pricing.calculator.total')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">
                  {t('pricing.calculator.basePrice')} ({t(`pricing.plans.${selectedPlan}.title`)})
                </span>
                <span className="font-semibold">
                  {formatCurrency(pricingResult.plan.basePrice, currency)}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">
                  {employeeCount} × {t('pricing.calculator.perEmployee')}
                </span>
                <span className="font-semibold">
                  {formatCurrency(pricingResult.plan.employeeCost, currency)}
                </span>
              </div>

              {selectedAddons.length > 0 && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">
                    {t('pricing.calculator.addons')}
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(pricingResult.addons.monthly, currency)}
                  </span>
                </div>
              )}

              <hr />

              <div className="flex justify-between items-center py-2 text-lg font-bold">
                <span>
                  {t('pricing.calculator.total')} 
                  {billingCycle === 'annual' ? t('common.perYear') : t('common.perMonth')}
                </span>
                <span className="text-emerald-600">
                  {formatCurrency(
                    billingCycle === 'annual' ? pricingResult.total.total : pricingResult.total.monthly,
                    currency
                  )}
                </span>
              </div>

              {billingCycle === 'annual' && (
                <div className="text-sm text-gray-500 text-center">
                  {formatCurrency(Math.round(pricingResult.total.total / 12), currency)} {t('common.perMonth')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PricingCalculator;