import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logger } from "@/lib/logger";
import jsPDF from "jspdf";
import { useInvoices, type InvoiceSortState } from "@/hooks/crm/useInvoices";
import { CustomerLink } from "@/components/admin/cross-links";
import { useCRMSettings } from "@/hooks/crm/useCRMSettings";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Plus,
    MoreHorizontal,
    FileText,
    Filter,
    CheckCircle,
    Clock,
    DollarSign,
    Send,
    Copy,
    Ban,
    TrendingUp,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { format, differenceInDays, startOfMonth, isAfter } from "date-fns";
import { toast } from "sonner";
import { CRMInvoice, CRMSettings } from "@/types/crm";
import { TruncatedText } from "@/components/shared/TruncatedText";
import { ConfirmDialog } from "@/components/admin/shared/ConfirmDialog";
import { ShortcutHint, useModifierKey } from "@/components/ui/shortcut-hint";
import { Skeleton } from "@/components/ui/skeleton";
import { usePagination } from "@/hooks/usePagination";
import { StandardPagination } from "@/components/shared/StandardPagination";
import { sanitizeSearchInput } from "@/lib/sanitizeSearch";
import { AdminDataTable } from "@/components/admin/shared/AdminDataTable";
import { AdminToolbar } from "@/components/admin/shared/AdminToolbar";
import type { ResponsiveColumn } from "@/components/shared/ResponsiveTable";

/**
 * Format payment terms based on number of days
 */
function formatPaymentTerms(days: number | null | undefined): string {
    if (!days || days <= 0) return "Due on Receipt";
    if (days === 15) return "Net 15";
    if (days === 30) return "Net 30";
    if (days === 45) return "Net 45";
    if (days === 60) return "Net 60";
    if (days === 90) return "Net 90";
    return `Net ${days}`;
}

/**
 * Calculate days until due or days overdue
 */
function calculateDueDateInfo(dueDate: string): { daysRemaining: number; isOverdue: boolean } {
    const now = new Date();
    const due = new Date(dueDate);
    const daysRemaining = differenceInDays(due, now);
    return {
        daysRemaining,
        isOverdue: daysRemaining < 0,
    };
}

interface GenerateInvoicePDFOptions {
    invoice: CRMInvoice;
    settings: CRMSettings | null | undefined;
}

/**
 * Generate a professional invoice PDF with tenant branding, line items, and payment terms
 */
