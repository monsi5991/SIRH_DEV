import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { 
  Calendar, Receipt, Clock, Workflow,
  X, ArrowRight, CheckCircle, XCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { mockValidationItems } from '../../data/mock';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

const iconMap = {
  leaves: Calendar,
  expenses: Receipt,
  timeAnomalies: Clock,
  workflows: Workflow
};

const colorMap = {
  leaves: 'bg-blue-100 text-blue-600',
  expenses: 'bg-green-100 text-green-600', 
  timeAnomalies: 'bg-orange-100 text-orange-600',
  workflows: 'bg-purple-100 text-purple-600'
};

const ValidationDrawer = ({ trigger, type = 'all' }) => {
  const { t, formatCurrency, formatDate } = useApp();

  const getValidationItems = () => {
    if (type === 'all') {
      return Object.entries(mockValidationItems).reduce((acc, [key, items]) => {
        acc[key] = items.slice(0, 3); // Show max 3 per category
        return acc;
      }, {});
    } else {
      return { [type]: mockValidationItems[type] || [] };
    }
  };

  const validationItems = getValidationItems();
  const totalCount = Object.values(validationItems).reduce((sum, items) => sum + items.length, 0);

  const handleApprove = (itemType, itemId) => {
    console.log(`Approving ${itemType} item ${itemId}`);
    // Handle approval logic
  };

  const handleReject = (itemType, itemId) => {
    console.log(`Rejecting ${itemType} item ${itemId}`);
    // Handle rejection logic
  };

  const renderValidationItem = (item, itemType) => {
    const Icon = iconMap[itemType];
    const colorClass = colorMap[itemType];

    return (
      <div key={item.id} className="p-4 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 truncate">
                {item.employeeName}
              </h4>
              <Badge variant="outline" className="text-xs">
                {formatDate(item.requestDate || item.date)}
              </Badge>
            </div>
            
            <div className="space-y-1 text-sm text-gray-600">
              {itemType === 'leaves' && (
                <>
                  <p>{t(`leaves.${item.type}`)} • {item.duration}</p>
                  <p>{formatDate(item.startDate)} - {formatDate(item.endDate)}</p>
                </>
              )}
              
              {itemType === 'expenses' && (
                <>
                  <p>{item.category} • {formatCurrency(item.amount)}</p>
                  <p>{item.description}</p>
                </>
              )}
              
              {itemType === 'timeAnomalies' && (
                <>
                  <p>{item.type} • {item.hours}</p>
                  <p>{formatDate(item.date)}</p>
                </>
              )}
              
              {itemType === 'workflows' && (
                <>
                  <p>{item.name}</p>
                  <p>Échéance: {formatDate(item.dueDate)}</p>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleApprove(itemType, item.id)}
            className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {t('common.approve')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleReject(itemType, item.id)}
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
          >
            <XCircle className="w-4 h-4 mr-2" />
            {t('common.reject')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {t('validation.toValidate')}
            <Badge variant="destructive" className="ml-2">
              {totalCount}
            </Badge>
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6 overflow-y-auto">
          {Object.entries(validationItems).map(([itemType, items]) => {
            if (items.length === 0) return null;
            
            const Icon = iconMap[itemType];
            
            return (
              <div key={itemType}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">
                      {t(`validation.${itemType}`)}
                    </h3>
                    <Badge variant="secondary">
                      {items.length}
                    </Badge>
                  </div>
                  
                  {items.length > 3 && (
                    <Button variant="ghost" size="sm" className="text-emerald-600">
                      {t('validation.viewAll')}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {items.map(item => renderValidationItem(item, itemType))}
                </div>
              </div>
            );
          })}
          
          {totalCount === 0 && (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="font-medium mb-2">Tout est à jour</h3>
              <p className="text-sm">Aucune validation en attente</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ValidationDrawer;