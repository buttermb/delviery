interface MoneyDisplayProps {
  amount: number;
  className?: string;
  showCents?: boolean;
}

export function MoneyDisplay({ amount, className = "", showCents = false }: MoneyDisplayProps) {
  const formatted = showCents
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <span className={`font-mono ${className}`}>
      ${formatted}
    </span>
  );
}