async function generateEnhancedInvoicePDF({ invoice, settings }: GenerateInvoicePDFOptions): Promise<void> {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPosition = margin;

    // Brand color (defaults to a professional blue if not set)
    const brandColor = { r: 16, g: 185, b: 129 }; // Default green (#10b981)

    // Helper to add logo from URL
    const addLogo = async (logoUrl: string, x: number, y: number, maxWidth: number, maxHeight: number): Promise<number> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        resolve(0);
                        return;
                    }

                    // Calculate dimensions maintaining aspect ratio
                    let width = img.width;
                    let height = img.height;
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;

                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    const dataUrl = canvas.toDataURL("image/png");
                    doc.addImage(dataUrl, "PNG", x, y, width, height);
                    resolve(height);
                } catch {
                    resolve(0);
                }
            };
            img.onerror = () => resolve(0);
            img.src = logoUrl;
        });
    };

    // Add logo if available
    if (settings?.logo_url) {
        const logoHeight = await addLogo(settings.logo_url, margin, yPosition, 40, 20);
        if (logoHeight > 0) {
            yPosition += logoHeight + 5;
        }
    }

    // Header with brand color
    doc.setFillColor(brandColor.r, brandColor.g, brandColor.b);
    doc.rect(0, 0, pageWidth, 8, "F");

    // Invoice Title
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("INVOICE", pageWidth - margin, yPosition, { align: "right" });
    yPosition += 12;

    // Company Information (right side)
    const companyName = settings?.company_name || "Your Company";
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(companyName, pageWidth - margin, yPosition, { align: "right" });
    yPosition += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    if (settings?.company_address) {
        const addressLines = doc.splitTextToSize(settings.company_address, 70);
        doc.text(addressLines, pageWidth - margin, yPosition, { align: "right" });
        yPosition += addressLines.length * 4;
    }

    if (settings?.company_email) {
        doc.text(settings.company_email, pageWidth - margin, yPosition, { align: "right" });
        yPosition += 4;
    }

    if (settings?.company_phone) {
        doc.text(settings.company_phone, pageWidth - margin, yPosition, { align: "right" });
        yPosition += 4;
    }

    yPosition = Math.max(yPosition, 60); // Ensure minimum spacing

    // Invoice Details Box
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, yPosition, contentWidth / 2 - 5, 35, 2, 2, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("Invoice Details", margin + 5, yPosition + 8);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice #: ${invoice.invoice_number}`, margin + 5, yPosition + 16);
    doc.text(`Issue Date: ${format(new Date(invoice.invoice_date), "MMM d, yyyy")}`, margin + 5, yPosition + 22);
    doc.text(`Due Date: ${format(new Date(invoice.due_date), "MMM d, yyyy")}`, margin + 5, yPosition + 28);

    // Payment Terms
    const paymentTerms = formatPaymentTerms(settings?.default_payment_terms);
    doc.text(`Terms: ${paymentTerms}`, margin + 5, yPosition + 34);

    // Bill To Box
    const billToX = margin + contentWidth / 2 + 5;
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(billToX, yPosition, contentWidth / 2 - 5, 35, 2, 2, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To", billToX + 5, yPosition + 8);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const clientName = invoice.client?.name || "Unknown Client";
    doc.text(clientName, billToX + 5, yPosition + 16);

    if (invoice.client?.email) {
        doc.text(invoice.client.email, billToX + 5, yPosition + 22);
    }
    if (invoice.client?.phone) {
        doc.text(invoice.client.phone, billToX + 5, yPosition + 28);
    }

    yPosition += 45;

    // Status Badge
    const statusColors: Record<string, { r: number; g: number; b: number }> = {
        paid: { r: 34, g: 197, b: 94 },
        sent: { r: 59, g: 130, b: 246 },
        draft: { r: 156, g: 163, b: 175 },
        overdue: { r: 239, g: 68, b: 68 },
        cancelled: { r: 107, g: 114, b: 128 },
    };
    const statusColor = statusColors[invoice.status] || statusColors.draft;

    doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
    const statusText = invoice.status.toUpperCase();
    const statusWidth = doc.getTextWidth(statusText) + 8;
    doc.roundedRect(margin, yPosition, statusWidth, 7, 1, 1, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(statusText, margin + 4, yPosition + 5);

    yPosition += 15;

    // Line Items Table
    const colWidths = {
        item: contentWidth * 0.4,
        qty: contentWidth * 0.15,
        price: contentWidth * 0.2,
        total: contentWidth * 0.25,
    };

    // Table Header
    doc.setFillColor(brandColor.r, brandColor.g, brandColor.b);
    doc.rect(margin, yPosition, contentWidth, 8, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Item", margin + 3, yPosition + 5.5);
    doc.text("Qty", margin + colWidths.item + 3, yPosition + 5.5);
    doc.text("Unit Price", margin + colWidths.item + colWidths.qty + 3, yPosition + 5.5);
    doc.text("Total", margin + colWidths.item + colWidths.qty + colWidths.price + 3, yPosition + 5.5);

    yPosition += 10;

    // Table Rows
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "normal");

    const lineItems = invoice.line_items ?? [];
    let rowIndex = 0;

    for (const item of lineItems) {
        // Check if we need a new page
        if (yPosition > 250) {
            doc.addPage();
            yPosition = margin;

            // Re-add header on new page
            doc.setFillColor(brandColor.r, brandColor.g, brandColor.b);
            doc.rect(margin, yPosition, contentWidth, 8, "F");
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text("Item", margin + 3, yPosition + 5.5);
            doc.text("Qty", margin + colWidths.item + 3, yPosition + 5.5);
            doc.text("Unit Price", margin + colWidths.item + colWidths.qty + 3, yPosition + 5.5);
            doc.text("Total", margin + colWidths.item + colWidths.qty + colWidths.price + 3, yPosition + 5.5);
            yPosition += 10;
            doc.setTextColor(50, 50, 50);
            doc.setFont("helvetica", "normal");
        }

        // Alternating row background
        if (rowIndex % 2 === 0) {
            doc.setFillColor(248, 249, 250);
            doc.rect(margin, yPosition - 3, contentWidth, 8, "F");
        }

        const itemName = item.product_name || item.description || "Item";
        const itemLines = doc.splitTextToSize(itemName, colWidths.item - 6);
        doc.text(itemLines, margin + 3, yPosition + 2);

        doc.text(String(item.quantity), margin + colWidths.item + 3, yPosition + 2);
        doc.text(formatCurrency(item.unit_price), margin + colWidths.item + colWidths.qty + 3, yPosition + 2);
        doc.text(formatCurrency(item.line_total), margin + colWidths.item + colWidths.qty + colWidths.price + 3, yPosition + 2);

        yPosition += Math.max(itemLines.length * 5, 8);
        rowIndex++;
    }

    // If no line items, show a message
    if (lineItems.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text("No line items", margin + 3, yPosition + 2);
        yPosition += 8;
    }

    yPosition += 5;

    // Totals Section
    const totalsX = margin + colWidths.item + colWidths.qty;

    // Subtotal
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Subtotal:", totalsX, yPosition);
    doc.text(formatCurrency(invoice.subtotal), pageWidth - margin, yPosition, { align: "right" });
    yPosition += 6;

    // Tax
    if (invoice.tax_amount > 0 || invoice.tax > 0) {
        const taxAmount = invoice.tax_amount || invoice.tax;
        const taxRate = invoice.tax_rate ? ` (${invoice.tax_rate}%)` : "";
        doc.text(`Tax${taxRate}:`, totalsX, yPosition);
        doc.text(formatCurrency(taxAmount), pageWidth - margin, yPosition, { align: "right" });
        yPosition += 6;
    }

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(totalsX, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    // Total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("Total:", totalsX, yPosition);
    doc.setTextColor(brandColor.r, brandColor.g, brandColor.b);
    doc.text(formatCurrency(invoice.total), pageWidth - margin, yPosition, { align: "right" });
    yPosition += 10;

    // Partial payment indicator
    const amountPaid = invoice.amount_paid ?? 0;
    if (amountPaid > 0) {
        const balanceDue = Math.max(0, invoice.total - amountPaid);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(34, 197, 94); // Green
        doc.text("Amount Paid:", totalsX, yPosition);
        doc.text(formatCurrency(amountPaid), pageWidth - margin, yPosition, { align: "right" });
        yPosition += 6;

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(totalsX, yPosition, pageWidth - margin, yPosition);
        yPosition += 6;

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(balanceDue > 0 ? 239 : 34, balanceDue > 0 ? 68 : 197, balanceDue > 0 ? 68 : 94);
        doc.text("Amount Due:", totalsX, yPosition);
        doc.text(formatCurrency(balanceDue), pageWidth - margin, yPosition, { align: "right" });
        yPosition += 10;
    } else {
        yPosition += 5;
    }

    // Due Date Info
    const dueDateInfo = calculateDueDateInfo(invoice.due_date);
    if (invoice.status !== "paid" && invoice.status !== "cancelled") {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        if (dueDateInfo.isOverdue) {
            doc.setTextColor(239, 68, 68);
            doc.text(`OVERDUE by ${Math.abs(dueDateInfo.daysRemaining)} days`, margin, yPosition);
        } else if (dueDateInfo.daysRemaining <= 7) {
            doc.setTextColor(245, 158, 11);
            doc.text(`Due in ${dueDateInfo.daysRemaining} days`, margin, yPosition);
        }
        yPosition += 8;
    }

    // Notes
    if (invoice.notes) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(50, 50, 50);
        doc.text("Notes:", margin, yPosition);
        yPosition += 5;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const noteLines = doc.splitTextToSize(invoice.notes, contentWidth);
        doc.text(noteLines, margin, yPosition);
        yPosition += noteLines.length * 4 + 5;
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();

        // Footer line
        doc.setDrawColor(brandColor.r, brandColor.g, brandColor.b);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

        // Thank you message
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 10, { align: "center" });

        // Page number
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    }

    // Save the PDF
    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
}

