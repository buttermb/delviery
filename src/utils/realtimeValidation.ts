/**
 * Realtime Data Validation Utilities
 * Simplified version - basic validation only
 */

/**
 * Validates incoming order data - simplified
 */
/**
 * Validates incoming order data - simplified
 */
export const validateOrder = (order: unknown): order is Record<string, unknown> => {
  return !!(order && typeof order === 'object');
};

/**
 * Validates activity data - simplified
 */
export const validateActivity = (activity: unknown): activity is Record<string, unknown> => {
  return !!(activity && typeof activity === 'object');
};

/**
 * Validates audit log data - simplified
 */
export const validateAuditLog = (log: unknown): log is Record<string, unknown> => {
  return !!(log && typeof log === 'object');
};

/**
 * Validates courier data - simplified
 */
export const validateCourier = (courier: unknown): courier is Record<string, unknown> => {
  return !!(courier && typeof courier === 'object');
};

/**
 * Validates giveaway data - simplified
 */
export const validateGiveaway = (giveaway: unknown): giveaway is Record<string, unknown> => {
  return !!(giveaway && typeof giveaway === 'object');
};

/**
 * Validates product data - simplified
 */
export const validateProduct = (product: unknown): product is Record<string, unknown> & { id: unknown } => {
  return !!(product && typeof product === 'object' && 'id' in product);
};

/**
 * Validates chat session data - simplified
 */
export const validateChatSession = (session: unknown): session is Record<string, unknown> & { id: unknown } => {
  return !!(session && typeof session === 'object' && 'id' in session);
};

/**
 * Validates chat message data - simplified
 */
export const validateChatMessage = (message: unknown): message is Record<string, unknown> => {
  return !!(message && typeof message === 'object');
};
