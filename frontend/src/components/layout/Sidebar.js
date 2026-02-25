// frontend/src/components/layout/Sidebar.js
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { get } from '../../lib/api';
import { useApp } from '../../contexts/AppContext';
import {
  Home, Users, Clock,
  FileText, BookOpen, BarChart3, Settings,
  ChevronDown, ChevronRight, Lock, Crown, User
} from 'lucide-react';
import { Badge } from '../ui/badge';

const ENABLE_SIDEBAR_COUNTS = true;

/* --------- persistance des overrides (Option B+) --------- */
const STORAGE_KEYS = {
  training: 'sidebarOverride.training',
  performance: 'sidebarOverride.performance',
};
const loadNumber = (k) => {
  try {
    const v = sessionStorage.getItem(k);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null; // private mode / SSR
  }
};
const saveNumber = (k, n) => {
  try {
    sessionStorage.setItem(k, String(n));
  } catch (e) {
    return; // quota / private mode
  }
};

const SIDEBAR_BY_PERSONA = {
  rh: [
    { key: 'home', icon: Home, path: '/', feature: null, children: [] },
    {
      key: 'hrSpace', icon: Users, path: null, feature: null, roles: ['RH'], children: [
        { key: 'hrWorkforcePlanning', path: '/hr/workforce-planning', feature: null, roles: ['RH'] },
        { key: 'hrStrategicReviews', path: '/hr/strategic-reviews', feature: null, roles: ['RH'] },
      ]
    },
    {
      key: 'operations', icon: Clock, path: null, feature: null, permissions: ['operations_read', 'all'], roles: ['RH'], children: [
        { key: 'leaves', path: '/operations/leaves', feature: 'leaves', permissions: ['operations_read', 'all'], roles: ['RH'] },
        { key: 'timeTracking', path: '/operations/time', feature: 'timeTracking', permissions: ['operations_read', 'all'], roles: ['RH'] },
        { key: 'events', path: '/operations/planning', feature: 'events', permissions: ['operations_read', 'all'], roles: ['RH'] },
        { key: 'expenses', path: '/operations/expenses', feature: 'expenses', permissions: ['operations_read', 'all'], roles: ['RH'] }
      ]
    },
    {
      key: 'documents', icon: FileText, path: null, feature: null, permissions: ['directory_read', 'all'], roles: ['RH'], children: [
        { key: 'onboarding', path: '/documents/onboarding', feature: 'onboarding', permissions: ['directory_read', 'all'], roles: ['RH'] },
        { key: 'offboarding', path: '/documents/offboarding', feature: null, permissions: ['directory_read', 'all'], roles: ['RH'] }
      ]
    },
    {
      key: 'people', icon: Users, path: null, feature: null, permissions: ['directory_read', 'all'], roles: ['RH'], children: [
        { key: 'directory', path: '/people/directory', feature: 'directory', permissions: ['directory_read', 'all'], roles: ['RH'] },
        { key: 'performance', path: '/people/performance', feature: 'performance', permissions: ['directory_read', 'all'], roles: ['RH'] },
        { key: 'training', path: '/people/training', feature: 'training', permissions: ['directory_read', 'all'], roles: ['RH'] }
      ]
    },
    {
      key: 'resources', icon: BookOpen, path: null, feature: null, permissions: ['directory_read', 'all'], roles: ['RH'], children: [
        { key: 'compliance', path: '/resources/compliance', feature: null, permissions: ['directory_read', 'all'], roles: ['RH'] },
        { key: 'policies', path: '/resources/policies', feature: null, permissions: ['directory_read', 'all'], roles: ['RH'] }
      ]
    },
    {
      key: 'analytics', icon: BarChart3, path: null, feature: null, permissions: ['analytics_read', 'all'], roles: ['RH'], children: [
        { key: 'reports', path: '/analytics/reports', feature: null, permissions: ['analytics_read', 'all'], roles: ['RH'] },
        { key: 'dashboards', path: '/analytics/dashboards', feature: 'advancedAnalytics', permissions: ['analytics_read', 'all'], roles: ['RH'] }
      ]
    },
    {
      key: 'admin', icon: Settings, path: null, feature: null, permissions: ['admin_read', 'all'], roles: ['RH'], children: [
        { key: 'structure', path: '/admin/structure', feature: null, permissions: ['admin_read', 'all'], roles: ['RH'] },
        { key: 'permissions', path: '/admin/permissions', feature: null, permissions: ['admin_read', 'all'], roles: ['RH'] },
        { key: 'integrations', path: '/admin/integrations', feature: null, permissions: ['admin_read', 'all'], roles: ['RH'] }
      ]
    }
  ],
  manager: [
    { key: 'home', icon: Home, path: '/', feature: null, children: [] },
    {
      key: 'managerSpace', icon: Users, path: null, feature: null, permissions: ['team_read', 'all'], roles: ['Manager'], children: [
        { key: 'managerDashboard', path: '/manager/dashboard', feature: null, permissions: ['team_read', 'all'], roles: ['Manager'] },
        { key: 'managerTeamOverview', path: '/manager/team-overview', feature: null, permissions: ['team_read', 'all'], roles: ['Manager'] },
        { key: 'teamApprovals', path: '/manager/approvals', feature: null, permissions: ['approvals_read', 'all'], roles: ['Manager'] },
        { key: 'managerPerformance', path: '/manager/performance', feature: null, permissions: ['team_read', 'all'], roles: ['Manager'] }
      ]
    },
    {
      key: 'resources', icon: BookOpen, path: null, feature: null, permissions: ['directory_read', 'all'], roles: ['Manager'], children: [
        { key: 'policies', path: '/resources/policies', feature: null, permissions: ['directory_read', 'all'], roles: ['Manager'] }
      ]
    }
  ],
  employee: [
    { key: 'home', icon: Home, path: '/', feature: null, children: [] },
    {
      key: 'employeeSpace', icon: User, path: null, feature: null, permissions: ['self_read', 'all'], roles: ['Employee'], children: [
        { key: 'employeeDashboard', path: '/employee/dashboard', feature: null, permissions: ['self_read', 'all'], roles: ['Employee'] },
        { key: 'employeeRequests', path: '/employee/requests', feature: null, permissions: ['self_read', 'all'], roles: ['Employee'] },
        { key: 'employeeDocuments', path: '/employee/documents', feature: null, permissions: ['self_read', 'all'], roles: ['Employee'] },
        { key: 'myProfile', path: '/employee/profile', feature: null, permissions: ['self_read', 'all'], roles: ['Employee'] },
        { key: 'myPayslips', path: '/me/payslips', feature: null, permissions: ['self_read', 'all'], roles: ['Employee'] },
      ]
    },
    {
      key: 'resources', icon: BookOpen, path: null, feature: null, permissions: ['self_read', 'directory_read', 'all'], roles: ['Employee'], children: [
        { key: 'policies', path: '/resources/policies', feature: null, permissions: ['self_read', 'directory_read', 'all'], roles: ['Employee'] }
      ]
    }
  ]
};

