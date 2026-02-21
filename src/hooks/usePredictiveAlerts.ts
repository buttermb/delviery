/**
 * Predictive Alerts Hook
 * Generates proactive alerts based on data patterns
 */

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/formatters';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertCategory = 'inventory' | 'orders' | 'payments' | 'customers' | 'compliance';

export interface PredictiveAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  daysUntil?: number;
  entityId?: string;
  entityType?: string;
  createdAt: Date;
}

interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold?: number;
  avgDailySales?: number;
  lastRestockDate?: Date;
}

interface Order {
  id: string;
  status: string;
  createdAt: Date;
  dueDate?: Date;
  total: number;
  customerName?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  dueDate: Date;
  amount: number;
  status: string;
  customerName?: string;
}

interface License {
  id: string;
  name: string;
  expirationDate: Date;
  type: string;
}

interface PredictiveAlertsInput {
  inventory?: InventoryItem[];
  orders?: Order[];
  invoices?: Invoice[];
  licenses?: License[];
}

export function usePredictiveAlerts(data: PredictiveAlertsInput): PredictiveAlert[] {
  return useMemo(() => {
    const alerts: PredictiveAlert[] = [];
    const now = new Date();

    // Inventory predictions
    if (data.inventory) {
      data.inventory.forEach(item => {
        if (item.avgDailySales && item.avgDailySales > 0) {
          const daysUntilStockout = Math.floor(item.stock / item.avgDailySales);
          
          if (daysUntilStockout <= 0) {
            alerts.push({
              id: `stockout-${item.id}`,
              category: 'inventory',
              severity: 'critical',
              title: 'Out of Stock',
              message: `${item.name} is currently out of stock`,
              actionLabel: 'Reorder Now',
              actionHref: `/admin/inventory/${item.id}/reorder`,
              daysUntil: 0,
              entityId: item.id,
              entityType: 'product',
              createdAt: now,
            });
          } else if (daysUntilStockout <= 3) {
            alerts.push({
              id: `stockout-soon-${item.id}`,
              category: 'inventory',
              severity: 'warning',
              title: 'Stock Running Low',
              message: `${item.name} will run out in ${daysUntilStockout} day${daysUntilStockout === 1 ? '' : 's'} based on current sales velocity`,
              actionLabel: 'Reorder',
              actionHref: `/admin/inventory/${item.id}/reorder`,
              daysUntil: daysUntilStockout,
              entityId: item.id,
              entityType: 'product',
              createdAt: now,
            });
          } else if (daysUntilStockout <= 7) {
            alerts.push({
              id: `stockout-week-${item.id}`,
              category: 'inventory',
              severity: 'info',
              title: 'Stock Alert',
              message: `${item.name} will run out in about ${daysUntilStockout} days at current pace`,
              actionLabel: 'Review',
              actionHref: `/admin/inventory/${item.id}`,
              daysUntil: daysUntilStockout,
              entityId: item.id,
              entityType: 'product',
              createdAt: now,
            });
          }
        }

        // Low stock threshold alert
        if (item.lowStockThreshold && item.stock <= item.lowStockThreshold && item.stock > 0) {
          const existingAlert = alerts.find(a => a.entityId === item.id && a.category === 'inventory');
          if (!existingAlert) {
            alerts.push({
              id: `low-stock-${item.id}`,
              category: 'inventory',
              severity: 'warning',
              title: 'Below Reorder Point',
              message: `${item.name} (${item.stock} units) is below the reorder threshold of ${item.lowStockThreshold}`,
              actionLabel: 'Reorder',
              actionHref: `/admin/inventory/${item.id}/reorder`,
              entityId: item.id,
              entityType: 'product',
              createdAt: now,
            });
          }
        }
      });
    }

    // Order aging alerts
    if (data.orders) {
      data.orders.forEach(order => {
        if (order.status === 'pending' || order.status === 'processing') {
          const ageHours = (now.getTime() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
          
          if (ageHours >= 48) {
            alerts.push({
              id: `order-aged-${order.id}`,
              category: 'orders',
              severity: 'critical',
              title: 'Order Needs Attention',
              message: `Order for ${order.customerName || 'customer'} has been ${order.status} for ${Math.floor(ageHours / 24)} days`,
              actionLabel: 'View Order',
              actionHref: `/admin/orders/${order.id}`,
              entityId: order.id,
              entityType: 'order',
              createdAt: now,
            });
          } else if (ageHours >= 24) {
            alerts.push({
              id: `order-aging-${order.id}`,
              category: 'orders',
              severity: 'warning',
              title: 'Order Aging',
              message: `Order for ${order.customerName || 'customer'} has been ${order.status} for over 24 hours`,
              actionLabel: 'Process',
              actionHref: `/admin/orders/${order.id}`,
              entityId: order.id,
              entityType: 'order',
              createdAt: now,
            });
          }
        }

        // Due date approaching
        if (order.dueDate) {
          const daysUntilDue = Math.ceil((new Date(order.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilDue < 0 && order.status !== 'delivered' && order.status !== 'completed') {
            alerts.push({
              id: `order-overdue-${order.id}`,
              category: 'orders',
              severity: 'critical',
              title: 'Overdue Delivery',
              message: `Order for ${order.customerName || 'customer'} is ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'} past due date`,
              actionLabel: 'Resolve',
              actionHref: `/admin/orders/${order.id}`,
              daysUntil: daysUntilDue,
              entityId: order.id,
              entityType: 'order',
              createdAt: now,
            });
          } else if (daysUntilDue <= 1 && daysUntilDue >= 0) {
            alerts.push({
              id: `order-due-soon-${order.id}`,
              category: 'orders',
              severity: 'warning',
              title: 'Delivery Due Soon',
              message: `Order for ${order.customerName || 'customer'} is due ${daysUntilDue === 0 ? 'today' : 'tomorrow'}`,
              actionLabel: 'View',
              actionHref: `/admin/orders/${order.id}`,
              daysUntil: daysUntilDue,
              entityId: order.id,
              entityType: 'order',
              createdAt: now,
            });
          }
        }
      });
    }

    // Invoice payment alerts
    if (data.invoices) {
      data.invoices.forEach(invoice => {
        if (invoice.status !== 'paid') {
          const daysUntilDue = Math.ceil((new Date(invoice.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilDue < 0) {
            alerts.push({
              id: `invoice-overdue-${invoice.id}`,
              category: 'payments',
              severity: 'critical',
              title: 'Overdue Invoice',
              message: `Invoice ${invoice.invoiceNumber} (${formatCurrency(invoice.amount)}) from ${invoice.customerName || 'customer'} is ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'} overdue`,
              actionLabel: 'Follow Up',
              actionHref: `/admin/invoices/${invoice.id}`,
              daysUntil: daysUntilDue,
              entityId: invoice.id,
              entityType: 'invoice',
              createdAt: now,
            });
          } else if (daysUntilDue <= 3) {
            alerts.push({
              id: `invoice-due-soon-${invoice.id}`,
              category: 'payments',
              severity: 'warning',
              title: 'Invoice Due Soon',
              message: `Invoice ${invoice.invoiceNumber} (${formatCurrency(invoice.amount)}) is due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
              actionLabel: 'Send Reminder',
              actionHref: `/admin/invoices/${invoice.id}`,
              daysUntil: daysUntilDue,
              entityId: invoice.id,
              entityType: 'invoice',
              createdAt: now,
            });
          }
        }
      });
    }

    // License/compliance alerts
    if (data.licenses) {
      data.licenses.forEach(license => {
        const daysUntilExpiry = Math.ceil((new Date(license.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          alerts.push({
            id: `license-expired-${license.id}`,
            category: 'compliance',
            severity: 'critical',
            title: 'License Expired',
            message: `${license.name} (${license.type}) expired ${Math.abs(daysUntilExpiry)} day${Math.abs(daysUntilExpiry) === 1 ? '' : 's'} ago`,
            actionLabel: 'Renew Now',
            actionHref: `/admin/compliance/licenses/${license.id}`,
            daysUntil: daysUntilExpiry,
            entityId: license.id,
            entityType: 'license',
            createdAt: now,
          });
        } else if (daysUntilExpiry <= 30) {
          alerts.push({
            id: `license-expiring-${license.id}`,
            category: 'compliance',
            severity: daysUntilExpiry <= 7 ? 'warning' : 'info',
            title: 'License Expiring Soon',
            message: `${license.name} (${license.type}) expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
            actionLabel: 'Renew',
            actionHref: `/admin/compliance/licenses/${license.id}`,
            daysUntil: daysUntilExpiry,
            entityId: license.id,
            entityType: 'license',
            createdAt: now,
          });
        }
      });
    }

    // Sort by severity and then by daysUntil
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Sort by urgency (smaller daysUntil first)
      const aDays = a.daysUntil ?? 999;
      const bDays = b.daysUntil ?? 999;
      return aDays - bDays;
    });
  }, [data]);
}

// Component to display predictive alerts
export { PredictiveAlertsPanel } from '@/components/ui/predictive-alerts-panel';
