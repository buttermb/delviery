import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatPhoneNumber } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface ImportCustomersDialogProps {
  menuId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export const ImportCustomersDialog = ({
  menuId,
  open,
  onOpenChange,
  onImportComplete
}: ImportCustomersDialogProps) => {
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Fetch wholesale clients
  const { data: clients, isLoading } = useQuery({
    queryKey: queryKeys.importCustomersWholesale.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesale_clients')
        .select('id, business_name, contact_name, phone, email, client_type')
        .eq('status', 'active')
        .order('company_name');
      
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  // Fetch already whitelisted customers
  const { data: existingWhitelist } = useQuery({
    queryKey: queryKeys.menuWhitelist.byMenu(menuId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_access_whitelist')
        .select('customer_phone')
        .eq('menu_id', menuId);
      
      if (error) throw error;
      return new Set(data.map(w => w.customer_phone));
    },
    enabled: open
  });

  const filteredClients = clients?.filter(client => {
    const searchLower = searchQuery.toLowerCase();
    return (
      client.business_name?.toLowerCase().includes(searchLower) ||
      client.contact_name?.toLowerCase().includes(searchLower) ||
      client.phone?.includes(searchQuery)
    );
  });

  const availableClients = filteredClients?.filter(
    client => !existingWhitelist?.has(client.phone)
  );

  const handleToggleCustomer = (clientId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedCustomers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCustomers.size === availableClients?.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(availableClients?.map(c => c.id) ?? []));
    }
  };

  const handleImport = async () => {
    if (selectedCustomers.size === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    setIsImporting(true);
    try {
      const selectedClientData = clients?.filter(c => selectedCustomers.has(c.id)) ?? [];
      
      const whitelistEntries = selectedClientData.map(client => ({
        menu_id: menuId,
        customer_name: client.business_name || client.contact_name,
        customer_phone: client.phone,
        customer_email: client.email,
        status: 'active' as const,
        invited_at: new Date().toISOString(),
        unique_access_token: crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      }));

      const { error } = await supabase
        .from('menu_access_whitelist')
        .insert(whitelistEntries);

      if (error) throw error;

      toast.success(`Added ${selectedCustomers.size} customers to whitelist`);
      onImportComplete();
      onOpenChange(false);
      setSelectedCustomers(new Set());
    } catch (error: unknown) {
      toast.error('Failed to import customers', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Import Customers from CRM
          </DialogTitle>
          <DialogDescription>
            Select customers from your wholesale CRM to add to this menu's whitelist
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, company, or phone..."
              aria-label="Search customers"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Selection Summary */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {selectedCustomers.size} of {availableClients?.length ?? 0} selected
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={!availableClients || availableClients.length === 0}
            >
              {selectedCustomers.size === availableClients?.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {/* Customer List */}
          <ScrollArea className="h-[400px] border rounded-lg">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading customers...
              </div>
            ) : availableClients && availableClients.length > 0 ? (
              <div className="p-4 space-y-2">
                {availableClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => handleToggleCustomer(client.id)}
                  >
                    <Checkbox
                      checked={selectedCustomers.has(client.id)}
                      onCheckedChange={() => handleToggleCustomer(client.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{client.business_name || client.contact_name}</p>
                        {client.client_type && (
                          <Badge variant="outline" className="text-xs">
                            {client.client_type}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {client.contact_name && client.business_name && (
                          <p>Contact: {client.contact_name}</p>
                        )}
                        <p>Phone: {formatPhoneNumber(client.phone)}</p>
                        {client.email && <p>Email: {client.email}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                {existingWhitelist && existingWhitelist.size > 0 ? (
                  <p>All available customers are already whitelisted</p>
                ) : (
                  <p>No customers found</p>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || selectedCustomers.size === 0}
          >
            {isImporting ? 'Importing...' : `Import ${selectedCustomers.size} Customers`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
