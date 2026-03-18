import { useState, useEffect, useMemo } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, Download, Mail, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { SEOHead } from '@/components/SEOHead';
import { PageHeader } from '@/components/shared/PageHeader';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { InvoiceSummaryStats } from '@/components/admin/invoices/InvoiceSummaryStats';
import { InvoiceFilters } from '@/components/admin/invoices/InvoiceFilters';
import { InvoiceTable } from '@/components/admin/invoices/InvoiceTable';
import { useNavigate, useParams } from 'react-router-dom';
import { CRMInvoice } from '@/types/crm';
import { logger } from '@/lib/logger';

export default function CustomerInvoices() {
  const { tenant, loading: accountLoading } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<CRMInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (tenant && !accountLoading) {
      loadInvoices();
    } else if (!accountLoading && !tenant) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, accountLoading]);

  const loadInvoices = async () => {
    if (!tenant) return;
    try {
      setLoading(true);
      // Join customers to resolve names
      const { data, error } = await supabase
        .from('customer_invoices' as 'tenants')
        .select(`
          *,
          client:customers(id, first_name, last_name, email)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map customer_invoices to CRMInvoice structure to share components
      const mappedInvoices = (data || []).map((inv: any) => ({
        ...inv,
        client: inv.client ? {
          ...inv.client,
          name: `${inv.client.first_name || ''} ${inv.client.last_name || ''}`.trim() || 'Unknown Client'
        } : undefined,
        // Map missing fields if necessary
        invoice_date: inv.issue_date || inv.created_at,
        client_id: inv.customer_id
      })) as CRMInvoice[];

      setInvoices(mappedInvoices);
    } catch (error) {
      logger.error('Error loading invoices', error instanceof Error ? error : new Error(String(error)));
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    let result = invoices;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.client?.name?.toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      result = result.filter(inv => inv.status === statusFilter);
    }

    if (dateRange?.from) {
      result = result.filter(inv => inv.invoice_date >= dateRange.from);
    }
    if (dateRange?.to) {
      result = result.filter(inv => inv.invoice_date <= dateRange.to);
    }

    return result;
  }, [invoices, searchQuery, statusFilter, dateRange]);

  if (loading || accountLoading) {
    return <EnhancedLoadingState type="table" />;
  }

  return (
    <>
      <SEOHead title="Customer Invoices" description="Manage customer invoices" />
      <div className="space-y-6 p-4 pb-16">
        <PageHeader
          title="Customer Invoices"
          description="View and manage invoices for your customers"
          actions={
            <Button onClick={() => navigate(`/${tenantSlug}/admin/advanced-invoice`)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          }
        />

        <InvoiceSummaryStats invoices={invoices} />

        <InvoiceFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        <InvoiceTable
          invoices={filteredInvoices}
          isLoading={loading}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={(inv) => navigate(`/${tenantSlug}/admin/crm/invoices/${inv.id}`)}
          onEditInBuilder={(id) => navigate(`/${tenantSlug}/admin/advanced-invoice?edit=${id}`)}
        />
      </div>
    </>
  );
}
