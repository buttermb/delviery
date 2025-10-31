import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, UserPlus, Copy, RotateCw, XCircle, Eye, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { useManageWhitelist } from '@/hooks/useDisposableMenus';
import { formatMenuUrl } from '@/utils/menuHelpers';

interface MenuWhitelistTabProps {
  menuId: string;
  menu: any;
  whitelist: any[];
  isLoading: boolean;
  encryptedToken: string;
}

export const MenuWhitelistTab = ({ 
  menuId,
  menu,
  whitelist, 
  isLoading,
  encryptedToken 
}: MenuWhitelistTabProps) => {
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });
  const [addingCustomer, setAddingCustomer] = useState(false);

  const manageWhitelist = useManageWhitelist();

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      showErrorToast('Missing Information', 'Name and phone are required');
      return;
    }

    setAddingCustomer(true);
    try {
      await manageWhitelist.mutateAsync({
        menu_id: menuId,
        action: 'add',
        customer_data: newCustomer
      });
      
      setNewCustomer({ name: '', phone: '', email: '', notes: '' });
    } catch (error) {
      // Error handled by mutation
    } finally {
      setAddingCustomer(false);
    }
  };

  const handleRevoke = async (whitelistId: string) => {
    if (!confirm('Are you sure you want to revoke access for this customer?')) return;

    try {
      await manageWhitelist.mutateAsync({
        menu_id: menuId,
        action: 'revoke',
        whitelist_id: whitelistId
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleRegenerateToken = async (whitelistId: string) => {
    if (!confirm('Regenerate access token? The old link will stop working.')) return;

    try {
      await manageWhitelist.mutateAsync({
        menu_id: menuId,
        action: 'regenerate_token',
        whitelist_id: whitelistId
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const copyAccessUrl = (uniqueToken: string) => {
    const url = formatMenuUrl(encryptedToken, uniqueToken);
    navigator.clipboard.writeText(url);
    showSuccessToast('URL Copied', 'Access URL copied to clipboard');
  };

  const shareViaWhatsApp = (entry: any) => {
    const url = formatMenuUrl(encryptedToken, entry.unique_access_token);
    const accessCode = menu?.access_code || 'N/A';
    const message = encodeURIComponent(
      `Hi ${entry.customer_name}! 🔐\n\n` +
      `You've been granted access to our private catalog.\n\n` +
      `Access URL: ${url}\n` +
      `Access Code: ${accessCode}\n\n` +
      `⚠️ IMPORTANT:\n` +
      `• Do not share this link\n` +
      `• Location verification required\n\n` +
      `Thank you!`
    );
    window.open(`https://wa.me/${entry.customer_phone.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading whitelist...</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Customer Form */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Add Customer</h3>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Customer Name *</Label>
            <Input
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone Number *</Label>
            <Input
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              placeholder="+1234567890"
            />
          </div>
          <div className="space-y-2">
            <Label>Email (Optional)</Label>
            <Input
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Input
              value={newCustomer.notes}
              onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
              placeholder="VIP customer"
            />
          </div>
        </div>

        <Button 
          className="mt-4"
          onClick={handleAddCustomer}
          disabled={addingCustomer || !newCustomer.name || !newCustomer.phone}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {addingCustomer ? 'Adding...' : 'Add to Whitelist'}
        </Button>
      </Card>

      {/* Whitelist Entries */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Whitelisted Customers ({whitelist.length})
        </h3>
        
        {whitelist.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No customers whitelisted yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add customers above to grant them access
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {whitelist.map((entry) => (
              <Card key={entry.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="font-semibold mb-1">{entry.customer_name}</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>{entry.customer_phone}</div>
                      {entry.customer_email && <div>{entry.customer_email}</div>}
                    </div>
                  </div>
                  <Badge variant={entry.status === 'active' ? 'default' : 'outline'}>
                    {entry.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                  <div>
                    <span className="font-medium">Views:</span> {entry.view_count || 0}
                  </div>
                  <div>
                    <span className="font-medium">Invited:</span> {format(new Date(entry.invited_at), 'MMM dd')}
                  </div>
                  {entry.first_access_at && (
                    <div>
                      <span className="font-medium">First Access:</span> {format(new Date(entry.first_access_at), 'MMM dd')}
                    </div>
                  )}
                  {entry.last_access_at && (
                    <div>
                      <span className="font-medium">Last Access:</span> {format(new Date(entry.last_access_at), 'MMM dd')}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyAccessUrl(entry.unique_access_token)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy URL
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => shareViaWhatsApp(entry)}
                  >
                    <MessageCircle className="h-3 w-3 mr-1" />
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRegenerateToken(entry.id)}
                  >
                    <RotateCw className="h-3 w-3 mr-1" />
                    Regenerate
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRevoke(entry.id)}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Revoke
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
