interface WeightDisplayProps {
  lbs: number;
  showKg?: boolean;
  className?: string;
}

export function WeightDisplay({ lbs, showKg = true, className = "" }: WeightDisplayProps) {
  const kg = Math.round(lbs * 0.453592);

  return (
    <span className={className}>
      {lbs} lbs
      {showKg && <span className="text-muted-foreground text-xs ml-1">({kg} kg)</span>}
    </span>
  );
}
