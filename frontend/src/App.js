// src/App.jsx
import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Outlet, useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

import { Toaster } from "./components/ui/toaster";

import ProtectedRoute from "./components/auth/ProtectedRoute";

// Public pages
import LoginPage from "./pages/auth/LoginPage";
import ForbiddenPage from "./pages/ForbiddenPage";

// Layout
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";

// Pages (Dashboard & Ops)
import HomePage from "./pages/HomePage";
import LeavesPage from "./pages/operations/LeavesPage";
import TimePage from "./pages/operations/TimePage";
import PlanningPage from "./pages/operations/PlanningPage";
import ExpensesPage from "./pages/operations/ExpensesPage";

// RH / People
import AnnuairePage from "./pages/people/AnnuairePage";
import PerformancePage from "./pages/people/PerformancePage";
import PerformanceDetailPage from "./pages/people/PerformanceDetailPage";
import FormationPage from "./pages/people/FormationPage";

// Documents
import OnboardingPage from "./pages/documents/OnboardingPage";
import OffboardingPage from "./pages/documents/OffboardingPage";

// Resources
import CompliancePage from "./pages/resources/CompliancePage";
import PoliciesPage from "./pages/resources/PoliciesPage";
import AnalyticsReportsPage from "./pages/analytics/AnalyticsReportsPage";
import AnalyticsDashboardsPage from "./pages/analytics/AnalyticsDashboardsPage";
import AdminStructurePage from "./pages/admin/AdminStructurePage";
import AdminPermissionsPage from "./pages/admin/AdminPermissionsPage";
import AdminIntegrationsPage from "./pages/admin/AdminIntegrationsPage";
import ManagerDashboardPage from "./pages/manager/ManagerDashboardPage";
import TeamApprovalsPage from "./pages/manager/TeamApprovalsPage";
import ManagerTeamOverviewPage from "./pages/manager/ManagerTeamOverviewPage";
import ManagerPerformancePage from "./pages/manager/ManagerPerformancePage";
import EmployeeDashboardPage from "./pages/employee/EmployeeDashboardPage";
import EmployeeProfilePage from "./pages/employee/EmployeeProfilePage";
import EmployeeRequestsPage from "./pages/employee/EmployeeRequestsPage";
import EmployeeDocumentsPage from "./pages/employee/EmployeeDocumentsPage";
import MyPayslipsPage from "./pages/employee/MyPayslipsPage";
import HrWorkforcePlanningPage from "./pages/hr/HrWorkforcePlanningPage";
import HrStrategicReviewsPage from "./pages/hr/HrStrategicReviewsPage";

// RH (optionnel)
import EmployeeListPage from "./pages/employee/EmployeeListPage";
import EmployeeEditPage from "./pages/employee/EmployeeEditPage";

/* =========================
 * Layout wrapper (protégé)
 * ========================= */
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

/* =========================
 * Route group protected
 * ========================= */
function RequireAuthLayout() {
  return (
    <ProtectedRoute redirectTo="/login">
      {({ user }) => <AppShell user={user} />}
    </ProtectedRoute>
  );
}

/* =========================
 * Helper: perms
 * - Pas besoin de mettre "all" partout : hasPermissions gère déjà "all"
 * ========================= */
const Perm = (props) => <ProtectedRoute {...props} enforce="perm" />;
const RolePerm = (props) => <ProtectedRoute {...props} enforce="both" />;
/* Usage: <Perm requiredPermissions={["operations_read"]}><Page/></Perm> */

