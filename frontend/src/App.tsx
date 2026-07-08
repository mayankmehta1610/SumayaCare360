import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import ProvidersPage from "./pages/ProvidersPage";
import AppointmentsPage from "./pages/AppointmentsPage";
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="encounters" element={<EncountersPage />} />
        <Route path="telemedicine" element={<TelemedicinePage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="masters" element={<MastersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="administration" element={<AdministrationPage />} />
        <Route path="clinical-hub" element={<ClinicalHubPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="modules/:moduleCode" element={<ModulePage />} />
        <Route
          path="tenants"
          element={
            <SuperAdminRoute>
              <TenantsPage />
            </SuperAdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
