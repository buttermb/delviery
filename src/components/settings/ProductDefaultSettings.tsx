import { Package } from "lucide-react";
import { ComingSoonPlaceholder } from "@/components/shared/ComingSoonPlaceholder";

export function ProductDefaultSettings() {
  return (
    <ComingSoonPlaceholder
      title="Product Default Settings"
      description="Configure default values for new products including tax rates, units, and categories."
      icon={Package}
    />
  );
}