const isFeatureLocked = (feature, user) => {
  if (!feature) return false;
  const roles = (user?.roles || [])
    .map(r => (typeof r === 'string' ? r : r?.name))
    .filter(Boolean);
  const has = (name) => roles.includes(name) || user?.role === name;

  // Règles paie supprimées
  // if (feature === 'payroll' || feature === 'payPrep' || feature === 'payslips') {
  //   return !(has('Admin') || has('RH'));
  // }
  if (feature === 'advancedAnalytics') {
    return !has('Admin');
  }
  return false;
};

const labelOverride = {
  home: 'Tableau de bord',
  hrSpace: 'Espace RH',
  hrWorkforcePlanning: 'Workforce planning',
  hrStrategicReviews: 'Revues stratégiques',
  employeeSpace: 'Espace employé',
  employeeDashboard: 'Mon tableau de bord',
  employeeRequests: 'Mes demandes',
  employeeDocuments: 'Mes documents',
  myProfile: 'Mon profil RH',
  myPayslips: 'Mes bulletins',
  managerSpace: 'Espace manager',
  managerDashboard: 'Tableau manager',
  managerTeamOverview: 'Vue équipe',
  managerPerformance: 'Performance équipe',
  teamApprovals: 'Validations équipe',
  operations: 'Opérations',
  people: 'RH / People',
  documents: 'Documents',
  resources: 'Ressources',
  analytics: 'Analytique',
  admin: 'Administration',
  leaves: 'Congés',
  timeTracking: 'Feuilles de temps',
  events: 'Événements',
  expenses: 'Dépenses',
  directory: 'Annuaire',
  performance: 'Performance',
  training: 'Formation',
  // payroll: 'Paie',        // supprimé
  // payPrep: 'Préparation paie', // supprimé
  // payslips: 'Bulletins',  // supprimé
};

