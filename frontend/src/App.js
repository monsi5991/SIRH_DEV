// src/App.jsx
import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { AppProvider } from "./contexts/AppContext";
import { AuthProvider } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/toaster";

// Auth
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
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

// Resources (Compliance & Policies)
import CompliancePage from "./pages/resources/CompliancePage";
import PoliciesPage from "./pages/resources/PoliciesPage";

// ❌ SUPPRIMÉ: toute la paie (pages/admin/portail salarié)
// import PreparationPayrollPage from "./pages/payroll/PreparationPage";
// import PayslipsPage from "./pages/payroll/PayslipsPage";
// import PayrollParamsPage from "./pages/payroll/PayrollParamsPage";
// import PayslipHtmlPage from "./pages/payroll/PayslipHtmlPage";
// import MyPayslipsPage from "./pages/employee/MyPayslipsPage";

// RH (optionnel) : gestion employés
import EmployeeListPage from "./pages/employee/EmployeeListPage";
import EmployeeEditPage from "./pages/employee/EmployeeEditPage";

const Layout = ({ children, user }) => {
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
        <main className="layout-main flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

Layout.propTypes = {
  children: PropTypes.node,
  user: PropTypes.shape({
    email: PropTypes.string,
    tenant: PropTypes.shape({ name: PropTypes.string }),
  }),
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      {/* Dashboard */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {({ user }) => (
              <Layout user={user}>
                <HomePage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />

      {/* Operations */}
      <Route
        path="/operations/leaves"
        element={
          <ProtectedRoute requiredPermissions={["operations_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <LeavesPage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations/time"
        element={
          <ProtectedRoute requiredPermissions={["operations_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <TimePage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations/planning"
        element={
          <ProtectedRoute requiredPermissions={["operations_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <PlanningPage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/operations/expenses"
        element={
          <ProtectedRoute requiredPermissions={["operations_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <ExpensesPage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />

      {/* People */}
      <Route
        path="/people/directory"
        element={
          <ProtectedRoute requiredPermissions={["directory_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <AnnuairePage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/people/performance"
        element={
          <ProtectedRoute requiredPermissions={["directory_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <PerformancePage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/people/performance/:id"
        element={
          <ProtectedRoute requiredPermissions={["directory_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <PerformanceDetailPage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/people/training"
        element={
          <ProtectedRoute requiredPermissions={["directory_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <FormationPage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />

      {/* Documents */}
      <Route
        path="/documents/onboarding"
        element={
          <ProtectedRoute>
            {({ user }) => (
              <Layout user={user}>
                <OnboardingPage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents/offboarding"
        element={
          <ProtectedRoute>
            {({ user }) => (
              <Layout user={user}>
                <OffboardingPage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />

      {/* Resources */}
      <Route
        path="/resources/compliance"
        element={
          <ProtectedRoute requiredPermissions={["directory_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <CompliancePage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/resources/policies"
        element={
          <ProtectedRoute requiredPermissions={["directory_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <PoliciesPage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />

      {/* ❌ SUPPRIMÉ: toutes les routes /payroll/* et /me/payslips */}

      {/* RH (optionnel) : gestion employés */}
      <Route
        path="/employee"
        element={
          <ProtectedRoute requiredPermissions={["directory_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <EmployeeListPage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee/:id/edit"
        element={
          <ProtectedRoute requiredPermissions={["directory_read", "all"]}>
            {({ user }) => (
              <Layout user={user}>
                <EmployeeEditPage />
              </Layout>
            )}
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            {({ user }) => (
              <Layout user={user}>
                <div className="p-6">
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Page en construction</h2>
                    <p className="text-gray-600">Cette page sera bientôt disponible.</p>
                  </div>
                </div>
              </Layout>
            )}
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  // ✅ Redirection automatique si 401 après tentative de refresh
  React.useEffect(() => {
    const on401 = () => {
      try { localStorage.removeItem("sirh_access"); } catch { /* noop */ }
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    };
    window.addEventListener("auth:unauthorized", on401);
    return () => window.removeEventListener("auth:unauthorized", on401);
  }, []);

  return (
    <AuthProvider>
      <AppProvider>
        <div className="App">
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
          <Toaster />
        </div>
      </AppProvider>
    </AuthProvider>
  );
}
