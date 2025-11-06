/**
 * Node Palette
 * Draggable node types for workflow builder
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Mail, 
  MessageSquare, 
  Database, 
  Webhook,
  Play,
  GitBranch,
  Package,
  Bell,
} from 'lucide-react';

interface NodePaletteProps {
  onNodeDragStart: (event: React.DragEvent, nodeType: string, config: any) => void;
}

const nodeTypes = [
  {
    type: 'send_email',
    label: 'Send Email',
    icon: Mail,
    description: 'Send email notification',
    category: 'Communication',
  },
  {
    type: 'send_sms',
    label: 'Send SMS',
    icon: MessageSquare,
    description: 'Send SMS message',
    category: 'Communication',
  },
  {
    type: 'database_query',
    label: 'Database Query',
    icon: Database,
    description: 'Execute database operation',
    category: 'Data',
  },
  {
    type: 'call_webhook',
    label: 'Webhook',
    icon: Webhook,
    description: 'Call external API',
    category: 'Integration',
  },
  {
    type: 'assign_courier',
    label: 'Assign Courier',
    icon: Play,
    description: 'Auto-assign delivery courier',
    category: 'Delivery',
  },
  {
    type: 'update_inventory',
    label: 'Update Inventory',
    icon: Package,
    description: 'Modify inventory levels',
    category: 'Inventory',
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: GitBranch,
    description: 'Conditional branching',
    category: 'Logic',
  },
  {
    type: 'notification',
    label: 'Push Notification',
    icon: Bell,
    description: 'Send push notification',
    category: 'Communication',
  },
];

export function NodePalette({ onNodeDragStart }: NodePaletteProps) {
  const categories = [...new Set(nodeTypes.map(n => n.category))];

  return (
    <Card className="w-[280px]">
      <CardHeader>
        <CardTitle className="text-lg">Action Nodes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map((category) => (
          <div key={category}>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
              {category}
            </h4>
            <div className="space-y-2">
              {nodeTypes
                .filter((n) => n.category === category)
                .map((node) => {
                  const Icon = node.icon;
                  return (
                    <div
                      key={node.type}
                      draggable
                      onDragStart={(e) => onNodeDragStart(e, 'action', {
                        type: node.type,
                        label: node.label,
                        actionType: node.type,
                      })}
                      className="flex items-center gap-2 p-2 border rounded cursor-move hover:bg-accent hover:border-accent-foreground transition-colors"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {node.label}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {node.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
