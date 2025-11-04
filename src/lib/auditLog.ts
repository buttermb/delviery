/**
 * Audit Log Helper
 * Centralized audit logging system for super admin actions
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

export interface AuditLogEvent {
  action: string;
  resourceType?: string;
  resourceId?: string;
  tenantId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(event: AuditLogEvent): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      logger.warn('Cannot log audit event: No authenticated user');
      return;
    }

    // Check if user is super admin
    // @ts-ignore - super_admins table not in types yet
    const { data: superAdmin } = await supabase
      // @ts-ignore
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    const actorType = superAdmin ? 'super_admin' : 'tenant_admin';

    // Get IP address and user agent from browser
    const ipAddress = await getClientIP();
    const userAgent = navigator.userAgent;

    // @ts-ignore - audit_logs schema has different fields than types suggest
    const { error } = await supabase.from('audit_logs').insert({
      // @ts-ignore - using custom fields not in generated types
      actor_id: user.id,
      actor_type: actorType,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      tenant_id: event.tenantId,
      changes: event.changes || {},
      ip_address: ipAddress,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      logger.error('Failed to log audit event', error);
      // Don't throw - audit logging failures shouldn't break the app
    }
  } catch (error) {
    logger.error('Error in logAuditEvent', error);
  }
}

/**
 * Get client IP address (simplified - in production would use proper method)
 */
async function getClientIP(): Promise<string | null> {
  try {
    // In a real application, you'd get this from the server
    // For client-side, we can use a service or store it in session
    return null; // Will be handled by Edge Function in production
  } catch {
    return null;
  }
}

/**
 * Predefined audit actions for common operations
 */
export const auditActions = {
  // Tenant actions
  tenantCreated: (tenantId: string, changes: Record<string, any>) =>
    logAuditEvent({
      action: 'tenant.created',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
      changes,
    }),

  tenantUpdated: (tenantId: string, changes: Record<string, any>) =>
    logAuditEvent({
      action: 'tenant.updated',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
      changes,
    }),

  tenantSuspended: (tenantId: string) =>
    logAuditEvent({
      action: 'tenant.suspended',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
    }),

  tenantActivated: (tenantId: string) =>
    logAuditEvent({
      action: 'tenant.activated',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
    }),

  tenantDeleted: (tenantId: string) =>
    logAuditEvent({
      action: 'tenant.deleted',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
    }),

  // Feature flag actions
  featureFlagCreated: (flagKey: string, changes: Record<string, any>) =>
    logAuditEvent({
      action: 'feature_flag.created',
      resourceType: 'feature_flag',
      changes: { flagKey, ...changes },
    }),

  featureFlagUpdated: (flagKey: string, changes: Record<string, any>) =>
    logAuditEvent({
      action: 'feature_flag.updated',
      resourceType: 'feature_flag',
      changes: { flagKey, ...changes },
    }),

  // Workflow actions
  workflowCreated: (workflowId: string, changes: Record<string, any>) =>
    logAuditEvent({
      action: 'workflow.created',
      resourceType: 'workflow',
      resourceId: workflowId,
      changes,
    }),

  workflowExecuted: (workflowId: string, tenantId?: string) =>
    logAuditEvent({
      action: 'workflow.executed',
      resourceType: 'workflow',
      resourceId: workflowId,
      tenantId,
    }),

  // Communication actions
  communicationSent: (communicationId: string, tenantIds: string[]) =>
    logAuditEvent({
      action: 'communication.sent',
      resourceType: 'communication',
      resourceId: communicationId,
      metadata: { recipientCount: tenantIds.length },
    }),

  // Rate limit actions
  rateLimitUpdated: (tenantId: string, changes: Record<string, any>) =>
    logAuditEvent({
      action: 'rate_limit.updated',
      resourceType: 'rate_limit',
      tenantId,
      changes,
    }),

  // Impersonation actions
  impersonationStarted: (tenantId: string) =>
    logAuditEvent({
      action: 'impersonation.started',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
      metadata: { type: 'impersonation' },
    }),

  impersonationEnded: (tenantId: string) =>
    logAuditEvent({
      action: 'impersonation.ended',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
      metadata: { type: 'impersonation' },
    }),

  // System actions
  systemConfigUpdated: (changes: Record<string, any>) =>
    logAuditEvent({
      action: 'system_config.updated',
      resourceType: 'system_config',
      changes,
    }),

  // Migration actions
  tenantMigrationStarted: (sourceTenantId: string, targetTenantId: string) =>
    logAuditEvent({
      action: 'tenant_migration.started',
      resourceType: 'tenant',
      resourceId: sourceTenantId,
      tenantId: sourceTenantId,
      metadata: { targetTenantId },
    }),

  tenantMigrationCompleted: (sourceTenantId: string, targetTenantId: string) =>
    logAuditEvent({
      action: 'tenant_migration.completed',
      resourceType: 'tenant',
      resourceId: sourceTenantId,
      tenantId: sourceTenantId,
      metadata: { targetTenantId },
    }),
};
