import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Ambulance,
  BarChart3,
  BedDouble,
  Bell,
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  FlaskConical,
  Globe,
  HeartPulse,
  LayoutDashboard,
  Map,
  Package,
  Pill,
  PlayCircle,
  Route,
  Scan,
  Scissors,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Siren,
  TrendingUp,
  Truck,
  Users,
  UserRoundCog,
  Video,
} from "lucide-react";

const ROUTE_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/demo-tour": PlayCircle,
  "/module-map": Map,
  "/care-journey": Route,
  "/patient-administration": UserRoundCog,
  "/tenants": Building2,
  "/patients": Users,
  "/providers": Stethoscope,
  "/appointments": Calendar,
  "/emergency": Siren,
  "/encounters": Activity,
  "/telemedicine": Video,
  "/inpatient": BedDouble,
  "/nursing": HeartPulse,
  "/operation-theatre": Scissors,
  "/laboratory": FlaskConical,
  "/radiology": Scan,
  "/pharmacy": Pill,
  "/inventory": Package,
  "/billing": CreditCard,
  "/insurance-claims": FileText,
  "/revenue-cycle": TrendingUp,
  "/pathways": ClipboardList,
  "/chronic-care": HeartPulse,
  "/physiotherapy": Activity,
  "/post-treatment": HeartPulse,
  "/womens-child-care": HeartPulse,
  "/ambulance": Ambulance,
  "/diet-housekeeping": Truck,
  "/documents": FileText,
  "/notifications": Bell,
  "/reports": BarChart3,
  "/integrations": Globe,
  "/data-governance": Database,
  "/provider-marketplace": Store,
  "/mobile-apps": Smartphone,
  "/audit": Shield,
  "/location-services": Globe,
  "/masters": Settings,
  "/clinical-hub": Stethoscope,
  "/administration": Building2,
  "/identity-security": Shield,
  "/rooms-facilities": Building2,
  "/portal": Users,
  "/engineering": Settings,
  "/hubs/platform": Settings,
  "/hubs/front-office": Users,
  "/hubs/clinical": Stethoscope,
  "/hubs/diagnostics": FlaskConical,
  "/hubs/inpatient": BedDouble,
  "/hubs/finance": CreditCard,
  "/hubs/care-programs": HeartPulse,
  "/hubs/operations": Truck,
  "/hubs/engagement": Bell,
  "/hubs/analytics": BarChart3,
};

const KPI_ICONS: Record<string, LucideIcon> = {
  patients: Users,
  appointments: Calendar,
  encounters: Stethoscope,
  admissions: BedDouble,
  invoices: CreditCard,
  lab_orders: FlaskConical,
  claims: FileText,
  providers: Stethoscope,
};

export function normalizeRoute(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[0] !== "hubs" && !path.includes("/hubs/")) {
    return `/${parts.slice(1).join("/")}`;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

type Props = { route?: string; code?: string; size?: number; className?: string };

export default function NavIcon({ route, code, size = 18, className }: Props) {
  let Icon: LucideIcon = ClipboardList;
  if (code && KPI_ICONS[code]) Icon = KPI_ICONS[code];
  else if (route) {
    const key = normalizeRoute(route);
    Icon = ROUTE_ICONS[key] || ROUTE_ICONS[`/${key.split("/").filter(Boolean).pop()}`] || Sparkles;
  }
  return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden />;
}

export { KPI_ICONS };
