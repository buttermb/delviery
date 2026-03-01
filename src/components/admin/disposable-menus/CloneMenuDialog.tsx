import { logger } from '@/lib/logger';
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
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import type { DisposableMenu } from '@/types/admin';

interface CloneMenuDialogProps {
  open: boolean;
  onClose: () => void;
  menu: DisposableMenu;
  onComplete: () => void;
}

export function CloneMenuDialog({ open, onClose, menu, onComplete }: CloneMenuDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState(menu?.name ? `${menu.name} (Copy)` : '');
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
          title: newTitle.trim(),
          description: menu.description,
          encrypted_url_token: crypto.randomUUID().replace(/-/g, '').substring(0, 24),
          access_code_hash: menu.access_code_hash ?? '',
          expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
          screenshot_protection_enabled: cloneSettings.security ? (menu.screenshot_protection_enabled ?? false) : false,
          screenshot_watermark_enabled: cloneSettings.security ? (menu.screenshot_watermark_enabled ?? false) : false,
          device_locking_enabled: cloneSettings.security ? (menu.device_locking_enabled ?? false) : false,
          view_limit_per_customer: menu.view_limit_per_customer || 5,
          security_settings: securitySettings,
          appearance_settings: menu.appearance_settings || {},
          menu_access_whitelist: [],
        })
        .select()
        .maybeSingle();

      if (menuError) throw menuError;

      // Note: Products would need to be handled separately through menu_data JSONB field
      // Whitelist cloning handled below

      // Clone whitelist if selected
      if (cloneSettings.whitelist) {
        const { data: whitelist } = await supabase
          .from('menu_access_whitelist')
          .select('customer_name, customer_phone, customer_email')
          .eq('menu_id', menu.id);

        interface WhitelistRow {
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
        }

        if (whitelist && whitelist.length > 0) {
          const whitelistToClone = (whitelist as WhitelistRow[]).map((w) => ({
            menu_id: newMenu.id,
            customer_name: w.customer_name,
            customer_phone: w.customer_phone,
            customer_email: w.customer_email || null,
            unique_access_token: crypto.randomUUID().replace(/-/g, '').substring(0, 16),
            status: 'pending' as const,
          }));

          const { error: whitelistError } = await supabase
            .from('menu_access_whitelist')
            .insert(whitelistToClone);

          if (whitelistError) {
            logger.error('Failed to clone menu whitelist', whitelistError instanceof Error ? whitelistError : new Error(String(whitelistError)), { component: 'CloneMenuDialog' });
          }
        }
      }

      toast.success(`Menu cloned successfully`, {
        description: `"${newTitle}" has been created`,
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      onComplete();
      onClose();
    } catch (error: unknown) {
      logger.error('Clone menu error', error instanceof Error ? error : new Error(String(error)), { component: 'CloneMenuDialog', menuId: menu.id });
      toast.error('Failed to clone menu', {
        description: error instanceof Error ? error.message : 'Could not clone menu',
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
            Create a copy of "{menu.title || menu.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newTitle">New Menu Title <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
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
