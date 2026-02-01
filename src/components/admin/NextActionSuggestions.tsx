/**
 * NextActionSuggestions - Contextual next steps after completing tasks
 * Reduces friction: Shows relevant follow-up actions immediately
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Mail, 
  FileText, 
  Package, 
  Plus, 
  ArrowLeft, 
  Eye,
  Printer,
  Send,
  ChartBar,
  Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ActionContext = 
  | 'order_created' 
  | 'product_added' 
  | 'customer_added'
  | 'invoice_created'
  | 'message_sent'
  | 'stock_updated';

interface SuggestedAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost';
}

interface NextActionSuggestionsProps {
  context: ActionContext;
  entityId?: string;
  entityName?: string;
  onAction?: (action: string) => void;
  customActions?: SuggestedAction[];
  className?: string;
}

export function NextActionSuggestions({
  context,
  entityId,
  entityName,
  onAction,
  customActions,
  className,
}: NextActionSuggestionsProps) {
  const handleAction = (actionKey: string, callback?: () => void) => {
    onAction?.(actionKey);
    callback?.();
  };

  const getContextConfig = () => {
    switch (context) {
      case 'order_created':
        return {
          title: `Order ${entityId ? `#${entityId}` : ''} created!`,
          subtitle: "What's next?",
          actions: [
            {
              key: 'send_confirmation',
              label: 'Send confirmation',
              icon: <Mail className="h-4 w-4" />,
              variant: 'default' as const,
            },
            {
              key: 'create_invoice',
              label: 'Create invoice',
              icon: <FileText className="h-4 w-4" />,
              variant: 'outline' as const,
            },
            {
              key: 'view_order',
              label: 'View order',
              icon: <Eye className="h-4 w-4" />,
              variant: 'outline' as const,
            },
            {
              key: 'create_another',
              label: 'Create another',
              icon: <Plus className="h-4 w-4" />,
              variant: 'ghost' as const,
            },
          ],
        };

      case 'product_added':
        return {
          title: `Product ${entityName ? `"${entityName}"` : ''} saved!`,
          subtitle: '',
          actions: [
            {
              key: 'add_inventory',
              label: 'Add inventory',
              icon: <Box className="h-4 w-4" />,
              variant: 'default' as const,
            },
            {
              key: 'add_another',
              label: 'Add another',
              icon: <Plus className="h-4 w-4" />,
              variant: 'outline' as const,
            },
            {
              key: 'add_to_menu',
              label: 'Add to menu',
              icon: <Package className="h-4 w-4" />,
              variant: 'outline' as const,
            },
            {
              key: 'back_to_products',
              label: 'Back to products',
              icon: <ArrowLeft className="h-4 w-4" />,
              variant: 'ghost' as const,
            },
          ],
        };

      case 'customer_added':
        return {
          title: `Customer ${entityName ? `"${entityName}"` : ''} added!`,
          subtitle: '',
          actions: [
            {
              key: 'create_order',
              label: 'Create order',
              icon: <Package className="h-4 w-4" />,
              variant: 'default' as const,
            },
            {
              key: 'send_welcome',
              label: 'Send welcome message',
              icon: <Mail className="h-4 w-4" />,
              variant: 'outline' as const,
            },
            {
              key: 'add_another',
              label: 'Add another',
              icon: <Plus className="h-4 w-4" />,
              variant: 'ghost' as const,
            },
          ],
        };

      case 'invoice_created':
        return {
          title: `Invoice ${entityId ? `#${entityId}` : ''} created!`,
          subtitle: '',
          actions: [
            {
              key: 'send_invoice',
              label: 'Send to customer',
              icon: <Send className="h-4 w-4" />,
              variant: 'default' as const,
            },
            {
              key: 'print_invoice',
              label: 'Print',
              icon: <Printer className="h-4 w-4" />,
              variant: 'outline' as const,
            },
            {
              key: 'view_invoice',
              label: 'View',
              icon: <Eye className="h-4 w-4" />,
              variant: 'outline' as const,
            },
          ],
        };

      case 'message_sent':
        return {
          title: `Message sent ${entityName ? `to ${entityName}` : ''}!`,
          subtitle: '',
          actions: [
            {
              key: 'view_delivery',
              label: 'View delivery report',
              icon: <ChartBar className="h-4 w-4" />,
              variant: 'outline' as const,
            },
            {
              key: 'send_another',
              label: 'Send another',
              icon: <Send className="h-4 w-4" />,
              variant: 'outline' as const,
            },
            {
              key: 'back',
              label: 'Back',
              icon: <ArrowLeft className="h-4 w-4" />,
              variant: 'ghost' as const,
            },
          ],
        };

      case 'stock_updated':
        return {
          title: `Stock updated!`,
          subtitle: entityName ? `${entityName} inventory adjusted` : '',
          actions: [
            {
              key: 'view_inventory',
              label: 'View all inventory',
              icon: <Box className="h-4 w-4" />,
              variant: 'outline' as const,
            },
            {
              key: 'update_another',
              label: 'Update another',
              icon: <Plus className="h-4 w-4" />,
              variant: 'ghost' as const,
            },
          ],
        };

      default:
        return {
          title: 'Action completed!',
          subtitle: '',
          actions: [],
        };
    }
  };

  const config = getContextConfig();
  const allActions = customActions || config.actions;

  if (allActions.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <Card className={`p-4 bg-success/5 border-success/20 ${className}`}>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
              <svg 
                className="h-4 w-4 text-success" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
            </div>
            
            <div className="flex-1">
              <h4 className="font-medium text-foreground">{config.title}</h4>
              {config.subtitle && (
                <p className="text-sm text-muted-foreground mt-0.5">{config.subtitle}</p>
              )}
              
              <div className="flex flex-wrap gap-2 mt-3">
                {allActions.map((action, index) => (
                  <Button
                    key={'key' in action ? action.key : index}
                    variant={action.variant || 'outline'}
                    size="sm"
                    onClick={() => handleAction(
                      'key' in action ? action.key : `action_${index}`,
                      action.onClick
                    )}
                    className="gap-1.5"
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
