import { Activity } from "lucide-react";

type Props = { compact?: boolean };

export default function BrandLogo({ compact }: Props) {
  return (
    <div className={`brand-logo ${compact ? "brand-logo--compact" : ""}`}>
      <div className="brand-logo__mark">
        <Activity size={compact ? 20 : 24} strokeWidth={2.5} />
      </div>
      {!compact && (
        <div className="brand-logo__text">
          <span className="brand-logo__name">SUMAYA</span>
          <span className="brand-logo__tag">Care 360</span>
        </div>
      )}
    </div>
  );
}
