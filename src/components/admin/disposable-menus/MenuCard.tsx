import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Users, ShoppingCart, Flame, Settings, BarChart3, Copy, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { BurnMenuDialog } from './BurnMenuDialog';
import { ManageAccessDialog } from './ManageAccessDialog';
import { format } from 'date-fns';
import { showSuccessToast } from '@/utils/toastHelpers';

interface MenuCardProps {
  menu: any;
}

export const MenuCard = ({ menu }: MenuCardProps) => {
  const [burnDialogOpen, setBurnDialogOpen] = useState(false);
  const [manageAccessOpen, setManageAccessOpen] = useState(false);

  const viewCount = menu.menu_access_logs?.[0]?.count || 0;
  const customerCount = menu.menu_access_whitelist?.[0]?.count || 0;
  const orderCount = menu.menu_orders?.[0]?.count || 0;
  
  const totalRevenue = menu.menu_orders?.reduce((sum: number, order: any) => {
    return sum + parseFloat(order.total_amount || 0);
  }, 0) || 0;

  const statusColors = {
    active: 'bg-green-500',
    soft_burned: 'bg-yellow-500',
    hard_burned: 'bg-red-500'
  };

  const statusLabels = {
    active: 'Active',
    soft_burned: 'Soft Burned',
    hard_burned: 'Hard Burned'
  };

  const copyUrl = () => {
    const url = `${window.location.origin}/m/${menu.encrypted_url_token}`;
    navigator.clipboard.writeText(url);
    showSuccessToast('URL Copied', 'Menu URL copied to clipboard');
  };

  const openMenu = () => {
    window.open(`/m/${menu.encrypted_url_token}`, '_blank');
  };

  return (
    <>
      <Card className="p-6 hover:shadow-lg transition-shadow">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-bold">{menu.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {menu.description || 'No description'}
              </p>
            </div>
            <Badge className={statusColors[menu.status as keyof typeof statusColors]}>
              {statusLabels[menu.status as keyof typeof statusLabels]}
            </Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span>{viewCount} views</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{customerCount} customers</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span>{orderCount} orders</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              ${totalRevenue.toLocaleString()}
            </div>
          </div>

          {/* URL */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Encrypted URL</div>
            <div className="flex items-center gap-2">
              <code className="text-xs flex-1 truncate">
                /m/{menu.encrypted_url_token}
              </code>
              <Button size="sm" variant="ghost" onClick={copyUrl}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={openMenu}>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Metadata */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Created: {format(new Date(menu.created_at), 'MMM dd, yyyy')}</div>
            {menu.burned_at && (
              <div>Burned: {format(new Date(menu.burned_at), 'MMM dd, yyyy')}</div>
            )}
            {menu.expiration_date && !menu.never_expires && (
              <div>Expires: {format(new Date(menu.expiration_date), 'MMM dd, yyyy')}</div>
            )}
          </div>

          {/* Actions */}
          {menu.status === 'active' && (
            <div className="flex gap-2 pt-2 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => setManageAccessOpen(true)}
              >
                <Settings className="h-4 w-4 mr-1" />
                Manage
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => window.location.href = `/admin/menu-analytics/${menu.id}`}
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Analytics
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setBurnDialogOpen(true)}
              >
                <Flame className="h-4 w-4 mr-1" />
                Burn
              </Button>
            </div>
          )}
        </div>
      </Card>

      <BurnMenuDialog 
        menu={menu}
        open={burnDialogOpen}
        onOpenChange={setBurnDialogOpen}
      />
      
      <ManageAccessDialog
        menu={menu}
        open={manageAccessOpen}
        onOpenChange={setManageAccessOpen}
      />
    </>
  );
};
