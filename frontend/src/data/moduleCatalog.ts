/** Client-side mirror of backend MODULE_CATALOG — all modules dedicated. */
export const MODULE_CATALOG = [
  { code: "super-admin-and-saas-control", name: "Super Admin & SaaS Control", category: "Platform", route: "/tenants", dedicated: true },
  { code: "identity-rbac-and-security", name: "Identity, RBAC & Security", category: "Platform", route: "/identity-security", dedicated: true },
  { code: "hospital-clinic-administration", name: "Hospital/Clinic Administration", category: "Administration", route: "/administration", dedicated: true },
  { code: "rooms-and-facilities", name: "Rooms & Facilities", category: "Administration", route: "/rooms-facilities", dedicated: true },
  { code: "patient-registration-and-crm", name: "Patient Registration & CRM", category: "Clinical Front Office", route: "/patients", dedicated: true },
  { code: "doctor-and-provider-management", name: "Doctor & Provider Management", category: "Clinical Front Office", route: "/providers", dedicated: true },
  { code: "appointment-and-queue-management", name: "Appointment & Queue Management", category: "Clinical Front Office", route: "/appointments", dedicated: true },
  { code: "emergency-and-triage", name: "Emergency & Triage", category: "Clinical Front Office", route: "/emergency", dedicated: true },
  { code: "opd-clinical-workflow", name: "OPD Clinical Workflow", category: "Clinical", route: "/encounters", dedicated: true },
  { code: "telemedicine-and-virtual-care", name: "Telemedicine & Virtual Care", category: "Clinical", route: "/telemedicine", dedicated: true },
  { code: "ipd-admission-and-ward-management", name: "IPD Admission & Ward Management", category: "Inpatient", route: "/inpatient", dedicated: true },
  { code: "nursing-and-care-plans", name: "Nursing & Care Plans", category: "Inpatient", route: "/nursing", dedicated: true },
  { code: "operation-theatre-and-procedures", name: "Operation Theatre & Procedures", category: "Inpatient", route: "/operation-theatre", dedicated: true },
  { code: "laboratory-and-diagnostics", name: "Laboratory & Diagnostics", category: "Diagnostics", route: "/laboratory", dedicated: true },
  { code: "radiology-and-imaging", name: "Radiology & Imaging", category: "Diagnostics", route: "/radiology", dedicated: true },
  { code: "pharmacy-management", name: "Pharmacy Management", category: "Pharmacy", route: "/pharmacy", dedicated: true },
  { code: "inventory-procurement-and-stores", name: "Inventory, Procurement & Stores", category: "Operations", route: "/inventory", dedicated: true },
  { code: "billing-tariff-and-payments", name: "Billing, Tariff & Payments", category: "Finance", route: "/billing", dedicated: true },
  { code: "insurance-and-claims", name: "Insurance & Claims", category: "Finance", route: "/insurance-claims", dedicated: true },
  { code: "revenue-cycle-management", name: "Revenue Cycle Management", category: "Finance", route: "/revenue-cycle", dedicated: true },
  { code: "disease-and-care-pathways", name: "Disease & Care Pathways", category: "Care Programs", route: "/pathways", dedicated: true },
  { code: "chronic-disease-programs", name: "Chronic Disease Programs", category: "Care Programs", route: "/chronic-care", dedicated: true },
  { code: "physiotherapy-and-rehab", name: "Physiotherapy & Rehab", category: "Care Programs", route: "/physiotherapy", dedicated: true },
  { code: "post-treatment-patient-care", name: "Post Treatment Patient Care", category: "Care Programs", route: "/post-treatment", dedicated: true },
  { code: "women-child-and-specialty-care", name: "Women, Child & Specialty Care", category: "Care Programs", route: "/womens-child-care", dedicated: true },
  { code: "ambulance-and-transport", name: "Ambulance & Transport", category: "Operations", route: "/ambulance", dedicated: true },
  { code: "diet-catering-and-housekeeping", name: "Diet, Catering & Housekeeping", category: "Operations", route: "/diet-housekeeping", dedicated: true },
  { code: "document-forms-and-templates", name: "Document, Forms & Templates", category: "Platform", route: "/documents", dedicated: true },
  { code: "notifications-and-engagement", name: "Notifications & Engagement", category: "Engagement", route: "/notifications", dedicated: true },
  { code: "reports-bi-and-analytics", name: "Reports, BI & Analytics", category: "Analytics", route: "/reports", dedicated: true },
  { code: "integrations-and-interoperability", name: "Integrations & Interoperability", category: "Platform", route: "/integrations", dedicated: true },
  { code: "data-governance-and-platform-ops", name: "Data Governance & Platform Ops", category: "Platform", route: "/data-governance", dedicated: true },
  { code: "provider-marketplace", name: "Provider Marketplace", category: "Operations", route: "/provider-marketplace", dedicated: true },
  { code: "mobile-apps", name: "Mobile Apps", category: "Engagement", route: "/mobile-apps", dedicated: true },
  { code: "audit-trail-and-governance", name: "Audit Trail & Governance", category: "Platform", route: "/audit", dedicated: true },
  { code: "location-services", name: "GPS & Location Services", category: "Platform", route: "/location-services", dedicated: true },
] as const;

