/**
 * Analytics Export Utilities
 *
 * Generate CSV and PDF reports from analytics data.
 * Uses jsPDF for PDF generation and native CSV for spreadsheet exports.
 */

import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { downloadFile, generateExportFilename } from './exportUtils';

// Types for analytics data
export interface AnalyticsMetric {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

export interface AnalyticsReportData {
  title: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics: AnalyticsMetric[];
  charts?: {
    title: string;
    data: ChartDataPoint[];
  }[];
  tables?: {
    title: string;
    headers: string[];
    rows: (string | number)[][];
  }[];
}

/**
 * Export analytics data to CSV format
 */
export function exportAnalyticsToCSV(data: AnalyticsReportData): void {
  const lines: string[] = [];

  // Header
  lines.push(`"${data.title}"`);
  lines.push(`"Report Period: ${format(data.dateRange.start, 'MMM d, yyyy')} - ${format(data.dateRange.end, 'MMM d, yyyy')}"`);
  lines.push(`"Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}"`);
  lines.push('');

  // Key Metrics Section
  lines.push('"Key Metrics"');
  lines.push('"Metric","Value","Change"');
  for (const metric of data.metrics) {
    const changeStr = metric.change !== undefined
      ? `${metric.change >= 0 ? '+' : ''}${metric.change}%`
      : '';
    lines.push(`"${metric.label}","${metric.value}","${changeStr}"`);
  }
  lines.push('');

  // Charts data
  if (data.charts) {
    for (const chart of data.charts) {
      lines.push(`"${chart.title}"`);

      // Get all keys from the first data point
      if (chart.data.length > 0) {
        const keys = Object.keys(chart.data[0]);
        lines.push(keys.map(k => `"${k}"`).join(','));

        for (const point of chart.data) {
          const values = keys.map(k => {
            const val = point[k];
            return typeof val === 'string' ? `"${val}"` : val;
          });
          lines.push(values.join(','));
        }
      }
      lines.push('');
    }
  }

  // Tables
  if (data.tables) {
    for (const table of data.tables) {
      lines.push(`"${table.title}"`);
      lines.push(table.headers.map(h => `"${h}"`).join(','));

      for (const row of table.rows) {
        const values = row.map(v => typeof v === 'string' ? `"${v}"` : v);
        lines.push(values.join(','));
      }
      lines.push('');
    }
  }

  const csvContent = '\uFEFF' + lines.join('\n'); // BOM for Excel
  const filename = generateExportFilename(data.title.toLowerCase().replace(/\s+/g, '-'), 'csv');
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
}

/**
 * Export analytics data to PDF format
 */
export function exportAnalyticsToPDF(data: AnalyticsReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin;

  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const textColor: [number, number, number] = [31, 41, 55]; // Dark gray
  const mutedColor: [number, number, number] = [107, 114, 128]; // Medium gray
  const successColor: [number, number, number] = [34, 197, 94]; // Green

  // Header with title
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.title, margin, 25);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateRangeText = `${format(data.dateRange.start, 'MMM d, yyyy')} - ${format(data.dateRange.end, 'MMM d, yyyy')}`;
  doc.text(dateRangeText, margin, 35);

  yPos = 55;

