/**
 * Unified Data Hooks
 * 
 * This module exports unified hooks for the simplified data architecture.
 * These hooks work with the unified tables (unified_orders, contacts, etc.)
 * while maintaining backward compatibility with existing code.
 * 
 * Migration Guide:
 * ----------------
 * Old Hook                     | New Hook
 * -----------------------------|------------------------------------------
 * useWholesaleOrders           | useUnifiedOrders({ orderType: 'wholesale' })
 * useMenuOrders                | useUnifiedOrders({ orderType: 'menu' })
 * useRealtimeOrders            | useUnifiedOrders({ orderType: 'retail' })
 * usePOSTransactions           | useUnifiedOrders({ orderType: 'pos' })
 * useWholesaleClients          | useContacts({ contactType: 'wholesale' })
 * useClients (CRM)             | useContacts({ contactType: 'crm' })
 * useCustomers                 | useContacts({ contactType: 'retail' })
 */

// Unified Orders
export {
  useUnifiedOrders,
  useUnifiedOrder,
  useCreateUnifiedOrder,
  useUpdateOrderStatus,
  useCancelOrder,
  useOrderStats,
  unifiedOrdersKeys,
  type UnifiedOrder,
  type UnifiedOrderItem,
  type CreateOrderInput,
  type OrderType,
  type OrderStatus,
  type PaymentStatus,
} from '../useUnifiedOrders';

// Unified Contacts
export {
  useContacts,
  useWholesaleContactsList,
  useRetailCustomers,
  useCRMLeads,
  useContact,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useUpdateContactBalance,
  useAddContactType,
  useContactStats,
  contactsKeys,
  type Contact,
  type CreateContactInput,
  type ContactType,
  type ContactStatus,
  type LeadStatus,
  type LoyaltyTier,
  type ClientType,
} from '../useContacts';

