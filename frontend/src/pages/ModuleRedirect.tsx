/** Redirect legacy /modules/:code URLs to dedicated routes. */
import { Navigate, useParams } from "react-router-dom";

const LEGACY_REDIRECTS: Record<string, string> = {
  "super-admin-and-saas-control": "/tenants",
  "identity-rbac-and-security": "/identity-security",
  "hospital-clinic-administration": "/administration",
  "rooms-and-facilities": "/rooms-facilities",
  "emergency-and-triage": "/emergency",
  "nursing-and-care-plans": "/nursing",
  "operation-theatre-and-procedures": "/operation-theatre",
  "inventory-procurement-and-stores": "/inventory",
  "revenue-cycle-management": "/revenue-cycle",
  "chronic-disease-programs": "/chronic-care",
  "physiotherapy-and-rehab": "/physiotherapy",
  "post-treatment-patient-care": "/post-treatment",
  "women-child-and-specialty-care": "/womens-child-care",
  "ambulance-and-transport": "/ambulance",
  "diet-catering-and-housekeeping": "/diet-housekeeping",
  "document-forms-and-templates": "/documents",
  "integrations-and-interoperability": "/integrations",
  "data-governance-and-platform-ops": "/data-governance",
  "provider-marketplace": "/provider-marketplace",
  "mobile-apps": "/mobile-apps",
  "location-services": "/location-services",
};

export default function ModuleRedirect() {
  const { moduleCode = "" } = useParams();
  const target = LEGACY_REDIRECTS[moduleCode];
  if (target) return <Navigate to={target} replace />;
  return <Navigate to="/module-map" replace />;
}
