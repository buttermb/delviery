import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, ExternalLink, MessageCircle, Mail, QrCode, Download, Loader2, CheckCircle2, Users, DollarSign } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { formatMenuUrl } from '@/utils/menuHelpers';
import { generateQRCodeDataURL, downloadQRCodePNG } from '@/lib/utils/qrCode';
import { useWholesaleClients } from '@/hooks/useWholesaleData';
import { useMenuWhitelist } from '@/hooks/useDisposableMenus';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface MenuShareDialogEnhancedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu: any;
  whitelistEntry?: any;
}

export const MenuShareDialogEnhanced = ({
  open,
  onOpenChange,
  menu,
  whitelistEntry
}: MenuShareDialogEnhancedProps) => {
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSms, setSendingSms] = useState(false);
  const [activeTab, setActiveTab] = useState('link');

  const { data: customers } = useWholesaleClients();
  const { data: whitelist } = useMenuWhitelist(menu?.id);

  const menuUrl = formatMenuUrl(
    menu?.encrypted_url_token,
    whitelistEntry?.unique_access_token
  );

  const accessCode = menu?.access_code || 'N/A';

  // Generate QR code when dialog opens
  useEffect(() => {
    if (open && menuUrl) {
      setQrLoading(true);
      generateQRCodeDataURL(menuUrl, { size: 256 })
        .then(setQrCodeDataUrl)
        .catch((error) => {
          logger.error('Failed to generate QR code', error, { component: 'MenuShareDialogEnhanced' });
          showErrorToast('QR Code Error', 'Failed to generate QR code');
        })
        .finally(() => setQrLoading(false));
    }
  }, [open, menuUrl]);

  // Auto-populate SMS message
  useEffect(() => {
    if (activeTab === 'sms' && !smsMessage) {
      const defaultMessage = `Hi! You've been granted access to our wholesale catalog.

Access URL: ${menuUrl}
Access Code: ${accessCode}

This link is confidential and expires ${menu?.expiration_date ? `on ${new Date(menu.expiration_date).toLocaleDateString()}` : 'after use'}.`;
      setSmsMessage(defaultMessage);
    }
  }, [activeTab, menuUrl, accessCode, menu?.expiration_date, smsMessage]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showSuccessToast(`${label} Copied`, 'Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = async () => {
    if (!menuUrl) return;
    try {
      await downloadQRCodePNG(menuUrl, `menu-qr-${menu?.id || 'code'}.png`, { size: 512 });
      showSuccessToast('QR Code Downloaded', 'QR code saved to your downloads');
    } catch (error) {
      showErrorToast('Download Failed', 'Failed to download QR code');
    }
  };

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const toggleSelectAll = () => {
    if (!customers) return;
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map((c: any) => c.id));
    }
  };

  const calculateSMSCost = () => {
    // Estimate: $0.01 per SMS (adjust based on your provider)
    return selectedCustomers.length * 0.01;
  };

  const handleSendSMS = async () => {
    if (selectedCustomers.length === 0) {
      showErrorToast('No Customers Selected', 'Please select at least one customer');
      return;
    }

    if (!smsMessage.trim()) {
      showErrorToast('Message Required', 'Please enter a message to send');
      return;
    }

    setSendingSms(true);
    try {
      // TODO: Integrate with SMS provider (Twilio, Plivo, Novu, etc.)
      // For now, show a placeholder
      const selectedCustomersData = customers?.filter((c: any) =>
        selectedCustomers.includes(c.id)
      );

      // Simulate SMS sending
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In production, call your SMS service here
      // Example:
      // const { data, error } = await supabase.functions.invoke('send-sms', {
      //   body: {
      //     customers: selectedCustomersData,
      //     message: smsMessage,
      //     menu_url: menuUrl,
      //     access_code: accessCode,
      //   }
      // });

      showSuccessToast(
        'SMS Sent',
        `SMS sent to ${selectedCustomers.length} customer${selectedCustomers.length > 1 ? 's' : ''}`
      );
      setSelectedCustomers([]);
    } catch (error: any) {
      showErrorToast('SMS Failed', error.message || 'Failed to send SMS');
    } finally {
      setSendingSms(false);
    }
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Hi ${whitelistEntry?.customer_name || 'there'}!\n\n` +
      `You've been granted access to our wholesale catalog.\n\n` +
      `Access URL: ${menuUrl}\n` +
      `Access Code: ${accessCode}\n\n` +
      `This link is confidential and expires ${menu?.expiration_date ? `on ${new Date(menu.expiration_date).toLocaleDateString()}` : 'after use'}.`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Access to ${menu?.name}`);
    const body = encodeURIComponent(
      `Hi ${whitelistEntry?.customer_name || 'there'},\n\n` +
      `You've been granted access to our wholesale catalog.\n\n` +
      `Access URL: ${menuUrl}\n` +
      `Access Code: ${accessCode}\n\n` +
      `Important: This link is confidential and expires ${menu?.expiration_date ? `on ${new Date(menu.expiration_date).toLocaleDateString()}` : 'after use'}.\n\n` +
      `Best regards`
    );
    window.open(`mailto:${whitelistEntry?.customer_email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Menu Access</DialogTitle>
          <DialogDescription>
            Share this encrypted menu via link, QR code, or SMS
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">Link & QR</TabsTrigger>
            <TabsTrigger value="sms">SMS Blast</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
          </TabsList>

          {/* Link & QR Tab */}
          <TabsContent value="link" className="space-y-6 mt-4">
            {/* Menu URL */}
            <div className="space-y-2">
              <Label>Access URL</Label>
              <div className="flex gap-2">
                <Input
                  value={menuUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(menuUrl, 'URL')}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(menuUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Access Code */}
            <div className="space-y-2">
              <Label>Access Code</Label>
              <div className="flex gap-2">
                <Input
                  value={accessCode}
                  readOnly
                  className="font-mono text-2xl text-center tracking-widest font-bold"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(accessCode, 'Code')}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* QR Code */}
            <div className="space-y-2">
              <Label>QR Code</Label>
              <div className="flex flex-col items-center gap-4 p-6 bg-muted rounded-lg">
                {qrLoading ? (
                  <Loader2 className="h-32 w-32 animate-spin text-muted-foreground" />
                ) : qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Menu QR Code"
                    className="w-64 h-64 border rounded"
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-muted-foreground">
                    Failed to generate QR code
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDownloadQR}
                    disabled={!qrCodeDataUrl}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Share */}
            <div className="space-y-2">
              <Label>Quick Share</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={handleWhatsApp}
                  className="w-full"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={handleEmail}
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>

            {/* Security Info */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={menu?.status === 'active' ? 'default' : 'destructive'}>
                  {menu?.status}
                </Badge>
              </div>
              {menu?.expiration_date && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expires:</span>
                  <span className="font-medium">
                    {new Date(menu.expiration_date).toLocaleDateString()}
                  </span>
                </div>
              )}
              {menu?.security_settings?.max_views && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">View Limit:</span>
                  <span className="font-medium">
                    {menu.security_settings.max_views} views
                  </span>
                </div>
              )}
            </div>
          </TabsContent>

          {/* SMS Blast Tab */}
          <TabsContent value="sms" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Select Customers</Label>
              <div className="border rounded-lg max-h-48 overflow-y-auto p-2">
                {customers && customers.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between p-2 border-b">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSelectAll}
                      >
                        {selectedCustomers.length === customers.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      <Badge variant="secondary">
                        {selectedCustomers.length} selected
                      </Badge>
                    </div>
                    <div className="space-y-1 mt-2">
                      {customers.map((customer: any) => (
                        <div
                          key={customer.id}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted',
                            selectedCustomers.includes(customer.id) && 'bg-primary/10'
                          )}
                          onClick={() => toggleCustomer(customer.id)}
                        >
                          <Checkbox
                            checked={selectedCustomers.includes(customer.id)}
                            onCheckedChange={() => toggleCustomer(customer.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {customer.business_name || customer.contact_name}
                            </div>
                            {customer.phone && (
                              <div className="text-xs text-muted-foreground">
                                {customer.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No customers available
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Custom Message</Label>
              <Textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Enter your message..."
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                The access URL and code will be automatically appended to your message.
              </p>
            </div>

            {selectedCustomers.length > 0 && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated Cost:</span>
                  <span className="font-medium flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {calculateSMSCost().toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recipients:</span>
                  <Badge variant="secondary">
                    <Users className="h-3 w-3 mr-1" />
                    {selectedCustomers.length}
                  </Badge>
                </div>
              </div>
            )}

            <Button
              onClick={handleSendSMS}
              disabled={selectedCustomers.length === 0 || sendingSms || !smsMessage.trim()}
              className="w-full"
            >
              {sendingSms ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Send SMS to {selectedCustomers.length} Customer{selectedCustomers.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg text-sm">
              <p className="text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> SMS functionality requires integration with a provider (Twilio, Plivo, etc.).
                This is a placeholder implementation.
              </p>
            </div>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Menu Access List</Label>
              <div className="border rounded-lg">
                {whitelist && whitelist.length > 0 ? (
                  <div className="divide-y">
                    {whitelist.map((entry: any) => (
                      <div key={entry.id} className="p-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {entry.customer_name || entry.customer?.business_name || 'Unknown Customer'}
                          </div>
                          {entry.customer_phone && (
                            <div className="text-sm text-muted-foreground">
                              {entry.customer_phone}
                            </div>
                          )}
                          {entry.invited_at && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Invited: {new Date(entry.invited_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <Badge variant={entry.status === 'active' ? 'default' : 'secondary'}>
                          {entry.status || 'active'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No customers have access yet
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

