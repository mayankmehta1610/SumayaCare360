import { ShieldPlus } from "lucide-react";

type Props = { compact?: boolean };

export default function BrandLogo({ compact }: Props) {
  return (
    <div className={`brand-logo ${compact ? "brand-logo--compact" : ""}`}>
      <div className="brand-logo__mark">
        <ShieldPlus size={compact ? 20 : 24} strokeWidth={2} />
      </div>
      {!compact && (
        <div className="brand-logo__text">
          <span className="brand-logo__name">SUMAYA CARE 360</span>
          <span className="brand-logo__tag">Hospital Operations Platform</span>
        </div>
      )}
    </div>
  );
}