const Sidebar = ({ currentPath = '/', onNavigate, user }) => {
  const { t } = useApp();
  const [expandedItems, setExpandedItems] = useState(['operations', 'people', 'employeeSpace', 'managerSpace', 'hrSpace']);
  const [counts, setCounts] = useState({ leaves: 0, timesheets: 0, expenses: 0, events: 0, total: 0 });
  const [peopleCounts, setPeopleCounts] = useState({ directory: 0, performance: 0, training: 0, total: 0 });

  // Overrides côté client (persistés)
  const trainingOverrideRef    = useRef(loadNumber(STORAGE_KEYS.training));
  const performanceOverrideRef = useRef(loadNumber(STORAGE_KEYS.performance));

  const midnightTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const withTimeout = (promise, ms = 5000) =>
    Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  const safeGet = async (url) => {
    try { return await withTimeout(get(url)); } catch (e) { return null; }
  };

  const fetchOperationCounts = async () => {
    const s = await safeGet('/dashboard/summary');
    const p = s?.pendingValidations || {};
    const leaves = p?.leaves || 0;
    const timesheets = p?.timesheets || 0;
    const expenses = p?.expenses || 0;

    let events = 0;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const from = `${yyyy}-${mm}-${dd}`;
    const evRes = await safeGet(`/operations/events?from=${from}`);
    events = Array.isArray(evRes?.events) ? evRes.events.length
          : Array.isArray(evRes) ? evRes.length : 0;

    if (!mountedRef.current) return;
    setCounts({ leaves, timesheets, expenses, events, total: leaves + timesheets + expenses + events });
  };

  // helper fallback "juste"
  const sumOrTotal = (obj, keys, totalKey = 'total') => {
    if (!obj) return 0;
    let hasSpecific = false;
    let sum = 0;
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        hasSpecific = true;
        sum += Number(obj[k] || 0);
      }
    }
    if (hasSpecific) return sum;
    if (Object.prototype.hasOwnProperty.call(obj, totalKey)) return Number(obj[totalKey] || 0);
    return 0;
  };

  const fetchPeopleCounts = async () => {
    const [dir, perf, train] = await Promise.all([
      safeGet('/people/counters/directory'),
      safeGet('/people/counters/performance'),
      safeGet('/people/counters/training'),
    ]);

    const dirCountBase = sumOrTotal(dir, ['profilesIncomplete', 'docsExpiring']);
    let perfCountBase  = sumOrTotal(perf, ['goalsPending', 'reviewsDue']);
    let trnCountBase   = sumOrTotal(train, ['sessionsSoon', 'certsExpiring', 'sessionsSoon14']);

    const perfCount = (typeof performanceOverrideRef.current === 'number')
      ? performanceOverrideRef.current : perfCountBase;
    const trnCount  = (typeof trainingOverrideRef.current === 'number')
      ? trainingOverrideRef.current : trnCountBase;

    if (!mountedRef.current) return;
    setPeopleCounts({
      directory: dirCountBase,
      performance: perfCount,
      training: trnCount,
      total: dirCountBase + perfCount + trnCount
    });
  };

  const fetchCounts = async () => {
    await Promise.allSettled([fetchOperationCounts(), fetchPeopleCounts()]);
  };

  useEffect(() => {
    mountedRef.current = true;

    // Applique tout de suite les overrides persistés
    setPeopleCounts(prev => {
      const directory = prev.directory || 0;
      const performance = typeof performanceOverrideRef.current === 'number' ? performanceOverrideRef.current : prev.performance || 0;
      const training = typeof trainingOverrideRef.current === 'number' ? trainingOverrideRef.current : prev.training || 0;
      return { directory, performance, training, total: directory + performance + training };
    });

    const id = setTimeout(() => { if (ENABLE_SIDEBAR_COUNTS) fetchCounts(); }, 1);

    const onAppRefresh    = () => { if (ENABLE_SIDEBAR_COUNTS) fetchCounts(); };
    const onEventsChanged = () => { if (ENABLE_SIDEBAR_COUNTS) fetchOperationCounts(); };

    // PERF override : {activeGoals} ou {total}
    const onGoalsChanged = (e) => {
      const d = e?.detail || {};
      let next = null;
      if (typeof d.activeGoals === 'number') next = d.activeGoals | 0;
      else if (typeof d.total === 'number')   next = d.total | 0;

      if (next !== null) {
        next = Math.max(0, next);
        performanceOverrideRef.current = next;
        saveNumber(STORAGE_KEYS.performance, next);
        setPeopleCounts(prev => {
          const directory = prev.directory || 0;
          const training  = (typeof trainingOverrideRef.current === 'number')
            ? trainingOverrideRef.current
            : (prev.training || 0);
          const performance = next;
          return { ...prev, performance, total: directory + performance + training };
        });
      } else if (ENABLE_SIDEBAR_COUNTS) {
        fetchPeopleCounts();
      }
    };

    // TRAINING override : {sessionsSoon14} | {total} | {count}
    const onTrainingChanged = (e) => {
      const d = e?.detail || {};
      let next = null;
      if (typeof d.sessionsSoon14 === 'number') next = d.sessionsSoon14 | 0;
      else if (typeof d.total === 'number')     next = d.total | 0;
      else if (typeof d.count === 'number')     next = d.count | 0;

      if (next !== null) {
        next = Math.max(0, next);
        trainingOverrideRef.current = next;
        saveNumber(STORAGE_KEYS.training, next);
        setPeopleCounts(prev => {
          const directory   = prev.directory || 0;
          const performance = (typeof performanceOverrideRef.current === 'number')
            ? performanceOverrideRef.current
            : (prev.performance || 0);
          const training = next;
          return { ...prev, training, total: directory + performance + training };
        });
      } else if (ENABLE_SIDEBAR_COUNTS) {
        fetchPeopleCounts();
      }
    };

    const onEmployeesChanged = () => { if (ENABLE_SIDEBAR_COUNTS) fetchPeopleCounts(); };

    window.addEventListener('app:counters:refresh', onAppRefresh);
    window.addEventListener('events:changed', onEventsChanged);
    window.addEventListener('goals:changed', onGoalsChanged);
    window.addEventListener('employees:changed', onEmployeesChanged);
    window.addEventListener('training:changed', onTrainingChanged);

    const interval = setInterval(() => { if (ENABLE_SIDEBAR_COUNTS) fetchCounts(); }, 10 * 60 * 1000);

    const onVisible = () => { if (!document.hidden && ENABLE_SIDEBAR_COUNTS) fetchCounts(); };
    document.addEventListener('visibilitychange', onVisible);

    const scheduleMidnight = () => {
      const now = new Date();
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 5, 0);
      return setTimeout(() => {
        if (ENABLE_SIDEBAR_COUNTS) fetchCounts();
        midnightTimerRef.current = scheduleMidnight();
      }, at - now);
    };
    midnightTimerRef.current = scheduleMidnight();

    return () => {
      mountedRef.current = false;
      clearTimeout(id);
      window.removeEventListener('app:counters:refresh', onAppRefresh);
      window.removeEventListener('events:changed', onEventsChanged);
      window.removeEventListener('goals:changed', onGoalsChanged);
      window.removeEventListener('employees:changed', onEmployeesChanged);
      window.removeEventListener('training:changed', onTrainingChanged);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
    };
  }, []);

  const tenantName =
    user?.tenant?.name
    || (user?.email ? user.email.split('@')[1] : null)
    || 'Mon espace';

  const toggleExpanded = (key) => {
    setExpandedItems(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]);
  };

  const userRoles = (user?.roles || [])
    .map(r => (typeof r === 'string' ? r : r?.name))
    .filter(Boolean);
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];

  const hasAnyPermission = (required) => {
    if (!required || !required.length) return true;
    if (userPermissions.includes('all')) return true;
    return required.some((p) => userPermissions.includes(p));
  };

  const hasAnyRole = (required) => {
    if (!required || !required.length) return true;
    return required.some((r) => userRoles.includes(r));
  };

  const canAccess = (item) => {
    if (!item) return false;
    if (!hasAnyPermission(item.permissions || [])) return false;
    if (!hasAnyRole(item.roles || [])) return false;
    return true;
  };

  const persona = userRoles.includes('RH')
    ? 'rh'
    : userRoles.includes('Manager')
      ? 'manager'
      : 'employee';

  const sidebarItems = SIDEBAR_BY_PERSONA[persona] || SIDEBAR_BY_PERSONA.employee;

  const getValidationCountForItem = (itemKey) => {
    if (itemKey === 'operations') {
      const isExpanded = expandedItems.includes('operations');
      return isExpanded ? 0 : counts.total;
    }
    if (itemKey === 'leaves')       return counts.leaves;
    if (itemKey === 'timeTracking') return counts.timesheets;
    if (itemKey === 'events')       return counts.events;
    if (itemKey === 'expenses')     return counts.expenses;

    if (itemKey === 'people') {
      const isExpanded = expandedItems.includes('people');
      return isExpanded ? 0 : (peopleCounts.total || 0);
    }
    if (itemKey === 'directory')    return peopleCounts.directory || 0;
    if (itemKey === 'performance')  return peopleCounts.performance || 0;
    if (itemKey === 'training')     return peopleCounts.training || 0;

    return 0;
  };

  const renderNavItem = (item, level = 0) => {
    if (!canAccess(item)) return null;

    const isExpanded  = expandedItems.includes(item.key);
    const visibleChildren = Array.isArray(item.children)
      ? item.children.filter((child) => canAccess(child))
      : [];
    const hasChildren = visibleChildren.length > 0;
    const isLocked    = item.feature ? isFeatureLocked(item.feature, user) : false;
    const isActive    = item.path === currentPath;
    const Icon        = item.icon;

    const handleClick = () => {
      if (hasChildren) toggleExpanded(item.key);
      else if (item.path && !isLocked) onNavigate?.(item.path);
    };

    const badgeCount = getValidationCountForItem(item.key);
    const label = labelOverride[item.key] ?? t(`nav.${item.key}`);

    return (
      <div key={item.key}>
        <div
          className={`
            flex items-center gap-3 px-3 py-2 mx-2 rounded-lg cursor-pointer
            transition-all duration-200 group
            ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''}
            ${isLocked ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'}
            ${level > 0 ? 'ml-4 text-sm' : ''}
          `}
          onClick={handleClick}
        >
          <div className="flex items-center gap-3 flex-1">
            {Icon && (
              <Icon
                className={`
                  w-5 h-5
                  ${isLocked ? 'text-gray-400' : isActive ? 'text-emerald-600' : 'text-gray-500'}
                `}
              />
            )}
            <span className="font-medium">{label}</span>

            {isLocked && (
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-gray-400" />
                {item.plan && <Crown className="w-3 h-3 text-amber-500" />}
              </span>
            )}
          </div>

          <Badge
            variant="destructive"
            className="px-1.5 py-0.5 text-xs"
            style={{
              minWidth: '1.5rem',
              display: 'inline-flex',
              justifyContent: 'center',
              opacity: badgeCount > 0 ? 1 : 0,
              pointerEvents: 'none',
            }}
          >
            {badgeCount || 0}
          </Badge>

          {hasChildren && (isExpanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />)}
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1 mb-2">
            {visibleChildren.map(child => renderNavItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {tenantName}
            </h3>
          </div>
        </div>
      </div>

      <div className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-1">
          {sidebarItems.map(item => renderNavItem(item))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>Plan</span>
            <Badge variant="secondary" className="text-xs">Standard</Badge>
          </div>
          <div className="mt-2 text-gray-500">
            {user?.email || '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

Sidebar.propTypes = {
  currentPath: PropTypes.string,
  onNavigate: PropTypes.func,
  user: PropTypes.shape({
    email: PropTypes.string,
    tenant: PropTypes.shape({ name: PropTypes.string }),
    roles: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
    permissions: PropTypes.arrayOf(PropTypes.string),
    role: PropTypes.string,
  }),
};

export default Sidebar;
