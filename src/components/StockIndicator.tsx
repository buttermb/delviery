import { AlertCircle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StockIndicatorProps {
  stock: number;
  viewCount?: number;
  showViewCount?: boolean;
}

const StockIndicator = ({ stock, viewCount, showViewCount = false }: StockIndicatorProps) => {
  const getStockStatus = () => {
    if (stock === 0) return { text: "Out of Stock", variant: "destructive" as const, show: true };
    if (stock <= 3) return { text: `Only ${stock} left!`, variant: "destructive" as const, show: true };
    if (stock <= 10) return { text: `${stock} in stock`, variant: "default" as const, show: true };
    return { text: "In Stock", variant: "default" as const, show: false };
  };

  const status = getStockStatus();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status.show && (
        <Badge variant={status.variant} className="gap-1">
          <AlertCircle className="w-3 h-3" />
          {status.text}
        </Badge>
      )}
      
      {showViewCount && viewCount && viewCount > 5 && (
        <Badge variant="outline" className="gap-1 bg-background/50">
          <TrendingUp className="w-3 h-3" />
          {viewCount} viewing now
        </Badge>
      )}
    </div>
  );
};

export default StockIndicator;
