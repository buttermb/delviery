/**
 * Invoice PDF Component using React-PDF
 * Inspired by React-PDF repo - https://github.com/diegomura/react-pdf
 * Generate professional invoices without external services
 */

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  customerName: string;
  customerAddress?: string;
  customerEmail?: string;
  companyName: string;
  companyAddress?: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  taxRate?: number;
  total: number;
  notes?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #333',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  section: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
    width: '30%',
  },
  value: {
    width: '70%',
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #eee',
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
    paddingVertical: 8,
  },
  tableCol: {
    paddingHorizontal: 5,
  },
  colDescription: {
    width: '40%',
  },
  colQuantity: {
    width: '15%',
    textAlign: 'right',
  },
  colPrice: {
    width: '22.5%',
    textAlign: 'right',
  },
  colTotal: {
    width: '22.5%',
    textAlign: 'right',
  },
  totals: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '300',
    marginBottom: 5,
  },
  totalLabel: {
    fontWeight: 'bold',
    marginRight: 20,
  },
  totalValue: {
    textAlign: 'right',
    minWidth: 100,
  },
  finalTotal: {
    borderTop: '2 solid #333',
    paddingTop: 10,
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: '1 solid #eee',
    fontSize: 10,
    color: '#666',
  },
});

export function InvoicePDF({ invoice }: { invoice: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Invoice #{invoice.invoiceNumber}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Issue Date:</Text>
            <Text style={styles.value}>{new Date(invoice.issueDate).toLocaleDateString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Due Date:</Text>
            <Text style={styles.value}>{new Date(invoice.dueDate).toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Company & Customer Info */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ width: '48%' }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>From:</Text>
              <Text>{invoice.companyName}</Text>
              {invoice.companyAddress && <Text>{invoice.companyAddress}</Text>}
            </View>
            <View style={{ width: '48%' }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>To:</Text>
              <Text>{invoice.customerName}</Text>
              {invoice.customerAddress && <Text>{invoice.customerAddress}</Text>}
              {invoice.customerEmail && <Text>{invoice.customerEmail}</Text>}
            </View>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCol, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableCol, styles.colQuantity]}>Qty</Text>
            <Text style={[styles.tableCol, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.tableCol, styles.colTotal]}>Total</Text>
          </View>
          {invoice.lineItems.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCol, styles.colDescription]}>{item.description}</Text>
              <Text style={[styles.tableCol, styles.colQuantity]}>{item.quantity}</Text>
              <Text style={[styles.tableCol, styles.colPrice]}>
                ${item.unitPrice.toFixed(2)}
              </Text>
              <Text style={[styles.tableCol, styles.colTotal]}>
                ${item.total.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>${invoice.subtotal.toFixed(2)}</Text>
          </View>
          {invoice.tax > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Tax {invoice.taxRate ? `(${(invoice.taxRate * 100).toFixed(1)}%)` : ''}:
              </Text>
              <Text style={styles.totalValue}>${invoice.tax.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.finalTotal]}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>${invoice.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.section}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Notes:</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business!</Text>
          <Text>Payment terms: Due upon receipt</Text>
        </View>
      </Page>
    </Document>
  );
}

// Component for downloading PDF
export function InvoiceDownloadButton({ invoice }: { invoice: InvoiceData }) {
  return (
    <PDFDownloadLink
      document={<InvoicePDF invoice={invoice} />}
      fileName={`invoice-${invoice.invoiceNumber}.pdf`}
      className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
    >
      {({ blob, url, loading, error }) =>
        loading ? 'Generating PDF...' : 'Download Invoice PDF'
      }
    </PDFDownloadLink>
  );
}

// Component for viewing PDF in browser
export function InvoiceViewer({ invoice }: { invoice: InvoiceData }) {
  return (
    <div className="w-full h-dvh">
      <PDFViewer width="100%" height="100%">
        <InvoicePDF invoice={invoice} />
      </PDFViewer>
    </div>
  );
}

