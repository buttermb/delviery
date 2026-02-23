import { Badge } from "@/components/ui/badge";
import { safeUpperCase } from "@/utils/stringHelpers";

interface RiskScoreBadgeProps {
  score: number;
}

export function RiskScoreBadge({ score }: RiskScoreBadgeProps) {
  const getVariant = (score: number) => {
    if (score >= 80) return "default"; // Green - Low risk
    if (score >= 60) return "secondary"; // Blue - Medium risk
    if (score >= 40) return "outline"; // Yellow - Elevated risk
    return "destructive"; // Red - High risk
  };

  const getLabel = (score: number) => {
    if (score >= 80) return "Low Risk";
    if (score >= 60) return "Medium Risk";
    if (score >= 40) return "Elevated Risk";
    return "High Risk";
  };

  return (
    <Badge variant={getVariant(score)}>
      Risk: {score}/100 ({getLabel(score)})
    </Badge>
  );
}

interface TrustLevelBadgeProps {
  level: string;
}

export function TrustLevelBadge({ level }: TrustLevelBadgeProps) {
  const getVariant = (level: string) => {
    switch (level) {
      case "vip": return "default";
      case "regular": return "secondary";
      case "new": return "outline";
      case "flagged": return "destructive";
      default: return "outline";
    }
  };

  return (
    <Badge variant={getVariant(level)}>
      {safeUpperCase(level || 'unknown')}
    </Badge>
  );
}

interface AccountStatusBadgeProps {
  status: string;
}

export function AccountStatusBadge({ status }: AccountStatusBadgeProps) {
  const getVariant = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "pending": return "outline";
      case "suspended": return "destructive";
      case "locked": return "destructive";
      case "banned": return "destructive";
      default: return "outline";
    }
  };

  return (
    <Badge variant={getVariant(status)}>
      {safeUpperCase(status || 'unknown')}
    </Badge>
  );
}