import { GitBranch } from "lucide-react";
import { ComingSoonPlaceholder } from "@/components/shared/ComingSoonPlaceholder";

export function OrderStatusWorkflowSettings() {
  return (
    <ComingSoonPlaceholder
      title="Order Status Workflow Customization"
      description="Define custom order statuses and transition rules for your business."
      icon={GitBranch}
    />
  );
}