  // Generated timestamp
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, pageWidth - margin - 60, yPos);

  yPos += 15;

  // Key Metrics Section
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Key Metrics', margin, yPos);
  yPos += 10;

  // Draw metrics in a grid (2 columns)
  const metricsPerRow = 2;
  const metricWidth = (pageWidth - 2 * margin - 10) / metricsPerRow;
  const metricHeight = 35;

  for (let i = 0; i < data.metrics.length; i++) {
    const metric = data.metrics[i];
    const col = i % metricsPerRow;
    const row = Math.floor(i / metricsPerRow);

    const xPos = margin + col * (metricWidth + 10);
    const boxY = yPos + row * (metricHeight + 5);

    // Check if we need a new page
    if (boxY + metricHeight > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      yPos = margin;
    }

    // Metric box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(xPos, boxY, metricWidth, metricHeight, 3, 3, 'F');

    // Metric label
    doc.setTextColor(...mutedColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(metric.label, xPos + 8, boxY + 12);

    // Metric value
    doc.setTextColor(...textColor);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(String(metric.value), xPos + 8, boxY + 27);

    // Change indicator if present
    if (metric.change !== undefined) {
      const changeText = `${metric.change >= 0 ? '+' : ''}${metric.change}%`;
      doc.setFontSize(9);
      doc.setTextColor(metric.change >= 0 ? successColor[0] : 239, metric.change >= 0 ? successColor[1] : 68, metric.change >= 0 ? successColor[2] : 68);
      doc.text(changeText, xPos + metricWidth - 25, boxY + 27);
    }
  }

  // Move yPos past the metrics grid
  const metricsRows = Math.ceil(data.metrics.length / metricsPerRow);
  yPos += metricsRows * (metricHeight + 5) + 15;

  // Check for page overflow before charts
  if (yPos > doc.internal.pageSize.getHeight() - 80) {
    doc.addPage();
    yPos = margin;
  }

  // Charts data as tables
  if (data.charts) {
    for (const chart of data.charts) {
      // Section title
      doc.setTextColor(...textColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(chart.title, margin, yPos);
      yPos += 8;

      if (chart.data.length > 0) {
        // Table header
        const keys = Object.keys(chart.data[0]);
        const colWidth = (pageWidth - 2 * margin) / keys.length;

        // Header background
        doc.setFillColor(243, 244, 246);
        doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');

        // Header text
        doc.setTextColor(...mutedColor);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        keys.forEach((key, idx) => {
          doc.text(key.charAt(0).toUpperCase() + key.slice(1), margin + idx * colWidth + 3, yPos + 5);
        });
        yPos += 10;

        // Data rows (limit to first 10 for PDF)
        const displayData = chart.data.slice(0, 10);
        doc.setTextColor(...textColor);
        doc.setFont('helvetica', 'normal');

        for (const point of displayData) {
          if (yPos > doc.internal.pageSize.getHeight() - 30) {
            doc.addPage();
            yPos = margin;
          }

          keys.forEach((key, idx) => {
            const value = point[key];
            const displayValue = typeof value === 'number'
              ? value.toLocaleString()
              : String(value);
            doc.text(displayValue.substring(0, 20), margin + idx * colWidth + 3, yPos + 4);
          });
          yPos += 7;
        }

        if (chart.data.length > 10) {
          doc.setTextColor(...mutedColor);
          doc.setFontSize(8);
          doc.text(`... and ${chart.data.length - 10} more rows`, margin, yPos + 4);
          yPos += 7;
        }
      }

      yPos += 10;
    }
  }

  // Tables
  if (data.tables) {
    for (const table of data.tables) {
      // Check for page overflow
      if (yPos > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        yPos = margin;
      }

      // Section title
      doc.setTextColor(...textColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(table.title, margin, yPos);
      yPos += 8;

      const colWidth = (pageWidth - 2 * margin) / table.headers.length;

      // Header background
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');

      // Header text
      doc.setTextColor(...mutedColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      table.headers.forEach((header, idx) => {
        doc.text(header.substring(0, 15), margin + idx * colWidth + 3, yPos + 5);
      });
      yPos += 10;

      // Data rows
      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'normal');

      const displayRows = table.rows.slice(0, 15);
      for (const row of displayRows) {
        if (yPos > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPos = margin;
        }

        row.forEach((cell, idx) => {
          const displayValue = typeof cell === 'number'
            ? cell.toLocaleString()
            : String(cell);
          doc.text(displayValue.substring(0, 18), margin + idx * colWidth + 3, yPos + 4);
        });
        yPos += 7;
      }

      if (table.rows.length > 15) {
        doc.setTextColor(...mutedColor);
        doc.setFontSize(8);
        doc.text(`... and ${table.rows.length - 15} more rows`, margin, yPos + 4);
      }

      yPos += 15;
    }
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
    doc.text(
      'Generated by FloraIQ Analytics',
      margin,
      doc.internal.pageSize.getHeight() - 10
    );
  }

  // Save the PDF
  const filename = generateExportFilename(data.title.toLowerCase().replace(/\s+/g, '-'), 'pdf');
  doc.save(filename);
}

/**
 * Helper to format currency for reports
 */
export function formatCurrencyForReport(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Helper to format large numbers for reports
 */
export function formatNumberForReport(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}