export type PhaseModule = {
  code: string;
  name: string;
  route: string;
  is_dedicated: boolean;
  super_only?: boolean;
};

export type NavPhase = {
  id: string;
  name: string;
  hub_route: string;
  icon: string;
  modules: PhaseModule[];
};

const PHASE_META: { id: string; name: string; hub_route: string; icon: string; categories: string[] }[] = [
  { id: "platform", name: "1 · Platform & setup", hub_route: "/hubs/platform", icon: "⚙️", categories: ["Platform", "Administration"] },
  { id: "front-office", name: "2 · Front office", hub_route: "/hubs/front-office", icon: "🏥", categories: ["Clinical Front Office"] },
  { id: "clinical", name: "3 · Clinical care", hub_route: "/hubs/clinical", icon: "🩺", categories: ["Clinical"] },
  { id: "diagnostics", name: "4 · Diagnostics & pharmacy", hub_route: "/hubs/diagnostics", icon: "🔬", categories: ["Diagnostics", "Pharmacy"] },
  { id: "inpatient", name: "5 · Inpatient", hub_route: "/hubs/inpatient", icon: "🛏️", categories: ["Inpatient"] },
  { id: "finance", name: "6 · Finance & RCM", hub_route: "/hubs/finance", icon: "💳", categories: ["Finance"] },
  { id: "care-programs", name: "7 · Care programs", hub_route: "/hubs/care-programs", icon: "📋", categories: ["Care Programs"] },
  { id: "operations", name: "8 · Operations", hub_route: "/hubs/operations", icon: "🚑", categories: ["Operations"] },
  { id: "engagement", name: "9 · Engagement", hub_route: "/hubs/engagement", icon: "📱", categories: ["Engagement"] },
  { id: "analytics", name: "10 · Analytics & compliance", hub_route: "/hubs/analytics", icon: "📊", categories: ["Analytics"] },
];

const VIRTUAL: PhaseModule[] = [
  { code: "_care-journey", name: "Care Journey (E2E)", route: "/care-journey", is_dedicated: true },
  { code: "_masters", name: "Configuration Masters", route: "/masters", is_dedicated: true },
  { code: "_clinical-hub", name: "Clinical Operations Hub", route: "/clinical-hub", is_dedicated: true },
  { code: "_portal", name: "Patient Portal", route: "/portal", is_dedicated: true },
  { code: "_administration", name: "Administration Hub", route: "/administration", is_dedicated: true },
  { code: "_engineering", name: "Engineering APIs", route: "/engineering", is_dedicated: true },
];

export function buildFallbackPhases(): NavPhase[] {
  return PHASE_META.map((p) => {
    const modules = MODULE_CATALOG.filter((m) => p.categories.includes(m.category)).map((m) => ({
      code: m.code,
      name: m.name,
      route: m.route,
      is_dedicated: true,
      super_only: m.code === "super-admin-and-saas-control",
    }));
    if (p.id === "clinical") modules.unshift(VIRTUAL.find((v) => v.code === "_care-journey")!);
    if (p.id === "platform") {
      modules.unshift(VIRTUAL.find((v) => v.code === "_administration")!, VIRTUAL.find((v) => v.code === "_masters")!);
    }
    if (p.id === "diagnostics") modules.unshift(VIRTUAL.find((v) => v.code === "_clinical-hub")!);
    if (p.id === "engagement") modules.push(VIRTUAL.find((v) => v.code === "_portal")!);
    if (p.id === "analytics") modules.push(VIRTUAL.find((v) => v.code === "_engineering")!);
    return { id: p.id, name: p.name, hub_route: p.hub_route, icon: p.icon, modules };
  });
}