/* =========================
 * Routes
 * ========================= */
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      {/* Protected group */}
      <Route element={<RequireAuthLayout />}>
        {/* Dashboard */}
        <Route index element={<HomePage />} />

        {/* Operations */}
        <Route
          path="operations/leaves"
          element={
            <Perm requiredPermissions={["operations_read"]}>
              <LeavesPage />
            </Perm>
          }
        />
        <Route
          path="operations/time"
          element={
            <Perm requiredPermissions={["operations_read"]}>
              <TimePage />
            </Perm>
          }
        />
        <Route
          path="operations/planning"
          element={
            <Perm requiredPermissions={["operations_read"]}>
              <PlanningPage />
            </Perm>
          }
        />
        <Route
          path="operations/expenses"
          element={
            <Perm requiredPermissions={["operations_read"]}>
              <ExpensesPage />
            </Perm>
          }
        />

        {/* People */}
        <Route
          path="people/directory"
          element={
            <Perm requiredPermissions={["directory_read"]}>
              <AnnuairePage />
            </Perm>
          }
        />
        <Route
          path="people/performance"
          element={
            <Perm requiredPermissions={["directory_read"]}>
              <PerformancePage />
            </Perm>
          }
        />
        <Route
          path="people/performance/:id"
          element={
            <Perm requiredPermissions={["directory_read"]}>
              <PerformanceDetailPage />
            </Perm>
          }
        />
        <Route
          path="people/training"
          element={
            <Perm requiredPermissions={["directory_read"]}>
              <FormationPage />
            </Perm>
          }
        />

        {/* Documents */}
        <Route path="documents/onboarding" element={<OnboardingPage />} />
        <Route path="documents/offboarding" element={<OffboardingPage />} />

        {/* Resources */}
        <Route
          path="resources/compliance"
          element={
            <Perm requiredPermissions={["directory_read"]}>
              <CompliancePage />
            </Perm>
          }
        />
        <Route
          path="resources/policies"
          element={
            <Perm requiredPermissions={["directory_read"]}>
              <PoliciesPage />
            </Perm>
          }
        />

        {/* Analytics */}
        <Route
          path="analytics/reports"
          element={
            <Perm requiredPermissions={["analytics_read"]}>
              <AnalyticsReportsPage />
            </Perm>
          }
        />
        <Route
          path="analytics/dashboards"
          element={
            <Perm requiredPermissions={["analytics_read"]}>
              <AnalyticsDashboardsPage />
            </Perm>
          }
        />

        {/* Admin */}
        <Route
          path="admin/structure"
          element={
            <Perm requiredPermissions={["admin_read"]}>
              <AdminStructurePage />
            </Perm>
          }
        />
        <Route
          path="admin/permissions"
          element={
            <Perm requiredPermissions={["admin_read"]}>
              <AdminPermissionsPage />
            </Perm>
          }
        />
        <Route
          path="admin/integrations"
          element={
            <Perm requiredPermissions={["admin_read"]}>
              <AdminIntegrationsPage />
            </Perm>
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
          element={
            <RolePerm requiredRole="Manager" requiredPermissions={["team_read"]}>
              <ManagerTeamOverviewPage />
            </RolePerm>
          }
        />
        <Route
          path="manager/approvals"
          element={
            <RolePerm requiredRole="Manager" requiredPermissions={["approvals_read"]}>
              <TeamApprovalsPage />
            </RolePerm>
          }
        />
        <Route
          path="manager/performance"
          element={
            <RolePerm requiredRole="Manager" requiredPermissions={["team_read"]}>
              <ManagerPerformancePage />
            </RolePerm>
          }
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
          path="employee/documents"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <EmployeeDocumentsPage />
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
          path="me/payslips"
          element={
            <RolePerm requiredRole="Employee" requiredPermissions={["self_read"]}>
              <MyPayslipsPage />
            </RolePerm>
          }
        />

        {/* RH exclusif */}
        <Route
          path="hr/workforce-planning"
          element={
            <RolePerm requiredRole="RH" requiredPermissions={["directory_read"]}>
              <HrWorkforcePlanningPage />
            </RolePerm>
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

        {/* RH */}
        <Route
          path="employee"
          element={
            <Perm requiredPermissions={["directory_read"]}>
              <EmployeeListPage />
            </Perm>
          }
        />
        <Route
          path="employee/:id/edit"
          element={
            <Perm requiredPermissions={["directory_read"]}>
              <EmployeeEditPage />
            </Perm>
          }
        />

        {/* Catch-all protected */}
        <Route
          path="*"
          element={
            <div className="p-6">
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Page en construction</h2>
                <p className="text-gray-600">Cette page sera bientôt disponible.</p>
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
