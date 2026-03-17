import { Monitor } from "lucide-react";
import { ComingSoonPlaceholder } from "@/components/shared/ComingSoonPlaceholder";

export function POSTerminalSettings() {
  return (
    <ComingSoonPlaceholder
      title="POS Terminal Settings"
      description="Configure receipt printer, cash drawer, barcode scanner, and tax display settings per terminal."
      icon={Monitor}
    />
  );
}
