/**
 * CustomerAutoAssociation - Automatic customer lookup and association for order creation.
 *
 * Features:
 * - Auto-searches customers by phone or email as user types
 * - Shows matching customers in a dropdown
 * - Allows selecting existing customer to associate with order
 * - Offers to create new customer if not found
 * - Displays selected customer with link to their profile
 */

import { useState, useEffect, useCallback } from 'react';
import { Check, Loader2, Plus, Search, User, UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomerLookup, CustomerMatch, NewCustomerData } from '@/hooks/useCustomerLookup';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

interface CustomerAutoAssociationProps {
  /** Current phone value from the form */
  phone: string;
  /** Current email value from the form */
  email: string;
  /** Current customer name from the form */
  customerName: string;
  /** Current delivery address from the form */
  deliveryAddress?: string;
  /** Callback when a customer is selected */
  onCustomerSelect: (customer: CustomerMatch | null) => void;
  /** Callback when a new customer is created */
  onCustomerCreate?: (customer: CustomerMatch) => void;
  /** Currently selected customer (controlled) */
  selectedCustomer?: CustomerMatch | null;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Get initials from a customer name for the avatar fallback
 */
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function CustomerAutoAssociation({
  phone,
  email,
  customerName,
  deliveryAddress,
  onCustomerSelect,
  onCustomerCreate,
  selectedCustomer: externalSelectedCustomer,
  disabled = false,
  className,
}: CustomerAutoAssociationProps) {
  const {
    matches,
    selectedCustomer: internalSelectedCustomer,
    isSearching,
    searchByPhone,
    searchByEmail,
    clear,
    selectCustomer,
    createCustomer,
    isCreating,
    query,
    searchType,
  } = useCustomerLookup();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Use external selected customer if provided, otherwise internal
  const selectedCustomer = externalSelectedCustomer !== undefined
    ? externalSelectedCustomer
    : internalSelectedCustomer;

  // Trigger search when phone or email changes
  useEffect(() => {
    if (disabled || selectedCustomer) return;

    // Prioritize phone lookup (more unique identifier)
    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length >= 7) {
      searchByPhone(phone);
      setShowDropdown(true);
      return;
    }

    // Fall back to email if phone is not long enough
    if (email && email.includes('@') && email.length >= 5) {
      searchByEmail(email);
      setShowDropdown(true);
      return;
    }

    // Clear if neither meets criteria
    if (query) {
      clear();
      setShowDropdown(false);
    }
  }, [phone, email, disabled, selectedCustomer, searchByPhone, searchByEmail, clear, query]);

  // Hide dropdown when no matches or customer selected
  useEffect(() => {
    if (matches.length === 0 && !isSearching) {
      // Give a slight delay before hiding to allow "Create new" option
      const timeout = setTimeout(() => {
        if (matches.length === 0 && query.length >= 3 && !selectedCustomer) {
          // Show the dropdown to display "No matches" with create option
          setShowDropdown(true);
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [matches, isSearching, query, selectedCustomer]);

  const handleSelectCustomer = useCallback((customer: CustomerMatch) => {
    selectCustomer(customer);
    onCustomerSelect(customer);
    setShowDropdown(false);
    toast.success('Customer linked to order', {
      description: `Associated with ${customer.full_name}`,
    });
    logger.info('Customer associated with order', {
      component: 'CustomerAutoAssociation',
      customerId: customer.id,
    });
  }, [selectCustomer, onCustomerSelect]);

  const handleClearSelection = useCallback(() => {
    selectCustomer(null);
    onCustomerSelect(null);
    clear();
  }, [selectCustomer, onCustomerSelect, clear]);

  const handleCreateCustomer = useCallback(async () => {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    try {
      // Parse name into first and last
      const nameParts = customerName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || undefined;

      const newCustomerData: NewCustomerData = {
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
        email: email || undefined,
        delivery_address: deliveryAddress,
      };

      const newCustomer = await createCustomer(newCustomerData);
      onCustomerSelect(newCustomer);
      onCustomerCreate?.(newCustomer);
      setShowCreateDialog(false);
      setShowDropdown(false);

      toast.success('Customer created and linked', {
        description: `Created ${newCustomer.full_name}`,
      });

      logger.info('New customer created from order', {
        component: 'CustomerAutoAssociation',
        customerId: newCustomer.id,
      });
    } catch (error) {
      toast.error('Failed to create customer', { description: humanizeError(error) });
      logger.error('Failed to create customer from order',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'CustomerAutoAssociation' }
      );
    }
  }, [customerName, phone, email, deliveryAddress, createCustomer, onCustomerSelect, onCustomerCreate]);

  // Don't show anything if disabled
  if (disabled) return null;

  // Show selected customer card
  if (selectedCustomer) {
    return (
      <Card className={cn('p-3 border-primary/20 bg-primary/5', className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                {getInitials(selectedCustomer.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{selectedCustomer.full_name}</span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  <Check className="h-3 w-3 mr-1" />
                  Linked
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                {selectedCustomer.phone && selectedCustomer.email && <span>•</span>}
                {selectedCustomer.email && <span className="truncate">{selectedCustomer.email}</span>}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleClearSelection}
            title="Remove customer association"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  // Show lookup dropdown when searching
  const hasQuery = query.length >= 3;
  const showResults = showDropdown && hasQuery;

  return (
    <div className={cn('relative', className)}>
      {/* Search indicator */}
      {isSearching && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Searching for existing customer...</span>
        </div>
      )}

      {/* Results dropdown */}
      {showResults && !isSearching && (
        <Card className="p-2 border shadow-lg">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 px-1">
            <Search className="h-3 w-3" />
            <span>
              {searchType === 'phone' ? 'Searching by phone' : 'Searching by email'}
            </span>
          </div>

          {matches.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-1 mb-2">
                {matches.length} existing customer{matches.length > 1 ? 's' : ''} found:
              </p>
              {matches.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-3 p-2 rounded-md text-left',
                    'hover:bg-muted/50 transition-colors cursor-pointer'
                  )}
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(customer.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{customer.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {customer.phone || customer.email}
                    </p>
                  </div>
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-3">
              <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mb-3">No existing customer found</p>
            </div>
          )}

          {/* Create new customer option */}
          <div className="border-t mt-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => setShowCreateDialog(true)}
              disabled={!customerName.trim()}
            >
              <UserPlus className="h-4 w-4" />
              Create new customer from this order
            </Button>
          </div>
        </Card>
      )}

      {/* Create Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Customer</DialogTitle>
            <DialogDescription>
              Create a new customer record from the order details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={customerName}
                readOnly
                className="bg-muted"
              />
            </div>

            {phone && (
              <div className="space-y-2">
                <Label htmlFor="create-phone">Phone</Label>
                <Input
                  id="create-phone"
                  value={phone}
                  readOnly
                  className="bg-muted"
                />
              </div>
            )}

            {email && (
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  value={email}
                  readOnly
                  className="bg-muted"
                />
              </div>
            )}

            {deliveryAddress && (
              <div className="space-y-2">
                <Label htmlFor="create-address">Delivery Address</Label>
                <Input
                  id="create-address"
                  value={deliveryAddress}
                  readOnly
                  className="bg-muted"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateCustomer}
              disabled={isCreating || !customerName.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Customer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
