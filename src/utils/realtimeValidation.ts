/**
 * Realtime Data Validation Utilities
 * Simplified version - basic validation only
 */

/**
 * Validates incoming order data - simplified
 */
export const validateOrder = (order: any): boolean => {
  return !!(order && typeof order === 'object');
};

/**
 * Validates activity data - simplified
 */
export const validateActivity = (activity: any): boolean => {
  return !!(activity && typeof activity === 'object');
};

/**
 * Validates audit log data - simplified
 */
export const validateAuditLog = (log: any): boolean => {
  return !!(log && typeof log === 'object');
};

/**
 * Validates courier data - simplified
 */
export const validateCourier = (courier: any): boolean => {
  return !!(courier && typeof courier === 'object');
};

/**
 * Validates giveaway data - simplified
 */
export const validateGiveaway = (giveaway: any): boolean => {
  return !!(giveaway && typeof giveaway === 'object');
};

/**
 * Validates product data - simplified
 */
export const validateProduct = (product: any): boolean => {
  return !!(product && typeof product === 'object' && product.id);
};

/**
 * Validates chat session data - simplified
 */
export const validateChatSession = (session: any): boolean => {
  return !!(session && typeof session === 'object' && session.id);
};

/**
 * Validates chat message data - simplified
 */
export const validateChatMessage = (message: any): boolean => {
  return !!(message && typeof message === 'object');
};
