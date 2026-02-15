/**
 * Vendor Document Manager Component
 *
 * Upload and manage vendor documents including contracts, licenses, lab results,
 * certificates, and pricing sheets. Features:
 * - Document upload with categorization
 * - Expiration date tracking with notifications
 * - Search and filter functionality
 * - Documents linked to vendor for compliance checks
 */

import { useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FileText,
  Upload,
  Plus,
  Loader2,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  X,
  Filter,
  Calendar,
  Download,
  ExternalLink,
  AlertTriangle,
  Clock,
  User,
  File,
  FileCheck,
  ShieldCheck,
  Receipt,
  Award,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  useVendorDocuments,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_OPTIONS,
  type VendorDocument,
  type DocumentCategory,
} from '@/hooks/useVendorDocuments';
import { logger } from '@/lib/logger';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { formatFileSize } from '@/lib/fileValidation';

// ============================================================================
// Types & Schema
// ============================================================================

interface VendorDocumentManagerProps {
  vendorId: string;
  vendorName: string;
}

const documentFormSchema = z.object({
  category: z.enum(['contract', 'license', 'lab_result', 'certificate', 'pricing_sheet', 'insurance', 'other']),
  name: z.string().min(1, 'Document name is required'),
  expiration_date: z.string().optional(),
  notes: z.string().optional(),
});

type DocumentFormValues = z.infer<typeof documentFormSchema>;

// ============================================================================
// Icon Map
// ============================================================================

const CATEGORY_ICONS: Record<DocumentCategory, React.ElementType> = {
  contract: FileText,
  license: ShieldCheck,
  lab_result: FileCheck,
  certificate: Award,
  pricing_sheet: Receipt,
  insurance: ShieldAlert,
  other: HelpCircle,
};

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  contract: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  license: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  lab_result: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  certificate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pricing_sheet: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  insurance: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

// ============================================================================
// Main Component
// ============================================================================

