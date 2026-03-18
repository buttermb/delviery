/**
 * POS Customer Selector
 * Searchable combobox for selecting customers in POS with quick create functionality
 */

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, User, Phone, Mail, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { QuickCreateCustomerDialog } from './QuickCreateCustomerDialog';
import { displayName } from '@/lib/formatters';
import { sanitizeSearchInput } from '@/lib/utils/searchSanitize';

export interface POSCustomer {
  id: string;
  first_name: string;
  last_name: string;
  customer_type: string;
  loyalty_points: number;
  email?: string | null;
  phone?: string | null;
}

interface POSCustomerSelectorProps {
  customers: POSCustomer[];
  selectedCustomer: POSCustomer | null;
  onSelectCustomer: (customer: POSCustomer | null) => void;
  onCustomerCreated?: (customer: POSCustomer) => void;
  isLoading?: boolean;
  tenantId?: string;
}

export function POSCustomerSelector({
  customers,
  selectedCustomer,
  onSelectCustomer,
  onCustomerCreated,
  isLoading = false,
  tenantId,
}: POSCustomerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;

    const query = sanitizeSearchInput(searchQuery).toLowerCase();
    return customers.filter((customer) => {
      const fullName = displayName(customer.first_name, customer.last_name).toLowerCase();
      const phone = (customer.phone ?? '').toLowerCase();
      const email = (customer.email ?? '').toLowerCase();

      return (
        fullName.includes(query) ||
        phone.includes(query) ||
        email.includes(query)
      );
    });
  }, [customers, searchQuery]);

  const handleSelect = (customerId: string) => {
    if (customerId === 'walk-in') {
      onSelectCustomer(null);
    } else {
      const customer = customers.find((c) => c.id === customerId);
      onSelectCustomer(customer || null);
    }
    setOpen(false);
    setSearchQuery('');
  };

  const handleCustomerCreated = (newCustomer: POSCustomer) => {
    onSelectCustomer(newCustomer);
    onCustomerCreated?.(newCustomer);
    setIsCreateDialogOpen(false);
    setOpen(false);
    setSearchQuery('');
  };

  const selectedLabel = selectedCustomer
    ? displayName(selectedCustomer.first_name, selectedCustomer.last_name)
    : 'Walk-in Customer';

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full h-12 justify-between text-base',
              !selectedCustomer && 'text-muted-foreground'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 shrink-0" />
              <span className="truncate">{selectedLabel}</span>
              {selectedCustomer?.customer_type === 'medical' && (
                <Badge variant="secondary" className="ml-1 shrink-0">Med</Badge>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {/* Walk-in option always at top */}
              <CommandGroup heading="Quick Selection">
                <CommandItem
                  value="walk-in"
                  onSelect={() => handleSelect('walk-in')}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      !selectedCustomer ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <User className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Walk-in Customer</span>
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />

              {/* Customer list */}
              <CommandGroup heading="Customers">
                {isLoading ? (
                  <CommandItem disabled className="justify-center py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                    Loading customers...
                  </CommandItem>
                ) : filteredCustomers.length === 0 ? (
                  <CommandEmpty>
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        {searchQuery
                          ? `No customers found for "${searchQuery}"`
                          : 'No customers yet'}
                      </p>
                      {tenantId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCreateDialogOpen(true)}
                          className="w-full"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {searchQuery
                            ? `Create "${searchQuery.split(' ')[0]}"`
                            : 'Create New Customer'}
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>
                ) : (
                  filteredCustomers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.id}
                      onSelect={() => handleSelect(customer.id)}
                      className="cursor-pointer py-3"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          selectedCustomer?.id === customer.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {displayName(customer.first_name, customer.last_name)}
                          </span>
                          {customer.customer_type === 'medical' && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              Med
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Award className="h-3 w-3" />
                        {customer.loyalty_points}
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>

              {/* Quick create option when there are results but user might want to add */}
              {tenantId && filteredCustomers.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => setIsCreateDialogOpen(true)}
                      className="cursor-pointer text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      <span>Add New Customer</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Quick Create Dialog */}
      {tenantId && (
        <QuickCreateCustomerDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          tenantId={tenantId}
          onSuccess={handleCustomerCreated}
          initialName={searchQuery}
        />
      )}
    </>
  );
}
