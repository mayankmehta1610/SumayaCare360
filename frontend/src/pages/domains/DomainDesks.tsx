import DedicatedModuleDesk from "../../components/DedicatedModuleDesk";

export const InventoryPage = () => (
  <DedicatedModuleDesk
    moduleCode="inventory-procurement-and-stores"
    description="Stock master → purchase request → GRN → issue · enforced procurement lifecycle"
    extraFields={[
      { key: "sku", label: "SKU / item code" },
      { key: "qty", label: "Quantity" },
    ]}
  />
);

export const ChronicCarePage = () => (
  <DedicatedModuleDesk
    moduleCode="chronic-disease-programs"
    description="Program enrollment → coordinator → monitoring → review visits"
    linkPatient
    extraFields={[{ key: "program", label: "Program (diabetes, HTN, etc.)" }]}
  />
);

export const PhysiotherapyPage = () => (
  <DedicatedModuleDesk
    moduleCode="physiotherapy-and-rehab"
    description="Assessment → exercise plan → session notes → discharge goals"
    linkPatient
    extraFields={[{ key: "session_no", label: "Session #" }]}
  />
);

export const PostTreatmentPage = () => (
  <DedicatedModuleDesk
    moduleCode="post-treatment-patient-care"
    description="Discharge plan → follow-up → home monitoring → medication adherence"
    linkPatient
    extraFields={[{ key: "follow_up_date", label: "Follow-up date" }]}
  />
);

export const WomensChildCarePage = () => (
  <DedicatedModuleDesk
    moduleCode="women-child-and-specialty-care"
    description="Antenatal · immunization · pediatric growth · specialty clinics"
    linkPatient
    extraFields={[{ key: "program_type", label: "Program type" }]}
  />
);

export const AmbulancePage = () => (
  <DedicatedModuleDesk
    moduleCode="ambulance-and-transport"
    description="Dispatch → en route → on scene → handover → billing linkage"
    linkPatient
    extraFields={[
      { key: "pickup", label: "Pickup location" },
      { key: "destination", label: "Destination" },
    ]}
  />
);

export const DietHousekeepingPage = () => (
  <DedicatedModuleDesk
    moduleCode="diet-catering-and-housekeeping"
    description="Diet orders · meal plans · catering SLA · housekeeping tasks"
    linkPatient
    extraFields={[{ key: "ward", label: "Ward / unit" }]}
  />
);

export const IntegrationsPage = () => (
  <DedicatedModuleDesk
    moduleCode="integrations-and-interoperability"
    description="FHIR · HL7 · payment gateway · lab interfaces · PACS bridge"
    extraFields={[
      { key: "endpoint", label: "Endpoint URL" },
      { key: "protocol", label: "Protocol (FHIR/HL7)" },
    ]}
  />
);

export const DataGovernancePage = () => (
  <DedicatedModuleDesk
    moduleCode="data-governance-and-platform-ops"
    description="Data quality · retention policy · backup status · release gates"
    extraFields={[{ key: "policy", label: "Policy / rule" }]}
  />
);

export const ProviderMarketplacePage = () => (
  <DedicatedModuleDesk
    moduleCode="provider-marketplace"
    description="Vendor onboarding → contract → SLA → settlement → ratings"
    extraFields={[
      { key: "vendor", label: "Vendor name" },
      { key: "sla", label: "SLA tier" },
    ]}
  />
);

export const MobileAppsPage = () => (
  <DedicatedModuleDesk
    moduleCode="mobile-apps"
    description="Patient app · doctor app · push certificates · feature flags"
    extraFields={[
      { key: "platform", label: "Platform (iOS/Android)" },
      { key: "version", label: "Version" },
    ]}
  />
);

export const RoomsHousekeepingDesk = () => (
  <DedicatedModuleDesk
    moduleCode="rooms-and-facilities"
    description="Housekeeping tasks · equipment tags · facility workflows"
    extraFields={[{ key: "room", label: "Room / bed" }]}
  />
);
