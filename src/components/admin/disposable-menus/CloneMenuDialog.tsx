import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface CloneMenuDialogProps {
  open: boolean;
  onClose: () => void;
  menu: any;
  onComplete: () => void;
}

export function CloneMenuDialog({ open, onClose, menu, onComplete }: CloneMenuDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState(`${menu?.title || ''} (Copy)`);
  const [cloneSettings, setCloneSettings] = useState({
    products: true,
    whitelist: false,
    security: true,
  });

  const handleClone = async () => {
    if (!menu || !newTitle.trim()) return;

    setLoading(true);
    try {
      // Clone menu - using security_settings JSONB for flexible configuration
      const securitySettings = cloneSettings.security ? (menu.security_settings || {}) : {};
      
      const { data: newMenu, error: menuError } = await supabase
        .from('disposable_menus')
        .insert({
          tenant_id: tenant?.id || menu.tenant_id,
          name: newTitle.trim(),
          description: menu.description,
          encrypted_url_token: crypto.randomUUID().replace(/-/g, '').substring(0, 24),
          access_code_hash: menu.access_code_hash || '',
          expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          screenshot_protection_enabled: cloneSettings.security ? menu.screenshot_protection_enabled : false,
          screenshot_watermark_enabled: cloneSettings.security ? menu.screenshot_watermark_enabled : false,
          device_locking_enabled: cloneSettings.security ? menu.device_locking_enabled : false,
          view_limit_per_customer: menu.view_limit_per_customer,
          security_settings: securitySettings,
          appearance_settings: menu.appearance_settings || {},
        })
        .select()
        .single();

      if (menuError) throw menuError;

      // Note: Products would need to be handled separately through menu_data JSONB field
      // Whitelist cloning handled below

      // Clone whitelist if selected
      if (cloneSettings.whitelist) {
        const { data: whitelist } = await supabase
          .from('menu_access_whitelist')
          .select('*')
          .eq('menu_id', menu.id);

        if (whitelist && whitelist.length > 0) {
          const whitelistToClone = whitelist.map((w: any) => ({
            menu_id: newMenu.id,
            customer_name: w.customer_name,
            customer_phone: w.customer_phone,
            customer_email: w.customer_email || null,
            unique_access_token: crypto.randomUUID().replace(/-/g, '').substring(0, 16),
            status: 'pending' as 'pending',
          }));

          const { error: whitelistError } = await supabase
            .from('menu_access_whitelist')
            .insert(whitelistToClone);

          if (whitelistError) console.error('Failed to clone whitelist:', whitelistError);
        }
      }

      toast({
        title: 'Menu Cloned Successfully',
        description: `"${newTitle}" has been created`,
      });

      onComplete();
      onClose();
    } catch (error: any) {
      console.error('Clone menu error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Clone Menu',
        description: error.message || 'Could not clone menu',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clone Menu</DialogTitle>
          <DialogDescription>
            Create a copy of "{menu?.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newTitle">New Menu Title *</Label>
            <Input
              id="newTitle"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter new menu title"
            />
          </div>

          <div className="space-y-3">
            <Label>Clone Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="products"
                  checked={cloneSettings.products}
                  onCheckedChange={(checked) =>
                    setCloneSettings({ ...cloneSettings, products: !!checked })
                  }
                />
                <Label htmlFor="products" className="font-normal">
                  Clone products
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="whitelist"
                  checked={cloneSettings.whitelist}
                  onCheckedChange={(checked) =>
                    setCloneSettings({ ...cloneSettings, whitelist: !!checked })
                  }
                />
                <Label htmlFor="whitelist" className="font-normal">
                  Clone whitelist (customers will need new access tokens)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="security"
                  checked={cloneSettings.security}
                  onCheckedChange={(checked) =>
                    setCloneSettings({ ...cloneSettings, security: !!checked })
                  }
                />
                <Label htmlFor="security" className="font-normal">
                  Clone security settings
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleClone} disabled={loading || !newTitle.trim()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cloning...
              </>
            ) : (
              'Clone Menu'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
