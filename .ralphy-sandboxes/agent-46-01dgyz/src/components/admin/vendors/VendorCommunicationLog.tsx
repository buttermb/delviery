/**
 * Vendor Communication Log Component
 *
 * Displays a timeline of all communications with a vendor.
 * Features:
 * - Add/edit/delete communication entries
 * - Filter by type and date range
 * - Search functionality
 * - Link POs to communication entries
 * - Timeline view with icons per communication type
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, formatDistanceToNow } from 'date-fns';

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
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
  Plus,
  Loader2,
  MoreVertical,
  Edit,
  Trash2,
  Search,
  X,
  Filter,
  Clock,
  User,
  Package,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  useVendorCommunications,
  useVendorPurchaseOrders,
  COMMUNICATION_TYPE_LABELS,
  COMMUNICATION_TYPE_OPTIONS,
  type VendorCommunicationLog,
  type CommunicationType,
} from '@/hooks/useVendorCommunications';
import { logger } from '@/lib/logger';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

// ============================================================================
// Types & Schema
// ============================================================================

interface VendorCommunicationLogProps {
  vendorId: string;
  vendorName: string;
}

const communicationFormSchema = z.object({
  communication_type: z.enum(['call', 'email', 'meeting', 'note', 'other']),
  subject: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  purchase_order_id: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  communication_date: z.string().optional(),
});

type CommunicationFormValues = z.infer<typeof communicationFormSchema>;

// ============================================================================
// Icon Map
// ============================================================================

const COMMUNICATION_ICONS: Record<CommunicationType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  other: HelpCircle,
};

const COMMUNICATION_COLORS: Record<CommunicationType, string> = {
  call: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  meeting: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  note: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

// ============================================================================
// Main Component
// ============================================================================

export function VendorCommunicationLog({ vendorId, vendorName }: VendorCommunicationLogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCommunication, setEditingCommunication] = useState<VendorCommunicationLog | null>(null);
  const [deleteCommunicationId, setDeleteCommunicationId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const {
    filteredCommunications,
    isLoading,
    isError,
    filters,
    updateFilters,
    clearFilters,
    createCommunication,
    updateCommunication,
    deleteCommunication,
    isCreating,
    isUpdating,
    isDeleting,
  } = useVendorCommunications(vendorId);

  const { data: purchaseOrders, isLoading: isLoadingPOs } = useVendorPurchaseOrders(vendorId);

  const form = useForm<CommunicationFormValues>({
    resolver: zodResolver(communicationFormSchema),
    defaultValues: {
      communication_type: 'note',
      subject: '',
      content: '',
      purchase_order_id: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      communication_date: new Date().toISOString().split('T')[0],
    },
  });

  // Handle dialog open for create
  const handleAddCommunication = useCallback(() => {
    setEditingCommunication(null);
    form.reset({
      communication_type: 'note',
      subject: '',
      content: '',
      purchase_order_id: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      communication_date: new Date().toISOString().split('T')[0],
    });
    setIsDialogOpen(true);
  }, [form]);

  // Handle dialog open for edit
  const handleEditCommunication = useCallback((communication: VendorCommunicationLog) => {
    setEditingCommunication(communication);
    form.reset({
      communication_type: communication.communication_type,
      subject: communication.subject ?? '',
      content: communication.content,
      purchase_order_id: communication.purchase_order_id ?? '',
      contact_name: communication.contact_name ?? '',
      contact_email: communication.contact_email ?? '',
      contact_phone: communication.contact_phone ?? '',
      communication_date: communication.communication_date.split('T')[0],
    });
    setIsDialogOpen(true);
  }, [form]);

  // Handle form submit
  const handleSubmit = async (values: CommunicationFormValues) => {
    try {
      if (editingCommunication) {
        await updateCommunication({
          id: editingCommunication.id,
          communication_type: values.communication_type,
          subject: values.subject || undefined,
          content: values.content,
          purchase_order_id: values.purchase_order_id || null,
          contact_name: values.contact_name || undefined,
          contact_email: values.contact_email || undefined,
          contact_phone: values.contact_phone || undefined,
          communication_date: values.communication_date
            ? new Date(values.communication_date).toISOString()
            : undefined,
        });
        toast.success('Communication updated successfully');
      } else {
        await createCommunication({
          vendor_id: vendorId,
          communication_type: values.communication_type,
          subject: values.subject || undefined,
          content: values.content,
          purchase_order_id: values.purchase_order_id || undefined,
          contact_name: values.contact_name || undefined,
          contact_email: values.contact_email || undefined,
          contact_phone: values.contact_phone || undefined,
          communication_date: values.communication_date
            ? new Date(values.communication_date).toISOString()
            : undefined,
        });
        toast.success('Communication logged successfully');
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      logger.error('Failed to save communication', error, { component: 'VendorCommunicationLog' });
      toast.error(editingCommunication ? 'Failed to update communication' : 'Failed to log communication');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteCommunicationId) return;
    try {
      await deleteCommunication(deleteCommunicationId);
      toast.success('Communication deleted successfully');
      setDeleteCommunicationId(null);
    } catch (error) {
      logger.error('Failed to delete communication', error, { component: 'VendorCommunicationLog' });
      toast.error('Failed to delete communication');
    }
  };

  // Check if any filters are active
  const hasActiveFilters = !!(filters.type || filters.startDate || filters.endDate || filters.searchQuery);

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
            icon={MessageSquare}
            title="Failed to load communications"
            description="There was an error loading vendor communications. Please try again."
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Communication Log
            </CardTitle>
            <CardDescription>
              Track all communications with {vendorName}
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
            <Button onClick={handleAddCommunication} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Log Communication
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
                      placeholder="Search content, subject, or contact..."
                      value={filters.searchQuery ?? ''}
                      onChange={(e) => updateFilters({ searchQuery: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Type Filter */}
                <div className="w-[160px]">
                  <label className="text-sm font-medium mb-1.5 block">Type</label>
                  <Select
                    value={filters.type ?? 'all'}
                    onValueChange={(value) =>
                      updateFilters({ type: value === 'all' ? undefined : (value as CommunicationType) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {COMMUNICATION_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div className="w-[160px]">
                  <label className="text-sm font-medium mb-1.5 block">From</label>
                  <Input
                    type="date"
                    value={filters.startDate ?? ''}
                    onChange={(e) => updateFilters({ startDate: e.target.value || undefined })}
                  />
                </div>

                {/* End Date */}
                <div className="w-[160px]">
                  <label className="text-sm font-medium mb-1.5 block">To</label>
                  <Input
                    type="date"
                    value={filters.endDate ?? ''}
                    onChange={(e) => updateFilters({ endDate: e.target.value || undefined })}
                  />
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

          {/* Timeline */}
          {filteredCommunications.length === 0 ? (
            <EnhancedEmptyState
              icon={MessageSquare}
              title={hasActiveFilters ? 'No matching communications' : 'No communications yet'}
              description={
                hasActiveFilters
                  ? 'Try adjusting your filters to find what you\'re looking for.'
                  : 'Log your first communication to track interactions with this vendor.'
              }
              primaryAction={
                hasActiveFilters
                  ? {
                    label: 'Clear Filters',
                    onClick: clearFilters,
                  }
                  : {
                    label: 'Log Communication',
                    onClick: handleAddCommunication,
                  }
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredCommunications.map((communication) => (
                <CommunicationCard
                  key={communication.id}
                  communication={communication}
                  onEdit={() => handleEditCommunication(communication)}
                  onDelete={() => setDeleteCommunicationId(communication.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Communication Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCommunication ? 'Edit Communication' : 'Log Communication'}
            </DialogTitle>
            <DialogDescription>
              {editingCommunication
                ? 'Update this communication entry.'
                : 'Record a communication with this vendor.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="communication_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMMUNICATION_TYPE_OPTIONS.map((option) => (
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
                  name="communication_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
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
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief subject line" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Details of the communication..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchase_order_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Purchase Order</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                      value={field.value || '__none__'}
                      disabled={isLoadingPOs}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a PO (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {purchaseOrders?.map((po) => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.po_number} - {po.status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Who" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Email" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone" type="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                  {editingCommunication ? 'Save Changes' : 'Log Communication'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCommunicationId} onOpenChange={() => setDeleteCommunicationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Communication</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this communication entry? This action cannot be undone.
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
// Communication Card Sub-component
// ============================================================================

interface CommunicationCardProps {
  communication: VendorCommunicationLog;
  onEdit: () => void;
  onDelete: () => void;
}

function CommunicationCard({ communication, onEdit, onDelete }: CommunicationCardProps) {
  const Icon = COMMUNICATION_ICONS[communication.communication_type];
  const colorClass = COMMUNICATION_COLORS[communication.communication_type];

  return (
    <div className="flex gap-4 rounded-lg border p-4">
      {/* Icon */}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {COMMUNICATION_TYPE_LABELS[communication.communication_type]}
              </Badge>
              {communication.subject && (
                <span className="font-medium">{communication.subject}</span>
              )}
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{communication.content}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

        {/* Meta info */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(communication.communication_date), 'MMM d, yyyy')}
            <span className="text-muted-foreground/60">
              ({formatDistanceToNow(new Date(communication.communication_date), { addSuffix: true })})
            </span>
          </span>

          {communication.contact_name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {communication.contact_name}
            </span>
          )}

          {communication.purchase_order && (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              PO: {communication.purchase_order.po_number}
            </span>
          )}

          {communication.created_by_name && (
            <span className="text-muted-foreground/60">
              Logged by {communication.created_by_name}
            </span>
          )}
        </div>

        {/* Contact details if provided */}
        {(communication.contact_email || communication.contact_phone) && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {communication.contact_email && (
              <a
                href={`mailto:${communication.contact_email}`}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Mail className="h-3 w-3" />
                {communication.contact_email}
              </a>
            )}
            {communication.contact_phone && (
              <a
                href={`tel:${communication.contact_phone}`}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Phone className="h-3 w-3" />
                {communication.contact_phone}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
