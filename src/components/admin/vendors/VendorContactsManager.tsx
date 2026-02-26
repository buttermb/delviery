/**
 * Vendor Contacts Manager Component
 *
 * Manages multiple contacts per vendor with CRUD operations.
 * Features:
 * - Add/edit/delete contacts
 * - Set primary contact (auto-selected for PO communications)
 * - Quick actions: call, email, copy number
 * - Contact history log
 * - Department categorization (sales, billing, logistics, etc.)
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import {
  User,
  Plus,
  Loader2,
  Phone,
  Mail,
  Star,
  MoreVertical,
  Copy,
  Edit,
  Trash2,
  History,
  Building2,
  Briefcase,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  useVendorContacts,
  useVendorContactHistory,
  DEPARTMENT_OPTIONS,
  HISTORY_ACTION_LABELS,
  type VendorContact,
  type ContactDepartment,
  type ContactHistoryAction,
} from '@/hooks/useVendorContacts';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { formatSmartDate } from '@/lib/formatters';

// ============================================================================
// Types & Schema
// ============================================================================

interface VendorContactsManagerProps {
  vendorId: string;
  vendorName: string;
}

const contactFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  role: z.string().optional(),
  department: z.string().optional(),
  phone: z.string().regex(/^[\d\s\-+()]+$/, "Invalid phone number").min(7, "Phone number must be at least 7 characters").max(20, "Phone number must be 20 characters or less").optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  is_primary: z.boolean().default(false),
  notes: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

const historyFormSchema = z.object({
  action: z.string().min(1, 'Action is required'),
  summary: z.string().optional(),
});

type HistoryFormValues = z.infer<typeof historyFormSchema>;

// ============================================================================
// Main Component
// ============================================================================

export function VendorContactsManager({ vendorId, vendorName }: VendorContactsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<VendorContact | null>(null);
  const [selectedContactForHistory, setSelectedContactForHistory] = useState<VendorContact | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);

  const {
    contacts,
    primaryContact: _primaryContact,
    isLoading,
    isError,
    createContact,
    updateContact,
    deleteContact,
    setPrimary,
    logInteraction,
    isCreating,
    isUpdating,
    isDeleting,
    isSettingPrimary,
  } = useVendorContacts(vendorId);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      role: '',
      department: '',
      phone: '',
      email: '',
      is_primary: false,
      notes: '',
    },
  });

  const historyForm = useForm<HistoryFormValues>({
    resolver: zodResolver(historyFormSchema),
    defaultValues: {
      action: '',
      summary: '',
    },
  });

  // Handle dialog open for create
  const handleAddContact = useCallback(() => {
    setEditingContact(null);
    form.reset({
      name: '',
      role: '',
      department: '',
      phone: '',
      email: '',
      is_primary: contacts.length === 0, // Auto-set primary if first contact
      notes: '',
    });
    setIsDialogOpen(true);
  }, [form, contacts.length]);

  // Handle dialog open for edit
  const handleEditContact = useCallback((contact: VendorContact) => {
    setEditingContact(contact);
    form.reset({
      name: contact.name,
      role: contact.role ?? '',
      department: contact.department ?? '',
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      is_primary: contact.is_primary,
      notes: contact.notes ?? '',
    });
    setIsDialogOpen(true);
  }, [form]);

  // Handle form submit
  const handleSubmit = async (values: ContactFormValues) => {
    try {
      if (editingContact) {
        await updateContact({
          id: editingContact.id,
          name: values.name,
          role: values.role || undefined,
          department: (values.department as ContactDepartment) || undefined,
          phone: values.phone || undefined,
          email: values.email || undefined,
          is_primary: values.is_primary,
          notes: values.notes || undefined,
        });
        toast.success('Contact updated successfully');
      } else {
        await createContact({
          vendor_id: vendorId,
          name: values.name,
          role: values.role || undefined,
          department: (values.department as ContactDepartment) || undefined,
          phone: values.phone || undefined,
          email: values.email || undefined,
          is_primary: values.is_primary,
          notes: values.notes || undefined,
        });
        toast.success('Contact added successfully');
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      logger.error('Failed to save contact', error, { component: 'VendorContactsManager' });
      toast.error(editingContact ? 'Failed to update contact' : 'Failed to add contact');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteContactId) return;
    try {
      await deleteContact(deleteContactId);
      toast.success('Contact deleted successfully');
      setDeleteContactId(null);
    } catch (error) {
      logger.error('Failed to delete contact', error, { component: 'VendorContactsManager' });
      toast.error('Failed to delete contact', { description: humanizeError(error) });
    }
  };

  // Handle set primary
  const handleSetPrimary = async (contactId: string) => {
    try {
      await setPrimary(contactId);
      toast.success('Primary contact updated');
    } catch (error) {
      logger.error('Failed to set primary contact', error, { component: 'VendorContactsManager' });
      toast.error('Failed to set primary contact', { description: humanizeError(error) });
    }
  };

  // Handle quick actions
  const handleCall = (contact: VendorContact) => {
    if (contact.phone) {
      window.open(`tel:${contact.phone}`, '_self');
      logInteraction({
        vendor_contact_id: contact.id,
        action: 'call',
        summary: `Called ${contact.name}`,
      }).catch((e) => { logger.warn('[VendorContacts] Failed to log interaction', { error: e }); });
    }
  };

  const handleEmail = (contact: VendorContact) => {
    if (contact.email) {
      window.open(`mailto:${contact.email}`, '_blank', 'noopener,noreferrer');
      logInteraction({
        vendor_contact_id: contact.id,
        action: 'email',
        summary: `Emailed ${contact.name}`,
      }).catch((e) => { logger.warn('[VendorContacts] Failed to log interaction', { error: e }); });
    }
  };

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success('Phone number copied');
    } catch (error) {
      toast.error('Failed to copy', { description: humanizeError(error) });
    }
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success('Email copied');
    } catch (error) {
      toast.error('Failed to copy', { description: humanizeError(error) });
    }
  };

  // Handle history dialog
  const handleViewHistory = (contact: VendorContact) => {
    setSelectedContactForHistory(contact);
    historyForm.reset({ action: '', summary: '' });
    setIsHistoryDialogOpen(true);
  };

  const handleLogInteraction = async (values: HistoryFormValues) => {
    if (!selectedContactForHistory) return;
    try {
      await logInteraction({
        vendor_contact_id: selectedContactForHistory.id,
        action: values.action as ContactHistoryAction,
        summary: values.summary || undefined,
      });
      toast.success('Interaction logged');
      historyForm.reset();
    } catch (error) {
      logger.error('Failed to log interaction', error, { component: 'VendorContactsManager' });
      toast.error('Failed to log interaction', { description: humanizeError(error) });
    }
  };

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
            icon={User}
            title="Failed to load contacts"
            description="There was an error loading vendor contacts. Please try again."
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
              <User className="h-5 w-5" />
              Contacts
            </CardTitle>
            <CardDescription>
              Manage contacts for {vendorName}
            </CardDescription>
          </div>
          <Button onClick={handleAddContact} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <EnhancedEmptyState
              icon={User}
              title="No contacts yet"
              description="Add your first contact to keep track of who to reach at this vendor."
              primaryAction={{
                label: 'Add Contact',
                onClick: handleAddContact,
              }}
            />
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onEdit={() => handleEditContact(contact)}
                  onDelete={() => setDeleteContactId(contact.id)}
                  onSetPrimary={() => handleSetPrimary(contact.id)}
                  onCall={() => handleCall(contact)}
                  onEmail={() => handleEmail(contact)}
                  onCopyPhone={() => contact.phone && handleCopyPhone(contact.phone)}
                  onCopyEmail={() => contact.email && handleCopyEmail(contact.email)}
                  onViewHistory={() => handleViewHistory(contact)}
                  isSettingPrimary={isSettingPrimary}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Contact Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : 'Add Contact'}
            </DialogTitle>
            <DialogDescription>
              {editingContact
                ? 'Update contact information for this vendor.'
                : 'Add a new contact for this vendor.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <Input placeholder="Account Manager" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEPARTMENT_OPTIONS.map((dept) => (
                            <SelectItem key={dept.value} value={dept.value}>
                              {dept.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="john@vendor.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_primary"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Set as primary contact
                    </FormLabel>
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
                        placeholder="Additional notes about this contact..."
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
                  {editingContact ? 'Save Changes' : 'Add Contact'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Contact History Dialog */}
      <ContactHistoryDialog
        contact={selectedContactForHistory}
        isOpen={isHistoryDialogOpen}
        onClose={() => {
          setIsHistoryDialogOpen(false);
          setSelectedContactForHistory(null);
        }}
        form={historyForm}
        onSubmit={handleLogInteraction}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteContactId}
        onOpenChange={() => setDeleteContactId(null)}
        onConfirm={handleDelete}
        title="Delete Contact"
        description="Are you sure you want to delete this contact? This action cannot be undone."
        itemType="contact"
        isLoading={isDeleting}
      />
    </>
  );
}

