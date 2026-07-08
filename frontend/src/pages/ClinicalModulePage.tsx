import { useSearchParams } from "react-router-dom";
import ClinicalHubPage from "./ClinicalHubPage";

type Tab = "lab" | "ipd" | "claims" | "all";

export default function ClinicalModulePage({ defaultTab = "all" }: { defaultTab?: Tab }) {
  const [params] = useSearchParams();
  const tab = (params.get("tab") as Tab) || defaultTab;
  return <ClinicalHubPage activeTab={tab} />;
}
