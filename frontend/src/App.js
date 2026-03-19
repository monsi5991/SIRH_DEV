import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import PropTypes from "prop-types";

import { Toaster } from "./components/ui/toaster";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import ScopeRoute from "./components/auth/ScopeRoute";

// Public pages
import ForbiddenPage from "./pages/ForbiddenPage";

// Layout
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";

// Core pages
import HomePage from "./pages/HomePage";

// Operations
import LeavesPage from "./pages/operations/LeavesPage";
import TimePage from "./pages/operations/TimePage";
import PlanningPage from "./pages/operations/PlanningPage";
import ExpensesPage from "./pages/operations/ExpensesPage";
import AttendancePage from "./pages/operations/AttendancePage";
import HrRequestsPage from "./pages/operations/HrRequestsPage";

// People
import AnnuairePage from "./pages/people/AnnuairePage";
import PerformancePage from "./pages/people/PerformancePage";
import PerformanceDetailPage from "./pages/people/PerformanceDetailPage";
import FormationPage from "./pages/people/FormationPage";
import EmployeeContractsPage from "./pages/people/EmployeeContractsPage";
import EmployeeDocumentsHubPage from "./pages/people/EmployeeDocumentsHubPage";

// Documents
import OnboardingPage from "./pages/documents/OnboardingPage";
import OffboardingPage from "./pages/documents/OffboardingPage";

// Resources / analytics / admin
import CompliancePage from "./pages/resources/CompliancePage";
import PoliciesPage from "./pages/resources/PoliciesPage";
import AnalyticsReportsPage from "./pages/analytics/AnalyticsReportsPage";
import AnalyticsDashboardsPage from "./pages/analytics/AnalyticsDashboardsPage";
import AdminStructurePage from "./pages/admin/AdminStructurePage";
import AdminPermissionsPage from "./pages/admin/AdminPermissionsPage";
import AdminIntegrationsPage from "./pages/admin/AdminIntegrationsPage";
import AdminWorkflowsPage from "./pages/admin/AdminWorkflowsPage";
import AdminAuditLogPage from "./pages/admin/AdminAuditLogPage";

// Manager
import ManagerDashboardPage from "./pages/manager/ManagerDashboardPage";
import ManagerApprovalsPage from "./pages/manager/ManagerApprovalsPage";

// Employee self-service
import EmployeeDashboardPage from "./pages/employee/EmployeeDashboardPage";
import EmployeeProfilePage from "./pages/employee/EmployeeProfilePage";
import EmployeeRequestsPage from "./pages/employee/EmployeeRequestsPage";
import EmployeeDocumentsPage from "./pages/employee/EmployeeDocumentsPage";
import EmployeeTimeAbsencesPage from "./pages/employee/EmployeeTimeAbsencesPage";
import EmployeePerformancePage from "./pages/employee/EmployeePerformancePage";
import EmployeeTrainingsPage from "./pages/employee/EmployeeTrainingsPage";
import EmployeeHelpPage from "./pages/employee/EmployeeHelpPage";
import EmployeeIndicatorsPage from "./pages/employee/EmployeeIndicatorsPage";
import SettingsPage from "./pages/settings/SettingsPage";

// HR space
import HrWorkforcePlanningPage from "./pages/hr/HrWorkforcePlanningPage";
import HrStrategicReviewsPage from "./pages/hr/HrStrategicReviewsPage";
import HrDashboardPage from "./pages/hr/HrDashboardPage";

// Employee admin pages
import EmployeeEditPage from "./pages/employee/EmployeeEditPage";
import { useAuth } from "./contexts/AuthContext";
import { normalizeRoles } from "./lib/permissions";

