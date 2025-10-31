interface WeightDisplayProps {
  lbs: number;
  showKg?: boolean;
  className?: string;
}

export function WeightDisplay({ lbs, showKg = true, className = "" }: WeightDisplayProps) {
  const kg = Math.round(lbs * 0.453592);
  
  // Convert to pounds for wholesale display
  let displayWeight = '';
  if (lbs >= 1) {
    displayWeight = `${lbs} lb${lbs !== 1 ? 's' : ''}`;
  } else if (lbs === 0.5) {
    displayWeight = 'Half Pound';
  } else if (lbs === 0.25) {
    displayWeight = 'Quarter Pound';
  } else {
    displayWeight = `${lbs} lbs`;
  }

  return (
    <span className={className}>
      {displayWeight}
      {showKg && <span className="text-muted-foreground text-xs ml-1">({kg} kg)</span>}
    </span>
  );
}
