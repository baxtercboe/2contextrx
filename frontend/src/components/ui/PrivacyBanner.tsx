import { Shield, Lock, Fingerprint, FileCheck } from "lucide-react";
import { Badge } from "./Badge";

const BADGES = [
  { icon: Shield, label: "PHI never leaves provider", variant: "green" as const },
  { icon: Lock, label: "HIPAA-aligned design", variant: "blue" as const },
  { icon: Fingerprint, label: "k-anonymized (k≥50)", variant: "purple" as const },
  { icon: FileCheck, label: "Aggregated data only", variant: "green" as const },
];

export function PrivacyBadgeRow() {
  return (
    <div className="flex flex-wrap gap-2">
      {BADGES.map(({ icon: Icon, label, variant }) => (
        <Badge key={label} variant={variant}>
          <Icon className="h-3 w-3" />
          {label}
        </Badge>
      ))}
    </div>
  );
}

export function PrivacyBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">
      <Shield className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold mb-1">Privacy Guarantee</p>
        <p>
          All data exposed through MCP tools is pre-aggregated with k-anonymity (k≥50).
          Raw PHI never leaves the provider environment. ContextRx acts solely as a metering
          and routing proxy — only aggregated results and cost metadata pass through.
        </p>
      </div>
    </div>
  );
}
