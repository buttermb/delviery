// Order edit restriction utilities

const NON_EDITABLE_STATUSES = ["shipped", "delivered", "completed", "cancelled"];
const CANCEL_ONLY_STATUSES = ["confirmed", "ready", "preparing"];

export function isOrderEditable(status: string): boolean {
  return !NON_EDITABLE_STATUSES.includes(status) && !CANCEL_ONLY_STATUSES.includes(status);
}

export function canCancelOrder(status: string): boolean {
  return !["delivered", "completed", "cancelled"].includes(status);
}

export function canChangeStatus(currentStatus: string, newStatus: string): boolean {
  const validTransitions: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["ready", "preparing", "shipped", "cancelled"],
    preparing: ["ready", "shipped", "cancelled"],
    ready: ["shipped", "cancelled"],
    shipped: ["delivered", "cancelled"],
    delivered: [],
    completed: [],
    cancelled: [],
  };
  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

export function getEditRestrictionMessage(status: string): string | null {
  if (NON_EDITABLE_STATUSES.includes(status)) {
    return `Order cannot be edited in "${status}" status`;
  }
  if (CANCEL_ONLY_STATUSES.includes(status)) {
    return `Order in "${status}" status can only be cancelled, not edited`;
  }
  return null;
}
