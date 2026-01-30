/**
 * Admin Components Export
 * Central export for all admin components
 */

// Dashboard
export * from './dashboard';

// CRM
export * from '../crm';

// Analytics
export { SelfHostedAnalytics } from './analytics/SelfHostedAnalytics';

// Routing
export { RouteOptimizer } from './routing/RouteOptimizer';

// Maps
export { SimpleMapVisualization } from './maps/SimpleMapVisualization';

// Invoice
export { AdvancedInvoice } from './invoice/AdvancedInvoice';
export { InvoicePDF, InvoiceDownloadButton, InvoiceViewer } from './InvoicePDF';

// AI
export { LocalAIIntegration } from './ai/LocalAIIntegration';

// Workflow
export { WorkflowBuilder } from './workflow/WorkflowBuilder';
export { AdvancedWorkflowBuilder } from './workflow/AdvancedWorkflowBuilder';

// Products
export { ProductQRGenerator } from './products/ProductQRGenerator';

