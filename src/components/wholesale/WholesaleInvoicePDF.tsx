/**
 * Wholesale Invoice PDF Component
 * Generates professional PDF invoices for wholesale orders
 */

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@/components/ui/lazy-react-pdf';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';

interface WholesaleOrderItem {
  id: string;
  product_name: string;
  quantity_lbs: number;
  unit_price: number;
}

interface WholesaleInvoiceData {
  orderNumber: string;
  orderDate: string;
  dueDate?: string;
  // Client info
  clientName: string;
  clientContact?: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  // Company info
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  // Order details
  items: WholesaleOrderItem[];
  subtotal: number;
  tax?: number;
  total: number;
  // Payment info
  paymentTerms: string;
  paymentStatus: string;
  outstandingBalance?: number;
  // Notes
  notes?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#10b981',
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    textAlign: 'right',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 5,
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  label: {
    color: '#666',
    width: 80,
  },
  value: {
    color: '#333',
    flex: 1,
  },
  addressBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  addressColumn: {
    width: '45%',
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fafafa',
  },
  colProduct: {
    flex: 2,
    fontWeight: 'bold',
  },
  colProductValue: {
    flex: 2,
  },
  colQty: {
    width: 60,
    textAlign: 'center',
  },
  colPrice: {
    width: 80,
    textAlign: 'right',
  },
  colTotal: {
    width: 90,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  totalsSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
    width: 250,
  },
  totalLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 20,
    color: '#666',
  },
  totalValue: {
    width: 100,
    textAlign: 'right',
    fontFamily: 'Courier',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#10b981',
    width: 250,
  },
  grandTotalLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 20,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  grandTotalValue: {
    width: 100,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Courier',
    color: '#10b981',
  },
  paymentInfo: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f0fdf4',
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  paymentTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#166534',
  },
  warningBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#fef3c7',
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#92400e',
  },
  warningText: {
    color: '#92400e',
    fontSize: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#999',
    fontSize: 9,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 15,
  },
  notesSection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 5,
  },
});

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function WholesaleInvoicePDF({ invoice }: { invoice: WholesaleInvoiceData }) {
  const totalWeight = invoice.items.reduce((sum, item) => sum + item.quantity_lbs, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>Order #{invoice.orderNumber}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 5 }}>
              {invoice.companyName}
            </Text>
            {invoice.companyAddress && (
              <Text style={{ color: '#666', marginBottom: 2 }}>{invoice.companyAddress}</Text>
            )}
            {invoice.companyPhone && (
              <Text style={{ color: '#666', marginBottom: 2 }}>{invoice.companyPhone}</Text>
            )}
            {invoice.companyEmail && (
              <Text style={{ color: '#666' }}>{invoice.companyEmail}</Text>
            )}
          </View>
        </View>

        {/* Dates & Addresses */}
        <View style={styles.addressBlock}>
          <View style={styles.addressColumn}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={{ fontWeight: 'bold', marginBottom: 3 }}>{invoice.clientName}</Text>
            {invoice.clientContact && (
              <Text style={{ marginBottom: 2 }}>{invoice.clientContact}</Text>
            )}
            {invoice.clientAddress && (
              <Text style={{ color: '#666', marginBottom: 2 }}>{invoice.clientAddress}</Text>
            )}
            {invoice.clientPhone && (
              <Text style={{ color: '#666', marginBottom: 2 }}>{invoice.clientPhone}</Text>
            )}
            {invoice.clientEmail && (
              <Text style={{ color: '#666' }}>{invoice.clientEmail}</Text>
            )}
          </View>
          <View style={styles.addressColumn}>
            <Text style={styles.sectionTitle}>Invoice Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Issue Date:</Text>
              <Text style={styles.value}>{formatDate(invoice.orderDate)}</Text>
            </View>
            {invoice.dueDate && (
              <View style={styles.row}>
                <Text style={styles.label}>Due Date:</Text>
                <Text style={styles.value}>{formatDate(invoice.dueDate)}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>Terms:</Text>
              <Text style={styles.value}>{invoice.paymentTerms}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Status:</Text>
              <Text style={{ ...styles.value, fontWeight: 'bold', color: invoice.paymentStatus === 'paid' ? '#10b981' : '#f59e0b' }}>
                {invoice.paymentStatus.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colProduct}>Product</Text>
            <Text style={styles.colQty}>Qty (lbs)</Text>
            <Text style={styles.colPrice}>Unit Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {invoice.items.map((item, index) => (
            <View key={item.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.colProductValue}>{item.product_name}</Text>
              <Text style={styles.colQty}>{item.quantity_lbs}</Text>
              <Text style={styles.colPrice}>{formatCurrency(item.unit_price)}</Text>
              <Text style={styles.colTotal}>
                {formatCurrency(item.quantity_lbs * item.unit_price)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Weight:</Text>
            <Text style={styles.totalValue}>{totalWeight} lbs</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          {invoice.tax !== undefined && invoice.tax > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax:</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.tax)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Due:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentTitle}>Payment Information</Text>
          <Text>Payment Terms: {invoice.paymentTerms}</Text>
          {invoice.dueDate && (
            <Text style={{ marginTop: 3 }}>Please remit payment by {formatDate(invoice.dueDate)}</Text>
          )}
        </View>

        {/* Outstanding Balance Warning */}
        {invoice.outstandingBalance !== undefined && invoice.outstandingBalance > 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Outstanding Balance</Text>
            <Text style={styles.warningText}>
              This client has an outstanding balance of {formatCurrency(invoice.outstandingBalance)}.
              Please collect this amount along with the current invoice.
            </Text>
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for your business! • Questions? Contact us at {invoice.companyEmail || 'support@company.com'}
        </Text>
      </Page>
    </Document>
  );
}

// Download Button Component
export function WholesaleInvoiceDownloadButton({
  invoice,
  variant = 'default',
  size = 'default',
}: {
  invoice: WholesaleInvoiceData;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}) {
  return (
    <PDFDownloadLink
      document={<WholesaleInvoicePDF invoice={invoice} />}
      fileName={`wholesale-invoice-${invoice.orderNumber}.pdf`}
    >
      {({ loading }) => (
        <Button variant={variant} size={size} disabled={loading} className="gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Download Invoice
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  );
}

export default WholesaleInvoicePDF;

