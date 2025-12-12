/**
 * Actionable Insights Component
 * Displays business intelligence and actionable recommendations
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  TrendingDown, TrendingUp, Users, Package, DollarSign,
  ArrowRight, AlertTriangle, CheckCircle2, Info
} from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { useNavigate, useParams } from 'react-router-dom';
// SendSMS removed per plan - can be re-added if needed
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Insight {
  id: string;
  type: 'warning' | 'success' | 'info';
  title: string;
  description: string;
  action: {
    label: string;
    onClick: () => void;
  };
  priority: 'high' | 'medium' | 'low';
}

export function ActionableInsights() {
  const { account } = useAccount();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [smsOpen, setSmsOpen] = useState<{ customerId: string; phone: string; name: string } | null>(null);

  const getFullPath = (href: string) => {
    if (!tenantSlug) return href;
    if (href.startsWith('/admin')) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  // Mock insights - in production, these would come from analytics
  const insights: Insight[] = [
    {
      id: 'revenue-decline',
      type: 'warning',
      title: 'Revenue down 15% this week',
      description: 'Your revenue has decreased compared to last week. Consider running promotions or re-engaging inactive customers.',
      action: {
        label: 'View Analytics',
        onClick: () => navigate(getFullPath('/admin/sales-dashboard')),
      },
      priority: 'high',
    },
    {
      id: 'inactive-customers',
      type: 'info',
      title: '12 customers haven\'t ordered in 30+ days',
      description: 'Re-engage these customers with a special offer or check-in message.',
      action: {
        label: 'Send Re-engagement Messages',
        onClick: () => {
          // Mock - would open SMS dialog with customer list
          setSmsOpen({
            customerId: 'mock-id',
            phone: '+1234567890',
            name: 'Inactive Customers',
          });
        },
      },
      priority: 'medium',
    },
    {
      id: 'low-stock',
      type: 'warning',
      title: '5 products are running low on stock',
      description: 'Review your inventory and restock popular items to avoid stockouts.',
      action: {
        label: 'View Inventory',
        onClick: () => navigate(getFullPath('/admin/inventory-hub')),
      },
      priority: 'high',
    },
    {
      id: 'new-orders',
      type: 'success',
      title: '3 new orders today',
      description: 'Great! You\'re getting new orders. Keep up the momentum.',
      action: {
        label: 'View Orders',
        onClick: () => navigate(getFullPath('/admin/orders')),
      },
      priority: 'low',
    },
  ];

  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5" />;
      case 'info':
        return <Info className="h-5 w-5" />;
    }
  };

  const getBadgeVariant = (priority: Insight['priority']) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
    }
  };

  if (insights.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Actionable Insights
          </CardTitle>
          <CardDescription>
            Key recommendations to improve your business performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.map((insight) => (
            <Alert
              key={insight.id}
              variant={insight.type === 'warning' ? 'destructive' : 'default'}
            >
              <div className="flex items-start gap-3">
                {getIcon(insight.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTitle>{insight.title}</AlertTitle>
                    <Badge variant={getBadgeVariant(insight.priority)} className="text-xs">
                      {insight.priority}
                    </Badge>
                  </div>
                  <AlertDescription>{insight.description}</AlertDescription>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={insight.action.onClick}
                  >
                    {insight.action.label}
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Alert>
          ))}
        </CardContent>
      </Card>

      {/* SMS Dialog for re-engagement */}
      {smsOpen && (
        <Dialog open={!!smsOpen} onOpenChange={(open) => !open && setSmsOpen(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send Re-engagement Message</DialogTitle>
            </DialogHeader>
            {/* SendSMS removed per plan - can be re-added if needed */}
            <div className="p-4 text-center text-muted-foreground">
              SMS functionality temporarily unavailable
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

