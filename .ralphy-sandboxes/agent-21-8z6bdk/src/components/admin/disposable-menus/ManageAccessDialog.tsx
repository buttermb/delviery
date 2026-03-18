import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMenuWhitelist, useManageWhitelist } from '@/hooks/useDisposableMenus';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Copy, RefreshCw, Ban, Send, Loader2, Users, Eye } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { ImportCustomersDialog } from './ImportCustomersDialog';
import { CustomerActivityTimeline } from './CustomerActivityTimeline';
import { SendAccessLinkDialog } from './SendAccessLinkDialog';
import type { DisposableMenu } from '@/types/admin';

interface WhitelistEntry {
  id: string;
  status?: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  unique_access_token?: string | null;
  last_access_at?: string | null;
  [key: string]: unknown;
}

interface ManageAccessDialogProps {
  menu: DisposableMenu;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ManageAccessDialog = ({ menu, open, onOpenChange }: ManageAccessDialogProps) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<WhitelistEntry | null>(null);
  const [sendLinkCustomer, setSendLinkCustomer] = useState<WhitelistEntry | null>(null);

  const { data: whitelist, refetch } = useMenuWhitelist(menu.id);
  const manageWhitelist = useManageWhitelist();

  const activeCustomers = whitelist?.filter(w => w.status === 'active') ?? [];
  const pendingCustomers = whitelist?.filter(w => w.status === 'pending') ?? [];
  const blockedCustomers = whitelist?.filter(w => w.status === 'blocked' || w.status === 'revoked') ?? [];

  const handleAddCustomer = async () => {
    if (!customerName || !customerPhone) return;

    try {
      await manageWhitelist.mutateAsync({
        menu_id: menu.id,
        action: 'add',
        customer_data: {
          name: customerName,
          phone: customerPhone,
          email: customerEmail || null
        }
      });

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
    } catch {
      showErrorToast('Failed to add customer', 'Please try again');
    }
  };

  const handleRevoke = async (whitelistId: string) => {
    try {
      await manageWhitelist.mutateAsync({
        menu_id: menu.id,
        action: 'revoke',
        whitelist_id: whitelistId,
        customer_data: { reason: 'Manually revoked' }
      });
    } catch {
      showErrorToast('Failed to revoke access', 'Please try again');
    }
  };

  const handleRegenerateToken = async (whitelistId: string) => {
    try {
      await manageWhitelist.mutateAsync({
        menu_id: menu.id,
        action: 'regenerate_token',
        whitelist_id: whitelistId
      });
    } catch {
      showErrorToast('Failed to regenerate token', 'Please try again');
    }
  };

  const copyAccessUrl = (token: string) => {
    const url = `${window.location.protocol}//${window.location.host}/m/${menu.encrypted_url_token}?u=${token}`;
    navigator.clipboard.writeText(url);
    showSuccessToast('URL Copied', 'Access URL copied to clipboard');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Manage Access - {menu.name}</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
              >
                <Users className="h-4 w-4 mr-2" />
                Import from CRM
              </Button>
            </div>
          </DialogHeader>

          {selectedCustomer ? (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
                className="mb-4"
              >
                ← Back to List
              </Button>
              <CustomerActivityTimeline
                whitelistId={selectedCustomer.id}
                customerName={String(selectedCustomer.customer_name || '')}
              />
            </div>
          ) : (
            <Tabs defaultValue="whitelist" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="whitelist">
                  Whitelisted ({activeCustomers.length})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending ({pendingCustomers.length})
                </TabsTrigger>
                <TabsTrigger value="blocked">
                  Blocked ({blockedCustomers.length})
                </TabsTrigger>
              </TabsList>

          <TabsContent value="whitelist" className="space-y-4">
            {/* Add Customer Form */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Invite New Customer</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="555-1234"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="customer@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={handleAddCustomer}
                disabled={!customerName || !customerPhone || manageWhitelist.isPending}
              >
                {manageWhitelist.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                Invite Customer
              </Button>
            </div>

            {/* Active Customers List */}
            <div className="space-y-2">
              {activeCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active customers yet
                </div>
              ) : (
                activeCustomers.map(customer => (
                  <div key={customer.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold">{customer.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {customer.customer_phone}
                          {customer.customer_email && ` • ${customer.customer_email}`}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-green-500/10">
                        Active
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-muted-foreground">Views:</span> {customer.view_count}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last access:</span>{' '}
                        {customer.last_access_at 
                          ? format(new Date(customer.last_access_at), 'MMM dd, HH:mm')
                          : 'Never'}
                      </div>
                    </div>

                    <div className="bg-muted p-2 rounded text-xs mb-3">
                      <code className="break-all">
                        /m/{menu.encrypted_url_token}?u={String(customer.unique_access_token || '')}
                      </code>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedCustomer(customer)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Activity
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyAccessUrl(customer.unique_access_token)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy URL
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSendLinkCustomer(customer)}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Send Link
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRegenerateToken(customer.id)}
                        disabled={manageWhitelist.isPending}
                      >
                        {manageWhitelist.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Regenerate
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRevoke(customer.id)}
                        disabled={manageWhitelist.isPending}
                      >
                        {manageWhitelist.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Ban className="h-3 w-3 mr-1" />
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="pending">
            <div className="space-y-2">
              {pendingCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending invites
                </div>
              ) : (
                pendingCustomers.map(customer => (
                  <div key={customer.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold">{customer.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {customer.customer_phone}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Invited: {format(new Date(customer.invited_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-yellow-500/10">
                        Pending
                      </Badge>
                    </div>
                    
                    <div className="bg-muted p-2 rounded text-xs mb-3">
                      <code className="break-all">
                        /m/{menu.encrypted_url_token}?u={String(customer.unique_access_token || '')}
                      </code>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyAccessUrl(customer.unique_access_token)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Invite URL
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRevoke(customer.id)}
                        disabled={manageWhitelist.isPending}
                      >
                        {manageWhitelist.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Ban className="h-3 w-3 mr-1" />
                        Cancel Invite
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="blocked">
            <div className="space-y-2">
              {blockedCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No blocked customers
                </div>
              ) : (
                blockedCustomers.map(customer => (
                  <div key={customer.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{customer.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {customer.customer_phone}
                        </div>
                        {customer.revoked_reason && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Reason: {customer.revoked_reason}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="bg-red-500/10">
                        {customer.status === 'blocked' ? 'Blocked' : 'Revoked'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <ImportCustomersDialog
        menuId={menu.id}
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={() => {
          refetch();
          setImportDialogOpen(false);
        }}
      />

      {sendLinkCustomer && (
        <SendAccessLinkDialog
          open={!!sendLinkCustomer}
          onClose={() => setSendLinkCustomer(null)}
          whitelistEntry={sendLinkCustomer as unknown as React.ComponentProps<typeof SendAccessLinkDialog>['whitelistEntry']}
          menuTitle={menu.name}
        />
      )}
    </>
  );
};
