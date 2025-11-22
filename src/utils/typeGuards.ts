/**
 * Type Guard Utilities
 * Provides runtime type checking for data validation
 */

/**
 * Validates that an order object has required properties
 */
/**
 * Validates that an order object has required properties
 */
export const isValidOrder = (order: unknown): order is { id: string; status: string } => {
  return (
    typeof order === 'object' &&
    order !== null &&
    'id' in order &&
    typeof (order as Record<string, unknown>).id === 'string' &&
    'status' in order &&
    typeof (order as Record<string, unknown>).status === 'string'
  );
};

/**
 * Validates that an activity object has required properties
 */
export const isValidActivity = (activity: unknown): activity is { type: string; message: string } => {
  return (
    typeof activity === 'object' &&
    activity !== null &&
    'type' in activity &&
    typeof (activity as Record<string, unknown>).type === 'string' &&
    'message' in activity &&
    typeof (activity as Record<string, unknown>).message === 'string'
  );
};

/**
 * Validates that an audit log object has required properties
 */
export const isValidAuditLog = (log: unknown): log is { action: string; entity_type: string } => {
  return (
    typeof log === 'object' &&
    log !== null &&
    'action' in log &&
    typeof (log as Record<string, unknown>).action === 'string' &&
    'entity_type' in log &&
    typeof (log as Record<string, unknown>).entity_type === 'string'
  );
};

/**
 * Validates that a bug report object has required properties
 */
export const isValidBugReport = (bug: unknown): bug is { type: string; severity: string; message: string } => {
  return (
    typeof bug === 'object' &&
    bug !== null &&
    'type' in bug &&
    typeof (bug as Record<string, unknown>).type === 'string' &&
    'severity' in bug &&
    typeof (bug as Record<string, unknown>).severity === 'string' &&
    'message' in bug &&
    typeof (bug as Record<string, unknown>).message === 'string'
  );
};

/**
 * Validates that a courier object has required properties
 */
export const isValidCourier = (courier: unknown): courier is { id: string; full_name: string } => {
  return (
    typeof courier === 'object' &&
    courier !== null &&
    'id' in courier &&
    typeof (courier as Record<string, unknown>).id === 'string' &&
    'full_name' in courier &&
    typeof (courier as Record<string, unknown>).full_name === 'string'
  );
};

/**
 * Safely extract string property from object
 */
export const safeString = (
  obj: unknown,
  key: string,
  defaultValue: string = ''
): string => {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : defaultValue;
};

/**
 * Safely extract number property from object
 */
export const safeNumber = (
  obj: unknown,
  key: string,
  defaultValue: number = 0
): number => {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : defaultValue;
};
