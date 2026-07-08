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
import ModuleRedirect from "./pages/ModuleRedirect";
import AdministrationPage from "./pages/AdministrationPage";
import ClinicalHubPage from "./pages/ClinicalHubPage";
import ReportsPage from "./pages/ReportsPage";
import NotificationsPage from "./pages/NotificationsPage";
import PatientPortalPage from "./pages/PatientPortalPage";
import MfaSettingsPage from "./pages/MfaSettingsPage";
import EngineeringHubPage from "./pages/EngineeringHubPage";
import ExpandedAreaPage from "./pages/ExpandedAreaPage";
import PhaseHubPage from "./pages/PhaseHubPage";
import ModuleMapPage from "./pages/ModuleMapPage";
import LaboratoryPage from "./pages/domains/LaboratoryPage";
import RadiologyPage from "./pages/domains/RadiologyPage";
import PharmacyPage from "./pages/domains/PharmacyPage";
import InsuranceClaimsPage from "./pages/domains/InsuranceClaimsPage";
import PathwaysPage from "./pages/domains/PathwaysPage";
import InpatientPage from "./pages/domains/InpatientPage";
import NursingPage from "./pages/domains/NursingPage";
import EmergencyPage from "./pages/domains/EmergencyPage";
import OperationTheatrePage from "./pages/domains/OperationTheatrePage";
import RevenueCyclePage from "./pages/domains/RevenueCyclePage";
import IdentityRbacPage from "./pages/domains/IdentityRbacPage";
import RoomsFacilitiesPage from "./pages/domains/RoomsFacilitiesPage";
import DocumentsPage from "./pages/domains/DocumentsPage";
import LocationServicesPage from "./pages/domains/LocationServicesPage";
import {
  InventoryPage,
  ChronicCarePage,
  PhysiotherapyPage,
  PostTreatmentPage,
  WomensChildCarePage,
  AmbulancePage,
  DietHousekeepingPage,
  IntegrationsPage,
  DataGovernancePage,
  ProviderMarketplacePage,
  MobileAppsPage,
} from "./pages/domains/DomainDesks";

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
    <Route path="identity-security" element={<IdentityRbacPage />} />
    <Route path="rooms-facilities" element={<RoomsFacilitiesPage />} />
    <Route path="documents" element={<DocumentsPage />} />
    <Route path="location-services" element={<LocationServicesPage />} />
    <Route path="clinical-hub" element={<ClinicalHubPage />} />
    <Route path="laboratory" element={<LaboratoryPage />} />
    <Route path="radiology" element={<RadiologyPage />} />
    <Route path="pharmacy" element={<PharmacyPage />} />
    <Route path="insurance-claims" element={<InsuranceClaimsPage />} />
    <Route path="pathways" element={<PathwaysPage />} />
    <Route path="inpatient" element={<InpatientPage />} />
    <Route path="nursing" element={<NursingPage />} />
    <Route path="emergency" element={<EmergencyPage />} />
    <Route path="operation-theatre" element={<OperationTheatrePage />} />
    <Route path="revenue-cycle" element={<RevenueCyclePage />} />
    <Route path="inventory" element={<InventoryPage />} />
    <Route path="chronic-care" element={<ChronicCarePage />} />
    <Route path="physiotherapy" element={<PhysiotherapyPage />} />
    <Route path="post-treatment" element={<PostTreatmentPage />} />
    <Route path="womens-child-care" element={<WomensChildCarePage />} />
    <Route path="ambulance" element={<AmbulancePage />} />
    <Route path="diet-housekeeping" element={<DietHousekeepingPage />} />
    <Route path="integrations" element={<IntegrationsPage />} />
    <Route path="data-governance" element={<DataGovernancePage />} />
    <Route path="provider-marketplace" element={<ProviderMarketplacePage />} />
    <Route path="mobile-apps" element={<MobileAppsPage />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="notifications" element={<NotificationsPage />} />
    <Route path="portal" element={<PatientPortalPage />} />
    <Route path="settings/mfa" element={<MfaSettingsPage />} />
    <Route path="engineering" element={<EngineeringHubPage />} />
    <Route path="engineering/:areaCode" element={<ExpandedAreaPage />} />
    <Route path="module-map" element={<ModuleMapPage />} />
    <Route path="hubs/:phaseId" element={<PhaseHubPage />} />
    <Route path="modules/:moduleCode" element={<ModuleRedirect />} />
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
