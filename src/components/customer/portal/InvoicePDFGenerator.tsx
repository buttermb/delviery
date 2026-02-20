import { useCallback } from 'react';
import jsPDF from 'jspdf';
import { logger } from '@/lib/logger';
import type { PortalInvoice } from '@/types/portal';
import { formatCurrency } from '@/lib/formatters';

export interface InvoicePDFGeneratorProps {
  invoice: PortalInvoice;
  clientName?: string;
  clientAddress?: string;
  companyName?: string;
  companyAddress?: string;
  paymentInstructions?: string;
  amountPaid?: number;
}

export function generateInvoicePDF({
  invoice,
  clientName = '',
  clientAddress = '',
  companyName = 'BigMike Wholesale',
  companyAddress = '',
  paymentInstructions = 'Please remit payment within 30 days.',
  amountPaid = 0,
}: InvoicePDFGeneratorProps): void {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Header
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INVOICE', margin, yPosition);
    yPosition += 10;

    // Company Info (right side)
    if (companyName) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(companyName, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 6;
    }

    if (companyAddress) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const addressLines = pdf.splitTextToSize(companyAddress, 80);
      pdf.text(addressLines, pageWidth - margin, yPosition, { align: 'right' });
      yPosition += addressLines.length * 4;
    }

    yPosition += 10;

    // Invoice Details
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Invoice #: ${invoice.invoice_number}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Issue Date: ${new Date(invoice.issue_date).toLocaleDateString()}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, margin, yPosition);
    yPosition += 10;

    // Bill To
    if (clientName) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Bill To:', margin, yPosition);
      yPosition += 6;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(clientName, margin, yPosition);
      yPosition += 6;

      if (clientAddress) {
        const addressLines = pdf.splitTextToSize(clientAddress, 80);
        pdf.text(addressLines, margin, yPosition);
        yPosition += addressLines.length * 4;
      }
      yPosition += 10;
    }

    // Line Items Table
    const colWidths = {
      item: contentWidth * 0.4,
      qty: contentWidth * 0.15,
      price: contentWidth * 0.2,
      total: contentWidth * 0.25,
    };

    // Table Header
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Item', margin, yPosition);
    pdf.text('Qty', margin + colWidths.item, yPosition);
    pdf.text('Price', margin + colWidths.item + colWidths.qty, yPosition);
    pdf.text('Total', margin + colWidths.item + colWidths.qty + colWidths.price, yPosition);
    yPosition += 6;

    // Draw header line
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 4;

    // Table Rows
    pdf.setFont('helvetica', 'normal');
    invoice.line_items.forEach((item) => {
      if (yPosition > 250) {
        // New page if needed
        pdf.addPage();
        yPosition = margin;
      }

      const itemName = pdf.splitTextToSize(item.product_name, colWidths.item - 2);
      pdf.text(itemName, margin, yPosition);
      pdf.text(String(item.quantity), margin + colWidths.item, yPosition);
      pdf.text(formatCurrency(item.price), margin + colWidths.item + colWidths.qty, yPosition);
      pdf.text(formatCurrency(item.total), margin + colWidths.item + colWidths.qty + colWidths.price, yPosition);
      yPosition += itemName.length * 5 + 2;
    });

    yPosition += 5;

    // Totals
    const totalsX = margin + colWidths.item + colWidths.qty;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Subtotal:', totalsX, yPosition);
    pdf.text(formatCurrency(invoice.subtotal), pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 6;

    if (invoice.tax > 0) {
      pdf.text('Tax:', totalsX, yPosition);
      pdf.text(formatCurrency(invoice.tax), pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 6;
    }

    // Total line
    pdf.setLineWidth(0.5);
    pdf.line(totalsX, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Total:', totalsX, yPosition);
    pdf.text(formatCurrency(invoice.total), pageWidth - margin, yPosition, { align: 'right' });
    yPosition += 8;

    // Partial payment indicator
    if (amountPaid > 0) {
      const balanceDue = Math.max(0, invoice.total - amountPaid);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(34, 197, 94);
      pdf.text('Amount Paid:', totalsX, yPosition);
      pdf.text(formatCurrency(amountPaid), pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 6;

      pdf.setLineWidth(0.5);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(totalsX, yPosition, pageWidth - margin, yPosition);
      yPosition += 6;

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      if (balanceDue > 0) {
        pdf.setTextColor(239, 68, 68);
      } else {
        pdf.setTextColor(34, 197, 94);
      }
      pdf.text('Amount Due:', totalsX, yPosition);
      pdf.text(formatCurrency(balanceDue), pageWidth - margin, yPosition, { align: 'right' });
      yPosition += 8;

      pdf.setTextColor(0, 0, 0);
    }

    yPosition += 2;

    // Payment Instructions
    if (paymentInstructions) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const instructions = pdf.splitTextToSize(paymentInstructions, contentWidth);
      pdf.text(instructions, margin, yPosition);
    }

    // Footer
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pdf.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Download PDF
    pdf.save(`Invoice-${invoice.invoice_number}.pdf`);
  } catch (error: unknown) {
    logger.error('Failed to generate invoice PDF', error, { component: 'InvoicePDFGenerator', invoiceId: invoice.id });
    throw error;
  }
}

export function useInvoicePDFGenerator() {
  const generatePDF = useCallback((props: InvoicePDFGeneratorProps) => {
    try {
      generateInvoicePDF(props);
    } catch (error: unknown) {
      logger.error('Error generating invoice PDF', error, { component: 'useInvoicePDFGenerator' });
      throw error;
    }
  }, []);

  return { generatePDF };
}

