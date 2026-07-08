import { useParams } from "react-router-dom";
import ModulePage from "./ModulePage";

/** Renders ModulePage for catalog routes like /radiology, /pharmacy, /pathways */
export default function RoutedModulePage({ code }: { code?: string }) {
  const { moduleCode } = useParams();
  const resolved = code || moduleCode || "";
  return <ModulePage moduleCode={resolved} />;
}