export function VendorDocumentManager({ vendorId, vendorName }: VendorDocumentManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<VendorDocument | null>(null);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    filteredDocuments,
    expiringDocuments,
    expiredDocuments,
    isLoading,
    isError,
    filters,
    updateFilters,
    clearFilters,
    createDocument,
    updateDocument,
    deleteDocument,
    isCreating,
    isUpdating,
    isDeleting,
  } = useVendorDocuments(vendorId);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      category: 'other',
      name: '',
      expiration_date: '',
      notes: '',
    },
  });

  // Handle dialog open for create
  const handleAddDocument = useCallback(() => {
    setEditingDocument(null);
    setSelectedFile(null);
    setFileError(null);
    form.reset({
      category: 'other',
      name: '',
      expiration_date: '',
      notes: '',
    });
    setIsDialogOpen(true);
  }, [form]);

  // Handle dialog open for edit
  const handleEditDocument = useCallback((document: VendorDocument) => {
    setEditingDocument(document);
    setSelectedFile(null);
    setFileError(null);
    form.reset({
      category: document.category,
      name: document.name,
      expiration_date: document.expiration_date ? document.expiration_date.split('T')[0] : '',
      notes: document.notes ?? '',
    });
    setIsDialogOpen(true);
  }, [form]);

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFileError(null);

    if (file) {
      // Basic validation - more validation happens on upload
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        setFileError(`File size exceeds maximum of ${formatFileSize(maxSize)}`);
        e.target.value = '';
        return;
      }

      setSelectedFile(file);
      // Auto-fill name if empty
      if (!form.getValues('name')) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        form.setValue('name', nameWithoutExt);
      }
    }
  }, [form]);

  // Handle form submit
  const handleSubmit = async (values: DocumentFormValues) => {
    try {
      if (editingDocument) {
        await updateDocument({
          id: editingDocument.id,
          category: values.category,
          name: values.name,
          expiration_date: values.expiration_date || null,
          notes: values.notes || null,
        });
        toast.success('Document updated successfully');
      } else {
        if (!selectedFile) {
          setFileError('Please select a file to upload');
          return;
        }

        await createDocument({
          vendor_id: vendorId,
          category: values.category,
          name: values.name,
          file: selectedFile,
          expiration_date: values.expiration_date || undefined,
          notes: values.notes || undefined,
        });
        toast.success('Document uploaded successfully');
      }
      setIsDialogOpen(false);
      setSelectedFile(null);
      form.reset();
    } catch (error) {
      logger.error('Failed to save document', error, { component: 'VendorDocumentManager' });
      toast.error(editingDocument ? 'Failed to update document' : 'Failed to upload document');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteDocumentId) return;
    try {
      await deleteDocument(deleteDocumentId);
      toast.success('Document deleted successfully');
      setDeleteDocumentId(null);
    } catch (error) {
      logger.error('Failed to delete document', error, { component: 'VendorDocumentManager' });
      toast.error('Failed to delete document');
    }
  };

  // Check if any filters are active
  const hasActiveFilters = !!(filters.category || filters.expiringWithinDays !== undefined || filters.searchQuery);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card>
        <CardContent className="p-6">
          <EnhancedEmptyState
            icon={FileText}
            title="Failed to load documents"
            description="There was an error loading vendor documents. Please try again."
            primaryAction={{
              label: 'Retry',
              onClick: () => window.location.reload(),
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Expiration Alerts */}
        {expiredDocuments.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Expired Documents</AlertTitle>
            <AlertDescription>
              {expiredDocuments.length} document{expiredDocuments.length > 1 ? 's have' : ' has'} expired
              and may need to be renewed: {expiredDocuments.map(d => d.name).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {expiringDocuments.length > 0 && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Documents Expiring Soon</AlertTitle>
            <AlertDescription>
              {expiringDocuments.length} document{expiringDocuments.length > 1 ? 's are' : ' is'} expiring
              within the next 30 days: {expiringDocuments.map(d => d.name).join(', ')}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents
              </CardTitle>
              <CardDescription>
                Manage documents for {vendorName}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={hasActiveFilters ? 'border-primary' : ''}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">
                    Active
                  </Badge>
                )}
              </Button>
              <Button onClick={handleAddDocument} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            {showFilters && (
              <div className="mb-6 rounded-lg border bg-muted/50 p-4">
                <div className="flex flex-wrap items-end gap-4">
                  {/* Search */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium mb-1.5 block">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search documents..."
                        value={filters.searchQuery ?? ''}
                        onChange={(e) => updateFilters({ searchQuery: e.target.value })}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div className="w-[180px]">
                    <label className="text-sm font-medium mb-1.5 block">Category</label>
                    <Select
                      value={filters.category ?? 'all'}
                      onValueChange={(value) =>
                        updateFilters({ category: value === 'all' ? undefined : (value as DocumentCategory) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Expiring Filter */}
                  <div className="w-[180px]">
                    <label className="text-sm font-medium mb-1.5 block">Expiration</label>
                    <Select
                      value={filters.expiringWithinDays?.toString() ?? 'all'}
                      onValueChange={(value) =>
                        updateFilters({ expiringWithinDays: value === 'all' ? undefined : parseInt(value, 10) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Documents" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Documents</SelectItem>
                        <SelectItem value="7">Expiring in 7 days</SelectItem>
                        <SelectItem value="30">Expiring in 30 days</SelectItem>
                        <SelectItem value="60">Expiring in 60 days</SelectItem>
                        <SelectItem value="90">Expiring in 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters */}
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Documents Grid */}
            {filteredDocuments.length === 0 ? (
              <EnhancedEmptyState
                icon={FileText}
                title={hasActiveFilters ? 'No matching documents' : 'No documents yet'}
                description={
                  hasActiveFilters
                    ? "Try adjusting your filters to find what you're looking for."
                    : 'Upload your first document to start tracking vendor documentation.'
                }
                primaryAction={
                  hasActiveFilters
                    ? {
                        label: 'Clear Filters',
                        onClick: clearFilters,
                      }
                    : {
                        label: 'Upload Document',
                        onClick: handleAddDocument,
                      }
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDocuments.map((document) => (
                  <DocumentCard
                    key={document.id}
                    document={document}
                    onEdit={() => handleEditDocument(document)}
                    onDelete={() => setDeleteDocumentId(document.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Document Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDocument ? 'Edit Document' : 'Upload Document'}
            </DialogTitle>
            <DialogDescription>
              {editingDocument
                ? 'Update document details.'
                : 'Upload a new document for this vendor.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* File Upload - Only show for new documents */}
              {!editingDocument && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    File <span className="text-destructive">*</span>
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-primary ${
                      fileError ? 'border-destructive' : selectedFile ? 'border-green-500' : ''
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={handleFileChange}
                    />
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <File className="h-6 w-6 text-green-500" />
                        <div className="text-left">
                          <p className="font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click to select a file or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PDF, JPEG, or PNG (max 25MB)
                        </p>
                      </>
                    )}
                  </div>
                  {fileError && (
                    <p className="text-sm text-destructive">{fileError}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DOCUMENT_CATEGORY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiration_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiration Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., License 2024" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about this document..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating || isUpdating}>
                  {(isCreating || isUpdating) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingDocument ? 'Save Changes' : 'Upload Document'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDocumentId} onOpenChange={() => setDeleteDocumentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This will also remove the file from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// Document Card Sub-component
// ============================================================================

interface DocumentCardProps {
  document: VendorDocument;
  onEdit: () => void;
  onDelete: () => void;
}

function DocumentCard({ document, onEdit, onDelete }: DocumentCardProps) {
  const Icon = CATEGORY_ICONS[document.category];
  const colorClass = CATEGORY_COLORS[document.category];

  // Calculate expiration status
  const getExpirationStatus = () => {
    if (!document.expiration_date) return null;

    const expDate = new Date(document.expiration_date);
    const today = new Date();
    const daysUntil = differenceInDays(expDate, today);

    if (daysUntil < 0) {
      return { status: 'expired', variant: 'destructive' as const, label: 'Expired' };
    } else if (daysUntil <= 7) {
      return { status: 'expiring-soon', variant: 'destructive' as const, label: `Expires in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}` };
    } else if (daysUntil <= 30) {
      return { status: 'expiring', variant: 'warning' as const, label: `Expires in ${daysUntil} days` };
    }
    return null;
  };

  const expirationStatus = getExpirationStatus();

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium truncate">{document.name}</h4>
            <Badge variant="outline" className="text-xs mt-0.5">
              {DOCUMENT_CATEGORY_LABELS[document.category]}
            </Badge>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a
                href={document.file_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={document.file_url} download={document.name}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Expiration Warning */}
      {expirationStatus && (
        <Badge variant={expirationStatus.variant === 'warning' ? 'destructive' : expirationStatus.variant} className="text-xs">
          <AlertTriangle className="mr-1 h-3 w-3" />
          {expirationStatus.label}
        </Badge>
      )}

      {/* Notes preview */}
      {document.notes && (
        <p className="text-sm text-muted-foreground line-clamp-2">{document.notes}</p>
      )}

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-3">
        <span className="flex items-center gap-1">
          <File className="h-3 w-3" />
          {formatFileSize(document.file_size)}
        </span>

        {document.expiration_date && !expirationStatus && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Expires {format(new Date(document.expiration_date), 'MMM d, yyyy')}
          </span>
        )}

        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
        </span>

        {document.uploaded_by_name && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {document.uploaded_by_name}
          </span>
        )}
      </div>
    </div>
  );
}
