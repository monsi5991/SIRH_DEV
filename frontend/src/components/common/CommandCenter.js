// src/components/common/CommandCenter.js
import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useApp } from '../../contexts/AppContext';
import {
  Calendar, Receipt, UserPlus, Workflow,
  Upload, Clock, Search, ArrowRight
} from 'lucide-react';
import { Dialog, DialogContent } from '../ui/dialog';
import { mockQuickActions } from '../../data/mock';

const iconMap = { Calendar, Receipt, UserPlus, Workflow, Upload, Clock };

// stable hors composant
const featureMap = {
  createLeaveRequest: 'leaves',
  createExpenseReport: 'expenses',
  addEmployee: 'directory',
  createWorkflow: null,
  uploadDocument: null,
  scheduleInterview: 'performance'
};

const CommandCenter = ({ isOpen, onClose }) => {
  const { t, hasFeature } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const actions = useMemo(() => {
    return mockQuickActions.filter(action => {
      const requiredFeature = featureMap[action.key];
      return !requiredFeature || hasFeature(requiredFeature);
    });
  }, [hasFeature]);

  const filteredActions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(action =>
      (t(`actions.${action.key}`) || '').toLowerCase().includes(q)
    );
  }, [searchQuery, actions, t]);

  const handleActionClick = (action) => {
    // À relier aux vraies actions (navigation, open modal, etc.)
    console.log(`Executing action: ${action.key}`);
    onClose?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose?.();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <div className="flex flex-col max-h-[80vh]">
          {/* Search header */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-200">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 outline-none text-lg"
              autoFocus
              onKeyDown={handleKeyDown}
            />
            <div className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">ESC</div>
          </div>

          {/* Actions list */}
          <div className="flex-1 overflow-y-auto">
            {filteredActions.length > 0 ? (
              <div className="p-2">
                {searchQuery === '' && (
                  <div className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions rapides
                  </div>
                )}

                <div className="space-y-1">
                  {filteredActions.map((action) => {
                    const Icon = iconMap[action.icon] || Search;
                    return (
                      <button
                        key={action.key}
                        onClick={() => handleActionClick(action)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                      >
                        <div className={`
                          w-10 h-10 rounded-lg flex items-center justify-center
                          ${action.color === 'blue' ? 'bg-blue-100 text-blue-600' : ''}
                          ${action.color === 'green' ? 'bg-green-100 text-green-600' : ''}
                          ${action.color === 'purple' ? 'bg-purple-100 text-purple-600' : ''}
                          ${action.color === 'orange' ? 'bg-orange-100 text-orange-600' : ''}
                          ${action.color === 'gray' ? 'bg-gray-100 text-gray-600' : ''}
                          ${action.color === 'pink' ? 'bg-pink-100 text-pink-600' : ''}
                        `}>
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {t(`actions.${action.key}`)}
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                <p>Aucun résultat trouvé</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div>Tapez pour rechercher des actions, employés, ou documents</div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white border border-gray-200 rounded text-xs">⌘K</kbd>
                <span>pour ouvrir</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

CommandCenter.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
};

export default CommandCenter;
