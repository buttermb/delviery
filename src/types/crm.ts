// ============================================================================
// CRM System TypeScript Types
// Auto-generated from database schema
// ============================================================================

/**
 * CRM Client record
 */
export interface CRMClient {
    id: string;
    account_id: string;

    // Basic Info
    name: string;
    email: string | null;
    phone: string | null;

    // Financial
    open_balance: number;

    // Status
    status: 'active' | 'archived';

    // Client Portal Access
    portal_password_hash: string | null;
    portal_last_login: string | null;

    // Notifications
    notified_about_menu_update: boolean;

    created_at: string;
    updated_at: string;
}

/**
 * Line item for pre-orders and invoices
 */
export interface LineItem {
    id?: string; // For UI key (temporary, used in LineItemsEditor)
    item_id?: string; // Product reference ID
    product_name?: string;
    description?: string;
    quantity: number;
    unit_price: number;
    line_total: number;
}

/**
 * CRM Pre-Order record
 */
export interface CRMPreOrder {
    id: string;
    account_id: string;
    client_id: string;

    // Pre-order Info
    pre_order_number: string;

    // Line Items
    line_items: LineItem[];

    // Financial
    subtotal: number;
    tax: number;
    total: number;

    // Status
    status: 'pending' | 'converted' | 'cancelled';

    // Conversion
    converted_to_invoice_id: string | null;
    converted_at: string | null;

    // Additional fields
    expected_date?: string | null;
    notes?: string | null;

    created_at: string;
    updated_at: string;

    // Relations
    client?: CRMClient;
}

/**
 * CRM Invoice record
 */
export interface CRMInvoice {
    id: string;
    account_id: string;
    client_id: string;

    // Invoice Info
    invoice_number: string;

    // Dates
    invoice_date: string;
    due_date: string;
    issue_date?: string; // Alias for invoice_date for compatibility

    // Line Items
    line_items: LineItem[];

    // Financial
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    tax: number; // Alias for tax_amount for compatibility
    total: number;

    // Status
    status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
    paid_at: string | null;

    // Sharing
    public_token: string;

    // Source
    created_from_pre_order_id: string | null;

    // Additional fields
    notes?: string | null;

    created_at: string;
    updated_at: string;

    // Relations
    client?: CRMClient;
}

/**
 * CRM Note record
 */
export interface CRMNote {
    id: string;
    account_id: string;
    client_id: string;

    // Note Content
    note_text: string;

    // Metadata
    created_by_user_id: string | null;
    created_by_name: string | null;

    created_at: string;
}

/**
 * CRM Message record
 */
export interface CRMMessage {
    id: string;
    account_id: string;
    client_id: string;

    // Message Content
    message_text: string;

    // Sender Info
    sender_type: 'admin' | 'client';
    sender_user_id: string | null;
    sender_name: string | null;

    created_at: string;
}

/**
 * CRM Invite record
 */
export interface CRMInvite {
    id: string;
    account_id: string;

    // Invite Info
    name: string;
    email: string | null;
    phone: string | null;

    // Invite Link
    invite_token: string;

    // Status
    status: 'pending' | 'accepted' | 'archived';

    // Linked Client
    client_id: string | null;

    accepted_at: string | null;
    created_at: string;

    // Relations
    client?: CRMClient;
}

/**
 * CRM Activity Log record
 */
export interface CRMActivityLog {
    id: string;
    account_id: string;
    client_id: string;

    // Activity Info
    activity_type:
    | 'pre_order_created'
    | 'invoice_created'
    | 'invoice_updated'
    | 'payment_marked'
    | 'note_added'
    | 'invite_sent'
    | 'invite_accepted'
    | 'client_created'
    | 'client_updated'
    | 'client_archived';

    description: string;

    // References
    reference_id: string | null;
    reference_type: string | null;

    // Metadata
    performed_by_user_id: string | null;
    performed_by_name: string | null;

    created_at: string;
}

/**
 * FAQ item for CRM settings
 */
export interface FAQ {
    question: string;
    answer: string;
}

/**
 * CRM Settings record
 */
export interface CRMSettings {
    id: string;
    account_id: string;

    // Invoice Settings
    invoice_prefix?: string | null;
    default_payment_terms?: number | null;
    default_tax_rate?: number | null;

    // Company Information
    company_name?: string | null;
    company_address?: string | null;
    company_email?: string | null;
    company_phone?: string | null;
    logo_url?: string | null;

    // Settings
    telegram_video_link: string | null;
    menu_last_updated_at: string | null;

    // Returns/Refunds counter
    returns_refunds_count: number;

    // FAQs
    faqs: FAQ[];

    // Subscription Info
    subscription_info: string | null;

    created_at: string;
    updated_at: string;
}

/**
 * Form values for creating/editing a client
 */
export interface ClientFormValues {
    name: string;
    email?: string;
    phone?: string;
    status?: 'active' | 'archived';
}

/**
 * Form values for creating/editing a pre-order
 */
export interface PreOrderFormValues {
    client_id: string;
    line_items: LineItem[];
    tax?: number;
    status?: 'pending' | 'converted' | 'cancelled';
}

/**
 * Form values for creating/editing an invoice
 */
export interface InvoiceFormValues {
    client_id: string;
    invoice_date: string;
    due_date: string;
    line_items: LineItem[];
    tax_rate?: number;
    status?: 'draft' | 'sent' | 'paid' | 'overdue';
    notes?: string;
}

/**
 * Form values for creating a note
 */
export interface NoteFormValues {
    note_text: string;
}

/**
 * Form values for creating a message
 */
export interface MessageFormValues {
    message_text: string;
}

/**
 * Form values for creating an invite
 */
export interface InviteFormValues {
    name: string;
    email?: string;
    phone?: string;
}

/**
 * Dashboard metrics
 */
export interface CRMDashboardMetrics {
    total_open_balance: number;
    active_clients_count: number;
    pre_orders_count: number;
    returns_refunds_count: number;
}

/**
 * Client portal authentication
 */
export interface ClientPortalAuth {
    client_id: string;
    client_name: string;
    account_id: string;
}