// ============================================================================
// Contact Card Sub-component
// ============================================================================

interface ContactCardProps {
  contact: VendorContact;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
  onCall: () => void;
  onEmail: () => void;
  onCopyPhone: () => void;
  onCopyEmail: () => void;
  onViewHistory: () => void;
  isSettingPrimary: boolean;
}

function ContactCard({
  contact,
  onEdit,
  onDelete,
  onSetPrimary,
  onCall,
  onEmail,
  onCopyPhone,
  onCopyEmail,
  onViewHistory,
  isSettingPrimary,
}: ContactCardProps) {
  return (
    <div className="flex items-start justify-between rounded-lg border p-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{contact.name}</span>
            {contact.is_primary && (
              <Badge variant="default" className="h-5 text-xs">
                <Star className="mr-1 h-3 w-3" />
                Primary
              </Badge>
            )}
          </div>
          {(contact.role || contact.department) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {contact.role && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {contact.role}
                </span>
              )}
              {contact.department && (
                <Badge variant="outline" className="text-xs">
                  {DEPARTMENT_OPTIONS.find(d => d.value === contact.department)?.label ?? contact.department}
                </Badge>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {contact.phone && (
              <button
                onClick={onCall}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Phone className="h-3 w-3" />
                {contact.phone}
              </button>
            )}
            {contact.email && (
              <button
                onClick={onEmail}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Mail className="h-3 w-3" />
                {contact.email}
              </button>
            )}
          </div>
          {contact.notes && (
            <p className="pt-1 text-sm text-muted-foreground">
              {contact.notes}
            </p>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Contact actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {contact.phone && (
            <>
              <DropdownMenuItem onClick={onCall}>
                <Phone className="mr-2 h-4 w-4" />
                Call
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyPhone}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Phone
              </DropdownMenuItem>
            </>
          )}
          {contact.email && (
            <>
              <DropdownMenuItem onClick={onEmail}>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyEmail}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Email
              </DropdownMenuItem>
            </>
          )}
          {(contact.phone || contact.email) && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={onViewHistory}>
            <History className="mr-2 h-4 w-4" />
            View History
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          {!contact.is_primary && (
            <DropdownMenuItem onClick={onSetPrimary} disabled={isSettingPrimary}>
              <Star className="mr-2 h-4 w-4" />
              Set as Primary
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================================
// Contact History Dialog Sub-component
// ============================================================================

interface ContactHistoryDialogProps {
  contact: VendorContact | null;
  isOpen: boolean;
  onClose: () => void;
  form: ReturnType<typeof useForm<HistoryFormValues>>;
  onSubmit: (values: HistoryFormValues) => Promise<void>;
}

function ContactHistoryDialog({
  contact,
  isOpen,
  onClose,
  form,
  onSubmit,
}: ContactHistoryDialogProps) {
  const { data: history, isLoading } = useVendorContactHistory(contact?.id ?? '');

  if (!contact) return null;

  const HISTORY_ACTIONS = [
    { value: 'call', label: 'Phone Call', icon: Phone },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'meeting', label: 'Meeting', icon: Building2 },
    { value: 'note', label: 'Note', icon: FileText },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Contact History - {contact.name}
          </DialogTitle>
          <DialogDescription>
            Log interactions and view history with this contact.
          </DialogDescription>
        </DialogHeader>

        {/* Log New Interaction Form */}
        <div className="border-b pb-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Log Interaction</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select action type..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {HISTORY_ACTIONS.map((action) => (
                          <SelectItem key={action.value} value={action.value}>
                            <span className="flex items-center gap-2">
                              <action.icon className="h-4 w-4" />
                              {action.label}
                            </span>
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
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Brief summary of the interaction..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" size="sm" disabled={!form.watch('action')}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Log Interaction
              </Button>
            </form>
          </Form>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !history || history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No interaction history yet.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const ActionIcon = HISTORY_ACTIONS.find(a => a.value === item.action)?.icon ?? FileText;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <ActionIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {HISTORY_ACTION_LABELS[item.action as ContactHistoryAction]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatSmartDate(item.created_at, { includeTime: true })}
                        </span>
                      </div>
                      {item.summary && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.summary}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
