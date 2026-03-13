import { Card } from '@/components/ui/card';
import { GitBranch } from 'lucide-react';

export function OrderStatusWorkflowSettings() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <GitBranch className="h-5 w-5" />
        Order Status Workflow Customization
      </h3>
      <p className="text-muted-foreground">
        Customize order status transitions and workflow rules for your business.
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        Coming soon: Define custom order statuses and transition rules.
      </div>
    </Card>
  );
}
