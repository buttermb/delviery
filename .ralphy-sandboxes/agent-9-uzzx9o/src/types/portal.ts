export interface PortalClient {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  portal_token: string;
  created_at: string;
}

export interface PortalInvoice {
  id: string;
  invoice_number: string;
  total: number;
  subtotal: number;
  tax: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issue_date: string;
  due_date: string;
  line_items: Array<{
    product_name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  created_at: string;
}

export interface PortalOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  items: Array<{
    product_name: string;
    quantity: number;
    price: number;
  }>;
  delivery_method?: string;
  payment_method?: string;
  converted_to_invoice_id?: string | null;
}

export interface PortalData {
  client: PortalClient;
  invoices: PortalInvoice[];
  orders: PortalOrder[];
  statistics: {
    total_invoices: number;
    total_spent: number;
    pending_invoices: number;
    total_orders: number;
  };
}