function AppShell({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const handleNavigate = (path) => {
    if (path && path !== currentPath) navigate(path);
  };

  return (
    <div className="h-screen flex bg-gray-50">
      <Sidebar currentPath={currentPath} onNavigate={handleNavigate} user={user} />
      <div className="flex-1 flex flex-col">
        <Header user={user} />
        <main className="layout-main flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

AppShell.propTypes = {
  user: PropTypes.shape({
    email: PropTypes.string,
    tenant: PropTypes.shape({ name: PropTypes.string }),
  }),
};

function RequireAuthLayout() {
  return (
    <ProtectedRoute redirectTo="/login">
      {({ user }) => <AppShell user={user} />}
    </ProtectedRoute>
  );
}

const RolePerm = (props) => <ProtectedRoute {...props} enforce="both" />;
const Access = (props) => <ScopeRoute {...props} />;

function RoleHomeRedirect() {
  const { user, loading } = useAuth();
  if (loading || !user) return <div className="p-6 text-center">Chargement…</div>;

  const roles = normalizeRoles(user?.roles || user?.role || []);
  if (roles.includes("ADMIN") || roles.includes("HR")) return <Navigate to="/hr/dashboard" replace />;
  if (roles.includes("MANAGER")) return <Navigate to="/manager/dashboard" replace />;
  if (roles.includes("EMPLOYEE")) return <Navigate to="/employee/dashboard" replace />;
  return <HomePage />;
}

function DashboardOverviewRedirect() {
  const { user, loading } = useAuth();
  if (loading || !user) return <div className="p-6 text-center">Chargement…</div>;

  const roles = normalizeRoles(user?.roles || user?.role || []);
  if (roles.includes("ADMIN") || roles.includes("HR")) return <Navigate to="/hr/dashboard" replace />;
  if (roles.includes("MANAGER")) return <Navigate to="/manager/dashboard" replace />;
  if (roles.includes("EMPLOYEE")) return <Navigate to="/employee/dashboard" replace />;
  return <Navigate to="/" replace />;
}

function RedirectPreserveSearch({ to }) {
  const location = useLocation();
  const nextUrl = React.useMemo(() => {
    const target = new URL(to, window.location.origin);
    const currentParams = new URLSearchParams(location.search || "");

    currentParams.forEach((value, key) => {
      if (!target.searchParams.has(key)) {
        target.searchParams.set(key, value);
      }
    });

    return `${target.pathname}${target.search}${location.hash || target.hash || ""}`;
  }, [location.hash, location.search, to]);

  return <Navigate to={nextUrl} replace />;
}

RedirectPreserveSearch.propTypes = {
  to: PropTypes.string.isRequired,
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/403" element={<ForbiddenPage />} />

      <Route element={<RequireAuthLayout />}>
        <Route index element={<RoleHomeRedirect />} />
        <Route path="dashboard/overview" element={<DashboardOverviewRedirect />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Operations */}
        <Route
          path="operations/leaves"
          element={
            <Access
              requiredRoles={["RH", "MANAGER", "ADMIN"]}
              requiredPermissions={["operations_read", "all"]}
              mode="anyOf"
            >
              <LeavesPage />
            </Access>
          }
        />
        <Route
          path="operations/absences"
          element={<Navigate to="/operations/leaves" replace />}
        />
        <Route
          path="operations/time"
          element={
            <Access
              requiredRoles={["RH", "MANAGER", "ADMIN"]}
              requiredPermissions={["operations_read", "all"]}
              mode="anyOf"
            >
              <TimePage />
            </Access>
          }
        />
        <Route
          path="operations/attendance"
          element={
            <Access
              requiredRoles={["RH", "MANAGER", "ADMIN"]}
              requiredPermissions={["operations_read", "all"]}
              mode="anyOf"
            >
              <AttendancePage />
            </Access>
          }
        />
        <Route
          path="operations/planning"
          element={
            <Access
              requiredRoles={["RH", "MANAGER", "ADMIN"]}
              requiredPermissions={["operations_read", "all"]}
              mode="anyOf"
            >
              <PlanningPage />
            </Access>
          }
        />
        <Route
          path="operations/expenses"
          element={
            <Access
              requiredRoles={["RH", "MANAGER", "ADMIN"]}
              requiredPermissions={["operations_read", "all"]}
              mode="anyOf"
            >
              <ExpensesPage />
            </Access>
          }
        />

        {/* Requests */}
        <Route
          path="requests/hr"
          element={
            <Access
              requiredRoles={["RH", "MANAGER", "ADMIN"]}
              requiredPermissions={["self_read", "operations_read", "team_read", "admin_read", "all"]}
              mode="anyOf"
            >
              <HrRequestsPage />
            </Access>
          }
        />

        {/* People */}
        <Route
          path="people/directory"
          element={
            <Access requiredRoles={["RH", "MANAGER", "ADMIN"]} requiredPermissions={["directory_read", "all"]} mode="anyOf">
              <AnnuairePage />
            </Access>
          }
        />
        <Route
          path="people/contracts"
          element={
            <Access requiredRoles={["RH", "MANAGER", "ADMIN"]} requiredPermissions={["directory_read", "all"]} mode="anyOf">
              <EmployeeContractsPage />
            </Access>
          }
        />
        <Route
          path="people/documents"
          element={
            <Access requiredRoles={["RH", "MANAGER", "ADMIN", "IT"]} requiredPermissions={["directory_read", "team_read", "all"]} mode="anyOf">
              <EmployeeDocumentsHubPage />
            </Access>
          }
        />
        <Route
          path="employees/documents"
          element={
            <Access requiredRoles={["RH", "MANAGER", "ADMIN", "IT"]} requiredPermissions={["directory_read", "team_read", "all"]} mode="anyOf">
              <RedirectPreserveSearch to="/people/documents" />
            </Access>
          }
        />
        <Route
          path="people/performance"
          element={
            <Access requiredRoles={["RH", "MANAGER", "ADMIN"]} requiredPermissions={["directory_read", "all"]} mode="anyOf">
              <PerformancePage />
            </Access>
          }
        />
        <Route
          path="people/performance/:id"
          element={
            <Access requiredRoles={["RH", "MANAGER", "ADMIN"]} requiredPermissions={["directory_read", "all"]} mode="anyOf">
              <PerformanceDetailPage />
            </Access>
          }
        />
        <Route
          path="people/training"
          element={
            <Access requiredRoles={["RH", "MANAGER", "ADMIN"]} requiredPermissions={["directory_read", "all"]} mode="anyOf">
              <FormationPage />
            </Access>
          }
        />

        {/* Documents */}
        <Route
          path="documents/onboarding"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["all"]} mode="anyOf">
              <OnboardingPage />
            </Access>
          }
        />
        <Route
          path="documents/offboarding"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["all"]} mode="anyOf">
              <OffboardingPage />
            </Access>
          }
        />

        {/* Resources */}
        <Route
          path="resources/compliance"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["admin_read", "all"]} mode="anyOf">
              <CompliancePage />
            </Access>
          }
        />
        <Route path="resources/policies" element={<Navigate to="/admin/policies" replace />} />

        {/* Analytics */}
        <Route
          path="analytics/reports"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["analytics_read", "all"]} mode="anyOf">
              <AnalyticsReportsPage />
            </Access>
          }
        />
        <Route
          path="analytics/dashboards"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["analytics_read", "all"]} mode="anyOf">
              <AnalyticsDashboardsPage />
            </Access>
          }
        />

        {/* Administration (new) */}
        <Route
          path="admin/organization"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["admin_read", "all"]} mode="anyOf">
              <AdminStructurePage />
            </Access>
          }
        />
        <Route
          path="admin/roles-permissions"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["admin_read", "all"]} mode="anyOf">
              <AdminPermissionsPage />
            </Access>
          }
        />
        <Route
          path="admin/workflows"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["admin_read", "all"]} mode="anyOf">
              <AdminWorkflowsPage />
            </Access>
          }
        />
        <Route
          path="admin/policies"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["admin_read", "all"]} mode="anyOf">
              <PoliciesPage />
            </Access>
          }
        />
        <Route
          path="admin/audit-log"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["admin_read", "all"]} mode="anyOf">
              <AdminAuditLogPage />
            </Access>
          }
        />

        {/* Legacy admin aliases */}
        <Route path="admin/structure" element={<Navigate to="/admin/organization" replace />} />
        <Route path="admin/permissions" element={<Navigate to="/admin/roles-permissions" replace />} />
        <Route
          path="admin/integrations"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["admin_read", "all"]} mode="anyOf">
              <AdminIntegrationsPage />
            </Access>
          }
        />

        {/* Keep old resource pages reachable by explicit compatibility routes if needed */}
        <Route
          path="_legacy/resources/compliance"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["all"]} mode="anyOf">
              <CompliancePage />
            </Access>
          }
        />
        <Route
          path="_legacy/resources/policies"
          element={
            <Access requiredRoles={["RH", "ADMIN"]} requiredPermissions={["admin_read", "all"]} mode="anyOf">
              <PoliciesPage />
            </Access>
          }
        />

        {/* Manager */}
        <Route
          path="manager/dashboard"
          element={
            <RolePerm requiredRole="Manager" requiredPermissions={["team_read"]}>
              <ManagerDashboardPage />
            </RolePerm>
          }
        />
        <Route
          path="manager/team-overview"
          element={<Navigate to="/manager/dashboard" replace />}
        />
        <Route
          path="manager/approvals"
          element={
            <RolePerm requiredRole="Manager" requiredPermissions={["team_read"]}>
              <ManagerApprovalsPage />
            </RolePerm>
          }
        />
        <Route
          path="manager/approvals-manager"
          element={<Navigate to="/manager/approvals" replace />}
        />
        <Route
          path="manager/performance"
          element={<Navigate to="/manager/dashboard" replace />}
        />

        {/* Employee self-service */}
        <Route
          path="employee/dashboard"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <EmployeeDashboardPage />
            </RolePerm>
          }
        />
        <Route
          path="employee/requests"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <EmployeeRequestsPage />
            </RolePerm>
          }
        />
        <Route
          path="employee/time"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <EmployeeTimeAbsencesPage />
            </RolePerm>
          }
        />
        <Route
          path="employee/performance"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <EmployeePerformancePage />
            </RolePerm>
          }
        />
        <Route
          path="employee/trainings"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <EmployeeTrainingsPage />
            </RolePerm>
          }
        />
        <Route
          path="employee/pay-documents"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <EmployeeDocumentsPage />
            </RolePerm>
          }
        />
        <Route
          path="employee/documents"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <RedirectPreserveSearch to="/employee/pay-documents" />
            </RolePerm>
          }
        />
        <Route
          path="employee/indicators"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <EmployeeIndicatorsPage />
            </RolePerm>
          }
        />
        <Route
          path="employee/profile"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <EmployeeProfilePage />
            </RolePerm>
          }
        />
        <Route
          path="employee/help"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <EmployeeHelpPage />
            </RolePerm>
          }
        />
        <Route
          path="me/payslips"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <RedirectPreserveSearch to="/employee/pay-documents?tab=payroll" />
            </RolePerm>
          }
        />
        <Route
          path="employee/payslips"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <RedirectPreserveSearch to="/employee/pay-documents?tab=payroll" />
            </RolePerm>
          }
        />

        {/* RH exclusive */}
        <Route
          path="hr/workforce-planning"
          element={
            <RolePerm requiredRole="RH" requiredPermissions={["directory_read"]}>
              <HrWorkforcePlanningPage />
            </RolePerm>
          }
        />
        <Route
          path="hr/dashboard"
          element={
            <Access
              requiredRoles={["RH", "ADMIN"]}
              requiredPermissions={["directory_read", "admin_read", "all"]}
              mode="anyOf"
            >
              <HrDashboardPage />
            </Access>
          }
        />
        <Route
          path="hr/strategic-reviews"
          element={
            <RolePerm requiredRole="RH" requiredPermissions={["directory_read"]}>
              <HrStrategicReviewsPage />
            </RolePerm>
          }
        />

        {/* RH list/edit */}
        <Route
          path="employee"
          element={
            <Access requiredRoles={["RH", "MANAGER", "ADMIN"]} requiredPermissions={["directory_read", "all"]} mode="anyOf">
              <Navigate to="/people/directory" replace />
            </Access>
          }
        />
        <Route
          path="employee/:id/edit"
          element={
            <Access requiredRoles={["RH", "MANAGER", "ADMIN"]} requiredPermissions={["directory_read", "all"]} mode="anyOf">
              <EmployeeEditPage />
            </Access>
          }
        />

        {/* Catch-all protected */}
        <Route
          path="*"
          element={
            <div className="p-6">
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Page indisponible</h2>
                <p className="text-gray-600">Ce module n&apos;est pas encore accessible sur votre espace actuel.</p>
              </div>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster />
    </div>
  );
}
