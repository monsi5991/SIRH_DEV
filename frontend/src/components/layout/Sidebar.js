import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { get } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  Home,
  Users,
  Clock,
  FileText,
  BookOpen,
  BarChart3,
  Settings,
  UserRound,
  ClipboardList,
  Target,
  GraduationCap,
  LifeBuoy,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Lock,
  Crown,
  LogOut,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { normalizeRole } from "../../lib/permissions";

const ENABLE_SIDEBAR_COUNTS = true;

const STORAGE_KEYS = {
  training: "sidebarOverride.training",
  performance: "sidebarOverride.performance",
  collapsed: "sidebar.collapsed",
};

const ROLE_PRIORITY = ["ADMIN", "HR", "IT", "MANAGER", "EMPLOYEE"];

const loadNumber = (k) => {
  try {
    const v = sessionStorage.getItem(k);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
};

const saveNumber = (k, n) => {
  try {
    sessionStorage.setItem(k, String(n));
  } catch (e) {
    return;
  }
};

const loadBoolean = (k, fallback = false) => {
  try {
    const v = sessionStorage.getItem(k);
    if (v === null) return fallback;
    return v === "1";
  } catch (e) {
    return fallback;
  }
};

const saveBoolean = (k, value) => {
  try {
    sessionStorage.setItem(k, value ? "1" : "0");
  } catch (e) {
    return;
  }
};

const DEFAULT_SIDEBAR_ITEMS = [
  { key: "home", icon: Home, path: "/", feature: null, section: "workspace", children: [] },
  {
    key: "employees",
    icon: Users,
    path: null,
    feature: null,
    section: "workspace",
    permissions: ["directory_read", "team_read", "all"],
    roles: ["RH", "Manager", "Admin", "IT"],
    children: [
      { key: "directory", path: "/people/directory", permissions: ["directory_read", "all"] },
      { key: "contracts", path: "/people/contracts", permissions: ["directory_read", "all"] },
      { key: "employeeDocuments", path: "/people/documents", permissions: ["directory_read", "team_read", "all"] },
    ],
  },
  {
    key: "timePresence",
    icon: Clock,
    path: null,
    feature: null,
    section: "operations",
    permissions: ["operations_read", "all"],
    roles: ["RH", "Manager", "Admin"],
    children: [
      { key: "leaves", path: "/operations/leaves", permissions: ["operations_read", "all"] },
      { key: "timeTracking", path: "/operations/time", permissions: ["operations_read", "all"] },
      { key: "attendance", path: "/operations/attendance", permissions: ["operations_read", "all"] },
    ],
  },
  {
    key: "expensesRequests",
    icon: FileText,
    path: null,
    feature: null,
    section: "operations",
    permissions: ["self_read", "operations_read", "all"],
    children: [
      { key: "expenses", path: "/operations/expenses", permissions: ["operations_read", "all"] },
      { key: "hrRequests", path: "/requests/hr", permissions: ["self_read", "operations_read", "all"] },
      {
        key: "managerApprovals",
        path: "/manager/approvals",
        permissions: ["team_read", "approvals_read", "approvals_write", "all"],
        roles: ["Manager"],
      },
    ],
  },
  {
    key: "performance",
    icon: BarChart3,
    path: "/people/performance",
    feature: "performance",
    section: "talent",
    permissions: ["directory_read", "all"],
    roles: ["RH", "Manager", "Admin"],
    children: [],
  },
  {
    key: "training",
    icon: BookOpen,
    path: "/people/training",
    feature: "training",
    section: "talent",
    permissions: ["directory_read", "all"],
    roles: ["RH", "Manager", "Admin"],
    children: [],
  },
  {
    key: "analytics",
    icon: BarChart3,
    path: null,
    feature: null,
    section: "analytics",
    permissions: ["analytics_read", "all"],
    roles: ["RH", "Admin"],
    children: [
      { key: "reports", path: "/analytics/reports", permissions: ["analytics_read", "all"] },
      {
        key: "dashboards",
        path: "/analytics/dashboards",
        feature: "advancedAnalytics",
        permissions: ["analytics_read", "all"],
      },
    ],
  },
  {
    key: "administration",
    icon: Settings,
    path: null,
    feature: null,
    section: "admin",
    permissions: ["admin_read", "all"],
    roles: ["RH", "Admin"],
    children: [
      { key: "organization", path: "/admin/organization", permissions: ["admin_read", "all"] },
      { key: "rolesPermissions", path: "/admin/roles-permissions", permissions: ["admin_read", "all"] },
      { key: "workflows", path: "/admin/workflows", permissions: ["admin_read", "all"] },
      { key: "hrPolicies", path: "/admin/policies", permissions: ["admin_read", "all"] },
      { key: "auditLog", path: "/admin/audit-log", permissions: ["admin_read", "all"] },
    ],
  },
];

const EMPLOYEE_SIDEBAR_ITEMS = [
  {
    key: "employeeDashboard",
    icon: Home,
    path: "/employee/dashboard",
    feature: null,
    section: "workspace",
    permissions: ["self_read", "all"],
    roles: ["Employee"],
    children: [],
  },
  {
    key: "employeeProfile",
    icon: UserRound,
    path: "/employee/profile",
    feature: null,
    section: "workspace",
    permissions: ["self_read", "all"],
    roles: ["Employee"],
    children: [],
  },
  {
    key: "employeeTime",
    icon: Clock,
    path: "/employee/time",
    feature: null,
    section: "operations",
    permissions: ["self_read", "all"],
    roles: ["Employee"],
    children: [],
  },
  {
    key: "employeeRequests",
    icon: ClipboardList,
    path: "/employee/requests",
    feature: null,
    section: "operations",
    permissions: ["self_read", "all"],
    roles: ["Employee"],
    children: [],
  },
  {
    key: "employeeDocsAndPayroll",
    icon: FileText,
    path: "/employee/pay-documents",
    feature: null,
    section: "operations",
    permissions: ["self_read", "all"],
    roles: ["Employee"],
    children: [],
  },
  {
    key: "employeePerformance",
    icon: Target,
    path: "/employee/performance",
    feature: null,
    section: "talent",
    permissions: ["self_read", "all"],
    roles: ["Employee"],
    children: [],
  },
  {
    key: "employeeTrainings",
    icon: GraduationCap,
    path: "/employee/trainings",
    feature: null,
    section: "talent",
    permissions: ["self_read", "all"],
    roles: ["Employee"],
    children: [],
  },
  {
    key: "employeeHelp",
    icon: LifeBuoy,
    path: "/employee/help",
    feature: null,
    section: "support",
    permissions: ["self_read", "all"],
    roles: ["Employee"],
    children: [],
  },
];

const isFeatureLocked = (feature, user) => {
  if (!feature) return false;
  const roles = (user?.roles || [])
    .map((r) => (typeof r === "string" ? r : r?.name))
    .filter(Boolean);
  const has = (name) => roles.includes(name) || user?.role === name;

  if (feature === "advancedAnalytics") {
    return !has("Admin") && !has("RH");
  }
  return false;
};

const labelOverride = {
  home: "Tableau de bord",
  employeeDashboard: "Accueil",
  employeeProfile: "Mon profil",
  employeeTime: "Temps & absences",
  employeeRequests: "Mes demandes",
  employeeDocsAndPayroll: "Paie & documents",
  employeePerformance: "Performance & objectifs",
  employeeTrainings: "Formation & carrière",
  employeeHelp: "Aide RH",
  employeeIndicators: "Mes indicateurs",

  employees: "Employés",
  directory: "Annuaire",
  contracts: "Contrats",
  employeeDocuments: "Parcours & documents",

  timePresence: "Temps & présence",
  leaves: "Congés",
  timeTracking: "Feuilles de temps",
  attendance: "Pointage",

  expensesRequests: "Dépenses & demandes",
  expenses: "Dépenses",
  hrRequests: "Demandes RH",
  managerApprovals: "Validations",

  performance: "Performance",
  training: "Formation",

  analytics: "Rapports & pilotage",
  reports: "Rapports",
  dashboards: "Tableaux de bord",

  administration: "Administration",
  organization: "Organisation",
  rolesPermissions: "Rôles & permissions",
  workflows: "Circuits RH",
  hrPolicies: "Politiques RH",
  auditLog: "Journal d’audit",
};

const ROLE_LABELS = {
  ADMIN: "Admin",
  HR: "RH",
  IT: "IT",
  MANAGER: "Manager",
  EMPLOYEE: "Employé",
  FINANCE: "Finance",
};

const DEFAULT_SECTION_ORDER = ["workspace", "operations", "talent", "support", "analytics", "admin"];

const DEFAULT_SECTION_LABELS = {
  workspace: "Espace de travail",
  operations: "Opérations",
  talent: "Talent & développement",
  support: "Support & aide",
  analytics: "Pilotage",
  admin: "Administration",
};

const findActiveParentKey = (items, currentPath) => {
  const parent = items.find((item) =>
    Array.isArray(item.children) &&
    item.children.some((child) => {
      if (!child?.path) return false;
      return currentPath === child.path || currentPath.startsWith(`${child.path}/`);
    })
  );
  return parent?.key || null;
};

const resolvePrimaryRole = (roles, fallbackRole) => {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return normalizeRole(fallbackRole) || "EMPLOYEE";
};

const Sidebar = ({ currentPath = "/", onNavigate, user }) => {
  const { t } = useApp();
  const { logout } = useAuth();
  const userRoles = (user?.roles || [])
    .map((r) => normalizeRole(typeof r === "string" ? r : r?.name))
    .filter(Boolean);
  const userPermissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const primaryRole = resolvePrimaryRole(userRoles, user?.role);
  const isEmployeeView = primaryRole === "EMPLOYEE";
  const sidebarItems = isEmployeeView ? EMPLOYEE_SIDEBAR_ITEMS : DEFAULT_SIDEBAR_ITEMS;
  const sectionOrder = DEFAULT_SECTION_ORDER;
  const sectionLabels = DEFAULT_SECTION_LABELS;

  const [isCollapsed, setIsCollapsed] = useState(() => loadBoolean(STORAGE_KEYS.collapsed, false));
  const [collapsedDetailsKey, setCollapsedDetailsKey] = useState(null);
  const [expandedItems, setExpandedItems] = useState(() => {
    const parentKey = findActiveParentKey(sidebarItems, currentPath);
    if (parentKey) return [parentKey];
    const firstExpandable = sidebarItems.find((item) => Array.isArray(item.children) && item.children.length > 0);
    return firstExpandable ? [firstExpandable.key] : [];
  });
  const [counts, setCounts] = useState({ leaves: 0, timesheets: 0, expenses: 0, events: 0, managerApprovals: 0, total: 0 });
  const [peopleCounts, setPeopleCounts] = useState({ directory: 0, performance: 0, training: 0, total: 0 });
  const [employeeCounts, setEmployeeCounts] = useState({
    pendingActions: 0,
    openRequests: 0,
    missingDays: 0,
    upcomingLeaves: 0,
  });

  const trainingOverrideRef = useRef(loadNumber(STORAGE_KEYS.training));
  const performanceOverrideRef = useRef(loadNumber(STORAGE_KEYS.performance));

  const midnightTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const withTimeout = (promise, ms = 5000) =>
    Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  const safeGet = async (url) => {
    try {
      return await withTimeout(get(url));
    } catch (e) {
      return null;
    }
  };

  const fetchOperationCounts = async () => {
    const s = await safeGet("/dashboard/summary");
    const p = s?.pendingValidations || {};
    const leaves = p?.leaves || 0;
    const timesheets = p?.timesheets || 0;
    const expenses = p?.expenses || 0;
    let managerApprovals = 0;

    if (primaryRole === "MANAGER") {
      const managerDashboard = await safeGet("/dashboard/manager");
      const approvals = managerDashboard?.approvalsSummary || {};
      managerApprovals =
        Number(approvals.leavePendingCount || 0) +
        Number(approvals.expensePendingCount || 0) +
        Number(approvals.hrRequestPendingCount || 0) +
        Number(approvals.trainingPendingCount || 0) +
        Number(approvals.timesheetPendingCount || 0);
    }

    let events = 0;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const from = `${yyyy}-${mm}-${dd}`;
    const evRes = await safeGet(`/operations/events?from=${from}`);
    events = Array.isArray(evRes?.events)
      ? evRes.events.length
      : Array.isArray(evRes)
      ? evRes.length
      : 0;

    if (!mountedRef.current) return;
    setCounts({
      leaves,
      timesheets,
      expenses,
      events,
      managerApprovals,
      total: leaves + timesheets + expenses + events,
    });
  };

  const sumOrTotal = (obj, keys, totalKey = "total") => {
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
      safeGet("/people/counters/directory"),
      safeGet("/people/counters/performance"),
      safeGet("/people/counters/training"),
    ]);

    const dirCountBase = sumOrTotal(dir, ["profilesIncomplete", "docsExpiring"]);
    const perfCountBase = sumOrTotal(perf, ["goalsPending", "reviewsDue"]);
    const trnCountBase = sumOrTotal(train, ["sessionsSoon", "certsExpiring", "sessionsSoon14"]);

    const perfCount = typeof performanceOverrideRef.current === "number" ? performanceOverrideRef.current : perfCountBase;
    const trnCount = typeof trainingOverrideRef.current === "number" ? trainingOverrideRef.current : trnCountBase;

    if (!mountedRef.current) return;
    setPeopleCounts({
      directory: dirCountBase,
      performance: perfCount,
      training: trnCount,
      total: dirCountBase + perfCount + trnCount,
    });
  };

  const fetchCounts = async () => {
    await Promise.allSettled([fetchOperationCounts(), fetchPeopleCounts()]);
  };

  const fetchEmployeeCounts = async () => {
    const d = await safeGet("/dashboard/employee");
    if (!mountedRef.current || !d) return;
    const pendingActions =
      Number(d?.pendingDocuments?.length || 0) +
      Number(d?.pendingForms?.length || 0) +
      Number(d?.upcomingInterviews?.length || 0);
    setEmployeeCounts({
      pendingActions,
      openRequests: Number(d?.myRequestsSummary?.totalOpen || 0),
      missingDays: Number(d?.timeToFill?.missingDays?.length || 0),
      upcomingLeaves: Number(d?.upcomingLeaves?.length || 0),
    });
  };

  useEffect(() => {
    mountedRef.current = true;

    if (isEmployeeView) {
      const id = setTimeout(() => {
        if (ENABLE_SIDEBAR_COUNTS) fetchEmployeeCounts();
      }, 1);
      const onAppRefresh = () => {
        if (ENABLE_SIDEBAR_COUNTS) fetchEmployeeCounts();
      };
      window.addEventListener("app:counters:refresh", onAppRefresh);

      const interval = setInterval(() => {
        if (ENABLE_SIDEBAR_COUNTS) fetchEmployeeCounts();
      }, 10 * 60 * 1000);

      const onVisible = () => {
        if (!document.hidden && ENABLE_SIDEBAR_COUNTS) fetchEmployeeCounts();
      };
      document.addEventListener("visibilitychange", onVisible);

      return () => {
        mountedRef.current = false;
        clearTimeout(id);
        window.removeEventListener("app:counters:refresh", onAppRefresh);
        clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }

    setPeopleCounts((prev) => {
      const directory = prev.directory || 0;
      const performance = typeof performanceOverrideRef.current === "number" ? performanceOverrideRef.current : prev.performance || 0;
      const training = typeof trainingOverrideRef.current === "number" ? trainingOverrideRef.current : prev.training || 0;
      return { directory, performance, training, total: directory + performance + training };
    });

    const id = setTimeout(() => {
      if (ENABLE_SIDEBAR_COUNTS) fetchCounts();
    }, 1);

    const onAppRefresh = () => {
      if (ENABLE_SIDEBAR_COUNTS) fetchCounts();
    };
    const onEventsChanged = () => {
      if (ENABLE_SIDEBAR_COUNTS) fetchOperationCounts();
    };

    const onGoalsChanged = (e) => {
      const d = e?.detail || {};
      let next = null;
      if (typeof d.activeGoals === "number") next = d.activeGoals | 0;
      else if (typeof d.total === "number") next = d.total | 0;

      if (next !== null) {
        next = Math.max(0, next);
        performanceOverrideRef.current = next;
        saveNumber(STORAGE_KEYS.performance, next);
        setPeopleCounts((prev) => {
          const directory = prev.directory || 0;
          const training = typeof trainingOverrideRef.current === "number" ? trainingOverrideRef.current : prev.training || 0;
          const performance = next;
          return { ...prev, performance, total: directory + performance + training };
        });
      } else if (ENABLE_SIDEBAR_COUNTS) {
        fetchPeopleCounts();
      }
    };

    const onTrainingChanged = (e) => {
      const d = e?.detail || {};
      let next = null;
      if (typeof d.sessionsSoon14 === "number") next = d.sessionsSoon14 | 0;
      else if (typeof d.total === "number") next = d.total | 0;
      else if (typeof d.count === "number") next = d.count | 0;

      if (next !== null) {
        next = Math.max(0, next);
        trainingOverrideRef.current = next;
        saveNumber(STORAGE_KEYS.training, next);
        setPeopleCounts((prev) => {
          const directory = prev.directory || 0;
          const performance = typeof performanceOverrideRef.current === "number" ? performanceOverrideRef.current : prev.performance || 0;
          const training = next;
          return { ...prev, training, total: directory + performance + training };
        });
      } else if (ENABLE_SIDEBAR_COUNTS) {
        fetchPeopleCounts();
      }
    };

    const onEmployeesChanged = () => {
      if (ENABLE_SIDEBAR_COUNTS) fetchPeopleCounts();
    };

    window.addEventListener("app:counters:refresh", onAppRefresh);
    window.addEventListener("events:changed", onEventsChanged);
    window.addEventListener("goals:changed", onGoalsChanged);
    window.addEventListener("employees:changed", onEmployeesChanged);
    window.addEventListener("training:changed", onTrainingChanged);

    const interval = setInterval(() => {
      if (ENABLE_SIDEBAR_COUNTS) fetchCounts();
    }, 10 * 60 * 1000);

    const onVisible = () => {
      if (!document.hidden && ENABLE_SIDEBAR_COUNTS) fetchCounts();
    };
    document.addEventListener("visibilitychange", onVisible);

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
      window.removeEventListener("app:counters:refresh", onAppRefresh);
      window.removeEventListener("events:changed", onEventsChanged);
      window.removeEventListener("goals:changed", onGoalsChanged);
      window.removeEventListener("employees:changed", onEmployeesChanged);
      window.removeEventListener("training:changed", onTrainingChanged);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);
    };
  }, [isEmployeeView]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    saveBoolean(STORAGE_KEYS.collapsed, isCollapsed);
    if (!isCollapsed) {
      setCollapsedDetailsKey(null);
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (!isCollapsed) return;
    const parentKey = findActiveParentKey(sidebarItems, currentPath);
    setCollapsedDetailsKey(parentKey || null);
  }, [isCollapsed, currentPath, sidebarItems]);

  const tenantName = user?.tenant?.name || (user?.email ? user.email.split("@")[1] : null) || "Mon espace";
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : "Utilisateur";
  const handleLogout = async () => {
    await logout();
  };

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  const toggleExpanded = (key) => {
    setExpandedItems((prev) => (prev.includes(key) ? [] : [key]));
  };

  const roleLabel = ROLE_LABELS[primaryRole] || "Utilisateur";
  const tenantInitial = String(tenantName || "S").slice(0, 1).toUpperCase();
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
  const pendingActionsCount = isEmployeeView
    ? employeeCounts.pendingActions
    : counts.total + peopleCounts.total;

  const hasAnyPermission = (required) => {
    if (!required || !required.length) return true;
    if (userPermissions.includes("all")) return true;
    return required.some((p) => userPermissions.includes(p));
  };

  const hasAnyRole = (required) => {
    if (!required || !required.length) return true;
    const needed = required.map((r) => normalizeRole(r)).filter(Boolean);
    return needed.some((r) => userRoles.includes(r));
  };

  const canAccess = (item) => {
    if (!item) return false;
    if (!hasAnyPermission(item.permissions || [])) return false;
    if (!hasAnyRole(item.roles || [])) return false;
    return true;
  };

  const getValidationCountForItem = (itemKey) => {
    if (itemKey === "employeeRequests") return employeeCounts.openRequests || 0;
    if (itemKey === "employeeTime") return employeeCounts.missingDays || 0;
    if (itemKey === "employeeDashboard") return employeeCounts.pendingActions || 0;
    if (itemKey === "employeeIndicators") return 0;

    if (itemKey === "timePresence") {
      const isExpanded = expandedItems.includes("timePresence");
      return isExpanded ? 0 : counts.leaves + counts.timesheets + counts.events;
    }

    if (itemKey === "leaves") return counts.leaves;
    if (itemKey === "timeTracking") return counts.timesheets;

    if (itemKey === "expensesRequests") {
      const isExpanded = expandedItems.includes("expensesRequests");
      return isExpanded ? 0 : counts.expenses;
    }

    if (itemKey === "expenses") return counts.expenses;
    if (itemKey === "managerApprovals") return counts.managerApprovals || 0;

    if (itemKey === "employees") {
      const isExpanded = expandedItems.includes("employees");
      return isExpanded ? 0 : peopleCounts.total || 0;
    }

    if (itemKey === "directory") return peopleCounts.directory || 0;
    if (itemKey === "performance") return peopleCounts.performance || 0;
    if (itemKey === "training") return peopleCounts.training || 0;

    return 0;
  };

  const isPathActive = (path) => {
    if (!path) return false;
    if (path === "/") return currentPath === "/";
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  const renderNavItem = (item, level = 0) => {
    if (!canAccess(item)) return null;

    const isExpanded = expandedItems.includes(item.key);
    const visibleChildren = Array.isArray(item.children)
      ? item.children.filter((child) => canAccess(child))
      : [];
    const hasChildren = visibleChildren.length > 0;
    const isLocked = item.feature ? isFeatureLocked(item.feature, user) : false;
    const childActive = visibleChildren.some((child) => isPathActive(child.path));
    const isActive = hasChildren ? childActive : isPathActive(item.path);
    const shouldShowChildren = hasChildren && isExpanded;
    const defaultChildPath = hasChildren
      ? (visibleChildren.find((child) => child?.path)?.path || null)
      : null;
    const Icon = item.icon;

    const handleClick = () => {
      if (isLocked) return;

      if (item.path) {
        onNavigate?.(item.path);
        return;
      }

      if (defaultChildPath) {
        setExpandedItems([item.key]);
        onNavigate?.(defaultChildPath);
        return;
      }

      if (hasChildren) toggleExpanded(item.key);
    };

    const handleChevronClick = (e) => {
      e.stopPropagation();
      if (hasChildren) toggleExpanded(item.key);
    };

    const badgeCount = getValidationCountForItem(item.key);
    const label = labelOverride[item.key] ?? t(`nav.${item.key}`);

    const labelClassName = level > 0
      ? "font-medium whitespace-nowrap truncate"
      : "font-semibold whitespace-nowrap";

    return (
      <div key={item.key}>
        <div
          className={`
            flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer select-none text-[15px]
            transition-all duration-200 group
            ${isActive ? "bg-emerald-400/22 text-white border border-emerald-300/45 shadow-[0_0_0_1px_rgba(52,211,153,0.20)]" : ""}
            ${isLocked ? "text-emerald-900/40 cursor-not-allowed" : "text-emerald-50 hover:bg-emerald-300/14 hover:text-white"}
            ${level > 0 ? "ml-4 text-sm pl-4" : ""}
          `}
          onClick={handleClick}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {Icon && (
              <Icon
                className={`
                  w-5 h-5
                  ${isLocked ? "text-emerald-900/30" : isActive ? "text-emerald-100" : "text-emerald-100/80"}
                `}
              />
            )}
            {!Icon && level > 0 && (
              <span
                className={`
                  w-1.5 h-1.5 rounded-full
                  ${isActive ? "bg-emerald-300" : "bg-slate-500"}
                `}
              />
            )}
            <span className={labelClassName}>{label}</span>

            {isLocked && (
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-900/40" />
                {item.plan && <Crown className="w-3 h-3 text-amber-500" />}
              </span>
            )}
          </div>

          <span
            className={`
              min-w-6 h-5 px-1.5 rounded-full text-[11px] font-semibold
              inline-flex items-center justify-center
              ${badgeCount > 0 ? "bg-emerald-500/24 text-emerald-50 border border-emerald-300/45" : "opacity-0"}
            `}
          >
            {badgeCount || 0}
          </span>

          {hasChildren && (
            <button
              type="button"
              onClick={handleChevronClick}
              className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-emerald-300/15"
              aria-label={shouldShowChildren ? "Réduire le menu" : "Développer le menu"}
            >
              {shouldShowChildren ? (
                <ChevronDown className="w-4 h-4 text-emerald-100/60" />
              ) : (
                <ChevronRight className="w-4 h-4 text-emerald-100/60" />
              )}
            </button>
          )}
        </div>

        {shouldShowChildren && <div className="mt-1 mb-2 space-y-1">{visibleChildren.map((child) => renderNavItem(child, level + 1))}</div>}
      </div>
    );
  };

  const visibleItems = sidebarItems.filter((item) => canAccess(item));
  const renderCollapsedNavItem = (item) => {
    if (!canAccess(item)) return null;

    const visibleChildren = Array.isArray(item.children)
      ? item.children.filter((child) => canAccess(child))
      : [];
    const hasChildren = visibleChildren.length > 0;
    const isLocked = item.feature ? isFeatureLocked(item.feature, user) : false;
    const childActive = visibleChildren.some((child) => isPathActive(child.path));
    const isActive = hasChildren ? childActive : isPathActive(item.path);
    const isPanelOpen = collapsedDetailsKey === item.key;
    const badgeCount = getValidationCountForItem(item.key);
    const label = labelOverride[item.key] ?? t(`nav.${item.key}`);
    const Icon = item.icon;

    const handleCollapsedClick = () => {
      if (isLocked) return;

      if (hasChildren) {
        setCollapsedDetailsKey((prev) => (prev === item.key ? null : item.key));
        return;
      }

      if (item.path) {
        onNavigate?.(item.path);
        setCollapsedDetailsKey(null);
      }
    };

    return (
      <button
        key={item.key}
        type="button"
        title={label}
        onClick={handleCollapsedClick}
        className={`
          relative w-11 h-11 mx-auto rounded-xl border transition-all duration-200
          flex items-center justify-center
          ${isActive ? "bg-emerald-400/24 border-emerald-300/45 text-white" : "bg-transparent border-transparent text-emerald-100/85 hover:bg-emerald-300/14"}
          ${isLocked ? "opacity-45 cursor-not-allowed" : ""}
        `}
      >
        {Icon && <Icon className="w-5 h-5" />}
        {badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold inline-flex items-center justify-center border border-emerald-300/50">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
        {hasChildren && (
          <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full ${isPanelOpen ? "bg-emerald-300" : "bg-emerald-700/80"}`} />
        )}
      </button>
    );
  };

  const collapsedDetailsItem = isCollapsed
    ? visibleItems.find((item) => item.key === collapsedDetailsKey) || null
    : null;
  const collapsedDetailsChildren = collapsedDetailsItem && Array.isArray(collapsedDetailsItem.children)
    ? collapsedDetailsItem.children.filter((child) => canAccess(child))
    : [];
  const collapsedDetailsTitle = collapsedDetailsItem
    ? (labelOverride[collapsedDetailsItem.key] ?? t(`nav.${collapsedDetailsItem.key}`))
    : "";
  const showCollapsedDetails = isCollapsed && !!collapsedDetailsItem && collapsedDetailsChildren.length > 0;

  const groupedItems = sectionOrder
    .map((sectionKey) => ({
      key: sectionKey,
      label: sectionLabels[sectionKey],
      items: visibleItems.filter((item) => item.section === sectionKey),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={`
        relative h-full bg-gradient-to-b from-emerald-900 via-emerald-950 to-[#022c22]
        border-r border-emerald-700/45 flex flex-col shadow-xl transition-all duration-250
        ${isCollapsed ? (showCollapsedDetails ? "w-[344px]" : "w-[92px]") : "w-[304px] max-w-[88vw]"}
      `}
    >
      <div className={`${isCollapsed ? "w-[92px] p-3" : "p-4"} border-b border-emerald-700/35`}>
        <div className={`flex items-center ${isCollapsed ? "justify-center gap-2" : "justify-between gap-3"} rounded-xl border border-emerald-200/20 bg-emerald-700/20 px-3 py-3`}>
          <div className={`flex items-center ${isCollapsed ? "" : "gap-3"} min-w-0`}>
            <div className="w-9 h-9 bg-emerald-400 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">{tenantInitial}</span>
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-100/80">SIRH Workspace</p>
                <h3 className="font-semibold text-white text-sm truncate">{tenantName}</h3>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-emerald-100/85 hover:bg-emerald-300/15"
            aria-label={isCollapsed ? "Ouvrir la barre latérale" : "Réduire la barre latérale"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {!isCollapsed && (
          <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/16 px-3 py-2.5">
            <p className="text-[11px] text-emerald-50/95">{isEmployeeView ? "Actions requises" : "Actions prioritaires"}</p>
            <div className="mt-1 flex items-end justify-between">
              <span className="text-2xl font-bold text-white">{pendingActionsCount}</span>
              <span className="text-[11px] text-emerald-50/80">à traiter</span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-100/80">
              {isEmployeeView
                ? `${employeeCounts.openRequests} demande(s) ouverte(s) · ${employeeCounts.missingDays} jour(s) à compléter`
                : `${counts.total} opérations · ${peopleCounts.total} dossier(s) RH`}
            </p>
          </div>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto ${isCollapsed ? "w-[92px] px-2 py-3 space-y-3" : "px-3 py-4 space-y-4"}`}>
        {groupedItems.map((group) => (
          <section key={group.key}>
            {!isCollapsed && (
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100/85">
                {group.label}
              </p>
            )}
            <div className={isCollapsed ? "space-y-2" : "space-y-1"}>
              {group.items.map((item) => (isCollapsed ? renderCollapsedNavItem(item) : renderNavItem(item)))}
            </div>
          </section>
        ))}
      </div>

      {showCollapsedDetails && (
        <div className="absolute left-[92px] top-3 bottom-3 w-[250px] rounded-2xl border border-emerald-300/30 bg-emerald-950/95 backdrop-blur shadow-2xl z-30 flex flex-col">
          <div className="px-3 py-3 border-b border-emerald-700/40 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-50 truncate">{collapsedDetailsTitle}</p>
            <button
              type="button"
              onClick={() => setCollapsedDetailsKey(null)}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-emerald-100/75 hover:bg-emerald-300/15"
              aria-label="Fermer les détails"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="p-2 space-y-1 overflow-y-auto">
            {collapsedDetailsChildren.map((child) => {
              const childActive = isPathActive(child.path);
              const childLabel = labelOverride[child.key] ?? t(`nav.${child.key}`);
              const childCount = getValidationCountForItem(child.key);
              return (
                <button
                  key={child.key}
                  type="button"
                  onClick={() => {
                    if (child.path) onNavigate?.(child.path);
                  }}
                  className={`
                    w-full px-3 py-2 rounded-lg text-left text-sm transition-colors
                    flex items-center justify-between
                    ${childActive ? "bg-emerald-400/24 text-white" : "text-emerald-50/90 hover:bg-emerald-300/14"}
                  `}
                >
                  <span className="truncate">{childLabel}</span>
                  <span className={`${childCount > 0 ? "opacity-100" : "opacity-0"} min-w-5 h-5 px-1 text-[10px] font-semibold rounded-full border border-emerald-300/45 bg-emerald-500/24 text-emerald-50 inline-flex items-center justify-center`}>
                    {childCount || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={`${isCollapsed ? "w-[92px] p-3" : "p-4"} border-t border-emerald-700/35 bg-emerald-950/55`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className={`
                w-full rounded-xl border border-emerald-200/20 bg-emerald-900/35 hover:bg-emerald-800/45
                ${isCollapsed ? "h-11 px-0" : "h-auto px-3 py-2.5"}
              `}
            >
              {isCollapsed ? (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
              ) : (
                <div className="w-full flex items-center justify-between text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                      <p className="text-[11px] text-emerald-100/70 truncate">{roleLabel}</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-emerald-100/70 shrink-0" />
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => onNavigate?.("/settings")}>
              {t("common.settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};

Sidebar.propTypes = {
  currentPath: PropTypes.string,
  onNavigate: PropTypes.func,
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
    tenant: PropTypes.shape({ name: PropTypes.string }),
    roles: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
    role: PropTypes.string,
    permissions: PropTypes.arrayOf(PropTypes.string),
  }),
};

export default Sidebar;
