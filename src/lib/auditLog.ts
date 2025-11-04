// Mock audit logging until tables are created
export async function logAuditEvent(params: any) {
  console.log('Audit event:', params);
  return { success: true };
}

export const auditActions = {
  tenantCreated: () => Promise.resolve(),
  tenantUpdated: () => Promise.resolve(),
  tenantSuspended: () => Promise.resolve(),
  tenantActivated: () => Promise.resolve(),
  tenantDeleted: () => Promise.resolve(),
  featureFlagCreated: () => Promise.resolve(),
  featureFlagUpdated: () => Promise.resolve(),
  workflowCreated: () => Promise.resolve(),
  workflowExecuted: () => Promise.resolve(),
  communicationSent: () => Promise.resolve(),
  rateLimitUpdated: () => Promise.resolve(),
  impersonationStarted: () => Promise.resolve(),
  impersonationEnded: () => Promise.resolve(),
  systemConfigUpdated: () => Promise.resolve(),
  tenantMigrationStarted: () => Promise.resolve(),
  tenantMigrationCompleted: () => Promise.resolve(),
};
