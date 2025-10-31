/**
 * Type Guard Utilities
 * Provides runtime type checking for data validation
 */

/**
 * Validates that an order object has required properties
 */
export const isValidOrder = (order: any): boolean => {
  return (
    order &&
    typeof order === 'object' &&
    typeof order.id === 'string' &&
    typeof order.status === 'string'
  );
};

/**
 * Validates that an activity object has required properties
 */
export const isValidActivity = (activity: any): boolean => {
  return (
    activity &&
    typeof activity === 'object' &&
    typeof activity.type === 'string' &&
    typeof activity.message === 'string'
  );
};

/**
 * Validates that an audit log object has required properties
 */
export const isValidAuditLog = (log: any): boolean => {
  return (
    log &&
    typeof log === 'object' &&
    typeof log.action === 'string' &&
    typeof log.entity_type === 'string'
  );
};

/**
 * Validates that a bug report object has required properties
 */
export const isValidBugReport = (bug: any): boolean => {
  return (
    bug &&
    typeof bug === 'object' &&
    typeof bug.type === 'string' &&
    typeof bug.severity === 'string' &&
    typeof bug.message === 'string'
  );
};

/**
 * Validates that a courier object has required properties
 */
export const isValidCourier = (courier: any): boolean => {
  return (
    courier &&
    typeof courier === 'object' &&
    typeof courier.id === 'string' &&
    typeof courier.full_name === 'string'
  );
};

/**
 * Safely extract string property from object
 */
export const safeString = (
  obj: any,
  key: string,
  defaultValue: string = ''
): string => {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  const value = obj[key];
  return typeof value === 'string' ? value : defaultValue;
};

/**
 * Safely extract number property from object
 */
export const safeNumber = (
  obj: any,
  key: string,
  defaultValue: number = 0
): number => {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  const value = obj[key];
  return typeof value === 'number' ? value : defaultValue;
};
