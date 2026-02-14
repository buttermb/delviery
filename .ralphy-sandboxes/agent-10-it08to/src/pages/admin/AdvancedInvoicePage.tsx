/**
 * Advanced Invoice Page
 * Professional invoicing inspired by Invoice Ninja and Crater
 */

import { AdvancedInvoice } from '@/components/admin/invoice/AdvancedInvoice';
import { SEOHead } from '@/components/SEOHead';

export default function AdvancedInvoicePage() {
  return (
    <>
      <SEOHead title="Create Invoice" />
      <div className="container mx-auto p-6">
        <AdvancedInvoice />
      </div>
    </>
  );
}