import { useAsyncAction } from "@/hooks/useAsyncAction";

function InvoicesPageSkeleton() {
    return (
        <div className="space-y-4 p-4 pb-16">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-36" />
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-4 rounded" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-7 w-24 mb-1" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Table Card */}
            <Card>
                <CardHeader className="p-4">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                        <Skeleton className="h-10 flex-1" />
                        <Skeleton className="h-10 w-full md:w-40" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Mobile skeletons */}
                    <div className="md:hidden divide-y">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-4 space-y-3">
                                <div className="flex justify-between">
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="space-y-1">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-20" />
                                    </div>
                                    <Skeleton className="h-6 w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Desktop table skeletons */}
                    <div className="hidden md:block">
                        <div className="grid grid-cols-9 gap-4 p-3 border-b bg-muted/50">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-14" />
                            <Skeleton className="h-4 w-10" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-16 ml-auto" />
                            <Skeleton className="h-4 w-12 ml-auto" />
                            <Skeleton className="h-4 w-16 ml-auto" />
                            <Skeleton className="h-4 w-14" />
                            <Skeleton className="h-4 w-14 ml-auto" />
                        </div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-9 gap-4 p-3 border-b last:border-b-0 items-center">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-16 ml-auto" />
                                <Skeleton className="h-4 w-14 ml-auto" />
                                <Skeleton className="h-4 w-16 ml-auto" />
                                <Skeleton className="h-5 w-16 rounded-full" />
                                <Skeleton className="h-8 w-8 ml-auto rounded" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function InvoicesPage() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [sort, setSort] = useState<InvoiceSortState>({ column: 'created_at', ascending: false });
    const [voidDialogOpen, setVoidDialogOpen] = useState(false);
    const [invoiceToVoid, setInvoiceToVoid] = useState<{ id: string; number: string } | null>(null);

    const { useInvoicesQuery, useMarkInvoicePaid, useMarkInvoiceSent, useVoidInvoice, useDuplicateInvoice } = useInvoices();
    const { data: invoices, isLoading } = useInvoicesQuery(sort);
    const markAsPaid = useMarkInvoicePaid();
    const markAsSent = useMarkInvoiceSent();
    const voidInvoice = useVoidInvoice();
    const duplicateInvoice = useDuplicateInvoice();
    const { data: crmSettings } = useCRMSettings();
    const mod = useModifierKey();

    const filteredInvoices = (() => {
        const sanitizedSearch = sanitizeSearchInput(searchQuery).toLowerCase();
        const filtered = invoices?.filter((invoice) => {
            const matchesSearch =
                !sanitizedSearch ||
                invoice.invoice_number.toLowerCase().includes(sanitizedSearch) ||
                (invoice.client?.name || "").toLowerCase().includes(sanitizedSearch);

            const isOverdue = invoice.due_date
                && new Date(invoice.due_date) < new Date()
                && ['sent', 'partially_paid'].includes(invoice.status);

            const matchesStatus = statusFilter
                ? (statusFilter === 'overdue' ? isOverdue : invoice.status === statusFilter)
                : true;

            return matchesSearch && matchesStatus;
        }) ?? [];

        // Client-side sort for computed 'balance' column
        if (sort?.column === 'balance') {
            return [...filtered].sort((a, b) => {
                const balanceA = a.total - (a.amount_paid ?? 0);
                const balanceB = b.total - (b.amount_paid ?? 0);
                return sort.ascending ? balanceA - balanceB : balanceB - balanceA;
            });
        }

        return filtered;
    })();

    // Pagination
    const {
        paginatedItems: paginatedInvoices,
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        goToPage,
        changePageSize,
        pageSizeOptions,
    } = usePagination(filteredInvoices, {
        defaultPageSize: 20,
        persistInUrl: true,
        urlKey: 'invoices',
    });

    const handleMarkAsPaid = useAsyncAction(async (id: string) => {
        await markAsPaid.mutateAsync(id);
    }, {
        successMessage: "Invoice marked as paid",
        errorMessage: "Failed to update invoice"
    });

    const handleMarkAsSent = useAsyncAction(async (id: string) => {
        await markAsSent.mutateAsync(id);
    }, {
        successMessage: "Invoice marked as sent",
        errorMessage: "Failed to update invoice"
    });

    const handleVoidInvoice = useAsyncAction(async (id: string) => {
        await voidInvoice.mutateAsync(id);
    }, {
        successMessage: "Invoice voided",
        errorMessage: "Failed to void invoice"
    });

    const handleDuplicateInvoice = useAsyncAction(async (id: string) => {
        const newInvoice = await duplicateInvoice.mutateAsync(id);
        navigate(`/${tenantSlug}/admin/crm/invoices/${newInvoice.id}`);
    }, {
        successMessage: "Invoice duplicated",
        errorMessage: "Failed to duplicate invoice"
    });

    const handleDownloadPDF = useCallback(async (invoice: CRMInvoice) => {
        if (isGeneratingPDF) return;

        setIsGeneratingPDF(true);
        try {
            await generateEnhancedInvoicePDF({
                invoice,
                settings: crmSettings,
            });
            toast.success("PDF downloaded successfully");
        } catch (error) {
            logger.error("PDF generation failed:", error instanceof Error ? error : new Error(String(error)), { component: 'InvoicesPage' });
            toast.error("Failed to generate PDF");
        } finally {
            setIsGeneratingPDF(false);
        }
    }, [crmSettings, isGeneratingPDF]);

    // Show full-page skeleton during initial load
    if (isLoading && !invoices) {
        return <InvoicesPageSkeleton />;
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "paid":
                return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">Paid</Badge>;
            case "overdue":
                return <Badge variant="destructive">Overdue</Badge>;
            case "sent":
                return <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">Sent</Badge>;
            case "draft":
                return <Badge className="bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700">Draft</Badge>;
            case "partially_paid":
                return <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">Partially Paid</Badge>;
            case "cancelled":
            case "void":
                return <Badge className="bg-gray-900 text-white border-gray-900 dark:bg-gray-100/10 dark:text-gray-300 dark:border-gray-600">{status === "void" ? "Void" : "Cancelled"}</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const handleSort = (column: string) => {
        setSort((prev) => {
            if (prev?.column === column) {
                if (prev.ascending) return { column, ascending: false };
                return null;
            }
            return { column, ascending: true };
        });
    };

    const SortableHeader = ({ field, label }: { field: string; label: string }) => {
        const isActive = sort?.column === field;
        return (
            <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 hover:bg-transparent"
                onClick={() => handleSort(field)}
            >
                <span>{label}</span>
                {isActive ? (
                    sort.ascending ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />
                ) : (
                    <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
                )}
            </Button>
        );
    };

    // Calculate stats
    const totalRevenue = invoices
        ?.filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + i.total, 0) ?? 0;

    const outstandingAmount = invoices
        ?.filter((i) => i.status === "sent" || i.status === "overdue")
        .reduce((sum, i) => sum + i.total, 0) ?? 0;

    // Calculate paid this month
    const monthStart = startOfMonth(new Date());
    const paidThisMonth = invoices
        ?.filter((i) => i.status === "paid" && i.paid_at && isAfter(new Date(i.paid_at), monthStart))
        .reduce((sum, i) => sum + i.total, 0) ?? 0;

    const paidThisMonthCount = invoices
        ?.filter((i) => i.status === "paid" && i.paid_at && isAfter(new Date(i.paid_at), monthStart))
        .length ?? 0;

    // Calculate average payment time (days from invoice date to paid date)
    const paidInvoicesWithDates = invoices?.filter(
        (i) => i.status === "paid" && i.paid_at && i.invoice_date
    ) ?? [];

    const avgPaymentTime = paidInvoicesWithDates.length > 0
        ? Math.round(
            paidInvoicesWithDates.reduce((sum, i) => {
                const invoiceDate = new Date(i.invoice_date);
                const paidDate = new Date(i.paid_at!);
                return sum + differenceInDays(paidDate, invoiceDate);
            }, 0) / paidInvoicesWithDates.length
        )
        : 0;

    const invoiceColumns: ResponsiveColumn<CRMInvoice>[] = [
        {
            header: <SortableHeader field="invoice_number" label="Invoice #" />,
            accessorKey: "invoice_number",
            className: "sticky left-0 z-20 bg-background",
            cell: (invoice) => (
                <TruncatedText text={invoice.invoice_number} className="font-medium" maxWidthClass="max-w-[200px]" />
            )
        },
        {
            header: "Client",
            accessorKey: "client",
            cell: (invoice) => (
                <div className="max-w-[200px] min-w-0 overflow-hidden">
                    <CustomerLink
                        customerId={invoice.client_id}
                        customerName={invoice.client?.name || "Unknown Client"}
                    />
                </div>
            )
        },
        {
            header: <SortableHeader field="invoice_date" label="Date" />,
            accessorKey: "invoice_date",
            className: "hidden lg:table-cell",
            cell: (invoice) => format(new Date(invoice.invoice_date), "MMM d, yyyy")
        },
        {
            header: <SortableHeader field="due_date" label="Due Date" />,
            accessorKey: "due_date",
            cell: (invoice) => format(new Date(invoice.due_date), "MMM d, yyyy")
        },
        {
            header: <div className="text-right"><SortableHeader field="total" label="Amount" /></div>,
            accessorKey: "total",
            className: "text-right",
            cell: (invoice) => formatCurrency(invoice.total)
        },
        {
            header: <div className="text-right"><SortableHeader field="amount_paid" label="Paid" /></div>,
            accessorKey: "amount_paid",
            className: "text-right hidden lg:table-cell",
            cell: (invoice) => formatCurrency(invoice.amount_paid ?? 0)
        },
        {
            header: <div className="text-right"><SortableHeader field="balance" label="Balance" /></div>,
            accessorKey: "balance" as any,
            className: "text-right",
            cell: (invoice) => formatCurrency(invoice.total - (invoice.amount_paid ?? 0))
        },
        {
            header: <SortableHeader field="status" label="Status" />,
            accessorKey: "status",
            cell: (invoice) => (
                <div className="flex items-center gap-1.5">
                    {getStatusBadge(invoice.status)}
                    {invoice.due_date && new Date(invoice.due_date) < new Date() && ['sent', 'partially_paid'].includes(invoice.status) && (
                        <Badge variant="destructive">
                            Overdue ({differenceInDays(new Date(), new Date(invoice.due_date))}d)
                        </Badge>
                    )}
                </div>
            )
        },
        {
            header: <div className="text-right">Actions</div>,
            className: "text-right",
            cell: (invoice) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-11 w-11 p-0" onClick={(e) => e.stopPropagation()}>
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/${tenantSlug}/admin/crm/invoices/${invoice.id}`);
                        }}>
                            View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            const link = `${window.location.origin}/portal/invoice/${invoice.public_token}`;
                            navigator.clipboard.writeText(link);
                            toast.success("Invoice link copied to clipboard");
                        }}>
                            Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {invoice.status === "draft" && (
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsSent.execute(invoice.id);
                            }}>
                                <Send className="mr-2 h-4 w-4" />
                                Mark as Sent
                            </DropdownMenuItem>
                        )}
                        {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsPaid.execute(invoice.id);
                            }}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Paid
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPDF(invoice);
                        }}>
                            <FileText className="mr-2 h-4 w-4" />
                            Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateInvoice.execute(invoice.id);
                        }}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                        </DropdownMenuItem>
                        {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus-visible:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setInvoiceToVoid({ id: invoice.id, number: invoice.invoice_number });
                                        setVoidDialogOpen(true);
                                    }}
                                >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Void Invoice
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        }
    ];

    const renderMobileInvoice = (invoice: CRMInvoice) => (
        <div
            className="p-4 active:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => navigate(`/${tenantSlug}/admin/crm/invoices/${invoice.id}`)}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 flex-1 mr-2">
                    <TruncatedText text={invoice.invoice_number} className="font-semibold text-sm" maxWidthClass="max-w-[180px]" />
                    <div className="text-sm text-foreground/90 font-medium min-w-0 max-w-[180px] overflow-hidden">
                        <CustomerLink
                            customerId={invoice.client_id}
                            customerName={invoice.client?.name || "Unknown Client"}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {getStatusBadge(invoice.status)}
                    {invoice.due_date && new Date(invoice.due_date) < new Date() && ['sent', 'partially_paid'].includes(invoice.status) && (
                        <Badge variant="destructive">
                            Overdue ({differenceInDays(new Date(), new Date(invoice.due_date))}d)
                        </Badge>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-end">
                <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Due: {format(new Date(invoice.due_date), "MMM d, yyyy")}</p>
                    <p>{format(new Date(invoice.invoice_date), "MMM d")}</p>
                    {(invoice.amount_paid ?? 0) > 0 && (
                        <p className="text-yellow-600">Paid: {formatCurrency(invoice.amount_paid ?? 0)}</p>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className={`font-bold text-base ${invoice.status === 'paid' ? 'text-green-600' :
                                (invoice.due_date && new Date(invoice.due_date) < new Date() && ['sent', 'partially_paid'].includes(invoice.status)) ? 'text-red-600' :
                                    invoice.status === 'partially_paid' ? 'text-yellow-600' : ''
                            }`}>
                            {formatCurrency(invoice.total - (invoice.amount_paid ?? 0))}
                        </span>
                        {invoice.status === 'partially_paid' && (
                            <p className="text-xs text-muted-foreground">of {formatCurrency(invoice.total)}</p>
                        )}
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-11 w-11 -mr-2" onClick={(e) => e.stopPropagation()}>
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem className="py-3" onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/${tenantSlug}/admin/crm/invoices/${invoice.id}`);
                            }}>
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="py-3" onClick={(e) => {
                                e.stopPropagation();
                                const link = `${window.location.origin}/portal/invoice/${invoice.public_token}`;
                                navigator.clipboard.writeText(link);
                                toast.success("Invoice link copied");
                            }}>
                                Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {invoice.status === "draft" && (
                                <DropdownMenuItem className="py-3" onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsSent.execute(invoice.id);
                                }}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Mark as Sent
                                </DropdownMenuItem>
                            )}
                            {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                                <DropdownMenuItem className="py-3" onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsPaid.execute(invoice.id);
                                }}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Mark as Paid
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="py-3" onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadPDF(invoice);
                            }}>
                                <FileText className="mr-2 h-4 w-4" />
                                Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem className="py-3" onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateInvoice.execute(invoice.id);
                            }}>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                            </DropdownMenuItem>
                            {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="py-3 text-destructive focus-visible:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setInvoiceToVoid({ id: invoice.id, number: invoice.invoice_number });
                                            setVoidDialogOpen(true);
                                        }}
                                    >
                                        <Ban className="mr-2 h-4 w-4" />
                                        Void Invoice
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4 p-4 pb-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
                    <p className="text-muted-foreground">
                        Manage your invoices and track payments.
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">
                            From {invoices?.filter(i => i.status === 'paid').length ?? 0} paid invoices
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Paid This Month</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(paidThisMonth)}</div>
                        <p className="text-xs text-muted-foreground">
                            {paidThisMonthCount} invoices paid
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(outstandingAmount)}</div>
                        <p className="text-xs text-muted-foreground">
                            {invoices?.filter(i => i.status === 'sent').length ?? 0} sent, {invoices?.filter(i => i.status === 'overdue').length ?? 0} overdue
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Payment Time</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{avgPaymentTime} days</div>
                        <p className="text-xs text-muted-foreground">
                            Based on {paidInvoicesWithDates.length} paid invoices
                        </p>
                    </CardContent>
                </Card>
            </div>

            <AdminToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search invoices..."
                actions={
                    <ShortcutHint keys={[mod, "N"]} label="New">
                        <Button onClick={() => navigate(`/${tenantSlug}/admin/crm/invoices/new`)}>
                            <Plus className="mr-2 h-4 w-4" /> Create Invoice
                        </Button>
                    </ShortcutHint>
                }
                filters={
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2 w-full md:w-auto justify-center">
                                <Filter className="h-4 w-4" />
                                Filter: {statusFilter ? statusFilter.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : "All"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[200px]">
                            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter(null)}>
                                All Statuses
                            </DropdownMenuItem>
                            <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("draft")}>
                                Draft
                            </DropdownMenuItem>
                            <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("sent")}>
                                Sent
                            </DropdownMenuItem>
                            <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("paid")}>
                                Paid
                            </DropdownMenuItem>
                            <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("partially_paid")}>
                                Partially Paid
                            </DropdownMenuItem>
                            <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("overdue")}>
                                Overdue
                            </DropdownMenuItem>
                            <DropdownMenuItem className="py-3 md:py-1.5" onClick={() => setStatusFilter("cancelled")}>
                                Cancelled
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                }
            />

            <AdminDataTable
                data={paginatedInvoices as CRMInvoice[]}
                keyExtractor={(invoice) => invoice.id}
                isLoading={isLoading}
                columns={invoiceColumns}
                renderMobileItem={renderMobileInvoice}
                emptyStateIcon={FileText}
                emptyStateTitle={searchQuery || statusFilter ? "No invoices found" : "No invoices yet"}
                emptyStateDescription={searchQuery || statusFilter ? "Try adjusting your search or filters." : "Create invoices to track payments from wholesale clients"}
                emptyStateAction={searchQuery || statusFilter ? {
                    label: "Clear Filters",
                    onClick: () => { setSearchQuery(""); setStatusFilter(null); },
                } : {
                    label: "Create Invoice",
                    onClick: () => navigate(`/${tenantSlug}/admin/crm/invoices/new`),
                    icon: Plus
                }}
            />

            {totalItems > 0 && (
                <div className="p-4 border-t bg-card rounded-b-lg">
                    <StandardPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        onPageChange={goToPage}
                        onPageSizeChange={changePageSize}
                        pageSizeOptions={pageSizeOptions}
                    />
                </div>
            )}

            <ConfirmDialog
                isOpen={voidDialogOpen}
                onConfirm={() => {
                    if (invoiceToVoid) {
                        handleVoidInvoice.execute(invoiceToVoid.id);
                    }
                    setVoidDialogOpen(false);
                    setInvoiceToVoid(null);
                }}
                onCancel={() => {
                    setVoidDialogOpen(false);
                    setInvoiceToVoid(null);
                }}
                title="Void Invoice"
                description={`Are you sure you want to void invoice ${invoiceToVoid?.number ?? ""}? This action cannot be undone.`}
                confirmLabel="Void Invoice"
                variant="destructive"
            />
        </div>
    );
}

