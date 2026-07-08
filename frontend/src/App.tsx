import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import ProvidersPage from "./pages/ProvidersPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import CareJourneyPage from "./pages/CareJourneyPage";
import EncountersPage from "./pages/EncountersPage";
import TelemedicinePage from "./pages/TelemedicinePage";
import BillingPage from "./pages/BillingPage";
import MastersPage from "./pages/MastersPage";
import AuditPage from "./pages/AuditPage";
import TenantsPage from "./pages/TenantsPage";
import ModulePage from "./pages/ModulePage";
import AdministrationPage from "./pages/AdministrationPage";
import ClinicalHubPage from "./pages/ClinicalHubPage";
import ReportsPage from "./pages/ReportsPage";
import NotificationsPage from "./pages/NotificationsPage";
import PatientPortalPage from "./pages/PatientPortalPage";
import MfaSettingsPage from "./pages/MfaSettingsPage";
import EngineeringHubPage from "./pages/EngineeringHubPage";
import ExpandedAreaPage from "./pages/ExpandedAreaPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (session.role_code !== "SUPER_ADMIN") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function TenantGuard({ children }: { children: React.ReactNode }) {
  const { tenantCode } = useParams();
  const { session } = useAuth();
  if (tenantCode && session?.tenant_code && session.tenant_code !== tenantCode) {
    return <Navigate to={`/${session.tenant_code}/dashboard`} replace />;
  }
  return <>{children}</>;
}

const shell = (
  <Protected>
    <TenantGuard>
      <AppLayout />
    </TenantGuard>
  </Protected>
);

const childRoutes = (
  <>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="patients" element={<PatientsPage />} />
    <Route path="providers" element={<ProvidersPage />} />
    <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="care-journey" element={<CareJourneyPage />} />
        <Route path="encounters" element={<EncountersPage />} />
    <Route path="telemedicine" element={<TelemedicinePage />} />
    <Route path="billing" element={<BillingPage />} />
    <Route path="masters" element={<MastersPage />} />
    <Route path="audit" element={<AuditPage />} />
    <Route path="administration" element={<AdministrationPage />} />
    <Route path="clinical-hub" element={<ClinicalHubPage />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="notifications" element={<NotificationsPage />} />
    <Route path="portal" element={<PatientPortalPage />} />
    <Route path="settings/mfa" element={<MfaSettingsPage />} />
    <Route path="engineering" element={<EngineeringHubPage />} />
    <Route path="engineering/:areaCode" element={<ExpandedAreaPage />} />
    <Route path="modules/:moduleCode" element={<ModulePage />} />
    <Route
      path="tenants"
      element={
        <SuperAdminRoute>
          <TenantsPage />
        </SuperAdminRoute>
      }
    />
  </>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/:tenantCode/login" element={<LoginPage />} />
      <Route path="/:tenantCode/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/" element={shell}>
        {childRoutes}
      </Route>
      <Route path="/:tenantCode" element={shell}>
        {childRoutes}
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
