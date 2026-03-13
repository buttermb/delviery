/**
 * PrintLayout
 * Wrapper component that adds print-friendly styles to admin pages.
 * Hides sidebar, nav, and action buttons when printing.
 * Shows a print header with business name, date, and page title.
 */

import { ReactNode } from 'react';

import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface PrintLayoutProps {
  title: string;
  children: ReactNode;
  showPrintButton?: boolean;
}

const PRINT_STYLES = `
@media print {
  /* Hide non-printable elements */
  nav,
  aside,
  [data-sidebar],
  [data-print-hide],
  .no-print,
  button:not([data-print-keep]) {
    display: none !important;
  }

  /* Show print header */
  [data-print-header] {
    display: flex !important;
  }

  /* Reset backgrounds and shadows for print */
  body {
    background: white !important;
    color: black !important;
  }

  /* Remove shadows and rounded corners */
  * {
    box-shadow: none !important;
  }

  /* Ensure content fills the page */
  main, [role="main"] {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  /* Page margins */
  @page {
    margin: 1cm;
  }
}
`;

export function PrintLayout({ title, children, showPrintButton = true }: PrintLayoutProps) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <style>{PRINT_STYLES}</style>

      {/* Print header - hidden on screen, shown when printing */}
      <div
        data-print-header
        className="hidden items-center justify-between border-b pb-4 mb-6"
      >
        <div>
          <h1 className="text-xl font-bold">FloraIQ</h1>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        <p className="text-sm text-muted-foreground">{currentDate}</p>
      </div>

      {/* Print button */}
      {showPrintButton && (
        <div data-print-hide className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      )}

      {children}
    </>
  );
}
