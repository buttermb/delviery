import { Star } from "lucide-react";

interface ReliabilityStarsProps {
  score: number; // 0-100
  showPercentage?: boolean;
}

export function ReliabilityStars({ score, showPercentage = true }: ReliabilityStarsProps) {
  const stars = Math.floor(score / 20); // Convert 0-100 to 0-5 stars

  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < stars
              ? "fill-warning text-warning"
              : "text-muted-foreground"
          }`}
        />
      ))}
      {showPercentage && (
        <span className="text-xs text-muted-foreground ml-1">
          {score}%
        </span>
      )}
    </div>
  );
}
