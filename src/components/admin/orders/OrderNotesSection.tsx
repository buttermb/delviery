/**
 * Order Notes Section Component
 *
 * Displays a tabbed interface for managing internal notes (visible only to staff)
 * and customer notes (visible to the customer).
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import FileText from "lucide-react/dist/esm/icons/file-text";
import Lock from "lucide-react/dist/esm/icons/lock";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Edit from "lucide-react/dist/esm/icons/edit";
import Save from "lucide-react/dist/esm/icons/save";
import X from "lucide-react/dist/esm/icons/x";
import User from "lucide-react/dist/esm/icons/user";
import { cn } from '@/lib/utils';

export interface OrderNotesSectionProps {
  /** The unique identifier of the order */
  orderId: string;
  /** Internal notes - only visible to staff */
  internalNotes?: string | null;
  /** Customer notes - visible to the customer */
  customerNotes?: string | null;
  /** The database table to update */
  tableName: 'marketplace_orders' | 'wholesale_orders' | 'menu_orders';
  /** The field name for internal notes in the table */
  internalNotesField?: string;
  /** The field name for customer notes in the table */
  customerNotesField?: string;
  /** Query key(s) to invalidate after updating */
  queryKeysToInvalidate?: string[][];
  /** Whether the component is in a loading state */
  isLoading?: boolean;
  /** Whether the notes are read-only */
  readOnly?: boolean;
  /** Additional filter for the update query (e.g., tenant_id) */
  additionalFilter?: { field: string; value: string };
  /** Custom class name */
  className?: string;
}

export function OrderNotesSection({
  orderId,
  internalNotes,
  customerNotes,
  tableName,
  internalNotesField = 'internal_notes',
  customerNotesField = 'customer_notes',
  queryKeysToInvalidate = [],
  isLoading = false,
  readOnly = false,
  additionalFilter,
  className,
}: OrderNotesSectionProps) {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'internal' | 'customer'>('internal');
  const [isEditingInternal, setIsEditingInternal] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editedInternalNotes, setEditedInternalNotes] = useState(internalNotes ?? '');
  const [editedCustomerNotes, setEditedCustomerNotes] = useState(customerNotes ?? '');

  // Mutation for updating notes
  const updateNotesMutation = useMutation({
    mutationFn: async ({
      field,
      value,
    }: {
      field: string;
      value: string;
    }) => {
      const updateData = { [field]: value };

      // Supabase type limitation: dynamic table names can't be statically typed
      const baseQuery = supabase.from(tableName).update(updateData);

      let query = baseQuery.eq('id', orderId);

      if (additionalFilter) {
        query = query.eq(additionalFilter.field, additionalFilter.value);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate specified queries
      queryKeysToInvalidate.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });

      const noteType = variables.field === internalNotesField ? 'Internal' : 'Customer';
      toast.success(`${noteType} notes saved successfully`);

      // Reset editing state
      if (variables.field === internalNotesField) {
        setIsEditingInternal(false);
      } else {
        setIsEditingCustomer(false);
      }
    },
    onError: (error, variables) => {
      const noteType = variables.field === internalNotesField ? 'internal' : 'customer';
      logger.error(`Failed to update ${noteType} notes`, error, {
        component: 'OrderNotesSection',
        orderId,
      });
      toast.error(`Failed to save ${noteType} notes`, { description: humanizeError(error) });
    },
  });

  const handleSaveInternalNotes = () => {
    updateNotesMutation.mutate({
      field: internalNotesField,
      value: editedInternalNotes,
    });
  };

  const handleSaveCustomerNotes = () => {
    updateNotesMutation.mutate({
      field: customerNotesField,
      value: editedCustomerNotes,
    });
  };

  const handleCancelInternalEdit = () => {
    setEditedInternalNotes(internalNotes ?? '');
    setIsEditingInternal(false);
  };

  const handleCancelCustomerEdit = () => {
    setEditedCustomerNotes(customerNotes ?? '');
    setIsEditingCustomer(false);
  };

  const handleStartInternalEdit = () => {
    setEditedInternalNotes(internalNotes ?? '');
    setIsEditingInternal(true);
  };

  const handleStartCustomerEdit = () => {
    setEditedCustomerNotes(customerNotes ?? '');
    setIsEditingCustomer(true);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasInternalNotes = Boolean(internalNotes?.trim());
  const hasCustomerNotes = Boolean(customerNotes?.trim());

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5" />
          Order Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'internal' | 'customer')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="internal" className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" />
              Internal
              {hasInternalNotes && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  1
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="customer" className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              Customer
              {hasCustomerNotes && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  1
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Internal Notes Tab */}
          <TabsContent value="internal" className="mt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Only visible to staff
                </p>
                {!readOnly && !isEditingInternal && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartInternalEdit}
                    className="h-7 px-2"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              {isEditingInternal ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedInternalNotes}
                    onChange={(e) => setEditedInternalNotes(e.target.value)}
                    placeholder="Add internal notes about this order (e.g., special handling instructions, follow-up reminders)..."
                    aria-label="Internal order notes"
                    rows={4}
                    maxLength={2000}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {editedInternalNotes.length}/2000
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelInternalEdit}
                      disabled={updateNotesMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveInternalNotes}
                      disabled={updateNotesMutation.isPending}
                    >
                      {updateNotesMutation.isPending ? (
                        'Saving...'
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'p-3 rounded-lg border min-h-[80px]',
                    hasInternalNotes
                      ? 'bg-muted/30'
                      : 'bg-muted/10 border-dashed'
                  )}
                >
                  {hasInternalNotes ? (
                    <p className="text-sm whitespace-pre-wrap">{internalNotes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No internal notes yet
                    </p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Customer Notes Tab */}
          <TabsContent value="customer" className="mt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Visible to the customer
                </p>
                {!readOnly && !isEditingCustomer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartCustomerEdit}
                    className="h-7 px-2"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
              </div>

              {isEditingCustomer ? (
                <div className="space-y-3">
                  <Textarea
                    value={editedCustomerNotes}
                    onChange={(e) => setEditedCustomerNotes(e.target.value)}
                    placeholder="Add notes for the customer (e.g., delivery updates, special messages)..."
                    aria-label="Customer-facing order notes"
                    rows={4}
                    maxLength={2000}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {editedCustomerNotes.length}/2000
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelCustomerEdit}
                      disabled={updateNotesMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveCustomerNotes}
                      disabled={updateNotesMutation.isPending}
                    >
                      {updateNotesMutation.isPending ? (
                        'Saving...'
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'p-3 rounded-lg border min-h-[80px]',
                    hasCustomerNotes
                      ? 'bg-muted/30'
                      : 'bg-muted/10 border-dashed'
                  )}
                >
                  {hasCustomerNotes ? (
                    <p className="text-sm whitespace-pre-wrap">{customerNotes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No customer notes yet
                    </p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
