import { Badge } from "@/components/ui/badge";
import { Shield, Award, Leaf, Package, ThumbsUp, Truck } from "lucide-react";

interface ProductTrustBadgesProps {
  variant?: "inline" | "grid";
  showAll?: boolean;
}

const ProductTrustBadges = ({ variant = "inline", showAll = false }: ProductTrustBadgesProps) => {
  const badges = [
    {
      icon: Award,
      text: "Lab Tested",
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
    {
      icon: Shield,
      text: "Quality Assured",
      color: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    {
      icon: Leaf,
      text: "USA Grown",
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    {
      icon: Package,
      text: "Discreet Shipping",
      color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    },
    {
      icon: ThumbsUp,
      text: "30-Day Guarantee",
      color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    {
      icon: Truck,
      text: "Fast Delivery",
      color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    },
  ];

  const displayBadges = showAll ? badges : badges.slice(0, 3);

  if (variant === "grid") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {displayBadges.map((badge, index) => {
          const Icon = badge.icon;
          return (
            <div
              key={index}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${badge.color}`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium">{badge.text}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {displayBadges.map((badge, index) => {
        const Icon = badge.icon;
        return (
          <Badge key={index} variant="outline" className={badge.color}>
            <Icon className="w-3 h-3 mr-1" />
            {badge.text}
          </Badge>
        );
      })}
    </div>
  );
};

export default ProductTrustBadges;
