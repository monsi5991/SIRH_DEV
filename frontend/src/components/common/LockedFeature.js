import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { Lock, Crown, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

const LockedFeature = ({ 
  feature, 
  requiredPlan = 'panafrica',
  title,
  description,
  benefits = [],
  illustration
}) => {
  const { t, currentTenant } = useApp();

  const planHierarchy = {
    essential: 1,
    growth: 2, 
    panafrica: 3
  };

  const currentPlanLevel = planHierarchy[currentTenant.plan] || 0;
  const requiredPlanLevel = planHierarchy[requiredPlan] || 3;

  const handleUpgrade = () => {
    console.log(`Upgrade to ${requiredPlan} plan`);
    // Navigate to pricing page
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardContent className="p-8 text-center">
          {/* Icon & Lock indicator */}
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              {illustration || <Lock className="w-10 h-10 text-gray-400" />}
            </div>
            <div className="absolute top-0 right-1/2 transform translate-x-6 -translate-y-2">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <Crown className="w-4 h-4 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Title & Description */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {title || t('locked.title')}
          </h1>
          <p className="text-gray-600 mb-6">
            {description || t('locked.description')}
          </p>

          {/* Current vs Required Plan */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="text-center">
              <Badge variant="outline" className="mb-2">
                {t('pricing.currentPlan')}
              </Badge>
              <div className="font-semibold text-gray-900">
                {t(`pricing.${currentTenant.plan}`)}
              </div>
            </div>
            
            <ArrowRight className="w-5 h-5 text-gray-400" />
            
            <div className="text-center">
              <Badge className="mb-2 bg-emerald-600">
                Requis
              </Badge>
              <div className="font-semibold text-emerald-600">
                {t(`pricing.${requiredPlan}`)}
              </div>
            </div>
          </div>

          {/* Benefits */}
          {benefits.length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Inclus dans {t(`pricing.${requiredPlan}`)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                    <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <span className="text-sm text-emerald-800">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="space-y-3">
            <Button 
              onClick={handleUpgrade}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              size="lg"
            >
              <Crown className="w-5 h-5 mr-2" />
              {t('locked.upgradeButton')} vers {t(`pricing.${requiredPlan}`)}
            </Button>
            
            <Button variant="ghost" className="w-full">
              {t('locked.learnMore')}
            </Button>
          </div>

          {/* Upgrade message */}
          <p className="text-xs text-gray-500 mt-6">
            {t('locked.upgradeMessage', { plan: t(`pricing.${requiredPlan}`) })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LockedFeature;